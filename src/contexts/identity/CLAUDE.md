# [IDENTITY] Company signup, users directory, /me

## Why / design

Signup is the one flow where the tenant doesn't exist yet, so it uses the RAW
system Prisma client (no ALS context to inherit) and stamps `companyId`
explicitly on every row — including the nested User, which the tenant
extension would not stamp. The rest of the context uses the tenant client:
two different DB clients in one context, on purpose.

## Features

Multi-tenant company signup (Company + settings + founding HR_ADMIN
Employee/User + Firebase account) · demo-login directory (`GET users`) for
the frontend switcher · HR-only single-user lookup · `GET me` self-identity.

## Business rules

- Signup refuses an email whose Firebase UID is already LINKED to a User row;
  an UNLINKED residual Firebase account (failed prior signup) is adopted
  rather than burning the email. On failure it deletes only a Firebase
  account THIS call created (compensation, never a pre-existing one).
- Company slug = slugify(name), deduped `base-2, …`. Founder seeded with
  placeholder birthDate 1970-01-01, salary 0.
- `GET users` is open to any authenticated user by design, but the mapped
  shape carries only name/title/department/role — no email/salary/SIN.
- Signup throttled 10/10min/IP on top of the global throttle.

## Gotchas

- `me` returns both `userId` (possibly impersonated) and `realUserId` (true
  caller) — keep them distinct. Company is read on the system client (tenant
  root is unscoped).
