# Nam Interior Constructs

The website and lead-management platform for **Nam Interior Constructs**, an
interior fit-out contractor in Kampala, Uganda.

It is a **multi-page** server-rendered site — every section is its own URL
(`/`, `/services`, `/services/kitchens`, `/work`, `/work/<project>`, `/about`,
`/contact`) — backed by a Postgres database, an admin JSON API, a contact/quote
pipeline that emails you when a lead arrives, and an image pipeline that turns
your raw phone photos into responsive `webp` files.

---

## Contents

1. [What's in the box](#1-whats-in-the-box)
2. [Prerequisites](#2-prerequisites)
3. [Local setup, step by step](#3-local-setup-step-by-step)
4. [Connecting the database](#4-connecting-the-database)
5. [Every environment variable explained](#5-every-environment-variable-explained)
6. [Running the site](#6-running-the-site)
7. [Managing your content](#7-managing-your-content)
8. [Deploying to the internet](#8-deploying-to-the-internet)
9. [Project structure](#9-project-structure)
10. [How it is kept secure](#10-how-it-is-kept-secure)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. What's in the box

| Piece | Technology | Notes |
| --- | --- | --- |
| Web server | Node.js 20+ / Express 5 | One process serves the pages **and** the API |
| Database | PostgreSQL 15+ via Prisma 6 | Users, leads, projects, services, testimonials, settings |
| Pages | Server-rendered HTML | No build step, no framework, no client-side router |
| Interactivity | ~700 lines of vanilla JS | Progressive enhancement only — the site works with JS off |
| Images | `sharp` | Generates `400 / 800 / 1600px` `.webp` variants + a manifest |
| Email | `nodemailer` | SMTP, disabled by default |
| Security | `helmet` + per-response CSP nonce | No inline scripts, strict policy |

**There is no build step.** `public/styles.css` and `public/app.js` are served
as-is. Because their URLs would otherwise never change, they are linked with a
content hash (`/styles.css?v=37b767a4e9`) that is computed at boot from the file
contents — see [`server/lib/asset-version.js`](server/lib/asset-version.js).
Edit the CSS, restart the server, and the hash changes, so no visitor is ever
served a stale stylesheet beside fresh markup.

---

## 2. Prerequisites

| Tool | Version | Check with |
| --- | --- | --- |
| Node.js | **20 or newer** | `node -v` |
| npm | 9 or newer | `npm -v` |
| PostgreSQL | **15 or newer** | `psql --version` |
| Git | any | `git --version` |

> **Do not use Docker.** It is not required and the project is set up to talk to
> a normal, locally-installed Postgres.

### Installing PostgreSQL on macOS

If `psql --version` fails, install it with Homebrew:

```bash
brew install postgresql@15
brew services start postgresql@15        # starts it now and on every login
echo 'export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

On Windows, download the installer from
[postgresql.org/download](https://www.postgresql.org/download/windows/) and keep
the password you set for the `postgres` user. On Ubuntu/Debian:
`sudo apt install postgresql`.

---

## 3. Local setup, step by step

### Step 1 — Install the dependencies

```bash
cd Nam_Interior_Constructs
npm install
```

This also runs `prisma generate` automatically (`postinstall`), which creates the
typed database client.

### Step 2 — Create your `.env` file

```bash
cp .env.example .env
```

Then open `.env` and set **at minimum** these two things:

1. `DATABASE_URL` — your Postgres connection string (see the next section).
2. `SESSION_SECRET` — a long random string. Generate one with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

### Step 3 — Create the database

```bash
createdb nam_interior_constructs
```

(If `createdb` is not found, add the Postgres `bin` folder to your `PATH` as
shown above, or use the full path `/opt/homebrew/opt/postgresql@15/bin/createdb`.)

### Step 4 — Create the tables

```bash
npm run db:migrate      # runs `prisma migrate deploy`
```

You should see `All migrations have been successfully applied.`

### Step 5 — Fill it with your content

```bash
npm run db:seed
```

This creates your admin login, the 8 services, the 3 portfolio projects (with
all their photos), 4 testimonials and the site settings. **It is safe to re-run** —
everything is an upsert and content you have edited by hand is left alone.

### Step 6 — Start it

```bash
npm run dev             # restarts automatically when you edit a file
```

Open **http://localhost:3000**.

---

## 4. Connecting the database

Everything database-related lives in the single `DATABASE_URL` value in `.env`.

The format is always:

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE_NAME
```

### Local Postgres (default)

```env
DATABASE_URL="postgresql://kaggwaham@localhost:5432/nam_interior_constructs"
```

- If your Postgres role has **no password**, leave the `:PASSWORD` part out
  entirely (note there is no colon) — exactly as above.
- If it **does** have a password: `postgresql://kaggwaham:mypassword@localhost:5432/nam_interior_constructs`.
- Special characters in a password (`@ : / ? #`) must be percent-encoded.
  `p@ss` becomes `p%40ss`.
- On Windows the host is usually still `localhost` and the port `5432`.

### Hosted Postgres (for deployment)

You do **not** need to change any code — you only paste a different URL. Copy the
connection string from your host's dashboard:

| Host | Where to find it | Which one to use |
| --- | --- | --- |
| **Render** | Database → *Connect* → *Internal Database URL* | Internal, if the web service is also on Render |
| **Neon** | Project → *Connection string* | The pooled string |
| **Supabase** | Settings → Database → *Connection string* | **URI**, not the "Connection pooling" one, unless you append `?pgbouncer=true` |

Hosted providers almost always require TLS. If the string does not already say
so, append it:

```env
DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require"
```

> **Render note:** use the **Internal** URL. The *External* URL is subject to
> bandwidth charges and is slower — it is only for connecting from your laptop.

### Changing the database structure later

The schema lives in [`prisma/schema.prisma`](prisma/schema.prisma). To change it:

```bash
# 1. edit prisma/schema.prisma
# 2. create a migration on your machine
npm run db:migrate:dev -- --name added_something

# 3. commit the new folder in prisma/migrations/, then in production run:
npm run db:migrate
```

Never edit `prisma/migrations/**/migration.sql` by hand, and never run
`db:migrate:dev` against your live production database.

> Handy: `npm run db:studio` opens Prisma Studio — a spreadsheet-like browser UI
> for every table. Great for fixing a typo without writing SQL.

---

## 5. Every environment variable explained

`.env.example` is the authoritative template. Here is what each one does.

### Core

| Variable | Required | Default | What it does |
| --- | --- | --- | --- |
| `NODE_ENV` | yes in prod | `development` | Set to `production` when deployed. Turns on secure cookies, HSTS and error redaction. |
| `PORT` | no | `3000` | Port the server listens on. Render sets this for you — do not hard-code it there. |
| `PUBLIC_URL` | yes in prod | `http://localhost:3000` | The public base URL. Used in `sitemap.xml`, Open Graph tags and emails. **No trailing slash.** |

### Database

| Variable | Required | What it does |
| --- | --- | --- |
| `DATABASE_URL` | **yes** | Postgres connection string. The app refuses to boot without it. |

### Security

| Variable | Required | What it does |
| --- | --- | --- |
| `SESSION_SECRET` | **yes in prod** | Signs the admin session cookie. Must be ≥ 32 characters and must not start with `change-me`. In production a weak value is a **fatal startup error** — that is deliberate, because a guessable secret lets anyone forge an admin login. In development a temporary one is generated and a warning is printed. |
| `SESSION_HOURS` | no (default `12`) | How long an admin stays signed in. |

### First admin account

Only read by `npm run db:seed`. After the account exists, changing these has no
effect — use the API or Prisma Studio to change a password.

| Variable | Default |
| --- | --- |
| `ADMIN_EMAIL` | `admin@naminteriorconstructs.com` |
| `ADMIN_PASSWORD` | `ChangeMe123!` |
| `ADMIN_NAME` | `Site Administrator` |

To hash a password yourself: `npm run hash -- "MyNewPassword"`.

### Email (optional)

| Variable | Default | What it does |
| --- | --- | --- |
| `MAIL_ENABLED` | `false` | While false, new leads are still saved to the database and **printed to the server console** — only the actual send is skipped. |
| `SMTP_HOST` | — | e.g. `smtp.resend.com`, `smtp.gmail.com`, `smtp.zoho.com` |
| `SMTP_PORT` | `587` | `587` for STARTTLS, `465` for implicit TLS |
| `SMTP_SECURE` | `false` | `true` when the port is `465` |
| `SMTP_USER` / `SMTP_PASS` | — | Your SMTP credentials. For Gmail use an **App Password**, not your real password. |
| `MAIL_FROM` | — | The From header, e.g. `"Nam Interior Constructs <no-reply@yourdomain.com>"` |
| `MAIL_TO` | `BUSINESS_EMAIL` | Where lead alerts are delivered. |

### Business details

> ### ⚠️ These are placeholders — you must replace them
>
> Every `BUSINESS_*` value below is a **made-up placeholder**. There was no
> business card in the supplied photos, so the real details were unknown. They
> appear on the contact page, in the header/footer, in the WhatsApp buttons and
> in the structured data that Google reads. **Replace all four before going
> live.**

| Variable | Placeholder value | Where it appears |
| --- | --- | --- |
| `BUSINESS_PHONE` | `+256 700 000 000` | Header, footer, contact page, `tel:` links |
| `BUSINESS_WHATSAPP` | `256700000000` | Every WhatsApp button. **Digits only, country code included, no `+` and no spaces.** |
| `BUSINESS_EMAIL` | `info@naminteriorconstructs.com` | Contact page, footer, mailto links |
| `BUSINESS_ADDRESS` | `Kampala, Uganda` | Contact page, Google structured data |

---

## 6. Running the site

```bash
npm run dev      # development — restarts on file changes
npm start        # production — no watcher
```

On boot you will see:

```
  Nam Interior Constructs
  ───────────────────────────────────────
  Website   http://localhost:3000
  Dashboard http://localhost:3000/admin/
  API       http://localhost:3000/api/health
  Mode      development
  Email     disabled (set MAIL_ENABLED=true)
```

> **Note:** the boot banner advertises `/admin/`, but the admin **user
> interface has not been built yet** — `/admin/` returns a 404. The admin **API**
> behind it is complete and working (see [`server/routes/`](server/routes/)), so
> the UI is the only missing piece. Until then, use `npm run db:studio` to manage
> content.

### Every URL

| URL | What it is |
| --- | --- |
| `/` | Home |
| `/services` | All services |
| `/services/<slug>` | One service (e.g. `/services/kitchens`) |
| `/work` | Portfolio index, filterable by category |
| `/work/<slug>` | One project gallery with a lightbox |
| `/about` | About + process |
| `/contact` | Contact form / quote request |
| `/robots.txt`, `/sitemap.xml` | SEO — generated from the database |
| `/api/health` | Liveness probe |
| `POST /api/leads` | Where the contact form submits |
| `/api/auth/*` | Login, logout, current user |
| `/api/admin/leads`, `/api/admin/projects`, `/api/admin/content`, `/api/admin/uploads`, `/api/admin/users` | Admin CRUD |

### Running it in the background

```bash
nohup npm start > server.log 2>&1 &
```

**Windows PowerShell:** `Start-Process npm -ArgumentList start`

---

## 7. Managing your content

### Adding a project

1. Put the photos in `Photos/` (or a subfolder of it).
2. Open [`scripts/optimize-images.js`](scripts/optimize-images.js) and add an
   entry to the folder list at the top — give it a `slug` and a `folder`.
3. Run:

   ```bash
   npm run images        # generates public/img/... and updates manifest.json
   npm run db:seed       # imports anything new into the database
   ```

New projects are inserted, existing ones are left alone. Photos are converted to
`webp` at 400px (thumbnails), 800px (tablets) and 1600px (full screen), and their
intrinsic dimensions are recorded so pages never shift while images load.

### Editing text

Use Prisma Studio (`npm run db:studio`) or the admin API. Services and projects
each have `title`, `tagline`/`summary`, `description` and `features`.

### Marking a project as featured

Set `featured = true` on a project. Those appear on the home page. `sortOrder`
controls the order (lowest first); `published = false` hides one completely.

### Filter categories

A project's `category` must be one of: `KITCHENS`, `WARDROBES`, `MEDIA_WALLS`,
`OFFICE_FITOUT`, `CEILINGS`, `BATHROOMS`, `TILING`, `FURNITURE`, `PAINTING`,
`RENOVATION`. The filter chips on `/work` are generated from whichever categories
actually have a published project.

---

## 8. Deploying to the internet

The intended target is **Render** (one web service + one Postgres database, no
CORS, no separate frontend host), but anything that runs Node and gives you
Postgres will work — Railway, Fly.io, Heroku, a VPS.

**Full step-by-step instructions, including DNS and post-deploy checks, are in
[`DEPLOYMENT.md`](DEPLOYMENT.md).**

The short version:

1. Push the repository to GitHub.
2. On Render: **New → PostgreSQL**, then copy the **Internal Database URL**.
3. **New → Web Service**, connect the repo.
   - Build command: `npm ci && npx prisma generate`
   - Start command: `npm start`
4. Add every environment variable from `.env.example`, with `NODE_ENV=production`.
5. Set the database up once, from your machine, pointing at the Render database:

   ```bash
   DATABASE_URL="<the Internal Database URL>" npm run db:migrate
   DATABASE_URL="<the Internal Database URL>" npm run db:seed
   ```

6. Deploy, replace the four `BUSINESS_*` placeholders, and log in.

---

## 9. Project structure

```
Nam_Interior_Constructs/
├── server/
│   ├── index.js              # app assembly: security, middleware, routes, static
│   ├── config.js             # every env var, read and validated in one place
│   ├── db.js                 # the single shared Prisma client
│   ├── lib/
│   │   ├── asset-version.js  # content hash for cache-busting css/js
│   │   ├── auth.js           # password hashing + session cookies
│   │   ├── mailer.js         # nodemailer transport (no-ops when disabled)
│   │   ├── site-data.js      # the 4 queries every page needs, in one Promise.all
│   │   └── validation.js     # zod schemas for every request body
│   ├── middleware/           # session guard + error/404 handlers
│   ├── routes/               # pages.js, public.js, auth.js, leads.js, projects.js,
│   │                         #   content.js, uploads.js (multer), users.js
│   └── views/
│       ├── layout.js         # the single <html> shell + structured data
│       ├── components.js     # every reusable block (cards, heroes, pagers…)
│       └── pages/            # one module per page, each returning a descriptor
├── public/
│   ├── styles.css            # the whole design system, ~2200 lines, no build step
│   ├── app.js                # progressive enhancement: theme, filter, lightbox, form
│   ├── 404.html              # static fallback, stylesheet link versioned at runtime
│   ├── favicon.svg
│   └── img/                  # generated by `npm run images`
│       ├── manifest.json     # slug → photo dimensions, read by the seed
│       └── projects/<slug>/  # <nn>-400.webp, <nn>-800.webp, <nn>-1600.webp
├── prisma/
│   ├── schema.prisma         # the database structure
│   ├── migrations/           # versioned SQL — this is what production runs
│   └── seed.js               # creates the admin, services, projects, testimonials
├── scripts/
│   ├── optimize-images.js    # raw photos → responsive webp
│   └── hash-password.js      # password hash helper
├── Photos/                   # your raw source photos (not served)
├── uploads/                  # admin-uploaded images (gitignored)
├── .env                      # your secrets — never committed
└── .env.example              # the template — committed
```

### How a page is rendered

Each module in `server/views/pages/` exports a function that returns a plain
object, and `layout.js` turns it into HTML:

```js
{
  active: 'work',              // sets <body data-page="work">
  path: '/work',
  title, description, image,   // <title>, meta description, OG image
  ogType: 'website',           // or 'article' on a project page
  structuredData: [ … ],       // JSON-LD; the business graph is always prepended
  body: '<section>…</section>',// the inner HTML for <main>
  __status: 404,               // only set by the not-found builder
}
```

To add a page: create `server/views/pages/yourpage.js`, export a builder, then
register the route in `server/routes/pages.js` and add it to `NAV` in
`components.js` if it belongs in the menu.

> **Restart the server after editing anything under `server/`.** ES modules are
> cached at import time, so `--watch` is what picks the change up. Files in
> `public/` do not need a restart.

---

## 10. How it is kept secure

- **No secrets in the repository.** `.env` is gitignored; only `.env.example` is
  committed. If you ever commit a real `.env`, rotate every value in it.
- **Strict Content-Security-Policy** with a fresh nonce on every response. No
  inline `<script>` anywhere — the only exceptions are the JSON-LD blocks, which
  are explicitly nonce-tagged.
- **Parameterised queries only.** Every database call goes through Prisma, so
  there is no string-concatenated SQL to inject into.
- **Every request body is validated** with zod before it reaches the database;
  unknown fields are stripped rather than stored.
- **Rate limiting** on the contact form and on login (both 15-minute windows), so
  the form cannot be used to spam you and passwords cannot be brute-forced.
- **A honeypot field** (`.website`) on the contact form. When it is filled the
  request is accepted with a success message but silently discarded and no email
  is sent — bots do not learn that they were caught.
- **Signed, httpOnly session cookies.** `secure` and HSTS only turn on when
  `NODE_ENV=production`.
- **Fail-closed startup.** A missing `DATABASE_URL`, or a weak `SESSION_SECRET`
  in production, stops the process instead of running insecurely.
- **API responses are `Cache-Control: no-store`**, so a shared computer or a CDN
  can never show one visitor's lead data to another.

---

## 11. Troubleshooting

**`✖ FATAL: DATABASE_URL is not set.`**
There is no `.env` file, or it has no `DATABASE_URL`. Run `cp .env.example .env`
and fill it in. Note the app looks for `.env` in the project root, next to
`package.json`.

**`✖ FATAL: SESSION_SECRET is missing or too weak.`**
You set `NODE_ENV=production` without a real secret. Generate one with the
`node -e` command in [section 5](#5-every-environment-variable-explained).

**`Can't reach database server at localhost:5432`**
Postgres is not running. On macOS: `brew services start postgresql@15`. Check it
with `pg_isready`.

**`database "nam_interior_constructs" does not exist`**
Run `createdb nam_interior_constructs`.

**`role "kaggwaham" does not exist`**
Your Postgres username is not `kaggwaham`. Find it with `whoami` (the default
Homebrew role matches your macOS username) and fix `DATABASE_URL` accordingly.

**The site loads but there are no projects.**
The seed has not run: `npm run db:seed`. If it complains that
`public/img/manifest.json` is missing, run `npm run images` first.

**My CSS change does nothing.**
Restart the server — the `?v=` cache-busting hash is computed at boot. If it is
still stale, hard-reload (<kbd>Cmd/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd>).

**`/admin/` is a 404.**
Expected — the admin UI is not built yet. Use `npm run db:studio`.

**Emails are not arriving.**
Set `MAIL_ENABLED=true`, verify the `SMTP_*` values, and test
`POST /api/leads` again. Check the spam folder. Note that leads are *always*
saved to the database first, so nothing is lost while email is misconfigured —
the console shows `[mail:disabled]` with the subject line instead.

**`EADDRINUSE: address already in use :::3000`**
Something else is on port 3000. Find and stop it:
`lsof -nP -iTCP:3000 -sTCP:LISTEN -t | xargs kill`, or set `PORT=3001`.

**I forgot the admin password.**
```bash
npm run hash -- "MyNewPassword"
```
then paste the hash into `ADMIN_PASSWORD` and re-run `npm run db:seed`, or update
the `User.passwordHash` row directly in `npm run db:studio`.

---

## License

Private and proprietary. © Nam Interior Constructs. All rights reserved.
