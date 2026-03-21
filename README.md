# Adequate Capital LMS — Production Build

**Version 1.8.2** | Microfinance Loan Management System

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start development server (runs in DEMO MODE with seed data)
npm run dev
```

Open http://localhost:5173 and log in with:

- **Email:** admin@adequatecapital.co.ke
- **Password:** admin123

## Project Structure

```
lms-prod/
├── index.html
├── package.json
├── vite.config.js
├── .env.example          ← Copy to .env and fill in Supabase creds
├── supabase_schema.sql   ← Run in Supabase SQL Editor
├── public/
│   └── _redirects        ← Cloudflare Pages SPA routing
└── src/
    ├── main.jsx           ← ReactDOM entry point
    ├── App.jsx            ← Auth-aware root wrapper
    ├── lms-core.jsx       ← Full LMS UI engine (all pages + components)
    ├── config/
    │   └── supabaseClient.js
    ├── context/
    │   └── AuthContext.jsx   ← Session, role, signIn/signOut
    ├── data/
    │   └── seedData.js       ← 500 customers, 1157 loans (demo mode)
    ├── hooks/
    │   ├── useAuth.js
    │   └── useDebounce.js
    ├── utils/
    │   └── helpers.js        ← fmt, fmtM, calcPenalty, uid, etc.
    ├── services/             ← All DB logic goes here
    │   ├── authService.js
    │   ├── loanService.js
    │   ├── customerService.js
    │   ├── paymentService.js
    │   ├── workerService.js
    │   ├── leadService.js
    │   └── auditService.js
    ├── components/           ← Standalone reusable components
    │   ├── Modal.jsx
    │   ├── Table.jsx         ← Virtualized (handles 100k+ rows)
    │   ├── Sidebar.jsx
    │   └── Header.jsx
    ├── features/             ← Feature barrel exports
    │   ├── loans/
    │   ├── customers/
    │   └── payments/
    ├── layouts/
    │   └── DashboardLayout.jsx
    └── pages/
        ├── Login.jsx
        ├── Dashboard.jsx
        ├── Loans.jsx
        └── Customers.jsx
```

## Modes

### Demo Mode (default — no config needed)

When `VITE_SUPABASE_URL` is blank, the app runs entirely in-memory with seed data.
All 500 customers, 1157 loans, payments, interactions and workers are available.
Changes are lost on page reload (no persistence).

### Supabase Mode (production)

1. Copy `.env.example` → `.env`
2. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. Run `supabase_schema.sql` in Supabase SQL Editor
4. Create your first admin user in Supabase Auth
5. Insert a matching row in the `workers` table with `auth_user_id` set

## Supabase Setup

```sql
-- After running supabase_schema.sql, create your admin worker:
INSERT INTO workers (name, email, role, auth_user_id)
VALUES (
  'Admin',
  'admin@adequatecapital.co.ke',
  'Admin',
  (SELECT id FROM auth.users WHERE email = 'admin@adequatecapital.co.ke')
);
```

## Cloudflare Pages Deployment

1. Push this repo to GitHub
2. In Cloudflare Pages: New project → Connect GitHub repo
3. Build settings:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Build output: `dist`
4. Environment variables (Settings → Environment Variables):
   ```
   VITE_SUPABASE_URL     = https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY = eyJ...
   ```
5. Deploy

## User Roles & Permissions

| Role                | Read | Write | Approve | Disburse | Reports | Settings |
| ------------------- | ---- | ----- | ------- | -------- | ------- | -------- |
| Admin               | ✅   | ✅    | ✅      | ✅       | ✅      | ✅       |
| Loan Officer        | ✅   | ✅    | ✅      | ✗        | ✗       | ✗        |
| Collections Officer | ✅   | ✅    | ✗       | ✗        | ✗       | ✗        |
| Finance             | ✅   | ✅    | ✗       | ✗        | ✅      | ✗        |
| Viewer / Auditor    | ✅   | ✗     | ✗       | ✗        | ✅      | ✗        |

## Key Features (v1.8.2)

- **500+ customers**, **1157 loans** with full payment history
- **Virtual scroll** — handles unlimited rows, O(1) DOM
- **Payment timeline** — late payments recovered into missed installments
- **Schedule Monitor** — real-time repayment tracking per loan
- **Collections pipeline** — 6-stage recovery workflow
- **Worker portal** — separate login for field officers
- **Security settings** — OTP, biometric, session timeout, lockout
- **Reports** — CSV export, portfolio analytics, officer performance
- **Full audit trail** — every action logged

## Build

```bash
npm run build    # Production build → dist/
npm run preview  # Preview production build locally
```

SMS API KEY
fVkx3vQM3Nl453NO
VOYAGE SECRET
!K@Aq29PGle0B^rV8J^cO@k!!
