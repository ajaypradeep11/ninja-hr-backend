export interface PlatformCompany {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  employeeCount: number;
  userCount: number;
  openRoles: number;
}

export interface PlatformUser {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  title: string;
  department: string;
  role: string;
  createdAt: string;
}

/**
 * AgentRun is deliberately not a log source. It has no createdAt and its `time`
 * column is a free-text display string, so its rows cannot be ordered into a
 * time-sorted feed without inventing timestamps. AuditEntry.at and
 * ModerationEvent.createdAt are both real DateTimes.
 */
export type LogKind = 'audit' | 'moderation';
export type LogSeverity = 'info' | 'warning' | 'error';

export interface PlatformLog {
  id: string;
  kind: LogKind;
  severity: LogSeverity;
  message: string;
  company: string;
  at: string;
}

export interface PlatformMetrics {
  companies: number;
  users: number;
  activeCompanies: number;
  failures: number;
}

export interface PlatformOverview {
  metrics: PlatformMetrics;
  companies: PlatformCompany[];
  recentLogs: PlatformLog[];
}

/**
 * Severity is derived, not stored: neither source table carries a severity
 * column.
 *
 * Note there is deliberately no 'error' case. Nothing in the schema records a
 * failure — AgentStatus is only RUNNING | AWAITING_APPROVAL | COMPLETED, with no
 * failed state — so no row can honestly be called an error today. The Overview
 * "Errors" bar therefore sits at zero rather than being fed an invented number.
 * If a failure state is added later, map it here and the bar starts reporting on
 * its own.
 */
export function severityFor(kind: LogKind): LogSeverity {
  // A guardrail block is a real "something was stopped" signal; an audit entry
  // is a routine record of something that happened.
  return kind === 'moderation' ? 'warning' : 'info';
}
