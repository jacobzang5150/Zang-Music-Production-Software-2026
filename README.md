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

Use **Connect Drive** in Session (or open a project's Drive button) to authorize the studio Google account. While Session is open and connected, projects/overdubs without a saved Drive link get `Client / Project / EDITS, MIXES, MASTERS`. Setup pauses while a form or unsaved notes are being edited. The icon-only button beside Drive copies the saved project folder URL; copying does not change sharing permissions.

Client folder matches ignore case and surrounding whitespace and reuse the oldest matching owned folder, even outside My Drive's root. Project and standard child folders are matched inside their respective parents. Existing duplicates are not merged or deleted; unrelated files and manually linked folders outside the matching hierarchy are not moved. Each project is automatically linked to its organized folder when setup finishes. Folder reservations are account/owner-scoped in Supabase's `studio_drive_folders`; a unique key elects a pre-generated Google Drive ID before creation, making concurrent sessions and interrupted retries idempotent. Once the project link is saved, setup is complete: reconnecting, refreshing, renaming projects, and renewing tokens skip folder setup entirely. The saved link in Supabase is the durable completion marker, including existing links. Session does not inspect, restore, or recreate that project’s deleted or moved folders. A trash icon in the Drive window moves writable child folders and their contents to Google Drive Trash, with confirmation. Interrupted initial setup can still be retried for projects that have never received a link. Folder links are saved with a narrow revision-checked update that preserves notes and progress.

The browser token is still memory-only. Reconnect after reloading Session or when Google authorization expires; pending setup resumes automatically. There is no unattended folder creation while Session is closed. The full account flow requires the user's Google authorization; tests use mocked Drive responses. Regression checks cover concurrent setup, multiple projects for one client, reuse of existing folders, partial failures, trashed folders, owner isolation, and conflict-safe link updates. A browser fixture verified automatic folder browsing and copy-icon placement; no real Drive files were created during QA.

Database addition: `supabase/drive-folders-schema.sql`; the signed `studio-data` gateway includes the `folders` resource. No Google access token or API key is stored in the public repository.

### Remembered Drive connections (prepared; requires client secret)

Set `GOOGLE_DRIVE_CLIENT_SECRET` to the existing Google OAuth web client's secret in private Sites runtime settings, then deploy to enable persistent connections. `GOOGLE_DRIVE_TOKEN_KEY` is a separately generated, private 32-byte base64 AES key. Keep both out of GitHub and client bundles. Do not rotate the token key without migrating saved tokens; rotating it requires users to reconnect.

When configured, Google Identity Services uses its popup authorization-code model. The server checks the exact production Origin and the non-simple `X-Requested-With` header, exchanges the code using the client secret, and stores only an AES-GCM encrypted refresh token in Supabase (`studio_drive_auth`). Encryption is bound to the authenticated Session owner's ID. Anonymous/browser Supabase roles have no table access; the signed gateway enforces ownership and revision checks. The browser receives short-lived access tokens in memory from an authenticated, no-store endpoint. It restores automatically on page load and renews while the page is active. Disconnect deletes the stored connection and clears memory; it does not remove Drive files or revoke all Google account permissions.

Until the client secret is configured, the existing session-only connection flow remains active. Google may still require renewed consent if access is revoked, its security policies require it, or an external OAuth app remains in Testing with short-lived refresh grants. Use the popup's page origin (`https://studio-project-tracker.jacobzang5150.chatgpt.site`) for the server token exchange. Client secret installation and a live user authorization are still required to verify this against Google; automated tests cover encryption, owner binding, CSRF checks, persistence isolation, restoration, and disconnect/refresh races.

### Project folder link sharing

New project folders receive a Google Drive permission with `type=anyone`, `role=reader`, `allowFileDiscovery=false` (Anyone with the link — Viewer). Existing linked project folders receive the same one-time update the next time Session has a connected Drive account. Subfolders and files inherit access from the project folder; existing explicit permissions are preserved. Client-level folders are not made public, so the link to one project does not expose other projects for that client.

The `driveSharingProcessedUrl` value is saved in each Supabase project record after processing its current link. It prevents repeated sharing work on login/token renewal. Sharing failures are reported and can be retried; Google Workspace policies or missing permissions may prevent public access. Missing/trashed project folders are skipped and marked processed without recreating them. Folder creation remains strictly separate: any saved Drive link means initial setup is complete. A sharing failure after creation therefore cannot trigger folder recreation. Live existing-folder updates require the user's connected Google account; tests use mocked Google responses.

The Drive window also has **Create folder** for the folder currently open. Names are required, new folders get Anyone with the link — Viewer access, and retries retain the same pre-generated ID. The copy-link icon sits to the left of the Drive button. Mobile hides background setup/sharing status banners; Drive errors and retry controls stay inside the Drive window. Background work does not disable workspace navigation or project creation and pauses before saving metadata when foreground editing begins.

### Two-way project folder names

Session queues project renames in Supabase (`driveNamePending`) and applies them to the linked project folder once Drive connects. While Session is visible, folder names are checked every 15 seconds, on focus/reconnect, and after an in-app Drive rename. When no Session rename is pending, the linked folder name updates the project; single/overdub song names follow only if they matched the old project name. A pending Session rename wins over a simultaneous Drive rename. Metadata merges use the latest revision and reject stale names/links. Deleted or inaccessible folders are never recreated. Client folders and unrelated subfolders are not renamed. Sync pauses during form/notes edits; failures are visible inside Drive and retried on the next check. Folder names longer than Session's 160-character limit require shortening in Drive. No unattended sync occurs while Session is closed.

Changing a project's client queues `driveClientPending` in Supabase. The visible Session workspace moves the existing linked project folder into the matching client folder (or creates that client folder using the existing reservation mechanism). It preserves the project folder ID, name, files, and link, and does not remove the old client folder or recreate project subfolders. Name and client sync acknowledgements check the latest project identity and URL before clearing pending work. Disconnected changes wait for Drive to reconnect.

## Project budgets

The budget icon opens a dedicated form editor styled to match Session. Recording / Production, Overdubs and Post-Production retain the supplied preset rates. Categories display as regular rows by default. The three-dot menu at the end of each category offers Add dropdown; this enables an expandable thread for that category. Add item inherits its category name and unit. Remove dropdown returns all items to regular rows without losing costs. The selection autosaves with the budget. Category edits within a dropdown apply to all of its items. Units are per song, hour, day or session; per tuning is available only for piano-tuning rows. Line totals are Rate × Quantity, rounded to cents; section subtotals and the project total sum those line totals. New rows and sections automatically use the same styles. Dates/hours and budget notes remain editable.

Autosave uses the existing `studio_budgets` table and signed owner-scoped gateway, with independent revisions and conflict protection. No database migration is required for the form editor. `lib/budget-model.ts` reads existing workbook cells, including custom inserted rows. Structured fields are stored as `sessionBudget` metadata on the first sheet; the original workbook cells are retained unchanged. The server's existing sheet passthrough schema preserves this data. Older projects receive a template on first opening, and new projects receive it at creation.

Excel download regenerates a formatted `.xlsx` with numeric rates/quantities, custom unit formats, row formulas, section subtotals and a grand total. Import and dropping an `.xlsx` onto the budget icon replace the form fields after validating the file. Import expects Session's layout (description A:B, details C:D, rate E, quantity F, total G; optional dates H:K and hours L:M), including section headings with Rate and Total. It supports 1–20 visible worksheets, 10,000 rows and 200 columns, a 10 MB source file and 2 MB saved JSON. General spreadsheet editing, macros, arbitrary formulas and Excel features outside these budget fields are not part of the form editor.

The agreed project estimate is optional and autosaves with the budget. Remaining funds equal the estimate minus current expenses; overspending shows an Over budget amount. The estimate and remaining-budget formula are retained in Excel export/import. Older saved budgets default to no estimate.

Budget rows can be reordered using the grip or row background; a 50%-opacity copy follows the pointer and the insertion line marks the drop location. Dropdown categories move with their items; items can also be reordered within their category. Touch users drag the grip, and focused grips support Up/Down. Changes autosave. Command+Z (Ctrl+Z on Windows) undoes budget edits, additions, deletions, imports, dropdown changes and row moves; Shift+Command+Z redoes. Undo history covers the current open budget session.

Budgets can be linked from **Link Projects** inside a project budget. Select the project whose existing budget should be shared; both projects then read and edit the same expenses, dates, agreed estimate and totals. Linking does not merge expenses. Personal budgets remain saved; **Unlink** unlinks that project and restores its pre-link budget. Multiple projects can join the same shared budget, including projects for different clients owned by the same account. Shared records survive deletion of a linked project. Clean open budgets refresh on focus and every 15 seconds; revision and budget-identity checks protect unsaved edits from concurrent changes. Excel exports identify shared projects. Apply `supabase/shared-budgets-schema.sql` before deploying the updated `studio-data` function. `tests/shared-budgets.sql` verifies linking, edits, unlinking and owner isolation in a rolled-back transaction.

Link Projects appears in the budget toolbar alongside Import and Download. Unlinked budgets have no relationship label; linked budgets show Linked and use the title Client Name - Project 1, Project 2. Excel titles and filenames follow the same naming.

Linked budgets have an Unlink button directly beside Link Projects in the toolbar. It restores that project’s original separate budget; the old explanatory unlink section has been removed.

Phones use the same horizontal budget table as desktop: category, details, rate and unit, quantity, total, and actions remain on one row. The Date, Details and Hours session tracker sits below the complete budget and project total on all screen sizes. The sheet opens fitted to the mobile portrait viewport, giving a zoomed-out overview. Native pinch-to-zoom stays available, and rotation recalculates the base fit without changing or losing entries. Phone styling supports widths up to 800px and touch devices up to 1100px, including wider landscape phones. Inputs retain readable 16px text and keyboard-aware VisualViewport sizing. Desktop styling remains unchanged. Autosave, shared budgets, row dragging and Excel import/export use the same data and logic in either orientation. Verified portrait-to-landscape rotation and desktop.

The mobile budget sheet fits its full desktop-width layout into the available viewport by default. The toolbar remains unscaled; native pinch zoom is unrestricted and the fit does not reset while pinching. Row drag previews retain the same effective scale as the sheet. Desktop zoom and layout are unchanged.

The mobile budget no longer shows Expenses, Sessions and Notes shortcut buttons; the fitted budget sheet opens directly below the toolbar.

To extend an already shared budget, open Link Projects, choose an additional project, and select Add project to budget. Repeat to add more projects; the panel stays open. This adds each selected project to the existing group instead of moving the open project out of it. Existing members, expenses and sessions stay in place, and the heading includes every linked project. The selected project's latest revision is checked before changing its membership. Failed reads or conflicting edits leave the current group intact.

Session rows have Date, Details and Hours fields, followed by a total-hours sum. They autosave with the rest of the budget and appear at the very bottom in Session and Excel exports. Existing date/hour rows remain readable; Details is optional for backward compatibility. Budget notes are removed from the interface and new Excel exports; existing saved legacy note data is preserved internally. Excel imports support both the original side-by-side date/hour layout and the new bottom Date/Details/Hours tracker.

Mobile fit uses a uniform CSS transform on an unscaled 900px sheet, with a separate viewport that reserves exactly the rendered width and height. This avoids nonuniform CSS zoom and mobile text autosizing; text-size-adjust is scoped to the mobile budget. All columns, controls and typography scale together. Portrait sizing fits the available width and height; returning from landscape restores the same fit. During native pinch zoom, the base scale is preserved while new content can still extend the reserved sheet height. Desktop wrappers use display:contents and retain the original layout.

Session dates are selected through a calendar button instead of a text input. The calendar opens above the budget at a readable size on desktop and mobile, with month/year navigation, Today, Clear date and keyboard navigation. Selections autosave as local YYYY-MM-DD dates; legacy date text remains unchanged until explicitly replaced. Excel import/export and linked budgets retain the same date data.

Drive folder rows accept file drops: external files upload directly to the highlighted writable folder, while existing files can be dragged into sibling subfolders. A translucent file preview follows the native drag cursor; folders highlight as valid targets. Drops on read-only folders or blank space do not move existing files. Moves preserve file IDs and contents and re-check current locations and Google capabilities before changing only the parent. The normal window-wide upload target remains available.

Drive preview loading is tracked separately from folder loading. Returning to Files cancels the preview and clears its busy state immediately. Folder breadcrumbs (including the current folder for refresh) remain available during reads, so users can go back while a folder is loading. Writes still lock navigation, and stale folder responses cannot replace a newer destination.

New file uploads continue while browsing Drive folders, using breadcrumbs, pagination, refresh and read-only previews. Each batch captures its destination and API client before starting. Completion refreshes only the currently visible upload folder and never redirects another folder or closes a preview. Other writes remain serialized; replacing file contents still locks navigation. The upload progress bar is byte-weighted across the complete selected batch, includes completed/total file counts, and reaches 100% only when all files are confirmed. Zero-byte files count toward completion. Cancel reports completed files without changing the current view. Closing the Drive window still stops transfers.


Invoices are created as saved drafts when a project or overdub is marked Delivered, before payment. The invoice opens for review and is also available from Invoice under Delivery & payment, including older delivered projects. The signed owner gateway stores snapshots in `studio_invoices`, separate from project and budget revisions. One owner-scoped record per budget key makes generation idempotent and shares one invoice among linked projects. Linked-budget recipients and the full project list are shown for review; projects with different clients require choosing the appropriate recipient.

Invoice selection defaults include producer/engineer, overdub and post-production fees. Rental, studio-musician (including child rows), equipment, tuning, travel and other outside expenses default to excluded even within fee sections. Users select costs they covered for reimbursement and may deselect any fee. Totals use the budget's rate × quantity amounts, exclude estimates and session logs, separate fees from reimbursements, and subtract previously received payments. Payment-received status sets the remaining balance to zero; for linked budgets all invoiced projects must be paid. Tax is not added automatically. Review custom categories before printing.

Invoice changes autosave with serialized writes and revision conflict protection; edits made during a save are rebased onto the confirmed revision. Closing and downloading flush outstanding edits. Invoice amounts sync automatically on open, focus, every 15 seconds when clean, and before export, while preserving choices for matching rows, invoice number, date and previously received payments. Invoices use the delivery date plus 30 days for the due date. Download PDF creates an actual named PDF, showing only included nonzero charges, payable to Jacob Zang. No invoice is automatically sent to a client. Install `supabase/invoices-schema.sql` and deploy the updated `studio-data` gateway before publishing the Site. `tests/invoice.test.ts` covers fee classification, nested reimbursements, linked identity, totals and printable escaping.

The invoice window has no Refresh from budget, Save invoice, explanatory fee paragraph, or payment-instructions/notes field. The export follows the supplied long-standing invoice layout: fixed Jacob Zang letterhead, recipient left, invoice number/date/due date right, Invoice heading, Description / Qty or hr / Unit Price / Total columns, alternating gray rows, total and fixed payment terms. The brand crop contains only the letterhead, not reference client amounts or other invoice data. The project owner’s supplied PDF body and heading fonts are embedded directly. Longer tables paginate. Download names follow `Zang (client last name) Invoice MM-DD-YYYY.pdf`, using the recipient surname and original issue date in America/Chicago. Existing notes remain stored but are not exported. The due-date clock remains 30 days from delivery. `tests/invoice-pdf.test.ts` verifies filenames, PDF pages and rebasing of in-flight edits.

Invoice typography now uses a consistent hierarchy: 12pt metadata and column headings, 11pt body/amount/detail/terms text, 14pt summary headings and a 28pt Invoice title. Project appears as `Project: ...` above the invoice number in the right metadata column; wrapped metadata pushes subsequent content down. Columns are Description, Unit Price, Quantity, Total. The supplied full Copperplate Bold and Arian LT Demi font files are embedded directly. Native Copperplate letterforms replace the earlier simulated small caps; the regular/body text uses the supplied Arian LT Demi variant.

Supabase assigns random, non-repeating four-digit numbers (1000–9999) atomically. Owner-scoped permanent reservations and a unique index prevent reuse, including after deletion; numbers are immutable on edit. The supplied historical number 4112 is reserved. Old JZ-prefixed invoice numbers are converted once, with a revision bump. After all 9,000 numbers have been reserved, creation fails clearly rather than repeating a number. `0000` is an unsaved-draft placeholder and is replaced by the database before an invoice is returned. Apply `supabase/invoice-numbers-schema.sql`, then deploy the updated gateway that returns the actual stored number. `tests/invoice-numbers.sql` verifies uniqueness, immutability, historical reservations, deletion retention and exhaustion in a rolled-back transaction.
