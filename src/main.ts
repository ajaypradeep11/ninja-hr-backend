import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './platform/database/prisma-exception.filter';

async function bootstrap() {
  // Raise the JSON body limit so base64-encoded résumé uploads (careers page)
  // aren't rejected by the default ~100kb express limit.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const { json, urlencoded } = await import('express');
  app.use(json({ limit: '8mb' }));
  app.use(urlencoded({ extended: true, limit: '8mb' }));
  app.setGlobalPrefix('api/v1');
  // InternalKeyGuard is registered as the first APP_GUARD in AppModule (see
  // its providers array for why the order matters) — no need to add it again
  // via app.useGlobalGuards() here.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
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
