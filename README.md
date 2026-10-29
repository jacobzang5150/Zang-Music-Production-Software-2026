# Session — Zang Music Production Software 2026

Private music production workspace for clients, LPs, EPs and singles. React, TypeScript and Vinext serve the app through Sites; all production project records are stored in Supabase Postgres.

## Features

- Marking Payment received plays a brief red/rose dollar-sign burst at the checkbox after the save succeeds, then returns to Projects. Reduced-motion preferences use a short fade. Failed saves stay on the project without celebrating.

- Workspace tabs and project details have browser-history URLs. Browser Back/Forward, mouse navigation buttons and refresh restore the selected page. Open forms prompt before leaving through history; progress updates do not create extra navigation entries.

- Mobile workspace with labeled bottom navigation, safe-area spacing, larger touch controls, stacked graphs and full-screen forms that follow the visible keyboard viewport. Stage dragging scrolls long pages/forms near their edges. Notification panels dismiss when tapping outside.

- Saved client dropdowns with a New client option. Supabase keeps a per-owner client directory, deduplicated by case-insensitive trimmed name; existing project and lead names are imported.
- Delivered and Payment received checkboxes are independent of production progress. Undelivered work stays Active even at 100%. Delivery and payment controls appear below all song completion stages. Delivered-but-unpaid work remains in Projects (Ongoing and Awaiting payment) and Graphs, but leaves the work queue. Once delivered and paid, it is listed only under Completed, ordered newest completion first; clearing payment restores it to Ongoing, Awaiting payment and Graphs.
- Delivery starts a 30-day payment clock, using a server-assigned UTC timestamp. The header bell shows persistent in-app alerts for overdue unpaid work, recalculated on load and every minute while open. Payment received clears the alert; undoing delivery clears its payment tracking. No email or browser push is sent.

- Dark charcoal interface with red accents; client names lead cards, recommendations, project detail pages and graphs, with project/song titles secondary.
- Production forms start with five unnamed stages weighted at 20% each. New overdubs start with Tracking (70%) and Revisions (30%). Enter the stage names and customize the weights; saved workflows are preserved when editing.
- Deadlines are optional. Undated work is labeled “No deadline,” excluded from due/overdue counts, and scored with a 30-day planning horizon while retaining its priority and completion weighting.

- New overdub form for a client’s song: acoustic guitar, electric guitar, or both, plus priority and deadline. Overdubs have editable completion stages and participate in the same project list and ranked work queue.
- Graphs workspace displays every production project and overdub as a 0–100% completion bar, including finished work. Select a bar to open its project.

- Leads workspace: add, rename, search and remove potential clients by name. Leads are stored in Supabase separately from projects, with the same owner isolation and revision checks.

- Project form with client, project title, release type, deadline and priority from 1–5.
- Track counts and names for LPs and EPs. Singles automatically use their project title as the single song name, so the form hides the track list.
- Drag stage handles to reorder in creation/edit forms or directly within a song; keyboard users can focus a handle and press Up/Down. Order is shared across songs and saves with the project. Stage weights and checked progress stay attached.
- Per-project completion stages and per-song checkboxes with weighted progress.
- Stage weights adjust in 5-point steps. Increasing a stage consumes weight from stages below it, starting with the next stage. Decreasing it gives weight to the next stage. Earlier stages never change. Inputs are capped by the available weight; the final stage is an automatic remainder. Zero-weight stages are allowed. Adding a stage starts it at zero; removing a stage transfers its weight to the next stage (or the new last stage).
- Project progress averages all songs. Work queue: overdue projects first, then descending `priority × (1 + 4 × completionFraction) / max(1, days remaining + 1)`. Completion is the project’s average song progress, with a bounded 1× boost at 0%, 3× at 50%, and 5× at 100%. Near-complete work is favored without a track-count advantage or division by zero at completion. Ties use deadline, client, then project name. Projects leave the queue only when Delivered is checked. Dates use the viewer's local calendar.
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

Client directory schema: `supabase/clients-schema.sql`; repeat-safe data import: `supabase/backfill-clients.sql`. Client records are retained independently of project deletion. Delivery fields are stored in each project JSON document; server transition logic preserves timestamps across ordinary edits.

## Google Drive window

The project Drive icon opens an accessible modal above Session; clicking outside or pressing Escape closes it. Projects retain their folder/file URL in Supabase. The modal supports folder browsing, filtering, pagination, Google Picker folder selection, direct resumable uploads (8 MiB chunks), upload cancellation, inline audio playback, renaming, replacing binary file contents, and editing small plain-text files. Google Docs/Sheets and other native Google formats use Google’s own editors via Open in Google. This is a custom Drive client, not an embedding of the full Drive website.

Configure these runtime values in Sites, never the public repository:
- `GOOGLE_DRIVE_CLIENT_ID`: OAuth web client ID.
- `GOOGLE_PICKER_API_KEY`: browser API key restricted to the production site and `https://docs.google.com/*`, and to Google Drive/Picker APIs.
- `GOOGLE_DRIVE_APP_ID`: Google Cloud project number.

Enable Google Drive API and Google Picker API. Register the exact production origin in the OAuth client's authorized JavaScript origins. This integration uses Google's browser token flow, so it needs no client secret or redirect URI. Declare `https://www.googleapis.com/auth/drive` under Google Auth platform > Data Access when configuring an external consent screen, and authorize the account as a test user while in Testing. Full Drive scope is necessary to list/manage existing files in linked folders: `drive.file` alone does not grant recursive access to all existing folder contents. Public external use of this restricted scope may require Google's verification; internal Workspace and personal testing requirements differ.

The visitor explicitly connects Google Drive. Tokens stay in memory only and are never sent to Session's server, Supabase, GitHub, or external URLs. Expired tokens require another user click to reconnect; the disconnect control forgets the local token. Drive API requests and file transfers go directly from the browser to Google. The authenticated `/api/drive/config` endpoint returns the public browser identifiers with no-store caching; the browser-restricted API key is necessarily visible to the signed-in browser. Google and file permissions remain authoritative for each action.

Inline audio buffers files up to 256 MiB; larger audio uses Google's preview/open action. Format playback depends on the browser. The plain-text editor is limited to 1 MiB and checks modified time before replacing content. It is not a collaborative document or audio waveform editor. Closing during an upload aborts unfinished transfers; refresh to verify any files completed before cancellation. No delete, sharing, or permission-changing UI is provided.

Verification: unit tests cover Drive URL parsing, safe request destinations, pagination, expired authorization, resource keys, download restrictions, and interrupted resumable uploads. Local browser QA uses temporary fixtures (not published) for connection, listing, audio, rename, and dismissal. Real account consent, Google Picker permissions, and live file operations must be verified by the signed-in owner after deployment.

### Automatic Drive folders

Use **Connect Drive** in Session (or open a project's Drive button) to authorize the studio Google account. While Session is open and connected, existing and newly saved projects/overdubs get `Client / Project / EDITS, MIXES, MASTERS`. Setup pauses while a form or unsaved notes are being edited. The icon-only button beside Drive copies the saved project folder URL; copying does not change sharing permissions.

Client folder matches ignore case and surrounding whitespace and reuse the oldest matching owned folder, even outside My Drive's root. Project and standard child folders are matched inside their respective parents. Existing duplicates are not merged or deleted; unrelated files and manually linked folders outside the matching hierarchy are not moved. Each project is automatically linked to its organized folder when setup finishes. Folder reservations are account/owner-scoped in Supabase's `studio_drive_folders`; a unique key elects a pre-generated Google Drive ID before creation, making concurrent sessions and interrupted retries idempotent. Previously assigned folders that are trashed, moved, or inaccessible produce a retryable error instead of a replacement duplicate. Folder links are saved with a narrow revision-checked update that preserves notes and progress.

The browser token is still memory-only. Reconnect after reloading Session or when Google authorization expires; pending setup resumes automatically. There is no unattended folder creation while Session is closed. The full account flow requires the user's Google authorization; tests use mocked Drive responses. Regression checks cover concurrent setup, multiple projects for one client, reuse of existing folders, partial failures, trashed folders, owner isolation, and conflict-safe link updates. A browser fixture verified automatic folder browsing and copy-icon placement; no real Drive files were created during QA.

Database addition: `supabase/drive-folders-schema.sql`; the signed `studio-data` gateway includes the `folders` resource. No Google access token or API key is stored in the public repository.

### Remembered Drive connections (prepared; requires client secret)

Set `GOOGLE_DRIVE_CLIENT_SECRET` to the existing Google OAuth web client's secret in private Sites runtime settings, then deploy to enable persistent connections. `GOOGLE_DRIVE_TOKEN_KEY` is a separately generated, private 32-byte base64 AES key. Keep both out of GitHub and client bundles. Do not rotate the token key without migrating saved tokens; rotating it requires users to reconnect.

When configured, Google Identity Services uses its popup authorization-code model. The server checks the exact production Origin and the non-simple `X-Requested-With` header, exchanges the code using the client secret, and stores only an AES-GCM encrypted refresh token in Supabase (`studio_drive_auth`). Encryption is bound to the authenticated Session owner's ID. Anonymous/browser Supabase roles have no table access; the signed gateway enforces ownership and revision checks. The browser receives short-lived access tokens in memory from an authenticated, no-store endpoint. It restores automatically on page load and renews while the page is active. Disconnect deletes the stored connection and clears memory; it does not remove Drive files or revoke all Google account permissions.

Until the client secret is configured, the existing session-only connection flow remains active. Google may still require renewed consent if access is revoked, its security policies require it, or an external OAuth app remains in Testing with short-lived refresh grants. Use the popup's page origin (`https://studio-project-tracker.jacobzang5150.chatgpt.site`) for the server token exchange. Client secret installation and a live user authorization are still required to verify this against Google; automated tests cover encryption, owner binding, CSRF checks, persistence isolation, restoration, and disconnect/refresh races.
