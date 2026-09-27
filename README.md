# NEVER SETTLE — online store

A complete, self-hosted fashion store for T-shirts, pants, punjabis, kurtas, shoes and wallets.

- **Shop:** home page with animations, collections with filters and sorting, product pages with sizes/colours and stock, search, cart, checkout, order tracking, contact, FAQ, size guide, policies.
- **Payments:** Cash on delivery + online payment through **SSLCOMMERZ** (cards, bKash, Nagad, Rocket, internet banking).
- **Admin panel** at `/admin`: orders (confirm, ship, cancel, refund), products (photos, prices, sizes, stock), messages, delivery charges, announcement bar, contact details and more.
- **Safe by design:** prices, stock and delivery charges are always recalculated on the server; online payments are verified with SSLCOMMERZ before an order is marked paid; stock is reserved when an order is placed and returned if it is cancelled or the payment fails.

Built with Next.js 15, React 19, Tailwind CSS, Framer Motion and MySQL / MariaDB.

---

## What you need

| | |
|---|---|
| Hosting | cPanel hosting with **Setup Node.js App** (Node.js **20** or newer), a MySQL/MariaDB database, and ideally **Terminal** or SSH access |
| Domain | Your domain pointed at the hosting, with **SSL (https)** turned on (cPanel → SSL/TLS Status → Run AutoSSL) |
| Payments | An SSLCOMMERZ account: free **sandbox** (test) account now, **live** merchant account when you're ready to take real money |

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
SSLCZ_STORE_ID="your sandbox store id"
SSLCZ_STORE_PASSWORD="your sandbox store password"
SSLCZ_SANDBOX="true"                                    # "false" only when you go live
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
- Choose **Pay online**. You'll see SSLCOMMERZ's sandbox page. Pay with a test card from SSLCOMMERZ's sandbox page, and you'll return to a "Payment received" page with the order marked **Paid**.
- In **Admin → Settings**, set your phone, email, address, social links, delivery charges and the announcement bar.
- Replace the demo products and photos in **Admin → Products**, and the banner photos in `public/images/` (see below).

---

## SSLCOMMERZ: test first, then go live

**Sandbox (testing, no real money)**
1. Register at <https://developer.sslcommerz.com/registration/>. You'll receive a sandbox **Store ID** and **Store Password** by email.
2. Put them in `.env` with `SSLCZ_SANDBOX="true"`, then **Restart** the app.

**Live (real money)**
1. Apply for a live merchant account with SSLCOMMERZ (they'll ask for trade licence and bank details) and wait for approval.
2. Put the **live** Store ID and Password in `.env`, set `SSLCZ_SANDBOX="false"`, and **Restart**.
3. Place one small real order and refund it to confirm.

**IPN (payment notifications):** the site sends its notification address to SSLCOMMERZ with every payment, so there's nothing else to set up. If SSLCOMMERZ asks you for an IPN URL, give them `https://www.yourdomain.com/api/payments/sslcommerz/ipn`.

**How payments are protected:** an order is only marked *Paid* after the site asks SSLCOMMERZ's validation service directly and the amount, currency and transaction match. A shopper who closes the payment page is not charged, and their reserved stock is released automatically after 60 minutes.

You can switch cash on delivery or online payment off at any time in **Admin → Settings**.

---

## Running the store day to day

- **New orders:** Admin → Dashboard shows orders *waiting for confirmation*: cash-on-delivery orders and paid online orders. Unpaid online orders (shoppers who left the payment page) are not counted.
- **Order status:** Pending → Confirmed → Processing → Shipped → Delivered. Choosing **Cancelled** or **Returned** puts the stock back automatically.
- **Cash on delivery:** mark the order **Paid** when the courier settles.
- **Refunds for online payments:** make the refund in your SSLCOMMERZ merchant panel, then set the order's payment to **Refunded** here.
- **Products:** upload photos (JPG, PNG or WebP, up to 5 MB), set price, "compare at" price (shows a sale badge), sizes, colours and stock per size/colour. Untick **Visible in store** to hide a product without deleting it.
- **Customers** can find their order at `/track` with their order number and phone number.

### Changing site photos and text
- Hero, story and banner photos: replace `public/images/hero-1.jpg`, `hero-2.jpg`, `story.jpg`, `banner.jpg` (landscape, about 1800 px wide), and the category photos in `public/images/categories/` (portrait 4:5). Keep the same file names, then Restart.
- Phone, email, address, social links, delivery charges, free-delivery threshold and the announcement bar: **Admin → Settings**.
- Policy pages (returns, shipping, privacy, terms): edit `src/app/(store)/policies/[slug]/page.tsx`, then rebuild.

### After changing code or `.env`
| You changed | Do this |
|---|---|
| `DATABASE_URL`, `AUTH_SECRET`, `SSLCZ_*`, `SMTP_*` | Restart the app |
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
| "Online payment is not set up yet" at checkout | Fill `SSLCZ_STORE_ID` and `SSLCZ_STORE_PASSWORD`, then Restart. |
| After paying, you land on the wrong address | `NEXT_PUBLIC_SITE_URL` is wrong. Fix it, then rebuild and Restart. |
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

- `SSLCZ_MOCK="true"` (with sandbox mode) replaces SSLCOMMERZ with a local stand-in payment page, for testing without internet. **Never set it on a live server.** It's ignored when `SSLCZ_SANDBOX="false"`.
- Database schema: `src/db/schema.ts` (Drizzle ORM). After changing it: `npm run db:generate` for a new migration or `npm run db:push`.
- Tested on MariaDB 10.11; written to work with MySQL 8 too (no MySQL-only query features).

### Project layout
```
server.js                 startup file for cPanel / PM2
database/install.sql      tables (phpMyAdmin import)
database/sample-data.sql  demo categories and products
src/app/(store)/          shop pages
src/app/admin/            admin panel
src/app/api/              checkout, SSLCOMMERZ callbacks, search, newsletter, contact
src/lib/                  orders, payments, SSLCOMMERZ, settings, auth
src/components/           UI, animations, cart
public/images/            site photos
uploads/                  product photos uploaded from the admin (back this up)
```

### Other servers (VPS)
Any Linux server with Node.js 20+ and MySQL works: `npm ci && npm run build`, then run `node server.js` with PM2 (`pm2 start server.js --name neversettle`) behind Nginx with HTTPS. Set `PORT` if you don't want 3000.
