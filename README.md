# Session — Studio Project Tracker

A private music production workspace for clients, LPs, EPs and singles. Built with React, TypeScript, Vinext and Cloudflare D1, hosted with Sites.

## Features

- Create, edit and delete projects through a form.
- Client and project names, release type, deadline and 1–5 priority.
- Configurable track counts and names (singles have one track).
- Per-project completion stages with custom weights totaling 100%.
- Per-song checkboxes and weighted progress; project progress averages all tracks.
- Work queue: overdue projects first, then descending `priority × remaining song-equivalents / max(1, days remaining + 1)`. A song at 70% has 0.3 song-equivalents remaining. Ties use deadline, then name. Completed projects leave the queue. Calendar deadlines use the viewer's local date. This is a workload heuristic, not an estimate of production hours.
- Persistent server storage, per-user authorization, optimistic concurrency protection, search and completed-project filter.

## Development

Requires Node 22.13+ and the dependencies pinned in pnpm-lock.yaml.

```sh
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm build
```

Sites provides authenticated request identity and the D1 `DB` binding. The app rejects data requests without authenticated identity. A standalone deployment must implement a trusted authentication boundary; never trust identity headers directly from the public internet. No client records are stored in Git.

Schema: `db/schema.ts`; migration: `drizzle/`. Generate schema changes with `pnpm db:generate`. Sites applies committed migrations during publication. Keep previous migration history immutable. Standard local D1 initialization uses the generated Wrangler configuration and migrations; see the platform development workflow when running outside Sites.

Important files:
- `app/page.tsx`: project dashboard, queue, project form and song checklists.
- `app/globals.css`: responsive studio UI.
- `app/api/projects/route.ts`: authenticated CRUD with revision checks.
- `lib/projects.ts`: shared validation, progress and ranking.
- `tests/projects.test.ts`: weighted progress, input validation and ranking tests.

The site is private by default. The source contains no credentials. Hosting identity in `.openai/hosting.json` is an opaque deployment identifier, not a secret.
