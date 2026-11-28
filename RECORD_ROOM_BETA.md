# Record Room beta

Production origin: https://recordroomhq.com. This Vercel app serves a public login page and a private workspace for each invited producer. The original Session site and its records stay on their existing host. A beta account never claims historical data by email.

## Deploy on Vercel

Import this repository into a **new** Next.js project. Use the `record-room-beta` branch as its production branch, the repository root, Node 24, and the checked-in `vercel.json`. Enable Corepack for the pinned pnpm version (Vercel setting `ENABLE_EXPERIMENTAL_COREPACK=1` if needed). Do not set a static output directory. Add the following environment variables, then deploy. Public Supabase keys are baked into the browser at build time; redeploy after changing them.

| Variable | Value |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Supabase Project URL |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Supabase publishable key |
| SUPABASE_SECRET_KEY | Server-only Supabase secret key (or legacy service-role key) |
| RECORD_ROOM_ORIGIN | https://recordroomhq.com (no trailing slash) |
| GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET | Google web OAuth client for Drive |
| GOOGLE_PICKER_API_KEY / GOOGLE_DRIVE_APP_ID | Origin-restricted Picker key and Google Cloud project number |
| GOOGLE_DRIVE_TOKEN_KEY | A stable 32-byte random key, base64 encoded. Keep server-side and backed up. |

In **Settings → Domains**, attach `recordroomhq.com`. At the registrar, use the exact DNS record and any ownership verification record Vercel gives for this project. Leave mail records in place. Set Deployment Protection so production visitors can reach the login screen without a Vercel account; keep previews protected. Do not make the legacy Sites workspace public.

## Auth and beta invitations

The migration in `supabase/migrations/202611280001_record_room_beta.sql` has been applied to the existing studio database. New projects on a fresh database also require the original studio schema and RPCs. Public roles cannot query studio tables or call the studio budget RPC. Record Room verifies the Supabase user and database invitation before each private API request. The studio service key is server-only.

Add each tester's actual sign-in email to `public.rr_invites` via the Supabase Table Editor: assign a unique slot from 1 through 9 and a lowercase email. Removing an invitation locks the workspace without deleting it. Coordinate any change of sign-in email with the invite list. No tester is invited by this code alone.

In Supabase Authentication, enable email/password, **Confirm email**, and Google. Set Site URL to `https://recordroomhq.com` and allow `https://recordroomhq.com/auth/callback`. Set both **Confirm signup** and **Reset password** email templates to include `{{ .Token }}` (the UI accepts the code length configured in Auth). Set up a verified SMTP sender for delivery to testers. Configure the Google provider's client ID and secret; use the Supabase callback URL shown in its dashboard as an authorized Google redirect URI. Google sign-in authenticates identity; Drive access is requested separately.

In Google Cloud, add `https://recordroomhq.com` to the web client's authorized JavaScript origins, allow the production origin on the Picker key, enable Drive and Picker, and add the beta Google accounts as OAuth test users when using a testing consent screen. Google may require renewed consent during testing. Each workspace's stored Drive token is encrypted with its verified owner identity. Automatic creation and public link sharing are off initially. Turning sharing off stops new grants; it does not revoke prior links. Deleting a Record Room account deletes its stored connection and workspace records, not the producer's own Google Drive files.

## Release check

Run `pnpm test`, `pnpm build` and, in an isolated SQL transaction, `tests/rr-tenant-isolation.sql` (uses temporary invitation slots 8 and 9 and rolls everything back). With two invited accounts on separate browser profiles, verify email-code and Google onboarding; create projects and templates in each; check direct project URLs/API requests do not cross accounts; exercise Drive connect and disconnect, recovery, and disposable account deletion. Do not invite the rest of the group until live email, OAuth, DNS and TLS work.

The beta starts with empty workspaces. Moving Jacob's historical records is a separate, owner-verified migration; do not copy Drive refresh tokens between identities or assign legacy records based only on a submitted email.

