# Paint Co Payroll

A weekly payroll app for a paint company with multiple work sites. Runs entirely
on-device (iPhone) as an installable web app — no server, no internet required
after first load.

## How it works

- **Work sites** → **Employees** (each with a daily rate and a *default* site —
  just a label, not a restriction) → **Attendance** marked day by day, at
  whichever site they actually worked that day → **Payroll**, generated once a
  week for every active employee, totalling their pay across whichever site(s)
  they worked that week.
- An employee can work different sites on different days within the same week —
  the attendance screen lets you pick "site worked today" and mark anyone
  against it, regardless of their default site.
- Saturday is treated as a half day (8am–1pm) and pays half the employee's daily rate.
- All data is stored locally on the phone using IndexedDB (via Dexie.js). Nothing
  leaves the device.
- Because browsers can occasionally clear site data under low storage, **export
  each week's payroll after generating it** (there's an "Export as file" button)
  and keep those files somewhere safe (e.g. share to yourself on WhatsApp/Files/email).

## Running it locally (on a computer, to test)

You'll need [Node.js](https://nodejs.org) (v18 or newer) installed.

```bash
npm install
npm run dev
```

Then open http://localhost:3000 in your browser.

## Deploying so the iPhone can reach it

A PWA needs to be served over **https** for "Add to Home Screen" and offline
support to work fully (localhost is an exception, but only on the same machine).
The easiest free option:

1. Push this project to a GitHub repo.
2. Deploy it for free on **Vercel** (https://vercel.com) — sign in with GitHub,
   import the repo, click Deploy. No configuration needed, it will detect Next.js
   automatically.
3. You'll get a URL like `https://paint-co-payroll.vercel.app`.

## Installing on the iPhone

1. Open the deployed URL in **Safari** on the iPhone (must be Safari, not Chrome).
2. Tap the **Share** icon (square with an arrow) at the bottom of the screen.
3. Scroll down and tap **"Add to Home Screen"**.
4. Give it a name (e.g. "Payroll") and tap **Add**.
5. It now appears as an app icon on the home screen. Opening it launches
   full-screen, without Safari's address bar, and works offline after the first
   load.

## First-time setup in the app

1. Open the app → you'll be prompted to set a 4-digit PIN (recommended, since
   this holds wage data) — or skip it.
2. Go to **Sites** → add each work location.
3. Go to **Team** → add employees with a daily rate and a default site (used
   just as a label/default — not a restriction).
4. Each day, go to **Attendance** → pick the site worked that day and the date →
   mark each employee Full / Half / Absent. If someone worked a different site
   than their default that day, that's fine — just select that site at the top
   before marking them.
5. On Saturday, go to **Payroll** → pick the week-ending Saturday →
   **Calculate this week's payroll** → review each employee's total (with the
   sites they worked that week shown underneath) → **Confirm & save**.
6. Tap a past payroll run to expand it and **Export as file** for your records.

## Project structure

```
app/
  page.tsx              Dashboard
  workplaces/page.tsx    Manage work sites
  employees/page.tsx     Manage employees & daily rates
  attendance/page.tsx    Daily attendance entry
  payroll/page.tsx       Weekly payroll generation & history
lib/
  db.ts                  IndexedDB schema (Dexie)
  date.ts                Mon-Sat work week helpers
  payroll.ts             Salary calculation logic
components/
  PinGate.tsx             PIN lock
  NavBar.tsx              Bottom tab navigation
  SwRegister.tsx          Registers the offline service worker
public/
  manifest.json           PWA manifest
  sw.js                   Offline caching
  icons/                  App icons
```

## Adjusting the payroll rule

The core calculation lives in `lib/payroll.ts` — `amountForDay()`. Right now:

- `FULL` → full daily rate
- `HALF` → half the daily rate (used for Saturday)
- `ABSENT` → 0

If pay rules ever change (e.g. overtime, different Saturday hours), that's the
one place to edit.
