# Deployment guide

How to put Nam Interior Constructs on the internet, step by step.

The instructions below use **[Render](https://render.com)** because it can host
both the web service and the PostgreSQL database, which means no CORS setup and
one dashboard for everything. A short section at the end covers other hosts.

- [Before you start](#before-you-start)
- [Part 1 — Put the code on GitHub](#part-1--put-the-code-on-github)
- [Part 2 — Create the database](#part-2--create-the-database)
- [Part 3 — Create the web service](#part-3--create-the-web-service)
- [Part 4 — Set the environment variables](#part-4--set-the-environment-variables)
- [Part 5 — Create the tables and seed the data](#part-5--create-the-tables-and-seed-the-data)
- [Part 6 — Verify the deploy](#part-6--verify-the-deploy)
- [Part 7 — Point your domain at it](#part-7--point-your-domain-at-it)
- [Part 8 — Going live checklist](#part-8--going-live-checklist)
- [Updating the site later](#updating-the-site-later)
- [Two things that will bite you](#two-things-that-will-bite-you)
- [Other hosts](#other-hosts)

---

## Before you start

You will need:

- A [Render](https://render.com) account (the free tier is enough to start).
- A [GitHub](https://github.com) account.
- Your real business details — phone, WhatsApp number, email and address. See
  the [going live checklist](#part-8--going-live-checklist).

Confirm the project builds cleanly before you ship it:

```bash
npm ci                  # clean install from the lockfile
npm run db:migrate      # migrations apply
npm start               # boots on http://localhost:3000
```

---

## Part 1 — Put the code on GitHub

This repository is **already connected** to
`https://github.com/Hamebeats/Nam_Interior_Constructs.git` on the **`master`**
branch, so there is nothing to set up. Confirm it, then push:

```bash
cd Nam_Interior_Constructs

git remote -v                    # should show Hamebeats/Nam_Interior_Constructs
git branch --show-current        # should show master

# make sure your secrets are NOT going to be committed
grep -q '^\.env$' .gitignore && echo ".env is ignored — good"

git add .
git commit -m "Describe what you changed"
git push
```

If you ever start a repository from scratch instead, the setup is:

```bash
git init
git add .
git commit -m "Nam Interior Constructs — initial build"
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin master
```

> ### Check this before you push
>
> ```bash
> git status --ignored --short | grep '^!!' | grep -E '\.env$|uploads/'
> ```
>
> If `.env` is listed as **tracked** (`git ls-files .env` prints something),
> remove it *before* pushing: `git rm --cached .env`. Anything in a git history
> is effectively public forever, and your database password lives in that file.

`public/img/` **must** be committed — those are the generated photos that the
site serves, and the build does not regenerate them.

---

## Part 2 — Create the database

1. In the Render dashboard: **New → PostgreSQL**.
2. Fill in:
   - **Name:** `nam-interior-db`
   - **Database:** `nam_interior_constructs`
   - **User:** leave the generated value
   - **Region:** the one closest to your visitors (for Uganda, `Frankfurt` is
     usually the best latency)
   - **Plan:** Free to start
3. Click **Create Database** and wait for the status to become *Available*.
4. On the database page, find the **Connections** section and copy the
   **Internal Database URL**. It looks like:

   ```
   postgresql://nam_interior_constructs_user:AbCdEf123@dpg-xxxxx-a/nam_interior_constructs
   ```

Keep this tab open — you need that URL twice more.

> **Internal vs External:** use the **Internal** URL for the web service (same
> region, private network, no bandwidth charge). Use the **External** URL only
> when you are running commands from your own laptop, which is what Part 5 does.
>
> **Free databases** are deleted after a period of inactivity. Check Render's
> current limits, and upgrade to a paid plan before you are relying on this in
> production — losing the database means losing every lead ever submitted.

---

## Part 3 — Create the web service

1. **New → Web Service** → connect your GitHub repository.
2. Fill in:

   | Field | Value |
   | --- | --- |
   | **Name** | `nam-interior-constructs` |
   | **Region** | **the same region as the database** |
   | **Branch** | `master` |
   | **Runtime** | `Node` |
   | **Build Command** | `npm ci && npx prisma generate` |
   | **Start Command** | `npm start` |
   | **Health Check Path** | `/api/health` |
   | **Instance Type** | Starter / Free to begin |

3. Do **not** click Create yet if you want the first deploy to succeed — go to
   Part 4 and add the environment variables first. (If you do create it now, the
   first deploy will fail with `DATABASE_URL is not set`; that is harmless, just
   add the variables and redeploy.)

**Why the build command is `npm ci && npx prisma generate`:** `npm ci` installs
exactly what `package-lock.json` pins and already runs `prisma generate` via
`postinstall`. The extra `npx prisma generate` is explicit insurance, and it does
**not** need a database — generating the client is a code step, not a query.

---

## Part 4 — Set the environment variables

In the web service: **Environment → Add Environment Variable**. Add every one of
these.

### Required

| Key | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | the **Internal Database URL** from Part 2 |
| `PUBLIC_URL` | `https://your-app.onrender.com` (or your domain, no trailing slash) |
| `SESSION_SECRET` | a fresh 96-character hex string |

Generate the secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> Do **not** set `PORT`. Render injects it and the app reads it automatically.
> Hard-coding `3000` on Render will make the health check fail.
>
> `PUBLIC_URL` matters more than it looks: it is baked into the `sitemap.xml`,
> the Open Graph tags that WhatsApp and Facebook show when someone shares a
> link, and the links in your lead-alert emails. If it is wrong, those will all
> point at `localhost`.

### Business details — replace the placeholders

| Key | Value |
| --- | --- |
| `BUSINESS_PHONE` | your real phone number, e.g. `+256 772 123 456` |
| `BUSINESS_WHATSAPP` | digits only, e.g. `256772123456` |
| `BUSINESS_EMAIL` | your real email |
| `BUSINESS_ADDRESS` | your real address, e.g. `Plot 12, Bukoto Street, Kampala` |

`BUSINESS_WHATSAPP` **must be digits only with the country code and no leading
`+`** — that is the format WhatsApp's click-to-chat links require.

### Optional — email alerts

| Key | Example |
| --- | --- |
| `MAIL_ENABLED` | `true` |
| `SMTP_HOST` | `smtp.resend.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | `resend` |
| `SMTP_PASS` | your API key |
| `MAIL_FROM` | `"Nam Interior Constructs <no-reply@yourdomain.com>"` |
| `MAIL_TO` | `info@yourdomain.com` |

With `MAIL_ENABLED=false` (the default) leads are still saved to the database and
printed to the Render logs — only the send is skipped. So you can launch now and
switch email on later without losing anything.

### Quick alternative to the dashboard

Render lets you paste a block of `KEY=value` lines. Generate it from your local
file and edit the secrets:

```bash
grep -vE '^\s*#|^\s*$' .env | sed 's/^/ /' | pbcopy    # macOS — now paste into Render
```

---

## Part 5 — Create the tables and seed the data

The migration files in `prisma/migrations/` are the schema. They need to be run
against the Render database **once**, before the site can work. Run this from
your own machine, using the **External** Database URL:

```bash
cd Nam_Interior_Constructs

export DEPLOY_DB="postgresql://…@dpg-xxxxx-a.oregon-postgres.render.com/nam_interior_constructs?sslmode=require"

# 1. create the tables
DATABASE_URL="$DEPLOY_DB" npm run db:migrate

# 2. create your admin login and all the content
DATABASE_URL="$DEPLOY_DB" \
  ADMIN_EMAIL="you@yourdomain.com" \
  ADMIN_PASSWORD="PickAStrongOne!" \
  ADMIN_NAME="Your Name" \
  npm run db:seed
```

You should see `All migrations have been successfully applied.` followed by the
seed summary.

> **Hosted Postgres requires `?sslmode=require`.** If you get
> `SSL/TLS required`, that suffix is missing.
>
> **Don't want to run it from your laptop?** Add `npm run db:migrate &&` to the
> front of the build command on paid plans, or use a **Pre-Deploy Command** of
> `npm run db:migrate`. Seeding is best done once by hand, because the seed also
> creates your admin password.

Verify it worked:

```bash
psql "$DEPLOY_DB" -c 'SELECT count(*) FROM "Service";'   # expect 8
psql "$DEPLOY_DB" -c 'SELECT count(*) FROM "Project";'   # expect 3
psql "$DEPLOY_DB" -c 'SELECT email FROM "User";'         # expect your admin
```

---

## Part 6 — Verify the deploy

Trigger a deploy (**Manual Deploy → Deploy latest commit**) and watch the logs.
You are looking for the boot banner:

```
  Nam Interior Constructs
  ───────────────────────────────────────
  Website   https://your-app.onrender.com
  Dashboard https://your-app.onrender.com/admin/
  API       https://your-app.onrender.com/api/health
  Mode      production
  Email     disabled (set MAIL_ENABLED=true)
```

`Mode production` confirms the env vars were picked up. If it says
`development`, fix `NODE_ENV` and redeploy — in development mode cookies are not
marked `secure` and the session secret is regenerated on every restart.

Now walk through the site:

- [ ] `https://your-app.onrender.com` loads with photos and a styled header.
- [ ] `/services`, `/work`, `/about`, `/contact` all load.
- [ ] `/work` — the filter chips work and clicking a photo opens the lightbox.
- [ ] `/sitemap.xml` shows your real domain, not `localhost`.
- [ ] Submit the contact form with **your own** details and confirm you land in
      the database:

      ```bash
      psql "$DEPLOY_DB" -c 'SELECT name, email, phone, "createdAt" FROM "Lead" ORDER BY "createdAt" DESC LIMIT 5;'
      ```

- [ ] If `MAIL_ENABLED=true`, the alert email arrives.
- [ ] Then delete that test row:

      ```bash
      psql "$DEPLOY_DB" -c 'DELETE FROM "Lead" WHERE email = '"'"'you@example.com'"'"';'
      ```

- [ ] Open the site on a real phone and check the header does not overflow and
      the WhatsApp button opens a chat with your number.

### Troubleshooting a failed deploy

| Log message | Cause and fix |
| --- | --- |
| `✖ FATAL: DATABASE_URL is not set.` | The variable is missing, or you used the database's *name* instead of its URL. |
| `✖ FATAL: SESSION_SECRET is missing or too weak.` | Set a real 96-character hex string. Values under 32 characters and anything starting with `change-me` are rejected in production. |
| `Can't reach database server` | Wrong URL, or the web service and database are in different regions. Use the **Internal** URL and match the regions. |
| `relation "Service" does not exist` | Part 5 was skipped. Run `npm run db:migrate`. |
| `Error: P1001` | The database is not Available yet, or you used the External URL from inside Render. |
| Health check failing | `PORT` was set manually, or the start command is not `npm start`. |

---

## Part 7 — Point your domain at it

1. In the web service: **Settings → Custom Domains → Add Custom Domain**, and
   enter `naminteriorconstructs.com` (and `www.naminteriorconstructs.com`).
2. Render shows you the DNS records to create. At your domain registrar
   (Namecheap, GoDaddy, Cloudflare, …):

   | Type | Name | Value |
   | --- | --- | --- |
   | `A` | `@` | the IP Render gives you |
   | `CNAME` | `www` | `your-app.onrender.com` |

3. Wait for DNS to propagate (minutes to a few hours). Render issues the TLS
   certificate automatically once it can see the records.
4. **Update `PUBLIC_URL`** to `https://naminteriorconstructs.com` and redeploy.
   This is easy to forget — if you skip it, every shared link will still
   preview with the `onrender.com` address.
5. Add `https://naminteriorconstructs.com/sitemap.xml` to
   [Google Search Console](https://search.google.com/search-console).

---

## Part 8 — Going live checklist

- [ ] Every `BUSINESS_*` placeholder replaced with real details.
- [ ] A real photo, phone number and address on the contact page.
- [ ] `NODE_ENV=production` — confirmed by `Mode production` in the boot banner.
- [ ] `PUBLIC_URL` set to the final `https://` domain with no trailing slash.
- [ ] A unique, strong `SESSION_SECRET` you have stored in a password manager.
- [ ] Admin password changed from whatever you passed to the seed.
- [ ] `MAIL_ENABLED=true` and a test lead successfully delivered (or you accept
      checking the Render logs for new leads).
- [ ] Test lead deleted from the `Lead` table.
- [ ] `https://your-domain/robots.txt` and `/sitemap.xml` show the live domain.
- [ ] The site loads on a real phone, and the header fits without sideways
      scrolling.
- [ ] A database backup plan: Render takes daily backups on paid plans. On free,
      run `pg_dump` yourself occasionally:

      ```bash
      pg_dump "$DEPLOY_DB" > backup-$(date +%F).sql
      ```

- [ ] `/admin/` currently returns a 404 — that is expected until the dashboard UI
      is built; the API behind it is complete. Manage content with
      `DATABASE_URL="$DEPLOY_DB" npm run db:studio`.

---

## Updating the site later

### Changing text or photos

Use Prisma Studio against production:

```bash
DATABASE_URL="$DEPLOY_DB" npm run db:studio
```

Point it at a tunnel or use the External URL. Changes appear immediately — no
redeploy needed, because pages are rendered from the database on each request.

### Changing code

```bash
git add .
git commit -m "Update the about page"
git push
```

Render redeploys automatically. Thanks to the `?v=` content hash, returning
visitors get the new CSS immediately — a permanently-cached stylesheet can never
be paired with new markup.

### Changing the database structure

```bash
# locally
npm run db:migrate:dev -- --name added_something
git add prisma/migrations && git commit -m "Add migration" && git push

# then against production
DATABASE_URL="$DEPLOY_DB" npm run db:migrate
```

Never run `db:migrate:dev` against production, and never edit an
already-deployed `migration.sql` file — that is what new migrations are for.

### Adding new photos

```bash
npm run images     # regenerate webp variants and manifest.json from Photos/
git add public/img && git commit -m "Add new photos" && git push
```

Then import them into the production database with the seed, or add the project
rows via Prisma Studio.

---

## Two things that will bite you

### 1. The filesystem is temporary

Render wipes the container's disk on every deploy and restart. That means
anything written to `uploads/` — images uploaded through the admin API — **will
disappear** the next time you deploy.

The site is built so this does not matter for the portfolio: those photos live in
`public/img/`, which is committed to git and shipped with the code.

If you start using admin uploads for real content, move to persistent storage
(S3, Cloudflare R2, Backblaze B2, or a Render Disk) before you rely on it. The
multer storage configuration in `server/routes/uploads.js` is the single place
to change.

### 2. Export your data before the free tier ends

A free Render database is deleted after a period of inactivity, and there is no
undo. Before you depend on this in production, either upgrade the database plan
or set a reminder to run:

```bash
pg_dump "$DEPLOY_DB" > nam-backup-$(date +%F).sql
```

---

## Other hosts

The app is a plain Node server — no build step and no platform-specific code —
so it runs anywhere. The only hard requirements are **Node 20+** and
**PostgreSQL**.

| Host | Notes |
| --- | --- |
| **Railway** | Add a Postgres plugin; it injects `DATABASE_URL` automatically. Set the rest of the variables by hand. |
| **Fly.io** | `fly launch`, then `fly postgres create` and `fly postgres attach`. Set `PUBLIC_URL` to `https://<app>.fly.dev`. |
| **Heroku** | Add the `heroku-postgresql` add-on. Use a `Procfile` containing `web: npm start`. |
| **DigitalOcean App Platform** | One component for the web service, one managed Postgres cluster. |
| **A VPS (nginx)** | Run `npm start` under `pm2` or a systemd unit, then reverse-proxy to it. `app.set('trust proxy', 1)` is already configured, so `req.ip` and secure cookies work correctly behind nginx. Set `PUBLIC_URL` to the public HTTPS URL. |

Whichever you choose, the sequence is identical: **set the environment variables
→ run `npm run db:migrate` → run `npm run db:seed` → `npm start`.**
