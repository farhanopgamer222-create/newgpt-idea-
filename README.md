# FarhanGPT

A complete, private multi-model AI workspace built with Next.js App Router, React, PostgreSQL, and Drizzle. Includes streaming chat, local text/code attachments, OpenRouter web search, secure email/password accounts, private guest sessions, saved conversations, search/rename/delete/export, a prompt library with local bookmarks, voice input, read-aloud, light/dark/system themes, mouse-reactive stars, a PWA, and a native Android client.

## Downloads

- `public/downloads/farhangpt.apk`: actual installable Android client, development-signed. Android 6.0 or newer. Enter your deployed HTTPS website address on first launch. The app contains no AI keys.
- `public/downloads/farhangpt-source.zip`: complete source package, excluding real environment files, private data, signing keys, dependencies, and build output.
- Both downloads are accessible from **Get the app** in the dismissible announcement and sidebar. Android APK installation may require allowing your browser to install unknown apps.

## Local development

1. Use Node.js 22 or newer and a PostgreSQL database.
2. Run `npm ci` (or `npm install`).
3. Copy `.env.example` to `.env.local`, then set a real `DATABASE_URL` and a **new** `OPENROUTER_API_KEY`.
4. Run `npx drizzle-kit push` to create the tables.
5. Run `npm run dev`.

Never put a key in a `NEXT_PUBLIC_*` environment variable. A key previously shared in a message should be revoked and replaced before production. The distributed source contains no API key and does not bundle any existing user accounts or conversations.

## Deploy on Cloudflare

This is a **fullstack application**. Uploading it as static files to Cloudflare Pages will not provide accounts, a database, or AI requests. Deploy to **Cloudflare Workers with OpenNext** instead. The compatible adapter and Wrangler are included.

1. Create an internet-reachable hosted PostgreSQL database (for example Neon or Supabase PostgreSQL). Use its pooled connection URL with SSL. A local `127.0.0.1` database cannot be reached by Cloudflare. With Supabase choose the session/transaction pooler URL, not a private IPv6-only address.
2. Put your database URL and a rotated OpenRouter key in local `.env.local`. Do not upload this file.
3. Run `npm ci`, then `npx drizzle-kit push`. This creates the FarhanGPT schema in the hosted database.
4. Run `npx wrangler login` and complete Cloudflare sign-in.
5. Set Worker secrets with `npx wrangler secret put DATABASE_URL` and `npx wrangler secret put OPENROUTER_API_KEY`. Paste each value only when Wrangler prompts. If the Worker does not exist yet, create `farhangpt` in the dashboard or perform the first deploy, then add secrets and redeploy.
6. Run `bash scripts/deploy-cloudflare.sh`. It builds with OpenNext and deploys to Workers. You can also use `npx opennextjs-cloudflare build` followed by `npx opennextjs-cloudflare deploy`.
7. Visit the generated `https://farhangpt.<your-account>.workers.dev` address. Check `/api/health` returns `{"ok":true}`. Register a new account and test a chat.
8. For a custom domain, open Workers & Pages → farhangpt → Settings → Domains & Routes → Add custom domain.
9. Download the Android APK, install it, and enter this same HTTPS address. Or install the PWA from your browser menu.

The `wrangler.jsonc` file enables Node compatibility for PostgreSQL and server-side cryptography. Cloudflare's runtime hint makes PostgreSQL connections single-use rather than sharing sockets between requests. For high traffic consider Cloudflare Hyperdrive and a paid Workers plan. Database/provider charges and model availability depend on your selected services. Cloudflare deployment requires your own Cloudflare credentials; no external deployment is performed by the local build.

If you rename the Worker, update both `name` and the `WORKER_SELF_REFERENCE` service in `wrangler.jsonc`. Production builds need `DATABASE_URL` present while building, as well as runtime secrets.

## Android client

The native source is in `android/`. It is a lightweight Java/WebView client, **not an offline AI model**. It requires your live HTTPS website. It uses secure cookies, disables local-file access and mixed HTTP content, opens external links in your browser, and only requests microphone permission when needed. WebView speech-recognition support depends on the device; system keyboard dictation is a fallback.

The included APK is signed with a development certificate so it can be installed directly. For a public release, use a private release keystore and rebuild; do not use the development certificate for a Play Store release. Android SDK signing tools verify the APK, but this sandbox does not have a physical Android device for device-level testing.

To rebuild: install JDK 17, Android SDK platform API 28+ and build tools, and the official R8 compiler JAR. Set `ANDROID_SDK_ROOT`, `ANDROID_BUILD_TOOLS`, `ANDROID_JAR`, and `R8_JAR` as necessary, then run `bash scripts/build-android.sh`. The script generates a temporary development signing key if none is present. Use a proper release signing pipeline for production.

## Data and security

- Passwords: salted scrypt hashes; no plaintext password storage.
- Sessions: 256-bit random tokens, SHA-256 hashes in PostgreSQL, HttpOnly/SameSite cookies, rotated on sign-in.
- Every conversation read/write is checked against the current account or private guest session.
- Registering or signing in claims that guest session's existing chats.
- AI keys exist only in the server environment; the browser calls the application's `/api/chat` proxy.
- Account deletion, authenticated password changes, JSON data export, and conversation deletion are available in Settings.
- Guest and account chat limits, IP-based limits, and authentication limits are enforced in PostgreSQL. Free routing defaults to `openrouter/free`; premium models and web search can incur provider charges.
- Custom instructions, theme, prompt bookmarks, animation preference, and announcement dismissal are stored on the current device.
- Messages are sent to OpenRouter and the chosen model provider to generate responses. Do not submit confidential information without reviewing their policies.
- The service worker only caches the offline screen and public app icons. It does not cache account APIs, private chats, or AI responses.
- There is no email service configured. Accounts use email/password credentials, not email verification, social sign-in, or email-based password resets. Signed-in users can change their password in Settings.

## Validation

Run `npx next typegen`, `npm exec tsc -- --noEmit --pretty false`, and `npm run build`. The API health check is `/api/health`.

For end-to-end tests against a running instance: install Chromium with `npx playwright install --with-deps chromium`, then run `node scripts/smoke-test.mjs`. Override `TEST_BASE_URL` for another deployment. The test makes one short free-model AI request, creates a temporary account, verifies privacy and account flows, and deletes its test account. A provider authentication/credit failure is reported separately from application correctness.

Keyboard shortcuts: **Ctrl/Cmd K** searches chats; **Ctrl/Cmd Shift O** starts a new one; **Enter** sends; **Shift Enter** adds a line; **Escape** closes dialogs.

Made by Farhan. Made for curious minds.
