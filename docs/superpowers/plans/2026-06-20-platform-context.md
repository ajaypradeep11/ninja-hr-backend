# Platform Bounded Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Platform bounded context (Settings + Agents + Co-Pilot/AI) in the NestJS backend, registering it as PlatformModule in app.module.ts.

**Architecture:** Single NestJS module under `src/contexts/platform/` following the domain/infrastructure/application/interface layering established by `people` (reads) and `timeoff` (commands). Uses CQRS with QueryBus + CommandBus. CoPilotService wraps `@anthropic-ai/sdk` directly and is provided by the module.

**Tech Stack:** NestJS 11, @nestjs/cqrs, @anthropic-ai/sdk, Prisma (companySettings + agentRun models), class-validator DTOs, TypeScript path alias `src/...`.

## Global Constraints

- NEVER touch `prisma/schema.prisma` or run migrations that create new tables — "No pending migrations" must pass.
- All enum string literals must be frozen exactly: `'Running'↔'RUNNING'`, `'Awaiting Approval'↔'AWAITING_APPROVAL'`, `'Completed'↔'COMPLETED'`.
- DEFAULT_SETTINGS must match frontend `lib/queries.ts` exactly.
- `@Actor()` decorator reads `x-actor-persona` header → `'admin' | 'employee'` (already exists at `src/platform/auth/actor.decorator.ts`).
- CoPilot: if `ANTHROPIC_API_KEY` is empty or doesn't start with `'sk-ant-'` → return `{ text: "", live: false }`.
- Import alias `src/...` (not relative for cross-directory imports).
- `npm run build` exit 0, `npm test` passes, `npm run lint` exit 0.
- Conventional Commits with trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

```
src/contexts/platform/
  domain/platform.types.ts
  infrastructure/platform.mapper.ts
  infrastructure/platform.mapper.spec.ts
  infrastructure/platform.repository.ts
  infrastructure/copilot.service.ts
  application/queries/get-settings.query.ts
  application/queries/get-agent-runs.query.ts
  application/queries/ask-copilot.query.ts
  application/commands/save-settings.command.ts
  application/commands/create-agent-run.command.ts
  application/commands/set-agent-run-status.command.ts
  interface/dto/platform.dto.ts
  interface/platform.controller.ts
  platform.module.ts
src/app.module.ts  (additive only — add PlatformModule import)
```

---

### Task 1: Install @anthropic-ai/sdk and scaffold directory

**Files:**
- Modify: `package.json` (via npm install)
- Create: `src/contexts/platform/` directory tree

- [ ] **Step 1: Install SDK**

```bash
cd /Users/ajaypradeepm/Work/NinjaHR\ project/ninja-hr-backend && npm i @anthropic-ai/sdk
```

Expected: SDK installed, package.json updated with `"@anthropic-ai/sdk": "^X.Y.Z"`.

- [ ] **Step 2: Create directory tree**

```bash
mkdir -p "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-backend/src/contexts/platform/domain"
mkdir -p "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-backend/src/contexts/platform/infrastructure"
mkdir -p "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-backend/src/contexts/platform/application/queries"
mkdir -p "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-backend/src/contexts/platform/application/commands"
mkdir -p "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-backend/src/contexts/platform/interface/dto"
```

---

### Task 2: Domain types

**Files:**
- Create: `src/contexts/platform/domain/platform.types.ts`

**Interfaces:**
- Produces: `CompanySettings`, `Integrations`, `AgentRun`, `AgentStatus`, `DEFAULT_SETTINGS` (used by all other tasks)

- [ ] **Step 1: Write domain types**

```typescript
// src/contexts/platform/domain/platform.types.ts

export type AgentStatus = 'Running' | 'Awaiting Approval' | 'Completed';

export interface AgentRun {
  id: string;
  intent: string;
  status: AgentStatus;
  progress: number;
  affected: number;
  summary: string;
  time: string;
}

export interface Integrations {
  google: boolean;
  m365: boolean;
  slack: boolean;
  sharepoint: boolean;
  esign: boolean;
  wagepoint: boolean;
  payworks: boolean;
  quickbooks: boolean;
}

export interface CompanySettings {
  companyName: string;
  provinces: string[];
  integrations: Integrations;
  recognitionPublic: boolean;
}

export const DEFAULT_SETTINGS: CompanySettings = {
  companyName: 'TestHR Inc.',
  provinces: ['ON', 'BC', 'QC', 'SK'],
  integrations: {
    google: true,
    m365: true,
    slack: true,
    sharepoint: true,
    esign: false,
    wagepoint: false,
    payworks: false,
    quickbooks: true,
  },
  recognitionPublic: true,
};
```

---

### Task 3: Mapper + mapper spec (TDD)

**Files:**
- Create: `src/contexts/platform/infrastructure/platform.mapper.ts`
- Create: `src/contexts/platform/infrastructure/platform.mapper.spec.ts`

**Interfaces:**
- Consumes: `AgentRun`, `AgentStatus` from `../domain/platform.types`
- Produces: `agentStatusToDb`, `agentStatusFromDb`, `rowToAgentRun`, `settingsRowToDto`

- [ ] **Step 1: Write the failing test**

```typescript
// src/contexts/platform/infrastructure/platform.mapper.spec.ts
import { agentStatusToDb, agentStatusFromDb } from './platform.mapper';

describe('platform enum maps', () => {
  it('round-trips Running', () => {
    expect(agentStatusToDb['Running']).toBe('RUNNING');
    expect(agentStatusFromDb['RUNNING']).toBe('Running');
  });

  it('round-trips Awaiting Approval', () => {
    expect(agentStatusToDb['Awaiting Approval']).toBe('AWAITING_APPROVAL');
    expect(agentStatusFromDb['AWAITING_APPROVAL']).toBe('Awaiting Approval');
  });

  it('round-trips Completed', () => {
    expect(agentStatusToDb['Completed']).toBe('COMPLETED');
    expect(agentStatusFromDb['COMPLETED']).toBe('Completed');
  });

  it('round-trips all three statuses', () => {
    const statuses = ['Running', 'Awaiting Approval', 'Completed'] as const;
    for (const s of statuses) {
      const db = agentStatusToDb[s];
      expect(agentStatusFromDb[db]).toBe(s);
    }
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-backend" && npx jest platform.mapper.spec --no-coverage 2>&1 | tail -20
```

Expected: FAIL with "Cannot find module './platform.mapper'"

- [ ] **Step 3: Write mapper implementation**

```typescript
// src/contexts/platform/infrastructure/platform.mapper.ts
import type { AgentRun, AgentStatus, CompanySettings, Integrations } from '../domain/platform.types';

function invert<K extends string, V extends string>(m: Record<K, V>): Record<V, K> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<V, k>;
}

export const agentStatusToDb = {
  Running: 'RUNNING',
  'Awaiting Approval': 'AWAITING_APPROVAL',
  Completed: 'COMPLETED',
} satisfies Record<AgentStatus, string>;

export const agentStatusFromDb = invert(agentStatusToDb);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToAgentRun(row: any): AgentRun {
  return {
    id: row.id,
    intent: row.intent,
    status: agentStatusFromDb[row.status as keyof typeof agentStatusFromDb],
    progress: row.progress,
    affected: row.affected,
    summary: row.summary,
    time: row.time,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function settingsRowToDto(row: any): CompanySettings {
  return {
    companyName: row.companyName,
    provinces: row.provinces,
    integrations: row.integrations as unknown as Integrations,
    recognitionPublic: row.recognitionPublic,
  };
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-backend" && npx jest platform.mapper.spec --no-coverage 2>&1 | tail -10
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-backend" && git add src/contexts/platform/domain/platform.types.ts src/contexts/platform/infrastructure/platform.mapper.ts src/contexts/platform/infrastructure/platform.mapper.spec.ts && git commit -m "$(cat <<'EOF'
feat(platform): add domain types and agentStatus mapper with round-trip tests

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Repository

**Files:**
- Create: `src/contexts/platform/infrastructure/platform.repository.ts`

**Interfaces:**
- Consumes: `PrismaService` from `src/platform/database/prisma.service`, `rowToAgentRun`, `settingsRowToDto`, `agentStatusToDb` from `./platform.mapper`, `DEFAULT_SETTINGS`, `CompanySettings`, `AgentRun`, `AgentStatus` from `../domain/platform.types`
- Produces: `PlatformRepository` with methods: `getSettings()`, `saveSettings(settings)`, `getAgentRuns()`, `createAgentRun(intent)`, `setAgentRunStatus(id, status)`

- [ ] **Step 1: Write repository**

```typescript
// src/contexts/platform/infrastructure/platform.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/platform/database/prisma.service';
import type { CompanySettings, AgentRun, AgentStatus } from '../domain/platform.types';
import { DEFAULT_SETTINGS } from '../domain/platform.types';
import { agentStatusToDb, rowToAgentRun, settingsRowToDto } from './platform.mapper';

@Injectable()
export class PlatformRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<CompanySettings> {
    const row = await this.prisma.companySettings.findUnique({ where: { id: 'default' } });
    if (!row) return DEFAULT_SETTINGS;
    return settingsRowToDto(row);
  }

  async saveSettings(settings: CompanySettings): Promise<CompanySettings> {
    await this.prisma.companySettings.upsert({
      where: { id: 'default' },
      update: {
        companyName: settings.companyName,
        provinces: settings.provinces,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        integrations: settings.integrations as any,
        recognitionPublic: settings.recognitionPublic,
      },
      create: {
        id: 'default',
        companyName: settings.companyName,
        provinces: settings.provinces,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        integrations: settings.integrations as any,
        recognitionPublic: settings.recognitionPublic,
      },
    });
    return this.getSettings();
  }

  async getAgentRuns(): Promise<AgentRun[]> {
    const rows = await this.prisma.agentRun.findMany();
    return rows.map(rowToAgentRun);
  }

  async createAgentRun(intent: string): Promise<AgentRun[]> {
    await this.prisma.agentRun.create({
      data: {
        intent,
        status: 'RUNNING',
        progress: 15,
        affected: 0,
        summary: `Agent started: ${intent}`,
        time: 'just now',
      },
    });
    return this.getAgentRuns();
  }

  async setAgentRunStatus(id: string, status: AgentStatus): Promise<AgentRun[]> {
    await this.prisma.agentRun.update({
      where: { id },
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: agentStatusToDb[status] as any,
        progress: status === 'Completed' ? 100 : undefined,
      },
    });
    return this.getAgentRuns();
  }
}
```

---

### Task 5: CoPilot service

**Files:**
- Create: `src/contexts/platform/infrastructure/copilot.service.ts`

**Interfaces:**
- Consumes: `@anthropic-ai/sdk`, `Persona` from `src/platform/auth/actor.decorator`
- Produces: `CopilotService.askCoPilot(question: string, persona: Persona): Promise<{ text: string; live: boolean }>`

- [ ] **Step 1: Write CopilotService**

```typescript
// src/contexts/platform/infrastructure/copilot.service.ts
import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type { Persona } from 'src/platform/auth/actor.decorator';

const KEY = process.env.ANTHROPIC_API_KEY;

function hasLiveKey(): boolean {
  return !!KEY && KEY.startsWith('sk-ant-');
}

const SYSTEM_BASE = `You are the HR Co-Pilot for TestHR, an agentic HR platform for the Canadian market.
Be concise and helpful — answer in 1-3 short sentences, no preamble. You understand Canadian
provincial employment standards (ESA), Ontario Bill 149, and Quebec Law 25 at a high level.

Hard guardrails you always respect and mention when relevant:
- You never execute destructive actions (deletions, status changes to Terminated/Rejected)
  without explicit human approval — you queue them for a one-click confirmation instead.
- For employee-facing questions you are scoped to the current user's own data only.
- This is illustrative guidance, not legal advice.`;

const SYSTEM_ADMIN = `${SYSTEM_BASE}

You are speaking to an HR Admin (Sarah Mitchell). You can read across Recruitment, Onboarding,
Leave, Documents, Performance, and Offboarding, and you can queue multi-step workflows for approval.`;

const SYSTEM_EMPLOYEE = `${SYSTEM_BASE}

You are speaking to an employee (Jim Scott, a BC-based Account Executive). Answer questions about
his leave balances, pay schedule, training, and HR policies. You cannot see other employees' data.`;

export interface CoPilotResult {
  text: string;
  live: boolean;
}

@Injectable()
export class CopilotService {
  async askCoPilot(question: string, persona: Persona): Promise<CoPilotResult> {
    if (!hasLiveKey()) return { text: '', live: false };

    try {
      const client = new Anthropic();
      const response = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        system: persona === 'admin' ? SYSTEM_ADMIN : SYSTEM_EMPLOYEE,
        messages: [{ role: 'user', content: question }],
      });
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();
      return { text: text || '', live: true };
    } catch {
      return { text: '', live: false };
    }
  }
}
```

---

### Task 6: CQRS queries

**Files:**
- Create: `src/contexts/platform/application/queries/get-settings.query.ts`
- Create: `src/contexts/platform/application/queries/get-agent-runs.query.ts`
- Create: `src/contexts/platform/application/queries/ask-copilot.query.ts`

**Interfaces:**
- Consumes: `PlatformRepository`, `CopilotService`, `Persona` from `src/platform/auth/actor.decorator`
- Produces: `GetSettingsQuery/Handler`, `GetAgentRunsQuery/Handler`, `AskCopilotQuery/Handler`

- [ ] **Step 1: Write GetSettingsQuery**

```typescript
// src/contexts/platform/application/queries/get-settings.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PlatformRepository } from '../../infrastructure/platform.repository';
import type { CompanySettings } from '../../domain/platform.types';

export class GetSettingsQuery {}

@QueryHandler(GetSettingsQuery)
export class GetSettingsHandler implements IQueryHandler<GetSettingsQuery, CompanySettings> {
  constructor(private readonly repo: PlatformRepository) {}
  execute(): Promise<CompanySettings> {
    return this.repo.getSettings();
  }
}
```

- [ ] **Step 2: Write GetAgentRunsQuery**

```typescript
// src/contexts/platform/application/queries/get-agent-runs.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PlatformRepository } from '../../infrastructure/platform.repository';
import type { AgentRun } from '../../domain/platform.types';

export class GetAgentRunsQuery {}

@QueryHandler(GetAgentRunsQuery)
export class GetAgentRunsHandler implements IQueryHandler<GetAgentRunsQuery, AgentRun[]> {
  constructor(private readonly repo: PlatformRepository) {}
  execute(): Promise<AgentRun[]> {
    return this.repo.getAgentRuns();
  }
}
```

- [ ] **Step 3: Write AskCopilotQuery**

```typescript
// src/contexts/platform/application/queries/ask-copilot.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CopilotService, type CoPilotResult } from '../../infrastructure/copilot.service';
import type { Persona } from 'src/platform/auth/actor.decorator';

export class AskCopilotQuery {
  constructor(
    public readonly question: string,
    public readonly persona: Persona,
  ) {}
}

@QueryHandler(AskCopilotQuery)
export class AskCopilotHandler implements IQueryHandler<AskCopilotQuery, CoPilotResult> {
  constructor(private readonly copilot: CopilotService) {}
  execute({ question, persona }: AskCopilotQuery): Promise<CoPilotResult> {
    return this.copilot.askCoPilot(question, persona);
  }
}
```

---

### Task 7: CQRS commands

**Files:**
- Create: `src/contexts/platform/application/commands/save-settings.command.ts`
- Create: `src/contexts/platform/application/commands/create-agent-run.command.ts`
- Create: `src/contexts/platform/application/commands/set-agent-run-status.command.ts`

**Interfaces:**
- Consumes: `PlatformRepository`, `CompanySettings`, `AgentRun`, `AgentStatus` from domain
- Produces: `SaveSettingsCommand/Handler`, `CreateAgentRunCommand/Handler`, `SetAgentRunStatusCommand/Handler`

- [ ] **Step 1: Write SaveSettingsCommand**

```typescript
// src/contexts/platform/application/commands/save-settings.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PlatformRepository } from '../../infrastructure/platform.repository';
import type { CompanySettings } from '../../domain/platform.types';

export class SaveSettingsCommand {
  constructor(public readonly settings: CompanySettings) {}
}

@CommandHandler(SaveSettingsCommand)
export class SaveSettingsHandler
  implements ICommandHandler<SaveSettingsCommand, CompanySettings>
{
  constructor(private readonly repo: PlatformRepository) {}
  execute({ settings }: SaveSettingsCommand): Promise<CompanySettings> {
    return this.repo.saveSettings(settings);
  }
}
```

- [ ] **Step 2: Write CreateAgentRunCommand**

```typescript
// src/contexts/platform/application/commands/create-agent-run.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PlatformRepository } from '../../infrastructure/platform.repository';
import type { AgentRun } from '../../domain/platform.types';

export class CreateAgentRunCommand {
  constructor(public readonly intent: string) {}
}

@CommandHandler(CreateAgentRunCommand)
export class CreateAgentRunHandler
  implements ICommandHandler<CreateAgentRunCommand, AgentRun[]>
{
  constructor(private readonly repo: PlatformRepository) {}
  execute({ intent }: CreateAgentRunCommand): Promise<AgentRun[]> {
    return this.repo.createAgentRun(intent);
  }
}
```

- [ ] **Step 3: Write SetAgentRunStatusCommand**

```typescript
// src/contexts/platform/application/commands/set-agent-run-status.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PlatformRepository } from '../../infrastructure/platform.repository';
import type { AgentRun, AgentStatus } from '../../domain/platform.types';

export class SetAgentRunStatusCommand {
  constructor(
    public readonly id: string,
    public readonly status: AgentStatus,
  ) {}
}

@CommandHandler(SetAgentRunStatusCommand)
export class SetAgentRunStatusHandler
  implements ICommandHandler<SetAgentRunStatusCommand, AgentRun[]>
{
  constructor(private readonly repo: PlatformRepository) {}
  execute({ id, status }: SetAgentRunStatusCommand): Promise<AgentRun[]> {
    return this.repo.setAgentRunStatus(id, status);
  }
}
```

---

### Task 8: DTOs

**Files:**
- Create: `src/contexts/platform/interface/dto/platform.dto.ts`

**Interfaces:**
- Consumes: `AgentStatus` from `../../domain/platform.types`
- Produces: `SaveSettingsDto`, `CreateAgentRunDto`, `SetAgentRunStatusDto`, `AskCopilotDto`

- [ ] **Step 1: Write DTOs**

```typescript
// src/contexts/platform/interface/dto/platform.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsArray, IsString, IsIn, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { AgentStatus } from '../../domain/platform.types';

const AGENT_STATUSES: AgentStatus[] = ['Running', 'Awaiting Approval', 'Completed'];

export class IntegrationsDto {
  @ApiProperty() @IsBoolean() google!: boolean;
  @ApiProperty() @IsBoolean() m365!: boolean;
  @ApiProperty() @IsBoolean() slack!: boolean;
  @ApiProperty() @IsBoolean() sharepoint!: boolean;
  @ApiProperty() @IsBoolean() esign!: boolean;
  @ApiProperty() @IsBoolean() wagepoint!: boolean;
  @ApiProperty() @IsBoolean() payworks!: boolean;
  @ApiProperty() @IsBoolean() quickbooks!: boolean;
}

export class SaveSettingsDto {
  @ApiProperty() @IsString() companyName!: string;
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) provinces!: string[];
  @ApiProperty({ type: IntegrationsDto }) @IsObject() @ValidateNested() @Type(() => IntegrationsDto) integrations!: IntegrationsDto;
  @ApiProperty() @IsBoolean() recognitionPublic!: boolean;
}

export class CreateAgentRunDto {
  @ApiProperty() @IsString() intent!: string;
}

export class SetAgentRunStatusDto {
  @ApiProperty({ enum: AGENT_STATUSES })
  @IsIn(AGENT_STATUSES)
  status!: AgentStatus;
}

export class AskCopilotDto {
  @ApiProperty() @IsString() question!: string;
}
```

---

### Task 9: Controller

**Files:**
- Create: `src/contexts/platform/interface/platform.controller.ts`

**Interfaces:**
- Consumes: All queries/commands, DTOs, `Actor` decorator from `src/platform/auth/actor.decorator`
- Produces: REST routes under `'platform'`

- [ ] **Step 1: Write controller**

```typescript
// src/contexts/platform/interface/platform.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { GetSettingsQuery } from '../application/queries/get-settings.query';
import { GetAgentRunsQuery } from '../application/queries/get-agent-runs.query';
import { AskCopilotQuery } from '../application/queries/ask-copilot.query';
import { SaveSettingsCommand } from '../application/commands/save-settings.command';
import { CreateAgentRunCommand } from '../application/commands/create-agent-run.command';
import { SetAgentRunStatusCommand } from '../application/commands/set-agent-run-status.command';
import { SaveSettingsDto, CreateAgentRunDto, SetAgentRunStatusDto, AskCopilotDto } from './dto/platform.dto';
import { Actor } from 'src/platform/auth/actor.decorator';
import type { Persona } from 'src/platform/auth/actor.decorator';

@ApiTags('platform')
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly queries: QueryBus,
    private readonly commands: CommandBus,
  ) {}

  @Get('settings')
  getSettings() {
    return this.queries.execute(new GetSettingsQuery());
  }

  @Put('settings')
  saveSettings(@Body() body: SaveSettingsDto) {
    return this.commands.execute(new SaveSettingsCommand(body));
  }

  @Get('agent-runs')
  getAgentRuns() {
    return this.queries.execute(new GetAgentRunsQuery());
  }

  @Post('agent-runs')
  createAgentRun(@Body() body: CreateAgentRunDto) {
    return this.commands.execute(new CreateAgentRunCommand(body.intent));
  }

  @Patch('agent-runs/:id/status')
  setAgentRunStatus(@Param('id') id: string, @Body() body: SetAgentRunStatusDto) {
    return this.commands.execute(new SetAgentRunStatusCommand(id, body.status));
  }

  @Post('copilot/ask')
  askCopilot(@Body() body: AskCopilotDto, @Actor() persona: Persona) {
    return this.queries.execute(new AskCopilotQuery(body.question, persona));
  }
}
```

---

### Task 10: Module + app.module.ts registration

**Files:**
- Create: `src/contexts/platform/platform.module.ts`
- Modify: `src/app.module.ts` (additive only)

**Interfaces:**
- Consumes: All handlers + repository + CopilotService + controller

- [ ] **Step 1: Write PlatformModule**

```typescript
// src/contexts/platform/platform.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PlatformController } from './interface/platform.controller';
import { PlatformRepository } from './infrastructure/platform.repository';
import { CopilotService } from './infrastructure/copilot.service';
import { GetSettingsHandler } from './application/queries/get-settings.query';
import { GetAgentRunsHandler } from './application/queries/get-agent-runs.query';
import { AskCopilotHandler } from './application/queries/ask-copilot.query';
import { SaveSettingsHandler } from './application/commands/save-settings.command';
import { CreateAgentRunHandler } from './application/commands/create-agent-run.command';
import { SetAgentRunStatusHandler } from './application/commands/set-agent-run-status.command';

@Module({
  imports: [CqrsModule],
  controllers: [PlatformController],
  providers: [
    PlatformRepository,
    CopilotService,
    GetSettingsHandler,
    GetAgentRunsHandler,
    AskCopilotHandler,
    SaveSettingsHandler,
    CreateAgentRunHandler,
    SetAgentRunStatusHandler,
  ],
})
export class PlatformModule {}
```

- [ ] **Step 2: Register in app.module.ts (additive)**

Add `import { PlatformModule } from './contexts/platform/platform.module';` and add `PlatformModule` to the imports array — all existing modules must remain.

Final `app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from './platform/database/database.module';
import { HealthController } from './platform/health/health.controller';
import { OnboardingModule } from './contexts/onboarding/onboarding.module';
import { PeopleModule } from './contexts/people/people.module';
import { TimeoffModule } from './contexts/timeoff/timeoff.module';
import { RecruitmentModule } from './contexts/recruitment/recruitment.module';
import { PerformanceModule } from './contexts/performance/performance.module';
import { OffboardingModule } from './contexts/offboarding/offboarding.module';
import { WorkplaceModule } from './contexts/workplace/workplace.module';
import { PlatformModule } from './contexts/platform/platform.module';

@Module({
  imports: [DatabaseModule, OnboardingModule, PeopleModule, TimeoffModule, RecruitmentModule, PerformanceModule, OffboardingModule, WorkplaceModule, PlatformModule],
  controllers: [HealthController],
})
export class AppModule {}
```

---

### Task 11: Build, test, lint, migrate verification

- [ ] **Step 1: Verify no pending migrations**

```bash
cd "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-backend" && npm run prisma:migrate 2>&1
```

Expected: output contains "No pending migrations" or "All migrations have been applied".

- [ ] **Step 2: Build**

```bash
cd "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-backend" && npm run build 2>&1 | tail -20
```

Expected: exit 0, no TypeScript errors.

- [ ] **Step 3: Run tests**

```bash
cd "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-backend" && npm test 2>&1 | tail -20
```

Expected: all tests pass including new platform.mapper.spec.

- [ ] **Step 4: Lint**

```bash
cd "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-backend" && npm run lint 2>&1 | tail -10
```

Expected: exit 0, no errors.

---

### Task 12: Start server and run live curls

- [ ] **Step 1: Start server in background**

```bash
cd "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-backend" && npm run start:dev &
sleep 5
```

- [ ] **Step 2: GET /platform/settings**

```bash
curl -s -o /dev/null -w "%{http_code}" -H "x-internal-key: dev-internal-key" http://localhost:4000/api/v1/platform/settings
```

Expected: `200`

```bash
curl -s -H "x-internal-key: dev-internal-key" http://localhost:4000/api/v1/platform/settings | head -5
```

Expected: JSON object with `companyName`, `provinces`, `integrations`, `recognitionPublic`.

- [ ] **Step 3: GET /platform/agent-runs**

```bash
curl -s -H "x-internal-key: dev-internal-key" http://localhost:4000/api/v1/platform/agent-runs | head -5
```

Expected: HTTP 200 with JSON array.

- [ ] **Step 4: POST /platform/copilot/ask**

```bash
curl -s -X POST http://localhost:4000/api/v1/platform/copilot/ask \
  -H "Content-Type: application/json" \
  -H "x-internal-key: dev-internal-key" \
  -H "x-actor-persona: admin" \
  -d '{"question":"hi"}'
```

Expected: `{"text":"","live":false}` (because `ANTHROPIC_API_KEY=""` in dev).

- [ ] **Step 5: Commit final**

```bash
cd "/Users/ajaypradeepm/Work/NinjaHR project/ninja-hr-backend" && git add -A && git commit -m "$(cat <<'EOF'
feat(platform): add Platform bounded context — Settings, Agents, CoPilot

Implements PlatformModule with CQRS pattern for Settings (get/save),
AgentRuns (get/create/set-status), and CoPilot/AI (ask) endpoints.
Installs @anthropic-ai/sdk; CoPilot returns live:false when no key is set.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```
