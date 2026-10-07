# Session — Zang Music Production Software 2026

Private music production workspace for clients, LPs, EPs and singles. React, TypeScript and Vinext serve the app through Sites; all production project records are stored in Supabase Postgres.

## Features

- Leads workspace: add, rename, search and remove potential clients by name. Leads are stored in Supabase separately from projects, with the same owner isolation and revision checks.

- Project form with client, project title, release type, deadline and priority from 1–5.
- Track counts and names for LPs and EPs. Singles automatically use their project title as the single song name, so the form hides the track list.
- Per-project completion stages and per-song checkboxes with weighted progress.
- Stage weights adjust in 5-point steps. Increasing a stage consumes weight from stages below it, starting with the next stage. Decreasing it gives weight to the next stage. Earlier stages never change. Inputs are capped by the available weight; the final stage is an automatic remainder. Zero-weight stages are allowed. Adding a stage starts it at zero; removing a stage transfers its weight to the next stage (or the new last stage).
- Project progress averages all songs. Work queue: overdue projects first, then descending `priority × remaining song-equivalents / max(1, days remaining + 1)`. A song at 70% has 0.3 song-equivalents remaining. Ties use deadline then name. Completed projects leave the queue. Dates use the viewer's local calendar.
- Search, completed-project filter and revision checks to prevent silently overwriting simultaneous edits.

## Development

Requires Node 22.13+ and dependencies pinned in `pnpm-lock.yaml`.

```sh
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm build
```

## Storage and authorization

Supabase project: `zegseumxuvpoypiiogjz` (Zang Music Production Software 2026).

`public.studio_projects` stores all project, client, track, stage, completion, priority and deadline data as a validated JSONB document plus owner and revision. The composite owner/id primary key supports efficient owner-scoped reads. SQL setup is recorded in `supabase/schema.sql`; the deployed migration is `20261007034337_create_studio_projects` in Supabase's migration history.

The browser calls `/api/projects`. Sites supplies verified ChatGPT identity. The server signs short-lived, audience-bound RS256 requests including the owner and complete operation payload. Supabase's `studio-data` Edge Function verifies the signature, validates the project and scopes every database request to that owner. Stale updates and deletes return HTTP 409.

The Edge Function uses Supabase's own server secret from its runtime. RLS is enabled, and `anon`/`authenticated` have no direct table privileges. Only the server gateway accesses project rows. Built-in Edge JWT verification is disabled because this function verifies its own Sites server signature; unsigned or modified requests receive HTTP 401.

Sites runtime configuration (set through the hosting secret manager, never committed):
- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_GATEWAY_PRIVATE_JWK`: secret private signing key. Its public counterpart is in `supabase/functions/studio-data/public-key.json`.

For key rotation, deploy the corresponding public key to the Edge Function and replace the private key in Sites. Never expose the private key, Supabase secret key, or server identity headers to browser clients. A standalone host must provide a trusted authentication boundary before using this API.

The app no longer reads or writes Cloudflare D1. Historical D1 migrations remain in `drizzle/` solely as source history. The former database is left untouched as a fallback snapshot; new and edited records live exclusively in Supabase.

## Source layout

- `app/page.tsx`, `app/globals.css`: dashboard, forms, checklists and styling.
- `app/api/projects/route.ts`: authenticated project API.
- `lib/projects.ts`: project validation, weighted progress, redistribution and ranking.
- `lib/supabase.ts`, `lib/gateway-auth.ts`: server database gateway and signature verification.
- `supabase/functions/studio-data/`: Supabase storage endpoint and public verification key.
- `supabase/schema.sql`: database schema and access grants.
- `tests/`: progress, ranking, redistribution and signature-security tests.

The source repository is public. Client/project records and credentials are never committed. The deployed app remains private.

Leads schema: `supabase/leads-schema.sql` (`public.studio_leads`). The signed gateway resource is `leads`; omitted resource continues to use projects.
