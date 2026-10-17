# Authentication and Security Audit

| | |
|---|---|
| Date | 2026-10-17 |
| Repository state | `main` at `4323f55` (PR #86) |
| Scope | Authentication, sessions, 2FA, password reset, invitations, RBAC and privilege escalation, tenant scoping, CSRF/XSS/SSRF, uploads, webhooks, CORS and headers, secrets, dependencies; plus security-relevant findings raised by the other eight agents. |
| Method | Read-only code inspection with file:line evidence; targeted local test runs; unauthenticated, low-volume GET/HEAD/OPTIONS probes of production. No production credentials, Coolify, Resend, S3 or GitHub App access. |
| Source | Security agent report (04), prefix SEC-, plus a consolidated appendix of security-relevant findings from reports 01, 02, 03, 05, 06, 07, 08 and 09 |
| Related | [System audit report](SYSTEM_AUDIT_REPORT.md) · [Bug register](BUG_REGISTER.md) · [Acceptance matrix](ACCEPTANCE_MATRIX.md) · [Remediation roadmap](REMEDIATION_ROADMAP.md) |

Each finding keeps the specialist agent's original ID; the consolidated `SW-` ID from the [bug register](BUG_REGISTER.md) is shown next to it. Severity in the index is the consolidated severity; where duplicates were merged the higher severity was kept, so it can differ from the severity line inside the original finding text.

## Finding index (security agent)

| Original ID | SW ID | Severity (consolidated) | Confidence | Consolidated title |
|---|---|---|---|---|
| SEC-001 | [SW-001](BUG_REGISTER.md#sw-001) | P1 | CONFIRMED | Mandatory 2FA for privileged roles is enforced only in the frontend |
| SEC-002 | [SW-002](BUG_REGISTER.md#sw-002) | P1 | CONFIRMED | CSRF exposure: production cookies are SameSite=None and nothing checks Origin or a CSRF token |
| SEC-003 | [SW-021](BUG_REGISTER.md#sw-021) | P2 | CONFIRMED | Login timing reveals which emails have accounts (Argon2 users ~7x faster than unknown emails) |
| SEC-004 | [SW-015](BUG_REGISTER.md#sw-015) | P2 | CONFIRMED | 2FA login step has no per-account or per-challenge attempt limit; challenge token reusable for 5 minutes; TOTP codes replayable |
| SEC-005 | [SW-016](BUG_REGISTER.md#sw-016) | P2 | CONFIRMED | TOTP secrets stored in plaintext; backup codes are unsalted SHA-256 over 32 bits |
| SEC-006 | [SW-017](BUG_REGISTER.md#sw-017) | P2 | CONFIRMED | Stored XSS on the public site through JSON-LD `set:html={JSON.stringify(...)}` |
| SEC-007 | [SW-018](BUG_REGISTER.md#sw-018) | P2 | CONFIRMED | `javascript:` and arbitrary/plain-http URLs accepted for CMS URL fields and rendered on the public site |
| SEC-008 | [SW-014](BUG_REGISTER.md#sw-014) | P2 | CONFIRMED | Public website and React app send no security headers (no CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy) |
| SEC-009 | [SW-019](BUG_REGISTER.md#sw-019) | P2 | CONFIRMED | Client portal users can read their DRAFT (and VOID) invoices |
| SEC-010 | [SW-020](BUG_REGISTER.md#sw-020) | P2 | CONFIRMED | Public project-inquiry sign-up auto-links a new portal login to an existing Client with a matching email |
| SEC-011 | [SW-023](BUG_REGISTER.md#sw-023) | P2 | CONFIRMED | Production dependency vulnerabilities: 3 critical, 18 high, 10 moderate |
| SEC-012 | [SW-022](BUG_REGISTER.md#sw-022) | P2 | SUSPECTED | Strict refresh rotation has no grace window: parallel tabs or a lost response trigger "reuse" and log out every device |
| SEC-013 | [SW-075](BUG_REGISTER.md#sw-075) | P3 | CONFIRMED | Forgot-password response timing reveals existing accounts |
| SEC-014 | [SW-076](BUG_REGISTER.md#sw-076) | P3 | CONFIRMED | Rate limiters use the in-memory store: counters reset on restart, are per replica, and anyone can lock an account out |
| SEC-015 | [SW-077](BUG_REGISTER.md#sw-077) | P3 | CONFIRMED | Logout does not invalidate the current access token; no "log out all devices" |
| SEC-016 | [SW-025](BUG_REGISTER.md#sw-025) | P2 | CONFIRMED | File downloads return 500 for non-Latin-1 filenames; Content-Disposition built from raw names |
| SEC-017 | [SW-028](BUG_REGISTER.md#sw-028) | P2 | SUSPECTED | Project managers can provision new user accounts and grant the ENGINEER role via project invite (bypassing admin-only onboarding) |
| SEC-018 | [SW-038](BUG_REGISTER.md#sw-038) | P2 | CONFIRMED | Re-running the seed overwrites admin-edited role permissions and resets the super-admin password |
| SEC-019 | [SW-078](BUG_REGISTER.md#sw-078) | P3 | CONFIRMED | No authenticated "change password" and no admin 2FA reset/recovery path |
| SEC-020 | [SW-079](BUG_REGISTER.md#sw-079) | P3 | CONFIRMED | UserInvitation model departs from data-model rules |
| SEC-021 | [SW-034](BUG_REGISTER.md#sw-034) | P2 | CONFIRMED | EVC Plus client is a generic placeholder contract; webhook has no replay window and no amount reconciliation |

## 1. Scope inspected / blocked

**Inspected (code read):**
- backend/src/routes/auth.routes.ts, controllers/auth.controller.ts, services/auth.service.ts
- backend/src/lib/{tokens,cookies,password,password-policy,totp,redisAuth,cors,env,logger,http,idempotency,storage,mailer}.ts, mail/templates.ts
- backend/src/middleware/{auth,rbac,rateLimit,validate,errorHandler}.ts, app.ts
- services: user, role, user-invitation, engineer-account, invoice, payment (webhook path), ticket, document, portal, project-inquiry (OTP + self-registration), github (webhook signature + URL checks), system-health (SSRF allow-list)
- controllers: payment, payment.webhook, invoice, ops-extra (documents/media download), github webhook
- routes: user, engineer-account, platform, ops-extra, finance (MFA gate), github
- prisma/schema.prisma auth models; migration 20261017090000_secure_user_invitations_reset_otp; prisma/seed.ts roles and permissions; docker-entrypoint.sh, Dockerfile
- packages/shared constants/roles.ts, permissions.ts, schemas/auth.ts, user.ts, team.ts, github.ts, payment.ts
- frontend: features/auth/*, lib/apiClient.ts, DOMPurify/marked usages, TwoFactorPanel QR; frontend/nginx.conf
- web: layouts/BaseLayout.astro (JSON-LD), components/TeamCard.astro, pages/blog/[slug].astro, astro.config

**Executed:**
- `npx vitest run auth.service.test.ts cookies.test.ts cors.test.ts`: 31/31 passed. These tests use mocks; there is no DB.
- Local timing measurement of the login hash paths (scratchpad/hashtime.cjs).
- `node` check that the Zod `url()` validator accepts a `javascript:` URL, and of how Node's `setHeader` handles non-Latin-1 filenames.
- `npm audit --omit=dev --json`
- Production (unauthenticated GET/OPTIONS only, about 12 requests): response headers on all three hosts, `/health`, CORS preflight from an evil origin and from the allowed origin, 401 checks on `/auth/me`, `/users`, `/finance/accounts`, and the Astro `/_image` endpoint.

**BLOCKED:**
- Production `Set-Cookie` flags. No unauthenticated endpoint sets a cookie, and logging in is forbidden by the brief.
- Real browser CSRF reproduction, which needs a session.
- Real 2FA, refresh and reuse flows against Postgres. The QA agent owns the DB-backed suite.
- Coolify env types, Resend domain (SPF/DKIM/DMARC), and S3 bucket ACLs. There are no credentials for these.

## 2. Module inventory

| module | frontend routes | backend endpoints | models | permissions | tests | status |
|---|---|---|---|---|---|---|
| Login / session | /login, /forgot-password, /reset-password | POST /auth/login, /login/2fa, /refresh, /logout, GET/PATCH /auth/me | User, RefreshToken | none / requireAuth | auth.service.test (mocked) | Works; gaps in SEC-001/002/003/004 |
| 2FA (TOTP + backup) | /profile?tab=security, TwoFactorSetupPage | POST /auth/2fa/setup, /confirm, /disable, /backup-codes | User.twoFactorSecret, TwoFactorBackupCode | requireAuth | mocked unit | Not enforced (SEC-001); secret stored in plaintext (SEC-005) |
| Password reset OTP | ForgotPassword/ResetPassword | POST /auth/forgot-password, /password-reset/verify, /reset-password | PasswordResetToken (code_hash, attempts, verified_at) | public, IP + account limited | mocked unit | Sound design. Uses crypto randomInt, 6 digits, HMAC at rest, 5 attempts, 10 min expiry, sessions revoked on reset |
| User invitations | /activate-account | POST /users, /users/invitations/:id/{resend,cancel}, POST /auth/user-invitations/{verify,activate} | UserInvitation | users.create / users.read | user-invitation.service.test | Sound. 256-bit token, SHA-256, 48 h, single use, the invitee sets their own password |
| Engineer accounts | /engineering/accounts, /engineer-activation | /engineering/accounts/*, /auth/engineer-invitations/* | EngineerAccountInvitation, EngineerProfile | engineering.manage + ADMIN/SUPER_ADMIN check in service | engineer-account*.test | OK; bypass through project invite (SEC-017) |
| Users / roles | /settings/users, /settings/roles | /users/*, /roles/*, /permissions | User, Role, Permission, UserRole | users.*, roles.read, roles.manage (SUPER_ADMIN only) | role/user tests, rbac.test | Escalation guarded (SUPER_ADMIN assignment blocked for non-SA; last SA protected) |
| Portal scoping | /portal/* | /invoices, /payments, /support-tickets, /documents, /portal/* | Invoice, Payment, SupportTicket, ClientDocument | invoices.read etc. + `roles.includes(CLIENT)` → clientId filter | portal/invoice tests | IDOR scoping correct; drafts leak (SEC-009) |
| Uploads / storage | various | /media, /documents, /cms/article-images, inquiry attachments | MediaAsset, ClientDocument | media.*, documents.* | storage*.test | Magic bytes checked, 25 MB/5 MB limits, server-generated keys, safe-key regex, O_EXCL/O_NOFOLLOW. Files are proxied through the API rather than presigned URLs |
| Webhooks | n/a | POST /payments/webhooks/evc-plus, /github/webhooks | Payment, GitHubWebhookEvent | HMAC | evcplus.client.test, github.service.test | HMAC with timingSafeEqual on the raw body. OK; see SEC-021 |
| CORS / headers | n/a | app.ts | n/a | n/a | cors.test | API OK; web/app hosts send no security headers (SEC-008) |

**Roles defined** (shared/constants/roles.ts and seeded by seed.ts): SUPER_ADMIN, ADMIN, MANAGER, FINANCE_MANAGER, ACCOUNTANT, PROJECT_MANAGER, LEAD_ENGINEER, ENGINEER, QA_ENGINEER, STAFF, EDITOR, CLIENT, GUEST. All ten roles named in the task exist. GUEST gets no permissions. 2FA is meant to be mandatory for SUPER_ADMIN, ADMIN, MANAGER, FINANCE_MANAGER, ACCOUNTANT and PROJECT_MANAGER (roles.ts:22-29).

**Verified-good items (no finding):**
- Access JWT lasts 15 m (tokens.ts:7). Refresh is an opaque 48-byte token stored as SHA-256 with a 30 d lifetime (tokens.ts:8,95-101).
- Refresh rotates under a row lock. Reusing a revoked token sets `sessionsRevokedAt` and revokes every refresh token (auth.service.ts:298-346); a unit test confirms this.
- Suspension or deactivation takes effect on the next request, because `requireAuth` reloads the active user (auth.ts, auth.service.ts:95-114). Refresh tokens are revoked on suspend and delete (user.service.ts:194-198, 222-228).
- Password reset sets `sessionsRevokedAt` and revokes refresh tokens (auth.service.ts:478-489).
- Passwords: new hashes use Argon2id (m=19456, t=2, p=1). Legacy bcrypt hashes are still verified (password.ts:6-19). Nothing rehashes a legacy bcrypt hash to Argon2 on login; that is acceptable.
- `trust proxy` is 1 (app.ts:58). CORS uses an exact allow-list, `*` is stripped (cors.ts). The probe with Origin https://evil.example got no ACAO header; the allowed origin got ACAO + credentials.
- Helmet runs on the API, and the probe showed CSP, HSTS, XFO and nosniff.
- Env is validated with Zod and only variable names are printed (env.ts).
- The logger redacts cookie, authorization and secrets (logger.ts).
- The error handler never returns stack traces.
- SSRF: the health probe allows only HTTPS hosts listed in HEALTH_PROBE_HOSTS, with no IPs, plus a DNS check (system-health.service.ts). GitHub links must be on github.com for the right repo (github.service.ts:40-70). No other code fetches a user-supplied URL.
- Privilege escalation: a non-SUPER_ADMIN cannot assign or edit SUPER_ADMIN (user.service.ts:107-115,170-174; user-invitation.service.ts:20). Only SUPER_ADMIN holds roles.manage (seed.ts ADMIN set excludes it), and the SUPER_ADMIN role cannot be edited (role.service.ts:53-60).
- IDOR: invoice, payment, ticket and document lookups use `findFirst({id, clientId})` for CLIENT users and return 404 (invoice.service.ts:89-118, document.service.ts:24-99, portal.service.ts:35-133, payment.controller.ts:7-21).
- Secrets: no keys or real credentials are committed. Only `.env.example` files with placeholders are present.
- DOMPurify wraps every `marked` output in the frontend. The TOTP QR SVG is generated locally.

## 3. Findings

### SEC-001 (SW-001) — Mandatory 2FA for privileged roles is enforced only in the frontend
- Severity: **P1** · Confidence: CONFIRMED (code path) · Module: Auth / RBAC
- **Description:** CLAUDE.md §13 says 2FA is mandatory for SUPER_ADMIN, ADMIN and MANAGER. The code computes `twoFactorRequired` (auth.service.ts:66), but the only consumer is the SPA redirect in `frontend/src/features/auth/loginDestination.ts:4`. `requireAuth` (middleware/auth.ts:10-40) and `rbac` (middleware/rbac.ts) never check it.
- **Reproduction:** A SUPER_ADMIN/ADMIN/MANAGER with `twoFactorEnabled=false` (the seeded super-admin starts this way, seed.ts:478-482) logs in with a password only and gets a full session (auth.service.ts:146-156). They can then call /users, /roles, /invoices/:id/void, /employees and so on directly.
- **Expected:** The server refuses privileged API access until 2FA is enrolled and verified for the session.
- **Actual:** Only `/api/v1/finance/*` and the finance reports check MFA (finance.routes.ts:53-68, reports.routes.ts:137-178).
- **Evidence:** `grep twoFactorRequired backend/src` returns only types, the controller response and toAuthUser. There is no middleware use.
- **Root cause:** The policy is computed but never applied on the server.
- **Affected users:** every privileged account. **Business impact:** a phished or reused password for an admin gives full control of users, invoices and HR data.
- **Recommended fix:** Add a `requireMfaForPrivilegedRoles` middleware after `requireAuth`.
  - When `isTwoFactorRequired(roles)` and there is no `mfaVerifiedAt` in the token, return 403 `MFA_REQUIRED` everywhere except `/auth/me`, `/auth/2fa/*` and `/auth/logout`.
  - Add a test for each required role.
- Dependencies: none. Complexity: S. **Verification:** an API test where an ADMIN without 2FA gets 403 on GET /users and 200 on /auth/2fa/setup.

### SEC-002 (SW-002) — CSRF exposure: production cookies are SameSite=None, and nothing checks Origin or a CSRF token
- Severity: **P1** · Confidence: CONFIRMED (code path; not reproduced in a browser because there is no session) · Module: Auth cookies / all mutating routes
- **Description:**
  - cookies.ts:21 sets `sameSite: isProd ? 'none' : 'lax'`. Its comment (cookies.ts:3-8) claims app.somwave.botandev.com and api.somwave.botandev.com are cross-site. They are the same site: both share the registrable domain botandev.com, so SameSite=Lax cookies would be sent on credentialed fetches from the app.
  - With SameSite=None, any third-party page can submit a cross-site `<form method=POST>` to the API with the victim's cookies attached. A form post is a "simple" request, so there is no preflight, and CORS only blocks reading the response.
  - Endpoints that need no JSON body and no custom header are therefore CSRF-able:
    - `POST /api/v1/invoices/:id/void` (platform.routes.ts:126; the void controller needs no Idempotency-Key, invoice.controller.ts:77-85)
    - `POST /api/v1/finance/transactions/:id/{submit,post,cancel}` (finance.routes.ts:246-280; the MFA gate passes because the victim's cookie carries mfaVerifiedAt)
    - `POST /engineering/accounts/:userId/{suspend,reactivate,cancel,resend}` (engineer-account.routes.ts:20-23)
    - `POST /users/invitations/:id/cancel` (user.routes.ts:37-48)
    - `POST /auth/logout` and `POST /auth/2fa/setup`
  - IDs are cuids. An insider who knows a target id, for example a CLIENT who knows their own invoice id, can lure a finance user to a page that voids that invoice.
- **Expected:** SameSite=Lax/Strict, plus an Origin/Referer allow-list check, or a double-submit CSRF token, on every unsafe method.
- **Actual:** Neither exists (app.ts:53-130).
- **Root cause:** A wrong same-site assumption in the cookie config.
- **Affected users:** all staff with mutating permissions. **Business impact:** unauthorized voiding of invoices and posting of finance transactions.
- **Recommended fix:**
  - Set `sameSite: 'lax'`, or `'strict'`, in production.
  - Add an Origin check middleware: on POST, PUT, PATCH and DELETE, reject requests whose Origin is present and not in corsOrigins; also reject requests with no Origin and a browser Sec-Fetch-Site of `cross-site`.
  - Optionally require `Content-Type: application/json` on every mutating route.
- Complexity: S. **Verification:** a supertest case where a POST with `Origin: https://evil.example` gets 403; a manual login on staging confirms the cookie still works with Lax.

### SEC-003 (SW-021) — Login timing reveals which emails have accounts (Argon2 users are about 7x faster than unknown emails)
- Severity: P2 · Confidence: CONFIRMED (measured locally) · Module: Auth login
- **Description:**
  - For unknown, inactive or suspended emails, login verifies against the dummy bcrypt cost-12 hash in auth.service.ts:141.
  - Real users created after the Argon2 switch verify with Argon2id (password.ts:6-13).
  - Measured: dummy bcrypt compare took 281 ms, while an Argon2id verify of a wrong password took 42 ms (scratchpad/hashtime.cjs).
  - The dummy string is also 59 characters, not a valid 60-character bcrypt hash, although bcrypt still burned the cost.
- **Impact:** reliable enumeration of active accounts by timing, despite the identical error message.
- **Fix:** Use an Argon2id dummy hash with the same parameters, generated once at boot. Optionally rehash legacy bcrypt hashes on successful login so all users share one timing profile.
- Complexity: S. **Verification:** a micro-benchmark test comparing timings for unknown and existing users.

### SEC-004 (SW-015) — 2FA login step has no account-level or per-challenge attempt limit; TOTP codes can be replayed
- Severity: P2 · Confidence: CONFIRMED (code) · Module: 2FA
- **Description:**
  - `/auth/login/2fa` uses `loginAccountRateLimiter`, but that limiter keys on `req.body.email` and is skipped when there is none (rateLimit.ts:49-51). The 2FA body is `{challengeToken, code}`, so only the IP limiter applies: 20 requests per 15 min per IP.
  - A challenge token stays valid for 5 min (tokens.ts:24). It can be reused for unlimited guesses and re-minted by logging in again.
  - Every guess also tries the 8 backup codes, which have 32 bits each.
  - `verifyTotp` accepts ±30 s (totp.ts:15) and does not store the last accepted step, so a captured code can be replayed inside the window.
- **Impact:** an attacker who already has the password, using distributed IPs, can brute-force the second factor. Each guess has about 3e-6 success probability; across many IPs this is practical within days.
- **Fix:**
  - Key the 2FA limiter on the challenge `sub`.
  - Add a per-user failed-2FA counter with lockout or backoff.
  - Store `lastTotpStep` and reject reuse.
- Complexity: S-M.

### SEC-005 (SW-016) — TOTP secret is stored in plaintext; backup codes use unsalted SHA-256 over 32 bits
- Severity: P2 · Confidence: CONFIRMED · Module: 2FA storage
- **Evidence:** schema.prisma:27 `twoFactorSecret String?` is written raw (auth.service.ts:199-202). Backup codes are generated with `randomBytes(4).toString('hex')` and hashed with plain SHA-256 (auth.service.ts:207-214).
- **Impact:** a DB read (backup, SQL leak) defeats 2FA for every user. A 32-bit unsalted hash is brute-forced offline in seconds.
- **Fix:** Encrypt the secret with AES-GCM using a key from env (CLAUDE.md §13 requires sensitive columns encrypted at rest). Use 10+ character codes and an HMAC with a server pepper, or Argon2.
- Complexity: M (needs a data migration).

### SEC-006 (SW-017) — Stored XSS on the public website through JSON-LD `set:html`
- Severity: P2 · Confidence: CONFIRMED (code path; not exploited) · Module: web (Astro) / CMS
- **Evidence:** web/src/layouts/BaseLayout.astro:100,103: `<script type="application/ld+json" set:html={JSON.stringify(articleSchema)} is:inline />`. `headline: title` and `description` come from CMS post data (blog/[slug].astro:30-31). `JSON.stringify` does not escape `<`, so a title containing `</script><script>alert(1)</script>` breaks out of the script block. `set:html` disables Astro escaping.
- **Impact:** an EDITOR account, or a compromised one, can run script on somwave.botandev.com for every visitor. Auth cookies live on the api host, so this enables defacement, phishing and redirects rather than session theft.
- **Fix:** `JSON.stringify(x).replace(/</g, '\\u003c')`. Complexity: S.

### SEC-007 (SW-018) — `javascript:` URLs are accepted for CMS URL fields and rendered as links on the public site
- Severity: P2 · Confidence: CONFIRMED (Zod check run) · Module: shared schemas / web
- **Evidence:**
  - `z.string().url().safeParse('javascript:alert(document.domain)//').success === true` when run locally.
  - The affected fields are team.ts:29-30,42-43 (`linkedinUrl`, `photoUrl`), testimonial avatarUrl, portfolio coverImage and job resumeUrl.
  - `web/src/components/TeamCard.astro:38 href={linkedinUrl}` renders the value as a link.
  - Only siteContent.ts:201 restricts the scheme, with `startsWith('https://')`.
- **Fix:** Add a shared `httpsUrl` schema that refines `new URL(v).protocol === 'https:'` and use it for every URL field. Complexity: S.

### SEC-008 (SW-014) — Public website and React app send no security headers
- Severity: P2 · Confidence: CONFIRMED (production probe) · Module: web / frontend deploy
- **Evidence:**
  - `curl -D -` on https://somwave.botandev.com/ and https://app.somwave.botandev.com/login returned only content-type, cache-control and alt-svc. There was no CSP, HSTS, X-Frame-Options/frame-ancestors, X-Content-Type-Options or Referrer-Policy.
  - frontend/nginx.conf contains only `add_header Cache-Control`. The API does send the helmet headers.
- **Impact:** the admin/finance SPA can be framed (clickjacking of void, approve and suspend buttons). There is no CSP defence-in-depth against XSS, and no HSTS on the two user-facing hosts.
- **Fix:**
  - Add the headers in nginx.conf: CSP with `frame-ancestors 'none'`, `script-src 'self'`, and `connect-src` pointing at the API.
  - Add the same set, or a Traefik headers middleware, for the Astro node server.
- Complexity: S.

### SEC-009 (SW-019) — Client portal users can read their DRAFT and VOID invoices
- Severity: P2 · Confidence: CONFIRMED (code) · Module: Invoices / Portal
- **Evidence:** `listInvoices`/`getInvoice` filter only on `{deletedAt:null, clientId}` (invoice.service.ts:89-118). A CLIENT calling GET /api/v1/invoices therefore sees unsent drafts, including amounts not yet approved.
- **Fix:** For CLIENT scope, add `status: { notIn: ['DRAFT'] }`; decide whether VOID should show. Complexity: S. **Verification:** a portal API test.

### SEC-010 (SW-020) — Public project-inquiry sign-up auto-links a new portal login to an existing Client with a matching email
- Severity: P2 · Confidence: CONFIRMED (code) · Module: Project inquiry / Portal onboarding
- **Evidence:** project-inquiry.service.ts:308-340. After OTP verification, if no User has that email, it looks up `client.findFirst({ email })` and creates a CLIENT user with that `clientId`.
- **Impact:** anyone who controls the mailbox on file for a client company (a shared info@ address, a former employee's alias, a typo'd domain) can self-provision full portal access to that client's invoices, documents and projects with no staff approval. It also silently creates the 1:N client:user relation that CLAUDE.md §18 lists as an open decision.
- **Fix:** Link to an existing Client only after staff approval, or only create a new Client. Complexity: M.

### SEC-011 (SW-023) — Production dependency vulnerabilities (3 critical, 18 high, 10 moderate)
- Severity: P2 · Confidence: CONFIRMED (audit) / SUSPECTED (exploitability) · Module: deps
- **Evidence:** `npm audit --omit=dev`:
  - astro 5.18.2 (critical): RCE via AVIF image optimization, Host-header SSRF in the prerendered error page, and several XSS issues; fixed in astro@7.4.0. The `/_image` endpoint is live in production (GET returned 400). No remote image domains are configured, which limits exposure.
  - @astrojs/node 9.5.5 (high).
  - bcrypt → @mapbox/node-pre-gyp → tar (critical; this is install-time).
  - proxy-addr (critical): IPv4-mapped IPv6 trust bypass. This app uses hop-count trust, so it is likely not applicable.
  - prisma/@prisma/config → deepmerge-ts (high).
  - react-router 6.30.6 (moderate): open redirect via backslash.
  - express/qs (moderate), and vite 5.4.21 (dev server only).
- **Fix:** Upgrade astro/@astrojs/node first (major version; test the web build), then bcrypt@6, prisma, express, and react-router-dom within 6.x if a patched version exists. Complexity: M.

### SEC-012 (SW-022) — Strict refresh rotation has no grace window; parallel tabs or a lost response trigger "reuse" and log out every device
- Severity: P2 · Confidence: SUSPECTED (by design reading; not reproduced) · Module: Auth refresh
- **Description:**
  - apiClient.ts:31-54 de-duplicates refresh calls only within one tab.
  - Two tabs that refresh at the same time send the same cookie. The second request finds `revokedAt` set and runs the reuse branch (auth.service.ts:310-316), which revokes all sessions.
  - The same happens if the refresh response is lost on the network.
- **Impact:** random forced logouts across devices. A security response is triggered by benign behaviour, which trains users to ignore it.
- **Fix:** Allow a short grace window (about 30 s) in which a just-rotated token returns the already-issued successor (`replacedByTokenHash`), or use a cross-tab lock such as BroadcastChannel or the Web Locks API. Complexity: M.

### SEC-013 (SW-075) — Forgot-password response timing reveals existing accounts
- Severity: P3 · Confidence: CONFIRMED (code) · Module: Password reset
- **Evidence:** `requestPasswordReset` returns at once for unknown emails (auth.service.ts:372-373) but awaits a DB transaction and the Resend API for known ones (auth.service.ts:379-410) before the controller responds (auth.controller.ts:102-114).
- **Fix:** Enqueue the mail in BullMQ and respond immediately. Complexity: S.

### SEC-014 (SW-076) — Rate limiters use the in-memory store; anyone can lock an account out
- Severity: P3 · Confidence: CONFIRMED · Module: rateLimit
- **Evidence:** rateLimit.ts has no `store`, so counters reset on every deploy or restart and are per instance. The per-account limiter allows 5 requests per 15 min keyed on the email in the body (rateLimit.ts:41-51), so any third party can block a known user's login indefinitely.
- **Fix:** Use `rate-limit-redis` with the existing ioredis. For the account key, count only failed attempts, or use a progressive delay instead of a hard block. Complexity: S.

### SEC-015 (SW-077) — Logout does not invalidate the current access token
- Severity: P3 · Confidence: CONFIRMED · Module: Auth
- **Evidence:** `logout` revokes only the refresh row (auth.service.ts:348-354). The access JWT stays valid for up to 15 min if someone has copied it. Accepted risk under the 15 m design. There is also no "log out all devices" endpoint.
- **Fix:** Optionally add a Redis `jti` denylist or a per-user `sessionsRevokedAt` bump for "log out everywhere". Complexity: S.

### SEC-016 (SW-025) — Downloads fail for non-Latin-1 filenames (Arabic or emoji) because of the raw Content-Disposition header
- Severity: P3 · Confidence: CONFIRMED (Node check) · Module: documents / media / inquiry attachments
- **Evidence:**
  - ops-extra.controller.ts:213,257 and project-inquiry.controller.ts:138 build `filename="${file.fileName}"` directly.
  - In Node, `setHeader` throws `ERR_INVALID_CHAR` for "ك.pdf", which surfaces as a 500. A filename containing `"` produces a malformed header parameter.
  - The schemas allow any string (document.ts:16, projectInquiry.ts:54).
- **Fix:** Use `res.attachment(name)` or RFC 5987 `filename*=UTF-8''…` with an ASCII fallback, as portal.controller.ts:71 already does with `safeName`. Complexity: S.

### SEC-017 (SW-028) — A project manager can provision engineer accounts, bypassing the admin-only engineer onboarding
- Severity: P3 · Confidence: SUSPECTED (impact) · Module: Engineer accounts
- **Evidence:**
  - `createEngineerAccount` requires ADMIN or SUPER_ADMIN (engineer-account.service.ts:25-29,220).
  - However, `inviteProjectEngineer` (engineering.service.ts:510-522) lets any project manager call `ensureEngineerAccountForProjectInvite`, which runs `provisionAccount` for any email.
  - That includes existing non-engineer users, CLIENT users among them. On activation with their own password they gain the ENGINEER role (engineer-account.service.ts:231-260, 590-597), which mixes client and internal roles in a way user invitations forbid (user-invitation.service.ts:22-27).
  - The 409 messages also tell the PM whether an email exists.
- **Fix:** Restrict project invites to existing active engineers, or apply the same role-mixing and admin checks. Complexity: S.

### SEC-018 (SW-038) — Re-running the seed silently resets the SUPER_ADMIN password; docs publish the default credentials
- Severity: P3 · Confidence: CONFIRMED · Module: seed
- **Evidence:**
  - seed.ts:478-482: `upsert … update: { passwordHash }` overwrites the live super-admin password on every `db:seed` and does not revoke sessions.
  - In any non-production NODE_ENV (staging), the password falls back to a hard-coded default (seed.ts:439,459).
  - docs/SUPER_ADMIN_SETUP.md:44 lists the default super-admin email and password.
  - The entrypoint does not run the seed (docker-entrypoint.sh), which limits impact.
- **Fix:** Use `update: {}` unless an explicit `SEED_RESET_SUPER_ADMIN=true` is set. Refuse the default password whenever NODE_ENV is not `development`. Complexity: S.

### SEC-019 (SW-078) — No authenticated "change password", and no admin 2FA reset or recovery path
- Severity: P3 · Confidence: CONFIRMED (route list auth.routes.ts:33-138) · Module: Auth
- **Description:** Users can change a password only through the email OTP reset. An admin who loses both the TOTP device and the backup codes cannot be recovered except by editing the DB. For required roles, disable is forbidden (auth.service.ts:263-265).
- **Fix:** Add `POST /auth/change-password`, requiring the current password and 2FA, revoking other sessions and sending a notification email. Add an audited SUPER_ADMIN "reset 2FA" action. Complexity: M.

### SEC-020 (SW-079) — UserInvitation model departs from data-model rules
- Severity: P3 · Confidence: CONFIRMED · Module: migration 20261017090000
- **Evidence:** schema.prisma:2308-2321 and migration.sql:
  - `status` is a free TEXT column rather than an enum.
  - `invited_by_id` has no FK and no index.
  - `role_ids TEXT[]` has no referential integrity, so a deleted role gives a 409 on activation.
  - There is no `deletedAt`.
- **Fix:** Use an enum `InvitationStatus`, add an FK to users, and add `@@index([status, expiresAt])`. Complexity: S.

### SEC-021 (SW-034) — EVC webhook has no replay window and no amount reconciliation
- Severity: P3 · Confidence: CONFIRMED (code) · Module: Payments webhook
- **Evidence:**
  - The signature is an HMAC over the raw body with timingSafeEqual (evcplus.client.ts:66-82); that part is correct.
  - The payload carries only `transactionId`, `status` and `reference` (payment.ts:56-60), with no timestamp or amount.
  - `applyEvcWebhook` credits the locally stored `payment.amount` (payment.service.ts:102-115) without checking it against what the gateway settled.
  - The `status !== 'PENDING'` guard makes it idempotent.
- **Fix:** Once the real EVC spec is known, verify the amount and currency and add a timestamp tolerance. Complexity: S (blocked on the gateway spec).

## 4. Acceptance rows

| feature | status | evidence |
|---|---|---|
| JWT access 15 m / refresh 30 d | PARTIAL | Code tokens.ts:7-10; cookies.test passes; no production cookie observed (BLOCKED) |
| httpOnly + Secure + SameSite cookies | FAILED | httpOnly/secure OK; SameSite=None in production (SEC-002) |
| Refresh rotation + reuse kills all sessions | VERIFIED (unit, mocked) | auth.service.test "rotates only a conditionally consumed…" + reuse log; real-DB run is the QA agent's |
| Logout invalidation | PARTIAL | Refresh revoked; access token lives 15 m (SEC-015) |
| Session invalidation on password reset / suspension | VERIFIED (unit) / code | auth.service.test "rejects an access token issued before password recovery"; user.service.ts:194-228 |
| Password hashing | PARTIAL | Argon2id new + bcrypt legacy verify; timing leak (SEC-003) |
| Login rate limit by IP AND account | PARTIAL | Both present (auth.routes.ts:33-46); memory store, lockout DoS, 2FA step not account-limited (SEC-004/014) |
| No email enumeration (login/forgot/invite) | FAILED | Login timing measured (SEC-003); forgot timing (SEC-013); invite is admin-only (OK) |
| Reset OTP: crypto RNG, 6 digits, 10 min, 5 attempts, HMAC at rest | VERIFIED (unit) | auth.service.ts:378-456; tests "limits expired and exhausted OTP attempts" pass |
| Invitation token entropy/hash/expiry/single-use; admin never sets password | VERIFIED (code + unit file present) | user-invitation.service.ts:65-76,135-190 |
| 2FA mandatory for privileged roles (server-side) | FAILED | SEC-001 |
| Role set defined and seeded | VERIFIED (code) | roles.ts, seed.ts |
| Privilege escalation guards | VERIFIED (code) | user.service.ts:107-145, role.service.ts:53-60 |
| Client cross-tenant scoping (invoice/doc/ticket/portal) | PARTIAL | IDOR-safe; drafts visible (SEC-009); self-link by email (SEC-010) |
| trust proxy / CORS never * | VERIFIED (probe) | evil-origin preflight → no ACAO; allowed origin → ACAO + credentials |
| Helmet / security headers | PARTIAL | API VERIFIED by probe; web + app FAILED (SEC-008) |
| CSRF posture | FAILED | SEC-002 |
| XSS (frontend markdown) | VERIFIED (code) | DOMPurify around marked in PortalProjectPage/DocumentationPage |
| XSS (Astro / public site) | FAILED | SEC-006, SEC-007 |
| SSRF | VERIFIED (code) | system-health allow-list; GitHub URL host check |
| Upload magic bytes / size / safe keys / traversal | VERIFIED (code) | storage.ts:14-33,107-111,146,239 |
| Presigned URLs (CLAUDE.md §13) | NOT IMPLEMENTED | Files are streamed through the API (acceptable alternative; document the decision) |
| Payment + GitHub webhook signatures | VERIFIED (code + unit files) | HMAC + timingSafeEqual on raw body |
| Secrets not committed | VERIFIED | git ls-files scan; only .env.example placeholders |
| npm audit prod | FAILED | 3 critical / 18 high (SEC-011) |
| Protected endpoints return 401 unauthenticated | VERIFIED (probe) | /auth/me, /users, /finance/accounts → 401 |
| /health pings Postgres + Redis | VERIFIED (probe) | `{"status":"ok","checks":{"redis":true,"postgres":true}}` |

## Appendix: security-relevant findings raised by other agents

These findings were raised outside the security report but affect authorization, tenant isolation, integrity of financial/HR records, availability or secrets handling. Full detail is in the bug register and the linked area report.

| SW ID | Severity | Confidence | Original IDs | Title | Area report |
|---|---|---|---|---|---|
| [SW-003](BUG_REGISTER.md#sw-003) | P1 | CONFIRMED | API-002, DB-004 | HR endpoints trust employeeId from the request body (IDOR): any STAFF can check in/out or file leave for any employee and read everyone's HR records | [API_AUDIT.md](API_AUDIT.md) |
| [SW-004](BUG_REGISTER.md#sw-004) | P1 | CONFIRMED | INF-001 | App nginx proxy has no client_max_body_size: uploads over ~750 KB through app.* get HTTP 413 | [INFRASTRUCTURE_AUDIT.md](INFRASTRUCTURE_AUDIT.md) |
| [SW-005](BUG_REGISTER.md#sw-005) | P1 | CONFIRMED | STO-001 | "Image storage is unavailable": storage is one global fail-closed condition with no readiness signal (production trigger unverified) | [CMS_WEBSITE_AUDIT.md](CMS_WEBSITE_AUDIT.md) |
| [SW-006](BUG_REGISTER.md#sw-006) | P1 | CONFIRMED | INF-002, FE-008, INF-016, WEB-001 | API is reached through public-hostname hairpins, so all app users (and all SSR page views) share one rate-limit bucket, including the login limiter | [INFRASTRUCTURE_AUDIT.md](INFRASTRUCTURE_AUDIT.md) |
| [SW-008](BUG_REGISTER.md#sw-008) | P1 | CONFIRMED | FIN-004 | EVC Plus charge leaves an orphaned PENDING payment whenever the provider call fails (always, while EVC is unconfigured) | [FINANCE_AUDIT.md](FINANCE_AUDIT.md) |
| [SW-009](BUG_REGISTER.md#sw-009) | P1 | CONFIRMED | FE-001 | Payment Idempotency-Key is regenerated after a failed or ambiguous request (duplicate-charge risk) | [FRONTEND_UI_AUDIT.md](FRONTEND_UI_AUDIT.md) |
| [SW-011](BUG_REGISTER.md#sw-011) | P1 | CONFIRMED | DB-001 | A fresh production DB is unusable without the dev seed: migrations create only 15 of 70 permissions and 3 of 13 roles | [DATABASE_AUDIT.md](DATABASE_AUDIT.md) |
| [SW-013](BUG_REGISTER.md#sw-013) | P1 | CONFIRMED | API-001, QA-007 | No HTTP-level test proves the auth, RBAC and cross-tenant 404 contract for any route | [API_AUDIT.md](API_AUDIT.md) |
| [SW-024](BUG_REGISTER.md#sw-024) | P2 | CONFIRMED | API-003 | Global search ignores project membership and leaks names of all projects and tasks | [API_AUDIT.md](API_AUDIT.md) |
| [SW-026](BUG_REGISTER.md#sw-026) | P2 | CONFIRMED | API-005 | Large JSON bodies (up to 35 MB) are parsed before authentication and before the rate limiter | [API_AUDIT.md](API_AUDIT.md) |
| [SW-029](BUG_REGISTER.md#sw-029) | P2 | CONFIRMED | FIN-008 | Invoice and payment endpoints bypass finance hardening: no MFA proof, no approval, no audit log; MANAGER can record payments | [FINANCE_AUDIT.md](FINANCE_AUDIT.md) |
| [SW-037](BUG_REGISTER.md#sw-037) | P2 | CONFIRMED | WEB-002, DB-002 | Seeded demo content is live in production as real testimonials, team, portfolio, careers and posts | [DATABASE_AUDIT.md](DATABASE_AUDIT.md) |
| [SW-039](BUG_REGISTER.md#sw-039) | P2 | CONFIRMED | DB-005 | Email uniqueness is case-sensitive at the DB level; app-level case-insensitive checks are racy | [DATABASE_AUDIT.md](DATABASE_AUDIT.md) |
| [SW-043](BUG_REGISTER.md#sw-043) | P2 | CONFIRMED | DB-011 | Cascading deletes on HR, financial and time records (latent data-loss risk) | [DATABASE_AUDIT.md](DATABASE_AUDIT.md) |
| [SW-044](BUG_REGISTER.md#sw-044) | P2 | CONFIRMED | ENG-006 | Timesheet approval is unscoped and effectively self-approval | [PROJECTS_ENGINEERING_AUDIT.md](PROJECTS_ENGINEERING_AUDIT.md) |
| [SW-052](BUG_REGISTER.md#sw-052) | P2 | SUSPECTED | ENG-008 | GitHub webhook body limit of 256 KB will reject legitimate large deliveries | [PROJECTS_ENGINEERING_AUDIT.md](PROJECTS_ENGINEERING_AUDIT.md) |
| [SW-054](BUG_REGISTER.md#sw-054) | P2 | SUSPECTED | INF-011 | Filesystem storage durability depends on an unverified Coolify volume; storageStatus() reports durable regardless | [INFRASTRUCTURE_AUDIT.md](INFRASTRUCTURE_AUDIT.md) |
| [SW-058](BUG_REGISTER.md#sw-058) | P2 | CONFIRMED | INF-012 | No backup, restore or monitoring artifacts in the repository | [INFRASTRUCTURE_AUDIT.md](INFRASTRUCTURE_AUDIT.md) |
| [SW-059](BUG_REGISTER.md#sw-059) | P2 | CONFIRMED | INF-013 | CI does not gate deploys, run e2e, build the Docker images or audit dependencies | [INFRASTRUCTURE_AUDIT.md](INFRASTRUCTURE_AUDIT.md) |
| [SW-060](BUG_REGISTER.md#sw-060) | P2 | CONFIRMED | STO-002 | Public image route shares the 60 requests/minute public rate limit | [CMS_WEBSITE_AUDIT.md](CMS_WEBSITE_AUDIT.md) |
| [SW-061](BUG_REGISTER.md#sw-061) | P2 | CONFIRMED | STO-003 | Image URLs are absolute, take their host from the request, and only the id is validated | [CMS_WEBSITE_AUDIT.md](CMS_WEBSITE_AUDIT.md) |
| [SW-064](BUG_REGISTER.md#sw-064) | P2 | CONFIRMED | WEB-007 | Careers applicants' resume URL is stored but never shown to staff; `javascript:` URLs accepted | [CMS_WEBSITE_AUDIT.md](CMS_WEBSITE_AUDIT.md) |
| [SW-073](BUG_REGISTER.md#sw-073) | P2 | CONFIRMED | QA-008 | Cross-tenant 404 proofs are mock-only; one is tautological; no HTTP-level proof | [TEST_COVERAGE_REPORT.md](TEST_COVERAGE_REPORT.md) |
| [SW-080](BUG_REGISTER.md#sw-080) | P3 | SUSPECTED | API-008 | Large `page` values likely become 500s; query validation is hand-rolled | [API_AUDIT.md](API_AUDIT.md) |
| [SW-081](BUG_REGISTER.md#sw-081) | P3 | CONFIRMED | API-009 | Idempotency-Key missing on message-sending endpoints; public enforcement only checks presence; public form keys regenerate per submit | [API_AUDIT.md](API_AUDIT.md) |
| [SW-082](BUG_REGISTER.md#sw-082) | P3 | CONFIRMED | API-012 | Webhooks bypass access logging and rate limiting | [API_AUDIT.md](API_AUDIT.md) |
| [SW-084](BUG_REGISTER.md#sw-084) | P3 | CONFIRMED | API-014, FE-019 | Project documentation routes and screens ignore the project-documentation.* permissions | [API_AUDIT.md](API_AUDIT.md) |
| [SW-091](BUG_REGISTER.md#sw-091) | P3 | CONFIRMED | DB-012, PRJ-004 | Archived projects' tasks/milestones appear for admins; legacy /tasks exposes other engineers' unapproved proposals | [DATABASE_AUDIT.md](DATABASE_AUDIT.md) |
| [SW-097](BUG_REGISTER.md#sw-097) | P3 | CONFIRMED | DB-019 | Missing DB-level guards on AR tables and finance actor columns | [DATABASE_AUDIT.md](DATABASE_AUDIT.md) |
| [SW-099](BUG_REGISTER.md#sw-099) | P3 | CONFIRMED | DB-021 | A soft-deleted user's email can never be invited again | [DATABASE_AUDIT.md](DATABASE_AUDIT.md) |
| [SW-111](BUG_REGISTER.md#sw-111) | P3 | CONFIRMED | ENG-014 | Release gates: PM can mark APPROVED -> DEPLOYED without a deployment record; admin may approve own release | [PROJECTS_ENGINEERING_AUDIT.md](PROJECTS_ENGINEERING_AUDIT.md) |
| [SW-112](BUG_REGISTER.md#sw-112) | P3 | CONFIRMED | ENG-015 | Activity feed omits member/handover/phase/release/deployment audits and shows finance expense events to every project viewer | [PROJECTS_ENGINEERING_AUDIT.md](PROJECTS_ENGINEERING_AUDIT.md) |
| [SW-113](BUG_REGISTER.md#sw-113) | P3 | CONFIRMED | ENG-016 | GitHub integration robustness gaps (stuck RECEIVED deliveries, reactivation of suspended installs, token per view, stale CI run) | [PROJECTS_ENGINEERING_AUDIT.md](PROJECTS_ENGINEERING_AUDIT.md) |
| [SW-114](BUG_REGISTER.md#sw-114) | P3 | CONFIRMED | INF-015 | GitHub (and other) configuration not validated by the Zod env schema; .env.example incomplete | [INFRASTRUCTURE_AUDIT.md](INFRASTRUCTURE_AUDIT.md) |
| [SW-117](BUG_REGISTER.md#sw-117) | P3 | CONFIRMED | INF-017 | index.html has no Cache-Control: a stale shell after deploy can white-screen | [INFRASTRUCTURE_AUDIT.md](INFRASTRUCTURE_AUDIT.md) |
| [SW-118](BUG_REGISTER.md#sw-118) | P3 | CONFIRMED | INF-018 | Healthcheck and documentation inconsistencies; one-level log redaction | [INFRASTRUCTURE_AUDIT.md](INFRASTRUCTURE_AUDIT.md) |
| [SW-120](BUG_REGISTER.md#sw-120) | P3 | CONFIRMED | FIN-012 | Segregation of duties is two-person only; the approver may also post | [FINANCE_AUDIT.md](FINANCE_AUDIT.md) |
| [SW-126](BUG_REGISTER.md#sw-126) | P3 | CONFIRMED | WEB-006 | Public forms have no honeypot or captcha; the idempotency key only blocks double-submits | [CMS_WEBSITE_AUDIT.md](CMS_WEBSITE_AUDIT.md) |
