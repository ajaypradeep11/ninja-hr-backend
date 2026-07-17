import 'dotenv/config';
import './platform/database/resolve-db-env'; // rewrites DATABASE_URL from DB_LIVE — must precede PrismaService
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './platform/database/prisma-exception.filter';
import { TenantContext } from './platform/database/tenant-context';
import { validInternalKeys } from './platform/auth/internal-key.guard';

/**
 * Fail closed on dangerous production configuration. The internal-key lane is a
 * full-trust bypass (it can impersonate any user), and Firebase is the only
 * end-user authentication — so a weak/default key or disabled auth in
 * production would be a complete authentication bypass. Refuse to boot.
 */
function assertProductionConfig(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const errors: string[] = [];
  // INTERNAL_API_KEY may be a comma-separated rotation list — EVERY entry must
  // be strong, since any one of them grants the full-trust lane.
  const keys = validInternalKeys();
  if (keys.length === 0 || keys.some((k) => k.length < 24)) {
    errors.push('INTERNAL_API_KEY must be set and every listed key at least 24 characters in production');
  }
  if (keys.includes('dev-internal-key')) {
    errors.push('INTERNAL_API_KEY still contains the development default');
  }
  if (process.env.FIREBASE_AUTH_DISABLED === '1') {
    errors.push('FIREBASE_AUTH_DISABLED=1 disables all end-user authentication and must not be set in production');
  }
  if (errors.length) {
    throw new Error(`Insecure production configuration:\n- ${errors.join('\n- ')}`);
  }
}

async function bootstrap() {
  assertProductionConfig();
  // Raise the JSON body limit so base64-encoded résumé uploads (careers page)
  // aren't rejected by the default ~100kb express limit.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const { default: helmet } = await import('helmet');
  const { json, urlencoded } = await import('express');
  // Security headers (nosniff, HSTS, frame-deny, …). CSP is disabled: this is
  // a JSON API that serves no HTML — except Swagger UI in dev, which inline
  // scripts and would break under helmet's default CSP.
  app.use(helmet({ contentSecurityPolicy: false }));
  // `verify` stashes the raw body bytes so InboundWebhookGuard can check an
  // HMAC signature over EXACTLY what the mail provider signed (re-serializing
  // parsed JSON would not round-trip byte-for-byte).
  app.use(
    json({
      limit: '8mb',
      verify: (req, _res, buf) => {
        (req as { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(urlencoded({ extended: true, limit: '8mb' }));

  // Cloud Run fronts the service with one Google proxy hop that appends the
  // real client IP to X-Forwarded-For. Trusting exactly that hop makes req.ip
  // (which the throttler keys on) the client's IP rather than the proxy's,
  // while still ignoring any spoofed XFF entries the client sent itself.
  (app.getHttpAdapter().getInstance() as import('express').Express).set('trust proxy', 1);

  // Open a fresh AsyncLocalStorage tenant store for every request BEFORE the
  // guard chain runs. ActorGuard mutates it (tenant.set) once it resolves the
  // caller's companyId; the Prisma tenant extension then reads it at query time.
  // Registered as a global Express middleware (rather than a Nest middleware
  // with forRoutes('*'), which Express 5 / path-to-regexp v8 rejects) so it
  // wraps the entire downstream pipeline in one continuous async context.
  const tenant = app.get(TenantContext);
  app.use((_req: unknown, _res: unknown, next: () => void) => tenant.run(null, () => next()));

  app.setGlobalPrefix('api/v1');
  // InternalKeyGuard is registered as the first APP_GUARD in AppModule (see
  // its providers array for why the order matters) — no need to add it again
  // via app.useGlobalGuards() here.
  // forbidNonWhitelisted: unknown fields are a 400, not a silent strip —
  // surfaces client bugs and makes probing visible instead of invisible.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new PrismaExceptionFilter());

  // Swagger is served as middleware, which the global guard does not cover —
  // keep the docs (and the full internal API surface) out of production.
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('NinjaHR API')
      .setVersion('1.0')
      .addApiKey({ type: 'apiKey', name: 'x-internal-key', in: 'header' }, 'internal-key')
      .build();
    const doc = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, doc);
  }

  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
