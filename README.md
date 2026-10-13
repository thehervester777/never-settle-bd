# NEVER SETTLE — online store

A complete, self-hosted fashion store for T-shirts, pants, punjabis, kurtas, shoes and wallets.

- **Shop:** home page with animations, collections with filters and sorting, product pages with sizes/colours and stock, search, cart, checkout, order tracking, contact, FAQ, size guide, policies.
- **Payments:** Cash on delivery across Bangladesh.
- **Admin panel** at `/admin`: sales dashboard with charts, orders (bulk actions, timeline, CSV export), printable invoices and packing slips, customers, products, inventory with stock history and stock value, profit & loss, expenses, cash transactions, team members with roles, activity log and store settings.
- **Safe by design:** prices, stock and delivery charges are always recalculated on the server; stock is reserved when an order is placed and returned if it is cancelled or returned.

Built with Next.js 15, React 19, Tailwind CSS, Framer Motion and MySQL / MariaDB.

---

## What you need

| | |
|---|---|
| Hosting | cPanel hosting with **Setup Node.js App** (Node.js **20** or newer), a MySQL/MariaDB database, and ideally **Terminal** or SSH access |
| Domain | Your domain pointed at the hosting, with **SSL (https)** turned on (cPanel → SSL/TLS Status → Run AutoSSL) |

> If your plan has no "Setup Node.js App" icon, ask your host to enable Node.js — or use any VPS (see "Other servers" at the end).

---

## Put it live on cPanel (about 30 minutes)

### 1. Create the database
1. cPanel → **MySQL® Databases**.
2. Create a database, e.g. `neversettle` (cPanel will name it `youruser_neversettle`).
3. Create a user with a strong password, e.g. `youruser_ns`.
4. **Add the user to the database** with **ALL PRIVILEGES**.
5. Write down: database name, user name, password.

### 2. Create the tables
1. cPanel → **phpMyAdmin** → click your database on the left.
2. **Import** → choose `database/install.sql` from this folder → **Import**.
3. *(Optional)* Import `database/sample-data.sql` the same way to get the 6 categories and 12 demo products. You can edit or delete them later in the admin panel.

   Without the sample data, your store starts empty. Create your categories first (Import sample data and delete the demo products, or run `npm run db:seed -- --categories-only` from the Terminal).

### 3. Upload the files
1. cPanel → **File Manager** → go to your home folder (not `public_html`).
2. Create a folder, e.g. `neversettle`, and upload **the zip** into it, then **Extract**.
3. Do **not** upload a `node_modules` folder. cPanel installs it for you.

### 4. Create your settings file (`.env`)
1. In File Manager, inside `neversettle`, copy `.env.example` to a new file called `.env` (turn on *Settings → Show hidden files* to see it).
2. Edit `.env`:

```ini
NEXT_PUBLIC_SITE_URL="https://www.yourdomain.com"      # your real address, https, no slash at the end
DATABASE_URL="mysql://youruser_ns:YOUR_DB_PASSWORD@localhost:3306/youruser_neversettle"
AUTH_SECRET="paste-a-long-random-string-here"           # at least 32 characters, keep it secret
```

- For `AUTH_SECRET`, use a password generator and make it 48+ random letters and numbers.
- If your database password contains symbols like `@ : / # ?`, replace them: `@`→`%40`, `:`→`%3A`, `/`→`%2F`, `#`→`%23`, `?`→`%3F`.

### 5. Create the Node.js app
1. cPanel → **Setup Node.js App** → **Create Application**.
2. **Node.js version:** 20 or newer (22 is best).
3. **Application mode:** Production.
4. **Application root:** `neversettle` (the folder from step 3).
5. **Application URL:** your domain.
6. **Application startup file:** `server.js`
7. Click **Create**, then click **Run NPM Install** and wait for it to finish.

### 6. Build the site
You need to run one build command. At the top of the app's page, cPanel shows a command like
`source /home/youruser/nodevenv/neversettle/22/bin/activate && cd /home/youruser/neversettle`.

1. Copy that command, open cPanel → **Terminal**, paste it and press Enter.
2. Run:

```bash
npm run build
```

3. Back in **Setup Node.js App**, click **Restart**.

> **No Terminal on your plan, or the build runs out of memory?** Build on your own computer instead: install Node.js 20+, put the same `.env` in the project folder, run `npm install` then `npm run build`, and upload the generated **`.next`** folder into `neversettle` on the server. Then Restart the app.

### 7. Create your admin account
Open `https://www.yourdomain.com/admin`. The first time, it asks you to **create the admin account** (name, email, password). This page only works once, while no admin exists, so do it straight away.

*(Alternative from the Terminal: `npm run admin:create -- you@yourdomain.com "Your Name"`.)*

### 8. Check everything
- Open the shop, add something to the cart and place a **cash on delivery** order. It appears in **Admin → Orders**.
- In **Admin → Settings**, set your phone, email, address, social links, delivery charges and the announcement bar.
- Replace the demo products and photos in **Admin → Products**, and the banner photos in `public/images/` (see below).

---

## Put it live on Vercel

1. **Database:** Vercel has no MySQL, so use one that accepts connections from the internet (e.g. Aiven, TiDB Cloud, Railway, or your cPanel MySQL with **Remote MySQL** allowing `%`). Import `database/install.sql` into it (plus `database/sample-data.sql` for demo products).
2. **Import the repo** in Vercel (framework: Next.js; default build settings). `server.js` isn't used there.
3. **Environment variables** (Settings → Environment Variables): `DATABASE_URL`, `AUTH_SECRET` (32+ random characters), `NEXT_PUBLIC_SITE_URL` (e.g. `https://your-project.vercel.app`) and optionally the `SMTP_*` ones. Most cloud databases only accept encrypted connections: also add `DATABASE_SSL` = `true`. If your provider gives you a CA certificate file (Aiven does), paste its contents into `DATABASE_SSL_CA`.
4. **Photo storage:** Storage → **Create** → **Blob** → connect it to the project. This adds `BLOB_READ_WRITE_TOKEN`, and admin photo uploads go there instead of the disk.
5. **Redeploy** (Deployments → ⋯ → Redeploy). Settings changes only take effect after a redeploy.
6. Open `/api/health`. It shows which settings are missing and whether the database works, with a plain-English fix if not. When it says `"ok": true`, open `/admin` to create your admin account.

If most pages show "Application error: a server-side exception has occurred", the site can't use the database. Open `/api/health` to see why. The deployment's **Logs** tab has the full error.

## Payments

The store takes **cash on delivery** only. Mark an order *Paid* in **Admin → Orders** once the courier hands over the cash. To pause ordering, untick cash on delivery in **Admin → Settings**.

---

## Running the store day to day

Everything lives in the admin panel at `/admin`:

| Area | What it does |
|---|---|
| **Dashboard** | Sales, orders, average order and gross profit for 7/30/90 days or 12 months (vs the previous period), sales chart, open-order pipeline, best sellers, top cities, low stock, recent orders and team activity. |
| **Orders** | Tabs (to confirm, to ship, shipped…), search, date and payment filters, CSV export. Tick several orders to confirm, ship, deliver, mark cash received, cancel or print invoices in one go. Each order has a progress tracker, one-click next step, profit on the order, and a timeline of every change with notes. |
| **Invoices** | Every order has an invoice (INV-order number). Print invoices and packing slips one by one or many at once (A4, or *Save as PDF*). Shows what's invoiced, collected and still with couriers. |
| **Customers** | Everyone who ordered, grouped by phone: orders, lifetime value, new/repeat/VIP, and a profile page with their history. |
| **Products** | Photos, prices, sizes/colours, stock and the **cost** you pay per unit (so margins show). |
| **Inventory** | Stock per size/colour, stock value at cost, low/sold-out filters, CSV export. **Adjust** a line to restock (with the purchase price; the cost becomes the weighted average), remove damaged units or enter a stock count. **Stock history** lists every change: sales, cancellations, returns, restocks, edits, with who did it. |
| **Profit & loss** | Revenue (counted when an order is delivered), cost of goods, gross profit, expenses by category and net profit for any period, monthly charts, CSV export. |
| **Expenses** | Rent, salaries, ads, courier charges, packaging… add them here so profit is real. |
| **Transactions** | Money in (cash collected from couriers) and out (expenses, refunds) with a running balance. |
| **Team & roles** | Add people and choose their role. Reset passwords or turn accounts off (they're signed out immediately). |
| **Activity log** | Who did what: sign-ins, order changes, stock changes, edits. |

**Roles**

| Role | Can |
|---|---|
| Owner | Everything, including team members and profit. |
| Manager | Orders, products, inventory, customers, messages, settings. No profit reports or team. |
| Accountant | Profit & loss, expenses, transactions, invoices, sales figures; can view orders but not change them. |
| Staff | Confirm/ship orders, record cash, print invoices, restock, messages. Sees no money figures or costs. |

Tips:
- **Cash on delivery:** when the courier pays you, open the order and click **Cash received from courier** (or tick many orders → *Cash received*). That records the money in Transactions.
- **Cancelled or Returned** puts the stock back automatically; reopening the order takes it again.
- Add a **cost** to each product (Products → product → Cost) or when restocking, otherwise profit counts those items as free. Inventory shows a warning for items without a cost.
- **Customers** can find their order at `/track` with their order number and phone number.

### Updating to a new version
Upload the new files over the old ones (keep your `.env` and the `uploads` folder), click **Run NPM Install**, then **Restart**. The database updates itself the first time the site runs: new tables and columns are added and nothing is deleted. Your database user needs **ALL PRIVILEGES** for that (it already has them if you followed step 1). Check `/api/health` afterwards.

### Changing site photos and text
- **Homepage slider: Admin → Homepage slider.** Add, edit, hide, reorder or delete slides. Each slide is a **picture** (JPG/PNG/WebP, landscape, at least 1920 × 1080, up to 10 MB) or a **video** (MP4 or WebM, 10–20 seconds, up to 60 MB; it plays muted and the next slide follows when it ends), with an optional separate portrait version for phones, a cover picture for videos, a heading, text and up to two buttons. iPhone `.MOV` videos need converting to MP4 first. Uploads are saved in the `uploads` folder, so keep that folder when you update.
  - If big video uploads fail on your hosting, upload the video somewhere else (e.g. your hosting's File Manager) and use **Paste a link instead**.
- Story and banner photos: replace `public/images/story.jpg`, `banner.jpg` (landscape, about 1800 px wide), and the category photos in `public/images/categories/` (portrait 4:5). Keep the same file names, then Restart.
- Phone, email, address, social links, delivery charges, free-delivery threshold and the announcement bar: **Admin → Settings**.
- Policy pages (returns, shipping, privacy, terms): edit `src/app/(store)/policies/[slug]/page.tsx`, then rebuild.

### After changing code or `.env`
| You changed | Do this |
|---|---|
| `DATABASE_URL`, `AUTH_SECRET`, `SMTP_*` | Restart the app |
| `NEXT_PUBLIC_SITE_URL` or `NEXT_PUBLIC_STORE_NAME` | `npm run build`, then Restart |
| Any file in `src/` | `npm run build`, then Restart |
| Photos in `public/images/` | Restart |

---

## Order emails (optional)
Fill the `SMTP_*` lines in `.env` to email customers an order confirmation and yourself a copy of every new order. You can use an email account created in cPanel → **Email Accounts** (server `mail.yourdomain.com`, port 465). Leave them empty to skip emails; orders still work normally.

---

## Backups
Back up these three regularly (cPanel → **Backup** can do all of them):
1. **The database** (phpMyAdmin → Export, or cPanel Backup).
2. **The `uploads` folder**, which holds your product photos uploaded from the admin panel.
3. **Your `.env` file** (keep it private; it contains your passwords).

To store uploads elsewhere, set `UPLOAD_DIR="/home/youruser/ns-uploads"` in `.env`.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Something went wrong" on every page | Check `DATABASE_URL` (user added to the database? special characters encoded?). Most hosts show the app's log file location in Setup Node.js App. |
| Can't sign in to admin, no error | Make sure the site opens on **https** and `NEXT_PUBLIC_SITE_URL` starts with `https://`, then rebuild. |
| `npm run build` stops with "heap out of memory" | Build on your own computer and upload the `.next` folder (step 6). |
| Changes don't appear | Rebuild (for code) and Restart (always). |
| Bangla text shows as `????` | The tables weren't created from `install.sql`. Re-import it into an empty database. |

---

## For developers

```bash
npm install
cp .env.example .env         # point DATABASE_URL at a local MySQL/MariaDB
npm run db:push              # create tables (or import database/install.sql)
npm run db:seed              # categories + demo products
npm run admin:create -- you@example.com "Your Name"
npm run dev                  # http://localhost:3000
```

- Database schema: `src/db/schema.ts` (Drizzle ORM). After changing it: `npm run db:generate` for a new migration or `npm run db:push`.
- Tested on MariaDB 10.11; written to work with MySQL 8 too (no MySQL-only query features).

### Project layout
```
server.js                 startup file for cPanel / PM2
database/install.sql      tables (phpMyAdmin import)
database/sample-data.sql  demo categories and products
src/app/(store)/          shop pages
src/app/admin/            admin panel
src/app/api/              checkout, search, newsletter, contact
src/lib/                  orders, settings, auth
src/components/           UI, animations, cart
public/images/            site photos
uploads/                  product photos uploaded from the admin (back this up)
```

### Other servers (VPS)
Any Linux server with Node.js 20+ and MySQL works: `npm ci && npm run build`, then run `node server.js` with PM2 (`pm2 start server.js --name neversettle`) behind Nginx with HTTPS. Set `PORT` if you don't want 3000.
