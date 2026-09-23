# Somwave

A single platform serving three audiences:

- **Public website** (`web/`, Astro) — prospects evaluate the company and get in touch.
- **Client portal** (`frontend/`, React) — clients see their projects and pay invoices.
- **Internal management system** (`frontend/`, React) — staff run projects, HR, and finance.

The full specification lives in [`CLAUDE.md`](./CLAUDE.md) and the design blueprint in
[`docs/Somwave_Blueprint_v3_2.docx`](./docs/Somwave_Blueprint_v3_2.docx). **`CLAUDE.md` is
authoritative** — where anything disagrees with it, `CLAUDE.md` wins.

## Monorepo layout

npm workspaces (`CLAUDE.md` §6):

| Workspace         | Package             | Stack                                  | Status                                    |
| ----------------- | ------------------- | -------------------------------------- | ----------------------------------------- |
| `packages/shared` | `@somwave/shared`   | Zod schemas, inferred types, constants | in use (grows per feature)                |
| `web`             | `@somwave/web`      | Astro (hybrid static/SSR)              | public site live (W1–W5; gaps in WORKLOG) |
| `frontend`        | `@somwave/frontend` | React 18 + Vite                        | internal + CMS + portal shell             |
| `backend`         | `@somwave/backend`  | Node 20 + Express                      | `/api/v1` + `/health`                     |

Current implementation vs remaining work: [`docs/STATUS_REPORT.md`](./docs/STATUS_REPORT.md), [`docs/WORKLOG.md`](./docs/WORKLOG.md), [`docs/FRONTEND_VISIBILITY.md`](./docs/FRONTEND_VISIBILITY.md).

## Build order

Work is gated (`CLAUDE.md` §3). Nothing starts before **F0** is complete:

- **F0.1** — monorepo and tooling ← _this scaffold_
- **F0.2** — infrastructure
- **F0.3** — Prisma core, auth, shared contract, `apiClient`
- **F0.4** — RBAC, `tokens.css`, `components/ui`, `components/states`, AppShell

Then: `F0 → W → I → P → M`.

## Prerequisites

- **Node** `>=20` (see [`.nvmrc`](./.nvmrc); production targets Node 20).
- **npm** 10+ (workspaces).

## Getting started

```bash
npm install          # install all workspaces
npm run lint         # eslint across the monorepo
npm run format:check # prettier check
npm run typecheck    # tsc --noEmit per workspace
npm run build        # per-workspace build (as builds are added)
```

## Conventions

- TypeScript `strict: true`; **no `any`** in shipped code (enforced by ESLint).
- Prettier is the single formatter; run `npm run format` before committing.
- Branches: `feat/` `fix/` `chore/` + phase code (e.g. `feat/P4.2-evcplus-gateway`).
- Commits: conventional (e.g. `feat(payments): add EVC Plus gateway`).

See `CLAUDE.md` §11 for the full code conventions and §15 for the definition of done.
