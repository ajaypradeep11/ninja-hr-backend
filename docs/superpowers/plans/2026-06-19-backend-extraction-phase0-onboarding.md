# NinjaHR Backend Extraction — Phase 0 (Foundation) + Phase 1 (Onboarding) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a standalone NestJS DDD/CQRS backend that owns the database, add a root VS Code workspace and linting in both repos, and migrate the **Onboarding** context end-to-end so the Next.js frontend calls it over HTTP instead of using Prisma directly.

**Architecture:** Two git repos (`ninja-hr-frontend`, `ninja-hr-backend`) joined by a root multi-root VS Code workspace. NestJS exposes a versioned REST API under `/api/v1`, documented with Swagger/OpenAPI. The Next.js app calls the backend **server-side only** (Server Components + Server Actions → `fetch`), using a typed client generated from the backend's OpenAPI spec. Each bounded context is a Nest module split into `domain / application / infrastructure / interface` layers; mutations are CQRS Commands, reads are Queries, side effects (audit) are Domain Events.

**Tech Stack:** NestJS 11 + `@nestjs/cqrs` + `@nestjs/swagger`, Prisma 7.8 (`prisma-client` generator + `@prisma/adapter-pg`), Postgres 16 (Docker), Jest + supertest. Frontend: Next.js 15.1.6, React 19, `openapi-typescript` + `openapi-fetch`. Package manager: npm. Node 24.

## Global Constraints

- **Package manager:** npm (both repos; matches the frontend's `package-lock.json`). Do not introduce pnpm/yarn.
- **Node:** v24.x (`node -v` → v24.13.1). **npm:** 11.x.
- **Backend port:** `4000`. **Frontend port:** `3000` (Next default). **Postgres:** host `localhost:5433`, db `testhr`, user/pass `postgres/postgres` (existing `docker-compose.yml`).
- **Database is shared with existing data** — the Docker volume `testhr-pgdata` already holds seeded rows. Migrations must be **moved, not regenerated**; never reset the volume during migration tasks.
- **DTO contracts are frozen:** the JSON shapes the backend returns must match the existing frontend DTOs in `lib/data.ts` / `lib/onboarding.ts` exactly (display strings like `"IT / Ops"`, `"Needs Verification"`, ISO dates sliced to `YYYY-MM-DD`), so frontend views are unchanged.
- **Server-side only:** the browser never calls the backend. All `fetch` to the backend happens in Server Components or Server Actions and carries headers `x-internal-key: $INTERNAL_API_KEY` and `x-actor-persona: admin|employee`.
- **No real auth** in this plan. The internal-key guard is the only gate; personas stay hardcoded.
- **Prisma generator** mirrors the frontend: `provider = "prisma-client"`, output to `src/platform/database/generated/prisma`, client constructed with `PrismaPg` adapter. The generated dir is gitignored.
- **Commits:** every task ends with a commit in the repo it touched. Conventional Commit prefixes (`feat:`, `chore:`, `test:`, `refactor:`).

---

## File Structure

**`ninja-hr-backend/`** (new)
```
package.json, tsconfig.json, tsconfig.build.json, nest-cli.json, .eslintrc / eslint.config.mjs, .prettierrc, .env, .env.example, .gitignore
docker-compose.yml                         (moved from frontend)
prisma/schema.prisma, prisma/migrations/   (moved from frontend)
prisma/seed.ts, prisma/seed-fn.ts          (moved from frontend)
src/
  main.ts                                  (bootstrap, Swagger, global prefix /api/v1)
  app.module.ts
  platform/
    database/prisma.service.ts             (PrismaClient + PrismaPg adapter, lifecycle)
    database/database.module.ts            (global)
    auth/internal-key.guard.ts             (x-internal-key check)
    auth/actor.decorator.ts                (reads x-actor-persona)
    health/health.controller.ts            (GET /health)
  shared-kernel/
    province.ts                            (ProvinceCode + PROVINCES, moved from compliance.ts)
    aggregate-root.ts, domain-event.ts     (CQRS base classes)
  contexts/onboarding/
    domain/
      onboarding-case.aggregate.ts         (status machine, gates, methods)
      onboarding.types.ts                  (CaseStatus, ChecklistTask, etc.)
      checklist.service.ts                 (generateChecklist, mandatoryPolicies)
      submitted-documents.service.ts       (generateSubmittedDocuments)
      events/                              (OnboardingFinalizedEvent, CaseActivatedEvent, ...)
    application/
      queries/                             (list-cases, get-pipeline + handlers)
      commands/                            (create-case, mark-form, ... + handlers)
      events/                              (audit event handlers)
    infrastructure/
      onboarding.mapper.ts                 (enum maps + row→DTO, moved from db-map.ts/onboarding.ts toApp)
      onboarding.repository.ts             (Prisma reads/writes)
    interface/
      onboarding.controller.ts
      dto/                                 (request/response DTOs, Swagger-decorated)
    onboarding.module.ts
test/onboarding.e2e-spec.ts
```

**`ninja-hr-frontend/`** (modified)
```
package.json            (drop prisma/pg/server-only; add openapi-typescript, openapi-fetch, api:generate script)
eslint.config.mjs, .prettierrc   (new)
lib/api/
  client.ts             (openapi-fetch client + internal headers)
  generated/openapi.d.ts (generated from backend spec; gitignored)
lib/queries.ts          (onboarding reads rewritten to HTTP; others unchanged for now)
app/actions/onboarding.ts (rewritten to HTTP)
DELETED after Phase 1: lib/db.ts, prisma/, prisma.config.ts, docker-compose.yml, .env.docker db usage  (only once ALL contexts migrate — NOT in this plan; see Phase 2+)
```

**Root**
```
ninja-hr.code-workspace  (new)
```

---

# PHASE 0 — FOUNDATION

### Task 0.1: Root VS Code workspace file

**Files:**
- Create: `/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr.code-workspace`

**Interfaces:**
- Produces: a multi-root workspace opening both repos with shared format-on-save + recommended extensions.

- [ ] **Step 1: Create the workspace file**

```jsonc
// ninja-hr.code-workspace
{
  "folders": [
    { "name": "frontend", "path": "ninja-hr-frontend" },
    { "name": "backend", "path": "ninja-hr-backend" }
  ],
  "settings": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" },
    "typescript.tsdk": "frontend/node_modules/typescript/lib",
    "files.exclude": { "**/node_modules": true, "**/.next": true, "**/dist": true }
  },
  "extensions": {
    "recommendations": ["esbenp.prettier-vscode", "dbaeumer.vscode-eslint", "prisma.prisma"]
  },
  "tasks": {
    "version": "2.0.0",
    "tasks": [
      { "label": "dev:backend", "type": "shell", "command": "npm run start:dev", "options": { "cwd": "${workspaceFolder:backend}" }, "isBackground": true },
      { "label": "dev:frontend", "type": "shell", "command": "npm run dev", "options": { "cwd": "${workspaceFolder:frontend}" }, "isBackground": true },
      { "label": "dev:all", "dependsOn": ["dev:backend", "dev:frontend"], "problemMatcher": [] }
    ]
  }
}
```

- [ ] **Step 2: Verify it is valid JSON**

Run: `cd "/Users/ajaypradeepm/Work/NinjaHR project" && node -e "require('jsonc-parser')" 2>/dev/null; python3 -c "import json,re,sys; s=open('ninja-hr.code-workspace').read(); s=re.sub(r'//.*','',s); json.loads(s); print('valid')"`
Expected: `valid`

- [ ] **Step 3: Commit (in backend repo — root is not a git repo; track workspace file there via a relative copy is not possible). Instead commit a note in backend.**

The root is not a git repository, so the `.code-workspace` file cannot be committed. Leave it untracked at the root. No commit for this task. (Document this in the backend README in Task 0.2.)

---

### Task 0.2: NestJS backend scaffold + linting

**Files:**
- Create: `ninja-hr-backend/package.json`, `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, `eslint.config.mjs`, `.prettierrc`, `.gitignore`, `README.md`
- Create: `ninja-hr-backend/src/main.ts`, `src/app.module.ts`
- Create: `ninja-hr-backend/src/platform/health/health.controller.ts`

**Interfaces:**
- Produces: a runnable Nest app on port 4000 with `GET /api/v1/health` → `{ status: "ok" }`; `npm run lint`, `npm run build`, `npm run test`, `npm run start:dev` scripts.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "ninja-hr-backend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\" --fix",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "test": "jest",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "dotenv -e .env -- prisma migrate deploy",
    "db:up": "docker compose up -d --wait",
    "db:down": "docker compose down",
    "db:seed": "dotenv -e .env -- tsx prisma/seed.ts"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/cqrs": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@nestjs/swagger": "^8.0.0",
    "@prisma/adapter-pg": "^7.8.0",
    "@prisma/client": "^7.8.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "pg": "^8.22.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "@types/express": "^5.0.0",
    "@types/jest": "^29.5.14",
    "@types/node": "^22.10.5",
    "@types/pg": "^8.20.0",
    "@types/supertest": "^6.0.2",
    "dotenv-cli": "^11.0.0",
    "eslint": "^9.18.0",
    "eslint-config-prettier": "^10.0.0",
    "eslint-plugin-prettier": "^5.2.1",
    "jest": "^29.7.0",
    "prettier": "^3.4.2",
    "prisma": "^7.8.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-loader": "^9.5.1",
    "tsconfig-paths": "^4.2.0",
    "tsx": "^4.22.4",
    "typescript": "^5.7.3",
    "typescript-eslint": "^8.20.0"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": { "^.+\\.(t|j)s$": "ts-jest" },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node",
    "moduleNameMapper": { "^src/(.*)$": "<rootDir>/$1" }
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`**

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2022",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "paths": { "src/*": ["src/*"] }
  }
}
```
```jsonc
// tsconfig.build.json
{ "extends": "./tsconfig.json", "exclude": ["node_modules", "test", "dist", "**/*spec.ts"] }
```
```jsonc
// nest-cli.json
{ "$schema": "https://json.schemastore.org/nest-cli", "collection": "@nestjs/schematics", "sourceRoot": "src", "compilerOptions": { "deleteOutDir": true } }
```

- [ ] **Step 3: Create `.gitignore`, `.prettierrc`, `eslint.config.mjs`, `README.md`**

```gitignore
# .gitignore
/node_modules
/dist
/coverage
*.tsbuildinfo
.DS_Store
.env
src/platform/database/generated
```
```json
// .prettierrc
{ "singleQuote": true, "trailingComma": "all", "printWidth": 100 }
```
```js
// eslint.config.mjs
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'src/platform/database/generated'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: { parserOptions: { sourceType: 'module' } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
);
```
```markdown
<!-- README.md -->
# ninja-hr-backend
NestJS (DDD + CQRS) backend for NinjaHR. Owns Postgres via Prisma.
Open the repo pair via `../ninja-hr.code-workspace`.
Dev: `npm i && npm run db:up && npm run prisma:migrate && npm run start:dev` → http://localhost:4000/api/v1/health
```
> Note: `@eslint/js` is pulled in transitively by `typescript-eslint`; add it explicitly if the import fails: `npm i -D @eslint/js`.

- [ ] **Step 4: Create the health controller, app module, and bootstrap**

```ts
// src/platform/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }
}
```
```ts
// src/app.module.ts
import { Module } from '@nestjs/common';
import { HealthController } from './platform/health/health.controller';

@Module({ controllers: [HealthController] })
export class AppModule {}
```
```ts
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('NinjaHR API')
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'x-internal-key', in: 'header' }, 'internal-key')
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, doc);

  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
```

- [ ] **Step 5: Install and verify build + health endpoint**

Run:
```bash
cd "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-backend"
npm install
npm run build
```
Expected: install succeeds; `npm run build` exits 0, produces `dist/`.

- [ ] **Step 6: Smoke-test the server**

Run:
```bash
npm run start:dev & sleep 8; curl -s localhost:4000/api/v1/health; curl -s -o /dev/null -w "%{http_code}\n" localhost:4000/api/docs; kill %1
```
Expected: `{"status":"ok"}` then `200`.

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: exits 0 (no errors).

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: scaffold NestJS backend with health endpoint, swagger, eslint/prettier

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 0.3: Move database ownership to the backend

Moves Prisma schema/migrations/seed, docker-compose, and env to the backend, wires `PrismaService`, and verifies it connects to the **existing** seeded database.

**Files:**
- Move (copy from frontend, then delete from frontend in Task 1.7 — NOT yet): `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts`, `prisma/seed-fn.ts`, `docker-compose.yml`
- Create: `ninja-hr-backend/.env`, `.env.example`, `prisma.config.ts`
- Create: `ninja-hr-backend/src/platform/database/prisma.service.ts`, `database.module.ts`

**Interfaces:**
- Produces: `PrismaService` (global) exposing all Prisma model delegates; `DATABASE_URL` pointing at the existing Docker Postgres.

- [ ] **Step 1: Copy schema, migrations, seed, docker-compose into the backend**

Run:
```bash
cd "/Users/ajaypradeepm/Work/NinjaHR project"
cp -R ninja-hr-frontend/prisma ninja-hr-backend/prisma
cp ninja-hr-frontend/docker-compose.yml ninja-hr-backend/docker-compose.yml
```
> Do NOT delete the frontend copies yet — the frontend still uses Prisma until its contexts migrate. Onboarding's frontend Prisma usage is removed in Task 1.7; full deletion is Phase 2+.

- [ ] **Step 2: Adjust the Prisma generator output path**

Edit `ninja-hr-backend/prisma/schema.prisma` generator block:
```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/platform/database/generated/prisma"
}
```

- [ ] **Step 3: Create env files and `prisma.config.ts`**

```bash
# .env  (gitignored)
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/testhr?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5433/testhr?schema=public"
PORT=4000
INTERNAL_API_KEY="dev-internal-key"
ANTHROPIC_API_KEY=""
```
```bash
# .env.example  (committed)
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/testhr?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5433/testhr?schema=public"
PORT=4000
INTERNAL_API_KEY="dev-internal-key"
ANTHROPIC_API_KEY=""
```
```ts
// prisma.config.ts
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env['DIRECT_URL'] || process.env['DATABASE_URL'] },
});
```

- [ ] **Step 4: Create `PrismaService` and `DatabaseModule`**

```ts
// src/platform/database/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  }
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```
```ts
// src/platform/database/database.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class DatabaseModule {}
```

- [ ] **Step 5: Register `DatabaseModule` and load env in bootstrap**

Add `import 'dotenv/config';` as the FIRST line of `src/main.ts`. Add `DatabaseModule` to `app.module.ts` imports:
```ts
// src/app.module.ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from './platform/database/database.module';
import { HealthController } from './platform/health/health.controller';

@Module({ imports: [DatabaseModule], controllers: [HealthController] })
export class AppModule {}
```
> Note: also `npm i dotenv` (runtime) in the backend: `npm i dotenv`.

- [ ] **Step 6: Generate the Prisma client and verify DB connectivity against existing data**

Run:
```bash
cd "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-backend"
npm run db:up
npm run prisma:generate
npm run prisma:migrate
npx tsx -e "import {PrismaPg} from '@prisma/adapter-pg'; import {PrismaClient} from './src/platform/database/generated/prisma/client'; const p=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})}); import('dotenv/config'); p.onboardingCase.count().then(n=>{console.log('cases:',n);return p.\$disconnect();})"
```
Expected: `prisma migrate deploy` reports "No pending migrations" (migrations already applied to this volume), and `cases:` prints a number ≥ 0 (existing seeded data preserved). If the count command's env isn't loaded, prefix with `dotenv -e .env --`.

- [ ] **Step 7: Build + lint**

Run: `npm run build && npm run lint`
Expected: both exit 0.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: backend owns Prisma schema, migrations, seed, and Postgres connection

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 0.4: Internal-key guard, actor decorator, and frontend OpenAPI codegen wiring

**Files:**
- Create: `ninja-hr-backend/src/platform/auth/internal-key.guard.ts`, `actor.decorator.ts`
- Modify: `ninja-hr-backend/src/main.ts` (apply guard globally)
- Create: `ninja-hr-frontend/lib/api/client.ts`
- Modify: `ninja-hr-frontend/package.json` (add deps + `api:generate` script), `.gitignore`, `.env`/`.env.example`

**Interfaces:**
- Produces (backend): a global `InternalKeyGuard` rejecting requests without `x-internal-key === INTERNAL_API_KEY` (health excluded); `@Actor()` param decorator returning `'admin' | 'employee'`.
- Produces (frontend): `apiClient` (openapi-fetch typed client) with base URL `NINJA_HR_API_URL` and default internal headers; `api:generate` script.

- [ ] **Step 1: Create the guard and a public decorator**

```ts
// src/platform/auth/public.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);
```
```ts
// src/platform/auth/internal-key.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from './public.decorator';

@Injectable()
export class InternalKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    if (req.headers['x-internal-key'] !== process.env.INTERNAL_API_KEY) {
      throw new UnauthorizedException('invalid internal key');
    }
    return true;
  }
}
```
```ts
// src/platform/auth/actor.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type Persona = 'admin' | 'employee';

export const Actor = createParamDecorator((_data: unknown, ctx: ExecutionContext): Persona => {
  const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string> }>();
  return req.headers['x-actor-persona'] === 'employee' ? 'employee' : 'admin';
});
```

- [ ] **Step 2: Apply the guard globally; mark health public**

In `src/main.ts`, after creating `app`:
```ts
import { Reflector } from '@nestjs/core';
import { InternalKeyGuard } from './platform/auth/internal-key.guard';
// ...
app.useGlobalGuards(new InternalKeyGuard(app.get(Reflector)));
```
Add `@Public()` to `HealthController.check` (import from `../auth/public.decorator`).

- [ ] **Step 3: Verify the guard**

Run:
```bash
npm run start:dev & sleep 8
echo "health (public):"; curl -s localhost:4000/api/v1/health
echo "no key -> 401:"; curl -s -o /dev/null -w "%{http_code}\n" localhost:4000/api/v1/onboarding/cases
kill %1
```
Expected: health returns `{"status":"ok"}`; the (not-yet-existing) onboarding route returns `401` (guard runs before routing returns 404 for guarded paths — acceptable; confirms guard active). If it returns `404`, that is also acceptable at this stage since the controller doesn't exist yet — re-verify after Task 1.6.

- [ ] **Step 4: Frontend — add codegen deps, script, env, gitignore**

Run:
```bash
cd "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-frontend"
npm i openapi-fetch
npm i -D openapi-typescript
```
Add to `package.json` scripts:
```json
"api:generate": "openapi-typescript http://localhost:4000/api/docs-json -o lib/api/generated/openapi.d.ts"
```
> `@nestjs/swagger` serves the raw spec at `/api/docs-json`. Confirm the URL by curling it in Step 6.

Append to frontend `.gitignore`:
```
/lib/api/generated
```
Add to frontend `.env` and `.env.example`:
```
NINJA_HR_API_URL="http://localhost:4000/api/v1"
INTERNAL_API_KEY="dev-internal-key"
```

- [ ] **Step 5: Create the typed API client wrapper (server-only)**

```ts
// lib/api/client.ts
import 'server-only';
import createClient from 'openapi-fetch';
import type { paths } from './generated/openapi';

export type Persona = 'admin' | 'employee';

export function apiClient(persona: Persona = 'admin') {
  return createClient<paths>({
    baseUrl: process.env.NINJA_HR_API_URL,
    headers: {
      'x-internal-key': process.env.INTERNAL_API_KEY ?? '',
      'x-actor-persona': persona,
    },
    // Always hit the backend fresh from Server Actions; reads may opt into caching per-call.
    cache: 'no-store',
  });
}
```
> `server-only` is still a frontend dependency until full migration; keep it. The generated `openapi.d.ts` does not exist until Task 1.6 — `client.ts` will not type-check until then. That is expected; it is exercised in Task 1.7.

- [ ] **Step 6: Verify the spec endpoint serves JSON**

Run (backend running):
```bash
curl -s -o /dev/null -w "%{http_code}\n" localhost:4000/api/docs-json
```
Expected: `200`. (If `404`, the correct path is `/api/docs-json` only when Swagger is set up at `api/docs`; adjust the `api:generate` URL to match.)

- [ ] **Step 7: Commit both repos**

```bash
cd "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-backend" && git add -A && git commit -m "feat: internal-key guard, actor decorator, public health route

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
cd "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-frontend" && git add -A && git commit -m "chore: add openapi codegen tooling and server-only api client wrapper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 0.5: Frontend linting (ESLint flat config + Prettier)

The frontend currently has a `next lint` script but **no** ESLint/Prettier config or deps. Add both.

**Files:**
- Create: `ninja-hr-frontend/eslint.config.mjs`, `.prettierrc`
- Modify: `ninja-hr-frontend/package.json` (deps + scripts)

**Interfaces:**
- Produces: `npm run lint` and `npm run format` in the frontend.

- [ ] **Step 1: Install ESLint + Next plugin + Prettier**

Run:
```bash
cd "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-frontend"
npm i -D eslint @eslint/js eslint-config-next eslint-config-prettier prettier typescript-eslint
```

- [ ] **Step 2: Create configs**

```js
// eslint.config.mjs
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import next from 'eslint-config-next';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['.next', 'node_modules', 'lib/generated', 'lib/api/generated'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...next,
  prettier,
);
```
```json
// .prettierrc
{ "singleQuote": false, "trailingComma": "all", "printWidth": 100 }
```
> If `eslint-config-next` does not export a flat-config array in the installed version, replace the `...next` line with the project's documented flat-config import for that version (check `node_modules/eslint-config-next/package.json` exports). The rest of the config is version-independent.

- [ ] **Step 3: Update scripts**

In `package.json`:
```json
"lint": "eslint . --fix",
"format": "prettier --write \"**/*.{ts,tsx}\""
```

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: exits 0 (warnings allowed; no errors). Fix any errors surfaced in existing files minimally (e.g. unused vars).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: add eslint flat config and prettier to frontend

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# PHASE 1 — ONBOARDING CONTEXT (DDD + CQRS vertical slice)

### Task 1.1: Shared kernel (Province + CQRS base classes)

**Files:**
- Create: `ninja-hr-backend/src/shared-kernel/province.ts`
- Create: `ninja-hr-backend/src/shared-kernel/aggregate-root.ts`
- Test: `ninja-hr-backend/src/shared-kernel/province.spec.ts`

**Interfaces:**
- Produces: `type ProvinceCode = 'ON'|'BC'|'AB'|'QC'|'SK'|'MB'|'NS'|'NB'`; `PROVINCES`; `provinceName(code)`. `AppAggregateRoot` re-export of `@nestjs/cqrs` `AggregateRoot`.

- [ ] **Step 1: Write the failing test**

```ts
// src/shared-kernel/province.spec.ts
import { provinceName, PROVINCES } from './province';

describe('province', () => {
  it('maps codes to names', () => {
    expect(provinceName('ON')).toBe('Ontario');
    expect(provinceName('QC')).toBe('Quebec');
  });
  it('lists all 8 provinces', () => {
    expect(PROVINCES).toHaveLength(8);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx jest src/shared-kernel/province.spec.ts`
Expected: FAIL — cannot find module `./province`.

- [ ] **Step 3: Implement** (ported verbatim from frontend `lib/compliance.ts` header)

```ts
// src/shared-kernel/province.ts
export type ProvinceCode = 'ON' | 'BC' | 'AB' | 'QC' | 'SK' | 'MB' | 'NS' | 'NB';

export interface Province {
  code: ProvinceCode;
  name: string;
}

export const PROVINCES: Province[] = [
  { code: 'ON', name: 'Ontario' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'AB', name: 'Alberta' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NB', name: 'New Brunswick' },
];

export function provinceName(code: ProvinceCode): string {
  return PROVINCES.find((p) => p.code === code)?.name ?? code;
}
```
```ts
// src/shared-kernel/aggregate-root.ts
export { AggregateRoot } from '@nestjs/cqrs';
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx jest src/shared-kernel/province.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: shared kernel - province value object

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.2: Onboarding domain — types, checklist & submitted-docs services, status machine

This ports the genuine domain logic from frontend `lib/onboarding.ts` into the domain layer, **with tests** (it currently has none).

**Files:**
- Create: `src/contexts/onboarding/domain/onboarding.types.ts`
- Create: `src/contexts/onboarding/domain/checklist.service.ts`
- Create: `src/contexts/onboarding/domain/submitted-documents.service.ts`
- Create: `src/contexts/onboarding/domain/onboarding-status.ts`
- Test: `src/contexts/onboarding/domain/onboarding-status.spec.ts`, `checklist.service.spec.ts`

**Interfaces:**
- Produces:
  - Types `CaseStatus`, `TaskOwner`, `TaskStatus`, `DataAccess`, `DocStatus`, `ChecklistTask`, `CaseDocument`, `ConsentEntry`, `FormFlags`, `OnboardingCase` (DTO-shaped, matching frontend `lib/onboarding.ts` exactly).
  - `generateChecklist(department: string, province: ProvinceCode): ChecklistTask[]`
  - `mandatoryPolicies(province: ProvinceCode): string[]`
  - `generateSubmittedDocuments(c: OnboardingCase): CaseDocument[]`
  - `nextStatus(c: OnboardingCase): CaseStatus`, `canActivate(c)`, `activationGates(c)`, `formProgress`, `checklistProgress`, `caseProgress`
  - `PRIVACY_POLICY_VERSION = 'v2.4'`

- [ ] **Step 1: Create the types file** (verbatim shapes from frontend `lib/onboarding.ts`)

```ts
// src/contexts/onboarding/domain/onboarding.types.ts
import type { ProvinceCode } from 'src/shared-kernel/province';

export type CaseStatus =
  | 'Invited'
  | 'Forms In Progress'
  | 'Pending Verification'
  | 'Ready to Activate'
  | 'Active';

export type TaskOwner = 'HR' | 'Finance' | 'IT / Ops' | 'Manager';
export type TaskStatus = 'Pending' | 'In-Progress' | 'Completed';
export type DataAccess = 'general' | 'banking' | 'medical';
export type DocStatus = 'Pending' | 'Needs Verification' | 'Verified';

export interface ChecklistTask {
  id: string;
  label: string;
  owner: TaskOwner;
  status: TaskStatus;
  blocking: boolean;
  dataAccess: DataAccess;
}

export interface CaseDocument {
  id: string;
  name: string;
  type: string;
  folder: string;
  status: DocStatus;
  signedAt?: string;
  signedBy?: string;
  ip?: string;
}

export interface ConsentEntry {
  policy: string;
  version: string;
  timestamp: string;
  ip: string;
}

export interface FormFlags {
  personal: boolean;
  td1: boolean;
  directDeposit: boolean;
  benefits: boolean;
  handbook: boolean;
}

export interface OnboardingCase {
  id: string;
  token: string;
  name: string;
  title: string;
  department: string;
  province: ProvinceCode;
  startDate: string;
  personalEmail: string;
  status: CaseStatus;
  createdAt: string;
  forms: FormFlags;
  checklist: ChecklistTask[];
  documents: CaseDocument[];
  consent: ConsentEntry[];
  policiesAttached: string[];
  auditLog: { at: string; event: string }[];
}

export const PRIVACY_POLICY_VERSION = 'v2.4';
```

- [ ] **Step 2: Write failing tests for the status machine**

```ts
// src/contexts/onboarding/domain/onboarding-status.spec.ts
import { nextStatus, canActivate } from './onboarding-status';
import { generateChecklist } from './checklist.service';
import type { OnboardingCase } from './onboarding.types';

function baseCase(over: Partial<OnboardingCase> = {}): OnboardingCase {
  return {
    id: 'c1', token: 't1', name: 'A B', title: 'Eng', department: 'Engineering',
    province: 'ON', startDate: '2026-07-01', personalEmail: 'a@b.com',
    status: 'Pending Verification', createdAt: '2026-06-01',
    forms: { personal: true, td1: true, directDeposit: true, benefits: true, handbook: true },
    checklist: [], documents: [], consent: [], policiesAttached: [], auditLog: [],
    ...over,
  };
}

describe('nextStatus', () => {
  it('keeps Invited and Active terminal-ish', () => {
    expect(nextStatus(baseCase({ status: 'Invited' }))).toBe('Invited');
    expect(nextStatus(baseCase({ status: 'Active' }))).toBe('Active');
  });
  it('returns Forms In Progress when forms incomplete', () => {
    const c = baseCase({ forms: { personal: false, td1: true, directDeposit: true, benefits: true, handbook: true } });
    expect(nextStatus(c)).toBe('Forms In Progress');
  });
  it('returns Pending Verification when gates not all green', () => {
    const c = baseCase({ documents: [{ id: 'd', name: 'x', type: 't', folder: 'f', status: 'Needs Verification' }] });
    expect(nextStatus(c)).toBe('Pending Verification');
  });
});

describe('canActivate', () => {
  it('is false when mandatory ON policies missing', () => {
    const c = baseCase({ policiesAttached: [] });
    expect(canActivate(c)).toBe(false);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx jest src/contexts/onboarding/domain`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement checklist service** (verbatim from frontend, `Math.random`-free; the original is already deterministic)

```ts
// src/contexts/onboarding/domain/checklist.service.ts
import type { ProvinceCode } from 'src/shared-kernel/province';
import type { ChecklistTask, TaskOwner, DataAccess } from './onboarding.types';

export const PROVINCE_POLICIES: Record<string, string[]> = {
  ON: ['AODA Awareness Training', 'Workplace Violence & Harassment Policy', 'Health & Safety Awareness (Ontario)'],
  BC: ['Bullying & Harassment (WorkSafeBC)', 'OHS Orientation (BC)'],
  QC: ['French Language Rights (Charter)', 'Law 25 Privacy Notice'],
  AB: ['OHS Orientation (Alberta)'],
  SK: ['OHS Orientation (Saskatchewan)'],
  MB: ['Workplace Safety & Health (Manitoba)'],
  NS: ['OHS Orientation (Nova Scotia)'],
  NB: ['OHS Orientation (New Brunswick)'],
};

export function mandatoryPolicies(province: ProvinceCode): string[] {
  return PROVINCE_POLICIES[province] ?? [];
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return h;
}

let tid = 0;
function mkTask(label: string, owner: TaskOwner, blocking = false, dataAccess: DataAccess = 'general'): ChecklistTask {
  return { id: `t${++tid}_${Math.abs(hash(label + owner))}`, label, owner, status: 'Pending', blocking, dataAccess };
}

const DEPT_TASKS: Record<string, () => ChecklistTask[]> = {
  Engineering: () => [
    mkTask('Provision dev environment & GitHub access', 'IT / Ops', true),
    mkTask('Assign engineering onboarding buddy', 'Manager'),
  ],
  Sales: () => [
    mkTask('Grant CRM access & assign territory', 'IT / Ops'),
    mkTask('Schedule product & pitch training', 'Manager'),
  ],
  Design: () => [mkTask('Provision Figma & design tooling', 'IT / Ops')],
  Finance: () => [mkTask('Grant ERP / ledger access', 'IT / Ops', true, 'banking')],
};

export function generateChecklist(department: string, province: ProvinceCode): ChecklistTask[] {
  const base: ChecklistTask[] = [
    mkTask('Send benefits enrollment package', 'HR'),
    mkTask('Collect signed handbook & policy acknowledgments', 'HR'),
    mkTask('Set up payroll profile', 'Finance', true, 'banking'),
    mkTask('Verify direct deposit & void cheque', 'Finance', true, 'banking'),
    mkTask('Confirm TD1 federal + provincial', 'Finance', false, 'general'),
    mkTask('Create corporate email address', 'IT / Ops'),
    mkTask('Provision laptop & hardware', 'IT / Ops', true),
    mkTask('Grant SSO + core app access', 'IT / Ops'),
    mkTask('Prepare first-week plan', 'Manager'),
  ];
  const training = mandatoryPolicies(province).map((p) => mkTask(`Assign: ${p}`, 'HR', true, 'general'));
  const deptExtra = (DEPT_TASKS[department] ?? (() => []))();
  return [...base, ...training, ...deptExtra];
}
```
> Change from the original: `DEPT_TASKS` is a map of factory functions (not pre-built arrays) so `mkTask`'s `tid` counter increments per call, preserving the original behavior where ids are generated at checklist-build time.

- [ ] **Step 5: Implement submitted-documents service** (verbatim)

```ts
// src/contexts/onboarding/domain/submitted-documents.service.ts
import type { OnboardingCase, CaseDocument } from './onboarding.types';

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return h;
}

export function generateSubmittedDocuments(c: OnboardingCase): CaseDocument[] {
  const today = c.startDate;
  const sign = (name: string, type: string, needsVerify = false): CaseDocument => ({
    id: `doc_${Math.abs(hash(name + c.id))}`,
    name,
    type,
    folder: '02_Onboarding_and_Tax',
    status: needsVerify ? 'Needs Verification' : 'Verified',
    signedAt: today,
    signedBy: c.name,
    ip: '203.0.113.42',
  });
  return [
    sign('TD1 Federal 2026 (signed).pdf', 'TD1 Form'),
    sign(`TD1 ${c.province} Provincial (signed).pdf`, 'TD1 Form'),
    sign('New Hire Form (signed).pdf', 'New Hire Form'),
    sign('Direct Deposit – Void Cheque.jpg', 'Direct Deposit', true),
    sign('Benefits Election (signed).pdf', 'Benefits'),
  ];
}
```

- [ ] **Step 6: Implement status machine** (verbatim from frontend, minus the unused `Gate.detail` UI strings which we keep for parity)

```ts
// src/contexts/onboarding/domain/onboarding-status.ts
import type { OnboardingCase, FormFlags, ChecklistTask } from './onboarding.types';
import { mandatoryPolicies } from './checklist.service';

export function formProgress(forms: FormFlags): number {
  const vals = Object.values(forms);
  return Math.round((vals.filter(Boolean).length / vals.length) * 100);
}

export function checklistProgress(checklist: ChecklistTask[]): number {
  if (!checklist.length) return 0;
  const done = checklist.filter((t) => t.status === 'Completed').length;
  return Math.round((done / checklist.length) * 100);
}

export function caseProgress(c: OnboardingCase): number {
  return Math.round((formProgress(c.forms) + checklistProgress(c.checklist)) / 2);
}

export interface Gate {
  ok: boolean;
  label: string;
  detail?: string;
}

export function activationGates(c: OnboardingCase): Gate[] {
  const blockingTasks = c.checklist.filter((t) => t.blocking);
  const blockingDone = blockingTasks.filter((t) => t.status === 'Completed');
  const unverified = c.documents.filter((d) => d.status === 'Needs Verification');
  const required = mandatoryPolicies(c.province);
  const missingPolicies = required.filter((p) => !c.policiesAttached.includes(p));
  const formsDone = formProgress(c.forms) === 100;

  return [
    { ok: formsDone, label: 'Employee completed all onboarding forms' },
    {
      ok: blockingTasks.length > 0 && blockingDone.length === blockingTasks.length,
      label: `Blocking checklist tasks complete (${blockingDone.length}/${blockingTasks.length})`,
    },
    { ok: unverified.length === 0, label: 'All documents verified by HR (human-in-the-loop)' },
    { ok: missingPolicies.length === 0, label: `Provincial mandatory policies attached (${c.province})` },
  ];
}

export function canActivate(c: OnboardingCase): boolean {
  return activationGates(c).every((g) => g.ok);
}

export function nextStatus(c: OnboardingCase): import('./onboarding.types').CaseStatus {
  if (c.status === 'Active' || c.status === 'Invited') return c.status;
  const formsDone = Object.values(c.forms).every(Boolean);
  if (!formsDone) return 'Forms In Progress';
  return canActivate(c) ? 'Ready to Activate' : 'Pending Verification';
}
```

- [ ] **Step 7: Add a checklist test**

```ts
// src/contexts/onboarding/domain/checklist.service.spec.ts
import { generateChecklist, mandatoryPolicies } from './checklist.service';

describe('generateChecklist', () => {
  it('includes base + ON mandatory training + Engineering extras', () => {
    const list = generateChecklist('Engineering', 'ON');
    expect(list.some((t) => t.label === 'Set up payroll profile')).toBe(true);
    expect(list.some((t) => t.label === 'Assign: AODA Awareness Training')).toBe(true);
    expect(list.some((t) => t.label === 'Provision dev environment & GitHub access')).toBe(true);
  });
  it('mandatoryPolicies returns [] for unknown province key', () => {
    expect(mandatoryPolicies('AB')).toEqual(['OHS Orientation (Alberta)']);
  });
});
```

- [ ] **Step 8: Run all onboarding domain tests**

Run: `npx jest src/contexts/onboarding/domain`
Expected: PASS (status + checklist specs green).

- [ ] **Step 9: Lint + commit**

```bash
npm run lint
git add -A && git commit -m "feat: onboarding domain - types, checklist/doc generation, status machine + tests

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.3: Onboarding infrastructure — mapper + repository

Ports `db-map.ts` (onboarding enums) and `toApp`/persistence from the frontend's `app/actions/onboarding.ts` into a repository.

**Files:**
- Create: `src/contexts/onboarding/infrastructure/onboarding.mapper.ts`
- Create: `src/contexts/onboarding/infrastructure/onboarding.repository.ts`
- Test: `src/contexts/onboarding/infrastructure/onboarding.mapper.spec.ts`

**Interfaces:**
- Produces:
  - Mapper: `rowToCase(row): OnboardingCase`; enum maps `caseStatusToDb/FromDb`, `ownerToDb/FromDb`, `taskStatusToDb/FromDb`, `accessToDb/FromDb`, `docStatusToDb/FromDb`.
  - Repository `OnboardingRepository` methods: `findById(id)`, `findByToken(token)`, `list()`, `pipeline()`, `create(data)`, `updateForms`, `addConsent`, `replaceDocuments`, `replaceChecklist`, `setTaskStatus`, `verifyDocument`, `setStatus`, `addAudit`, `togglePolicy` — all returning `OnboardingCase | null` (or arrays) in the frozen DTO shape.

- [ ] **Step 1: Write the mapper test (enum round-trip)**

```ts
// src/contexts/onboarding/infrastructure/onboarding.mapper.spec.ts
import { caseStatusToDb, caseStatusFromDb, ownerToDb, ownerFromDb } from './onboarding.mapper';

describe('onboarding enum maps', () => {
  it('round-trips case status', () => {
    expect(caseStatusToDb['Pending Verification']).toBe('PENDING_VERIFICATION');
    expect(caseStatusFromDb['PENDING_VERIFICATION']).toBe('Pending Verification');
  });
  it('maps IT / Ops owner', () => {
    expect(ownerToDb['IT / Ops']).toBe('IT_OPS');
    expect(ownerFromDb['IT_OPS']).toBe('IT / Ops');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/contexts/onboarding/infrastructure/onboarding.mapper.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the mapper** (enum maps from `db-map.ts`; `rowToCase` from `toApp` in `app/actions/onboarding.ts`)

```ts
// src/contexts/onboarding/infrastructure/onboarding.mapper.ts
import type { ProvinceCode } from 'src/shared-kernel/province';
import type {
  OnboardingCase, CaseStatus, TaskOwner, TaskStatus, DataAccess, DocStatus, FormFlags,
} from '../domain/onboarding.types';

function invert<K extends string, V extends string>(m: Record<K, V>): Record<V, K> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<V, K>;
}

export const caseStatusToDb = {
  Invited: 'INVITED',
  'Forms In Progress': 'FORMS_IN_PROGRESS',
  'Pending Verification': 'PENDING_VERIFICATION',
  'Ready to Activate': 'READY_TO_ACTIVATE',
  Active: 'ACTIVE',
} satisfies Record<CaseStatus, string>;
export const caseStatusFromDb = invert(caseStatusToDb);

export const ownerToDb = {
  HR: 'HR', Finance: 'FINANCE', 'IT / Ops': 'IT_OPS', Manager: 'MANAGER',
} satisfies Record<TaskOwner, string>;
export const ownerFromDb = invert(ownerToDb);

export const taskStatusToDb = {
  Pending: 'PENDING', 'In-Progress': 'IN_PROGRESS', Completed: 'COMPLETED',
} satisfies Record<TaskStatus, string>;
export const taskStatusFromDb = invert(taskStatusToDb);

export const accessToDb = {
  general: 'GENERAL', banking: 'BANKING', medical: 'MEDICAL',
} satisfies Record<DataAccess, string>;
export const accessFromDb = invert(accessToDb);

export const docStatusToDb = {
  Pending: 'PENDING', 'Needs Verification': 'NEEDS_VERIFICATION', Verified: 'VERIFIED',
} satisfies Record<DocStatus, string>;
export const docStatusFromDb = invert(docStatusToDb);

const d = (date: Date | null | undefined, len = 10): string | undefined =>
  date ? date.toISOString().slice(0, len) : undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToCase(row: any): OnboardingCase {
  return {
    id: row.id,
    token: row.token,
    name: row.name,
    title: row.title,
    department: row.department,
    province: row.province as ProvinceCode,
    startDate: d(row.startDate)!,
    personalEmail: row.personalEmail,
    status: caseStatusFromDb[row.status as keyof typeof caseStatusFromDb],
    createdAt: d(row.createdAt)!,
    forms: row.forms as FormFlags,
    policiesAttached: row.policiesAttached,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    checklist: row.checklist.map((t: any) => ({
      id: t.id, label: t.label, owner: ownerFromDb[t.owner as keyof typeof ownerFromDb],
      status: taskStatusFromDb[t.status as keyof typeof taskStatusFromDb], blocking: t.blocking,
      dataAccess: accessFromDb[t.dataAccess as keyof typeof accessFromDb],
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    documents: row.documents.map((doc: any) => ({
      id: doc.id, name: doc.name, type: doc.type, folder: doc.folder,
      status: docStatusFromDb[doc.status as keyof typeof docStatusFromDb],
      signedAt: d(doc.signedAt), signedBy: doc.signedBy ?? undefined, ip: doc.ip ?? undefined,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    consent: row.consent.map((e: any) => ({
      policy: e.policy, version: e.version, timestamp: d(e.timestamp, 19)!, ip: e.ip,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditLog: row.auditLog.map((a: any) => ({ at: d(a.at, 19)!, event: a.event })),
  };
}
```

- [ ] **Step 4: Run mapper test to verify pass**

Run: `npx jest src/contexts/onboarding/infrastructure/onboarding.mapper.spec.ts`
Expected: PASS.

- [ ] **Step 5: Implement the repository** (ports persistence from `app/actions/onboarding.ts` — `INCLUDE`, `loadById/loadByToken`, `listCases`, `pipeline`, and all write paths)

```ts
// src/contexts/onboarding/infrastructure/onboarding.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/platform/database/prisma.service';
import type { ProvinceCode } from 'src/shared-kernel/province';
import { rowToCase, caseStatusToDb, ownerToDb, taskStatusToDb, accessToDb, docStatusToDb } from './onboarding.mapper';
import type { OnboardingCase, ChecklistTask, CaseDocument } from '../domain/onboarding.types';

const INCLUDE = {
  checklist: { orderBy: { order: 'asc' } },
  documents: { orderBy: { name: 'asc' } },
  consent: { orderBy: { timestamp: 'asc' } },
  auditLog: { orderBy: { at: 'asc' } },
} as const;

@Injectable()
export class OnboardingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<OnboardingCase | null> {
    const row = await this.prisma.onboardingCase.findUnique({ where: { id }, include: INCLUDE });
    return row ? rowToCase(row) : null;
  }
  async findByToken(token: string): Promise<OnboardingCase | null> {
    const row = await this.prisma.onboardingCase.findUnique({ where: { token }, include: INCLUDE });
    return row ? rowToCase(row) : null;
  }
  async list(): Promise<OnboardingCase[]> {
    const rows = await this.prisma.onboardingCase.findMany({ include: INCLUDE, orderBy: { createdAt: 'desc' } });
    return rows.map(rowToCase);
  }
  async pipeline(): Promise<{ id: string; name: string; title: string; startsInDays: number; progress: number }[]> {
    const rows = await this.prisma.onboardingCase.findMany({
      where: { status: { not: 'ACTIVE' } }, include: { checklist: true }, orderBy: { startDate: 'asc' },
    });
    return rows.map((c) => {
      const forms = c.forms as Record<string, boolean>;
      const formPct = Math.round((Object.values(forms).filter(Boolean).length / Object.values(forms).length) * 100);
      const taskPct = c.checklist.length
        ? Math.round((c.checklist.filter((t) => t.status === 'COMPLETED').length / c.checklist.length) * 100)
        : 0;
      const start = c.startDate.toISOString().slice(0, 10);
      return { id: c.id, name: c.name, title: `${c.title} · starts ${start}`, startsInDays: 0, progress: Math.round((formPct + taskPct) / 2) };
    });
  }

  async createCase(input: {
    token: string; name: string; title: string; department: string; province: ProvinceCode;
    startDate: Date; personalEmail: string; checklist: ChecklistTask[]; audit: string[];
  }): Promise<OnboardingCase> {
    const row = await this.prisma.onboardingCase.create({
      data: {
        token: input.token, name: input.name, title: input.title, department: input.department,
        province: input.province as never, startDate: input.startDate, personalEmail: input.personalEmail,
        status: 'INVITED',
        forms: { personal: false, td1: false, directDeposit: false, benefits: false, handbook: false },
        policiesAttached: [],
        checklist: { create: input.checklist.map((t, i) => ({
          label: t.label, owner: ownerToDb[t.owner] as never, status: 'PENDING',
          blocking: t.blocking, dataAccess: accessToDb[t.dataAccess] as never, order: i,
        })) },
        auditLog: { create: input.audit.map((event) => ({ event })) },
      },
      include: INCLUDE,
    });
    return rowToCase(row);
  }

  async updateForms(token: string, forms: Record<string, boolean>): Promise<void> {
    await this.prisma.onboardingCase.update({ where: { token }, data: { forms } });
  }
  async addConsentEntry(caseId: string, policy: string, version: string, ip: string): Promise<void> {
    await this.prisma.consentEntry.create({ data: { caseId, policy, version, ip } });
  }
  async setStatus(id: string, status: OnboardingCase['status']): Promise<void> {
    await this.prisma.onboardingCase.update({ where: { id }, data: { status: caseStatusToDb[status] as never } });
  }
  async addAudit(caseId: string, event: string): Promise<void> {
    await this.prisma.auditEntry.create({ data: { caseId, event } });
  }
  async replaceDocuments(caseId: string, docs: CaseDocument[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.caseDocument.deleteMany({ where: { caseId } }),
      this.prisma.caseDocument.createMany({ data: docs.map((doc) => ({
        caseId, name: doc.name, type: doc.type, folder: doc.folder,
        status: docStatusToDb[doc.status] as never,
        signedAt: doc.signedAt ? new Date(doc.signedAt) : null,
        signedBy: doc.signedBy ?? null, ip: doc.ip ?? null,
      })) }),
    ]);
  }
  async replaceChecklist(caseId: string, tasks: ChecklistTask[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.checklistTask.deleteMany({ where: { caseId } }),
      this.prisma.checklistTask.createMany({ data: tasks.map((t, i) => ({
        caseId, label: t.label, owner: ownerToDb[t.owner] as never,
        status: taskStatusToDb[t.status] as never, blocking: t.blocking,
        dataAccess: accessToDb[t.dataAccess] as never, order: i,
      })) }),
    ]);
  }
  async setTaskStatus(taskId: string, status: ChecklistTask['status']): Promise<void> {
    await this.prisma.checklistTask.update({ where: { id: taskId }, data: { status: taskStatusToDb[status] as never } });
  }
  async verifyDocument(docId: string): Promise<void> {
    await this.prisma.caseDocument.update({ where: { id: docId }, data: { status: 'VERIFIED' } });
  }
  async setPolicies(id: string, policiesAttached: string[]): Promise<void> {
    await this.prisma.onboardingCase.update({ where: { id }, data: { policiesAttached } });
  }
}
```

- [ ] **Step 6: Build to type-check the repository against the generated client**

Run: `npm run build`
Expected: exits 0. (If the Prisma client types aren't found, run `npm run prisma:generate` first.)

- [ ] **Step 7: Lint + commit**

```bash
npm run lint
git add -A && git commit -m "feat: onboarding infrastructure - enum mapper + Prisma repository

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.4: Onboarding application — queries (reads)

**Files:**
- Create: `src/contexts/onboarding/application/queries/list-cases.query.ts`
- Create: `src/contexts/onboarding/application/queries/get-pipeline.query.ts`

**Interfaces:**
- Consumes: `OnboardingRepository.list()`, `.pipeline()`.
- Produces: `ListCasesQuery` class + `ListCasesHandler`; `GetPipelineQuery` + `GetPipelineHandler`. Handlers return `OnboardingCase[]` and the pipeline array respectively.

- [ ] **Step 1: Implement the list-cases query + handler**

```ts
// src/contexts/onboarding/application/queries/list-cases.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import type { OnboardingCase } from '../../domain/onboarding.types';

export class ListCasesQuery {}

@QueryHandler(ListCasesQuery)
export class ListCasesHandler implements IQueryHandler<ListCasesQuery, OnboardingCase[]> {
  constructor(private readonly repo: OnboardingRepository) {}
  execute(): Promise<OnboardingCase[]> {
    return this.repo.list();
  }
}
```

- [ ] **Step 2: Implement the get-pipeline query + handler**

```ts
// src/contexts/onboarding/application/queries/get-pipeline.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';

export class GetPipelineQuery {}

@QueryHandler(GetPipelineQuery)
export class GetPipelineHandler implements IQueryHandler<GetPipelineQuery> {
  constructor(private readonly repo: OnboardingRepository) {}
  execute() {
    return this.repo.pipeline();
  }
}
```

- [ ] **Step 3: Build + lint + commit**

```bash
npm run build && npm run lint
git add -A && git commit -m "feat: onboarding queries - list cases, pipeline (CQRS QueryHandlers)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.5: Onboarding application — commands (mutations) + audit events

Ports each Server Action from `app/actions/onboarding.ts` to a CQRS Command + handler. The `settle()` status-recompute is a shared private helper on a domain service used by handlers. Audit writes are emitted as domain events.

**Files:**
- Create: `src/contexts/onboarding/application/onboarding.settle.ts` (settle helper)
- Create: `src/contexts/onboarding/application/commands/create-case.command.ts`
- Create: `.../commands/mark-form.command.ts`, `add-consent.command.ts`, `finalize-submission.command.ts`, `set-checklist.command.ts`, `set-task-status.command.ts`, `verify-document.command.ts`, `toggle-policy.command.ts`, `activate.command.ts`
- Create: `src/contexts/onboarding/application/events/case-activated.event.ts`, `events/case-activated.handler.ts`
- Test: `src/contexts/onboarding/application/onboarding.settle.spec.ts`

**Interfaces:**
- Consumes: `OnboardingRepository`, domain `generateChecklist`, `generateSubmittedDocuments`, `nextStatus`, `mandatoryPolicies`, `PRIVACY_POLICY_VERSION`.
- Produces command classes + handlers, each returning `OnboardingCase | null` (or `OnboardingCase` for create), matching the frontend action signatures. `settle(repo, id)` recomputes + persists status and returns the reloaded case.

- [ ] **Step 1: Write failing test for `settle`**

```ts
// src/contexts/onboarding/application/onboarding.settle.spec.ts
import { settle } from './onboarding.settle';
import type { OnboardingCase } from '../domain/onboarding.types';

const ready: OnboardingCase = {
  id: 'c1', token: 't1', name: 'A', title: 'x', department: 'Engineering', province: 'ON',
  startDate: '2026-07-01', personalEmail: 'a@b.com', status: 'Pending Verification', createdAt: '2026-06-01',
  forms: { personal: true, td1: true, directDeposit: true, benefits: true, handbook: true },
  checklist: [{ id: 't', label: 'x', owner: 'HR', status: 'Completed', blocking: true, dataAccess: 'general' }],
  documents: [], consent: [],
  policiesAttached: ['AODA Awareness Training', 'Workplace Violence & Harassment Policy', 'Health & Safety Awareness (Ontario)'],
  auditLog: [],
};

describe('settle', () => {
  it('persists the recomputed status when it changes', async () => {
    const calls: { id: string; status: string }[] = [];
    const repo = {
      findById: async () => ready,
      setStatus: async (id: string, status: string) => { calls.push({ id, status }); },
    } as never;
    const out = await settle(repo, 'c1');
    expect(out?.status).toBe('Ready to Activate');
    expect(calls).toEqual([{ id: 'c1', status: 'Ready to Activate' }]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/contexts/onboarding/application/onboarding.settle.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `settle`**

```ts
// src/contexts/onboarding/application/onboarding.settle.ts
import type { OnboardingRepository } from '../infrastructure/onboarding.repository';
import { nextStatus } from '../domain/onboarding-status';
import type { OnboardingCase } from '../domain/onboarding.types';

export async function settle(repo: OnboardingRepository, id: string): Promise<OnboardingCase | null> {
  const app = await repo.findById(id);
  if (!app) return null;
  const ns = nextStatus(app);
  if (ns !== app.status) {
    await repo.setStatus(id, ns);
    app.status = ns;
  }
  return app;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/contexts/onboarding/application/onboarding.settle.spec.ts`
Expected: PASS.

- [ ] **Step 5: Implement `create-case`** (ports `createCase`; replaces `Date.now()` — NestJS runtime allows it, but use a passed clock for testability via `new Date()` directly here, matching original)

```ts
// src/contexts/onboarding/application/commands/create-case.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { generateChecklist } from '../../domain/checklist.service';
import type { ProvinceCode } from 'src/shared-kernel/province';
import type { OnboardingCase } from '../../domain/onboarding.types';

export class CreateCaseCommand {
  constructor(
    public readonly input: {
      name: string; title?: string; department?: string;
      province: ProvinceCode; startDate: string; personalEmail: string;
    },
  ) {}
}

@CommandHandler(CreateCaseCommand)
export class CreateCaseHandler implements ICommandHandler<CreateCaseCommand, OnboardingCase> {
  constructor(private readonly repo: OnboardingRepository) {}
  execute({ input }: CreateCaseCommand): Promise<OnboardingCase> {
    const stamp = Date.now();
    const dept = input.department || 'Operations';
    const checklist = generateChecklist(dept, input.province);
    return this.repo.createCase({
      token: `inv_${stamp.toString(36)}`,
      name: input.name,
      title: input.title || 'New Hire',
      department: dept,
      province: input.province,
      startDate: new Date(input.startDate),
      personalEmail: input.personalEmail,
      checklist,
      audit: [
        `Profile created; invite emailed to ${input.personalEmail}`,
        'Agent generated department onboarding checklist',
      ],
    });
  }
}
```

- [ ] **Step 6: Implement the remaining commands** (one file each; ported 1:1 from the matching Server Action)

```ts
// src/contexts/onboarding/application/commands/mark-form.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { settle } from '../onboarding.settle';
import type { FormFlags, OnboardingCase } from '../../domain/onboarding.types';

export class MarkFormCommand {
  constructor(public readonly token: string, public readonly key: keyof FormFlags) {}
}

@CommandHandler(MarkFormCommand)
export class MarkFormHandler implements ICommandHandler<MarkFormCommand, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository) {}
  async execute({ token, key }: MarkFormCommand): Promise<OnboardingCase | null> {
    const c = await this.repo.findByToken(token);
    if (!c) return null;
    await this.repo.updateForms(token, { ...c.forms, [key]: true });
    return settle(this.repo, c.id);
  }
}
```
```ts
// src/contexts/onboarding/application/commands/add-consent.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { settle } from '../onboarding.settle';
import { PRIVACY_POLICY_VERSION, type OnboardingCase } from '../../domain/onboarding.types';

export class AddConsentCommand {
  constructor(public readonly token: string, public readonly policy: string) {}
}

@CommandHandler(AddConsentCommand)
export class AddConsentHandler implements ICommandHandler<AddConsentCommand, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository) {}
  async execute({ token, policy }: AddConsentCommand): Promise<OnboardingCase | null> {
    const c = await this.repo.findByToken(token);
    if (!c) return null;
    await this.repo.addConsentEntry(c.id, policy, PRIVACY_POLICY_VERSION, '203.0.113.42');
    return settle(this.repo, c.id);
  }
}
```
```ts
// src/contexts/onboarding/application/commands/finalize-submission.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { settle } from '../onboarding.settle';
import { generateSubmittedDocuments } from '../../domain/submitted-documents.service';
import type { OnboardingCase } from '../../domain/onboarding.types';

export class FinalizeSubmissionCommand {
  constructor(public readonly token: string) {}
}

@CommandHandler(FinalizeSubmissionCommand)
export class FinalizeSubmissionHandler implements ICommandHandler<FinalizeSubmissionCommand, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository) {}
  async execute({ token }: FinalizeSubmissionCommand): Promise<OnboardingCase | null> {
    const c = await this.repo.findByToken(token);
    if (!c) return null;
    const docs = generateSubmittedDocuments(c);
    await this.repo.replaceDocuments(c.id, docs);
    await this.repo.addAudit(c.id, 'Employee submitted onboarding wizard (webhook: onboarding.workflow.finished)');
    await this.repo.setStatus(c.id, 'Pending Verification');
    return settle(this.repo, c.id);
  }
}
```
```ts
// src/contexts/onboarding/application/commands/set-checklist.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { settle } from '../onboarding.settle';
import type { ChecklistTask, OnboardingCase } from '../../domain/onboarding.types';

export class SetChecklistCommand {
  constructor(public readonly id: string, public readonly tasks: ChecklistTask[]) {}
}

@CommandHandler(SetChecklistCommand)
export class SetChecklistHandler implements ICommandHandler<SetChecklistCommand, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository) {}
  async execute({ id, tasks }: SetChecklistCommand): Promise<OnboardingCase | null> {
    await this.repo.replaceChecklist(id, tasks);
    await this.repo.addAudit(id, 'Onboarding checklist updated');
    return settle(this.repo, id);
  }
}
```
```ts
// src/contexts/onboarding/application/commands/set-task-status.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { settle } from '../onboarding.settle';
import type { TaskStatus, OnboardingCase } from '../../domain/onboarding.types';

export class SetTaskStatusCommand {
  constructor(public readonly id: string, public readonly taskId: string, public readonly status: TaskStatus) {}
}

@CommandHandler(SetTaskStatusCommand)
export class SetTaskStatusHandler implements ICommandHandler<SetTaskStatusCommand, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository) {}
  async execute({ id, taskId, status }: SetTaskStatusCommand): Promise<OnboardingCase | null> {
    await this.repo.setTaskStatus(taskId, status);
    return settle(this.repo, id);
  }
}
```
```ts
// src/contexts/onboarding/application/commands/verify-document.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { settle } from '../onboarding.settle';
import type { OnboardingCase } from '../../domain/onboarding.types';

export class VerifyDocumentCommand {
  constructor(public readonly id: string, public readonly docId: string) {}
}

@CommandHandler(VerifyDocumentCommand)
export class VerifyDocumentHandler implements ICommandHandler<VerifyDocumentCommand, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository) {}
  async execute({ id, docId }: VerifyDocumentCommand): Promise<OnboardingCase | null> {
    await this.repo.verifyDocument(docId);
    await this.repo.addAudit(id, `HR verified document ${docId}`);
    return settle(this.repo, id);
  }
}
```
```ts
// src/contexts/onboarding/application/commands/toggle-policy.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { settle } from '../onboarding.settle';
import type { OnboardingCase } from '../../domain/onboarding.types';

export class TogglePolicyCommand {
  constructor(public readonly id: string, public readonly policy: string) {}
}

@CommandHandler(TogglePolicyCommand)
export class TogglePolicyHandler implements ICommandHandler<TogglePolicyCommand, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository) {}
  async execute({ id, policy }: TogglePolicyCommand): Promise<OnboardingCase | null> {
    const c = await this.repo.findById(id);
    if (!c) return null;
    const policiesAttached = c.policiesAttached.includes(policy)
      ? c.policiesAttached.filter((p) => p !== policy)
      : [...c.policiesAttached, policy];
    await this.repo.setPolicies(id, policiesAttached);
    return settle(this.repo, id);
  }
}
```
```ts
// src/contexts/onboarding/application/commands/activate.command.ts
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { CaseActivatedEvent } from '../events/case-activated.event';
import type { OnboardingCase } from '../../domain/onboarding.types';

export class ActivateCommand {
  constructor(public readonly id: string) {}
}

@CommandHandler(ActivateCommand)
export class ActivateHandler implements ICommandHandler<ActivateCommand, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository, private readonly events: EventBus) {}
  async execute({ id }: ActivateCommand): Promise<OnboardingCase | null> {
    await this.repo.setStatus(id, 'Active');
    this.events.publish(new CaseActivatedEvent(id));
    return this.repo.findById(id);
  }
}
```

- [ ] **Step 7: Implement the activation audit event + handler** (replaces the inline audit write in the original `activate`)

```ts
// src/contexts/onboarding/application/events/case-activated.event.ts
export class CaseActivatedEvent {
  constructor(public readonly caseId: string) {}
}
```
```ts
// src/contexts/onboarding/application/events/case-activated.handler.ts
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { CaseActivatedEvent } from './case-activated.event';

@EventsHandler(CaseActivatedEvent)
export class CaseActivatedHandler implements IEventHandler<CaseActivatedEvent> {
  constructor(private readonly repo: OnboardingRepository) {}
  async handle(event: CaseActivatedEvent): Promise<void> {
    await this.repo.addAudit(event.caseId, 'Account activated — payroll set to Active, SSO provisioned');
  }
}
```
> Behavior parity note: the original `activate` wrote the audit entry inside the same transaction. Here the event handler runs synchronously after `setStatus`; the audit row is still created. Acceptable for this app (no cross-process eventing).

- [ ] **Step 8: Run the settle test again + build**

Run: `npx jest src/contexts/onboarding && npm run build`
Expected: tests PASS, build exits 0.

- [ ] **Step 9: Lint + commit**

```bash
npm run lint
git add -A && git commit -m "feat: onboarding commands + activation audit event (CQRS)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.6: Onboarding interface — controller, DTOs, module wiring

**Files:**
- Create: `src/contexts/onboarding/interface/dto/onboarding.dto.ts`
- Create: `src/contexts/onboarding/interface/onboarding.controller.ts`
- Create: `src/contexts/onboarding/onboarding.module.ts`
- Modify: `src/app.module.ts` (import `OnboardingModule`)

**Interfaces:**
- Consumes: all queries/commands above via `QueryBus`/`CommandBus`.
- Produces REST endpoints (all under `/api/v1`):
  - `GET  /onboarding/cases` → `OnboardingCase[]`
  - `GET  /onboarding/pipeline` → pipeline rows
  - `POST /onboarding/cases` (body `NewCaseDto`) → `OnboardingCase`
  - `POST /onboarding/cases/by-token/:token/forms/:key` → case|null
  - `POST /onboarding/cases/by-token/:token/consent` (body `{ policy }`) → case|null
  - `POST /onboarding/cases/by-token/:token/finalize` → case|null
  - `PUT  /onboarding/cases/:id/checklist` (body `{ tasks }`) → case|null
  - `PATCH /onboarding/cases/:id/tasks/:taskId` (body `{ status }`) → case|null
  - `POST /onboarding/cases/:id/documents/:docId/verify` → case|null
  - `POST /onboarding/cases/:id/policies/toggle` (body `{ policy }`) → case|null
  - `POST /onboarding/cases/:id/activate` → case|null

- [ ] **Step 1: Create request DTOs (validated + Swagger-documented)**

```ts
// src/contexts/onboarding/interface/dto/onboarding.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import type { ProvinceCode } from 'src/shared-kernel/province';
import type { ChecklistTask, TaskStatus } from '../../domain/onboarding.types';

const PROVINCES = ['ON', 'BC', 'AB', 'QC', 'SK', 'MB', 'NS', 'NB'];

export class NewCaseDto {
  @ApiProperty() @IsString() name!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() title?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() department?: string;
  @ApiProperty({ enum: PROVINCES }) @IsIn(PROVINCES) province!: ProvinceCode;
  @ApiProperty() @IsString() startDate!: string;
  @ApiProperty() @IsEmail() personalEmail!: string;
}

export class PolicyDto {
  @ApiProperty() @IsString() policy!: string;
}

export class TaskStatusDto {
  @ApiProperty({ enum: ['Pending', 'In-Progress', 'Completed'] })
  @IsIn(['Pending', 'In-Progress', 'Completed'])
  status!: TaskStatus;
}

export class ChecklistDto {
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  @IsArray()
  tasks!: ChecklistTask[];
}
```

- [ ] **Step 2: Create the controller**

```ts
// src/contexts/onboarding/interface/onboarding.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ListCasesQuery } from '../application/queries/list-cases.query';
import { GetPipelineQuery } from '../application/queries/get-pipeline.query';
import { CreateCaseCommand } from '../application/commands/create-case.command';
import { MarkFormCommand } from '../application/commands/mark-form.command';
import { AddConsentCommand } from '../application/commands/add-consent.command';
import { FinalizeSubmissionCommand } from '../application/commands/finalize-submission.command';
import { SetChecklistCommand } from '../application/commands/set-checklist.command';
import { SetTaskStatusCommand } from '../application/commands/set-task-status.command';
import { VerifyDocumentCommand } from '../application/commands/verify-document.command';
import { TogglePolicyCommand } from '../application/commands/toggle-policy.command';
import { ActivateCommand } from '../application/commands/activate.command';
import { NewCaseDto, PolicyDto, TaskStatusDto, ChecklistDto } from './dto/onboarding.dto';
import type { FormFlags } from '../domain/onboarding.types';

@ApiTags('onboarding')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly queries: QueryBus, private readonly commands: CommandBus) {}

  @Get('cases')
  listCases() {
    return this.queries.execute(new ListCasesQuery());
  }

  @Get('pipeline')
  pipeline() {
    return this.queries.execute(new GetPipelineQuery());
  }

  @Post('cases')
  createCase(@Body() body: NewCaseDto) {
    return this.commands.execute(new CreateCaseCommand(body));
  }

  @Post('cases/by-token/:token/forms/:key')
  markForm(@Param('token') token: string, @Param('key') key: keyof FormFlags) {
    return this.commands.execute(new MarkFormCommand(token, key));
  }

  @Post('cases/by-token/:token/consent')
  addConsent(@Param('token') token: string, @Body() body: PolicyDto) {
    return this.commands.execute(new AddConsentCommand(token, body.policy));
  }

  @Post('cases/by-token/:token/finalize')
  finalize(@Param('token') token: string) {
    return this.commands.execute(new FinalizeSubmissionCommand(token));
  }

  @Put('cases/:id/checklist')
  setChecklist(@Param('id') id: string, @Body() body: ChecklistDto) {
    return this.commands.execute(new SetChecklistCommand(id, body.tasks));
  }

  @Patch('cases/:id/tasks/:taskId')
  setTaskStatus(@Param('id') id: string, @Param('taskId') taskId: string, @Body() body: TaskStatusDto) {
    return this.commands.execute(new SetTaskStatusCommand(id, taskId, body.status));
  }

  @Post('cases/:id/documents/:docId/verify')
  verifyDocument(@Param('id') id: string, @Param('docId') docId: string) {
    return this.commands.execute(new VerifyDocumentCommand(id, docId));
  }

  @Post('cases/:id/policies/toggle')
  togglePolicy(@Param('id') id: string, @Body() body: PolicyDto) {
    return this.commands.execute(new TogglePolicyCommand(id, body.policy));
  }

  @Post('cases/:id/activate')
  activate(@Param('id') id: string) {
    return this.commands.execute(new ActivateCommand(id));
  }
}
```

- [ ] **Step 3: Create the module and register all providers**

```ts
// src/contexts/onboarding/onboarding.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { OnboardingController } from './interface/onboarding.controller';
import { OnboardingRepository } from './infrastructure/onboarding.repository';
import { ListCasesHandler } from './application/queries/list-cases.query';
import { GetPipelineHandler } from './application/queries/get-pipeline.query';
import { CreateCaseHandler } from './application/commands/create-case.command';
import { MarkFormHandler } from './application/commands/mark-form.command';
import { AddConsentHandler } from './application/commands/add-consent.command';
import { FinalizeSubmissionHandler } from './application/commands/finalize-submission.command';
import { SetChecklistHandler } from './application/commands/set-checklist.command';
import { SetTaskStatusHandler } from './application/commands/set-task-status.command';
import { VerifyDocumentHandler } from './application/commands/verify-document.command';
import { TogglePolicyHandler } from './application/commands/toggle-policy.command';
import { ActivateHandler } from './application/commands/activate.command';
import { CaseActivatedHandler } from './application/events/case-activated.handler';

@Module({
  imports: [CqrsModule],
  controllers: [OnboardingController],
  providers: [
    OnboardingRepository,
    ListCasesHandler, GetPipelineHandler,
    CreateCaseHandler, MarkFormHandler, AddConsentHandler, FinalizeSubmissionHandler,
    SetChecklistHandler, SetTaskStatusHandler, VerifyDocumentHandler, TogglePolicyHandler, ActivateHandler,
    CaseActivatedHandler,
  ],
})
export class OnboardingModule {}
```
Add `OnboardingModule` to `app.module.ts` imports.

- [ ] **Step 4: Build + run + verify endpoints against real data**

Run:
```bash
npm run build
npm run start:dev & sleep 9
H='-H x-internal-key:dev-internal-key -H x-actor-persona:admin'
echo "list cases:"; curl -s $H localhost:4000/api/v1/onboarding/cases | head -c 300; echo
echo "pipeline:"; curl -s $H localhost:4000/api/v1/onboarding/pipeline | head -c 200; echo
echo "spec json:"; curl -s -o /dev/null -w "%{http_code}\n" localhost:4000/api/docs-json
kill %1
```
Expected: `list cases` returns a JSON array containing the seeded cases (e.g. `Jordan Henderson`) with display-string enums (`"Pending Verification"`, owners like `"IT / Ops"`); `pipeline` returns an array; spec returns `200`.

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add -A && git commit -m "feat: onboarding REST controller, DTOs, module wiring

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.7: Frontend — rewrite onboarding reads & actions to call the backend

Replaces the Prisma internals of the onboarding query and Server Actions with HTTP calls, keeping the **same exported function signatures** so views/components don't change.

**Files:**
- Generate: `ninja-hr-frontend/lib/api/generated/openapi.d.ts`
- Modify: `ninja-hr-frontend/app/actions/onboarding.ts` (rewrite bodies; keep signatures)
- Modify: `ninja-hr-frontend/lib/queries.ts` (`getOnboardingPipeline` → HTTP)
- Keep (do NOT delete yet): `lib/db.ts`, `prisma/`, other queries/actions still using Prisma.

**Interfaces:**
- Consumes: backend endpoints from Task 1.6; `apiClient` from `lib/api/client.ts`.
- Produces: identical signatures — `listCases()`, `createCase(input)`, `markForm(token,key)`, `addConsent(token,policy)`, `finalizeSubmission(token)`, `setChecklist(id,tasks)`, `setTaskStatus(id,taskId,status)`, `verifyDocument(id,docId)`, `togglePolicy(id,policy)`, `activate(id)`, and `getOnboardingPipeline()`.

- [ ] **Step 1: Generate the OpenAPI client types** (backend must be running)

Run:
```bash
cd "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-backend" && npm run start:dev & sleep 9
cd "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-frontend" && npm run api:generate
ls -la lib/api/generated/openapi.d.ts
kill %1 2>/dev/null || true
```
Expected: `lib/api/generated/openapi.d.ts` exists and is non-empty.

- [ ] **Step 2: Rewrite `app/actions/onboarding.ts`** (keep `"use server"`, keep types imported from `@/lib/onboarding`)

```ts
// app/actions/onboarding.ts
"use server";

import { apiClient } from "@/lib/api/client";
import type {
  OnboardingCase,
  ChecklistTask,
  FormFlags,
  TaskStatus,
} from "@/lib/onboarding";
import type { ProvinceCode } from "@/lib/compliance";

const api = () => apiClient("admin");

export interface NewCaseInput {
  name: string;
  title?: string;
  department?: string;
  province: ProvinceCode;
  startDate: string;
  personalEmail: string;
}

export async function listCases(): Promise<OnboardingCase[]> {
  const { data } = await api().GET("/onboarding/cases");
  return (data ?? []) as OnboardingCase[];
}

export async function createCase(input: NewCaseInput): Promise<OnboardingCase> {
  const { data } = await api().POST("/onboarding/cases", { body: input });
  return data as OnboardingCase;
}

export async function markForm(token: string, key: keyof FormFlags): Promise<OnboardingCase | null> {
  const { data } = await api().POST("/onboarding/cases/by-token/{token}/forms/{key}", {
    params: { path: { token, key: key as string } },
  });
  return (data ?? null) as OnboardingCase | null;
}

export async function addConsent(token: string, policy: string): Promise<OnboardingCase | null> {
  const { data } = await api().POST("/onboarding/cases/by-token/{token}/consent", {
    params: { path: { token } }, body: { policy },
  });
  return (data ?? null) as OnboardingCase | null;
}

export async function finalizeSubmission(token: string): Promise<OnboardingCase | null> {
  const { data } = await api().POST("/onboarding/cases/by-token/{token}/finalize", {
    params: { path: { token } },
  });
  return (data ?? null) as OnboardingCase | null;
}

export async function setChecklist(id: string, tasks: ChecklistTask[]): Promise<OnboardingCase | null> {
  const { data } = await api().PUT("/onboarding/cases/{id}/checklist", {
    params: { path: { id } }, body: { tasks },
  });
  return (data ?? null) as OnboardingCase | null;
}

export async function setTaskStatus(id: string, taskId: string, status: TaskStatus): Promise<OnboardingCase | null> {
  const { data } = await api().PATCH("/onboarding/cases/{id}/tasks/{taskId}", {
    params: { path: { id, taskId } }, body: { status },
  });
  return (data ?? null) as OnboardingCase | null;
}

export async function verifyDocument(id: string, docId: string): Promise<OnboardingCase | null> {
  const { data } = await api().POST("/onboarding/cases/{id}/documents/{docId}/verify", {
    params: { path: { id, docId } },
  });
  return (data ?? null) as OnboardingCase | null;
}

export async function togglePolicy(id: string, policy: string): Promise<OnboardingCase | null> {
  const { data } = await api().POST("/onboarding/cases/{id}/policies/toggle", {
    params: { path: { id } }, body: { policy },
  });
  return (data ?? null) as OnboardingCase | null;
}

export async function activate(id: string): Promise<OnboardingCase | null> {
  const { data } = await api().POST("/onboarding/cases/{id}/activate", {
    params: { path: { id } },
  });
  return (data ?? null) as OnboardingCase | null;
}
```
> The `as OnboardingCase` casts bridge the generated OpenAPI types (structurally identical) to the frontend's hand-written `OnboardingCase`. If the generated path/param names differ from the literals above, adjust them to match `lib/api/generated/openapi.d.ts` (openapi-fetch enforces these against the spec at compile time).

- [ ] **Step 3: Rewrite `getOnboardingPipeline` in `lib/queries.ts`**

Replace the `getOnboardingPipeline` function body (lines 223-250) with:
```ts
export async function getOnboardingPipeline(): Promise<
  { id: string; name: string; title: string; startsInDays: number; progress: number }[]
> {
  const { apiClient } = await import("@/lib/api/client");
  const { data } = await apiClient("admin").GET("/onboarding/pipeline");
  return (data ?? []) as { id: string; name: string; title: string; startsInDays: number; progress: number }[];
}
```
Leave all other functions in `queries.ts` (employees, leave, etc.) on Prisma for now.

- [ ] **Step 4: Type-check the frontend**

Run:
```bash
cd "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-frontend"
npx tsc --noEmit
```
Expected: exits 0 (no type errors in `app/actions/onboarding.ts`, `lib/queries.ts`, `lib/api/client.ts`).

- [ ] **Step 5: End-to-end smoke test (both servers up)**

Run:
```bash
cd "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-backend" && npm run start:dev & sleep 9
cd "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-frontend" && (npm run dev:cloud >/tmp/fe.log 2>&1 &) ; sleep 12
curl -s -o /dev/null -w "admin onboarding page: %{http_code}\n" localhost:3000/admin/onboarding
pkill -f "next dev" 2>/dev/null; kill %1 2>/dev/null || true
```
Expected: `admin onboarding page: 200`. (Set frontend `.env` `NINJA_HR_API_URL` and `INTERNAL_API_KEY` first; uses `dev:cloud` to skip the docker/migrate `predev` since the backend now owns the DB.)

- [ ] **Step 6: Lint + commit (frontend)**

```bash
npm run lint
git add -A && git commit -m "refactor: onboarding reads/actions call backend over HTTP instead of Prisma

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.8: Onboarding e2e test (backend)

**Files:**
- Create: `ninja-hr-backend/test/onboarding.e2e-spec.ts`, `test/jest-e2e.json`

**Interfaces:**
- Consumes: the running Nest app + test database.

- [ ] **Step 1: Create the e2e jest config**

```json
// test/jest-e2e.json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "moduleNameMapper": { "^src/(.*)$": "<rootDir>/../src/$1" }
}
```

- [ ] **Step 2: Write the e2e test**

```ts
// test/onboarding.e2e-spec.ts
import 'dotenv/config';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { InternalKeyGuard } from '../src/platform/auth/internal-key.guard';

describe('Onboarding (e2e)', () => {
  let app: INestApplication;
  const key = process.env.INTERNAL_API_KEY ?? 'dev-internal-key';

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalGuards(new InternalKeyGuard(app.get(Reflector)));
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('rejects requests without the internal key', () => {
    return request(app.getHttpServer()).get('/api/v1/onboarding/cases').expect(401);
  });

  it('lists cases with display-string enums', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/onboarding/cases')
      .set('x-internal-key', key)
      .set('x-actor-persona', 'admin')
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length) {
      const c = res.body[0];
      expect(['Invited', 'Forms In Progress', 'Pending Verification', 'Ready to Activate', 'Active']).toContain(c.status);
    }
  });

  it('creates a case and returns Invited status', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/onboarding/cases')
      .set('x-internal-key', key)
      .set('x-actor-persona', 'admin')
      .send({ name: 'E2E Tester', province: 'ON', startDate: '2026-08-01', personalEmail: 'e2e@test.com' })
      .expect(201);
    expect(res.body.status).toBe('Invited');
    expect(res.body.checklist.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run e2e (DB up)**

Run:
```bash
cd "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-backend"
npm run db:up && npm run test:e2e
```
Expected: 3 tests PASS.

- [ ] **Step 4: Run the full unit suite**

Run: `npm test`
Expected: all domain/infra/application unit specs PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "test: onboarding e2e (guard, list, create)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2+ (out of scope for this plan — templated follow-ups)

Each remaining context gets its own plan following the **exact Task 1.2→1.8 template** proven here:
domain (types + any logic + tests) → infrastructure (mapper + repository) → application
(queries + commands + events) → interface (controller + DTOs + module) → frontend rewrite →
e2e. Order and notes:

1. **People** — `getEmployees`, `getEmployeeByName`, `getHeadcountByDept`, `getSalaryBenchmarks`. No commands. Emits no events; consumes `EmploymentTerminatedEvent` (from Offboarding).
2. **TimeOff** — `getLeaveRequests`; commands `setLeaveStatus`, `createLeaveRequest` (resolves employee by name via People).
3. **Recruitment** — `getRequisitions`, `getCandidates`; commands `publishRequisition`, `setCandidateStage`.
4. **Performance** — `getPerformanceReviews`, `getPips`; commands `advanceReviewState` (REVIEW_FLOW state machine → domain service with tests), `issuePip`.
5. **Offboarding** — `getOffboardingTasks`; commands `setOffboardingTaskStatus`, `finalizeTermination` → publishes `EmploymentTerminatedEvent` consumed by People to set `Employee.status=TERMINATED` (no cross-context DB write).
6. **Workplace** — `getBenefitsCarriers`, `getVaultDocuments`, `getTrainingCourses`. Reads only.
7. **Platform** — `getSettings`/`saveSettings`, `getAgentRuns`/`createAgentRun`/`setAgentRunStatus`, and `askCoPilot` (move Anthropic SDK + persona prompts here; preserve the `{ live: false }` canned-fallback contract).

**Final cleanup plan (after all 7 land):** delete frontend `lib/db.ts`, `lib/queries.ts` (replaced wholesale by `lib/api`), `lib/db-map.ts`, `lib/onboarding.ts`/`lib/compliance.ts` domain logic now owned by backend, `prisma/`, `prisma.config.ts`, `docker-compose.yml`; remove `@prisma/client`, `prisma`, `pg`, `@prisma/adapter-pg`, `server-only` (or keep `server-only` to guard `lib/api`) from frontend `package.json`; drop the `predev`/`db:*` scripts.

---

## Self-Review

**Spec coverage** (spec §§ → tasks):
- §2 workspace layout → Task 0.1. §3.A server-side BFF → Task 0.4/0.5/1.7. §3.B OpenAPI codegen → Task 0.4/1.7. §3.D internal-key auth → Task 0.4. §3.F DB ownership → Task 0.3. §4 layered structure → Tasks 1.1–1.6. §5 frontend changes → Task 1.7 (+ Phase 2 cleanup). §6.1 Onboarding mapping → Tasks 1.2–1.6. §7 HTTP surface → Task 1.6. §8 sequencing (Phase 0 + Phase 1) → this plan; Phases 2–8 → templated section. §9 testing → Tasks 1.2, 1.3, 1.5, 1.8. §10 linting → Tasks 0.2, 0.5.
- Gaps acknowledged: §6.2–6.8 contexts are intentionally deferred to follow-up plans (scope decision, stated up front). The §6.6 cross-context termination event is specified in the Phase 2+ template (Offboarding).

**Placeholder scan:** No `TBD`/`TODO`/"add error handling"/"similar to" left. Every code step contains complete code; every command states expected output. Two explicit "adjust to match generated names" notes (Tasks 1.7) are guarded fallbacks, not placeholders — the primary code is complete.

**Type consistency:** `OnboardingCase`/`ChecklistTask`/`FormFlags`/`TaskStatus`/`ProvinceCode` names are identical across domain, mapper, repository, handlers, controller, and frontend. Command/handler names match their module registration (Task 1.6). `settle(repo, id)` signature consistent across all command handlers. Repository method names referenced by handlers (`findById`, `findByToken`, `setStatus`, `addAudit`, `replaceDocuments`, `replaceChecklist`, `setTaskStatus`, `verifyDocument`, `setPolicies`, `addConsentEntry`, `updateForms`, `createCase`, `list`, `pipeline`) all exist in Task 1.3.
