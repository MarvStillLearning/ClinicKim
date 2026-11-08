# Clinic Management System (React + Supabase)

## Pages
Dashboard, POS / Cashier, Patients (with consultations), Appointments, Inventory, Sales History, Staff & Roles.

## Folders
- `supabase/schema.sql` - database tables (safe to run again)
- `src/lib/format.js` - clinic name (EDIT THIS) + money/date helpers
- `src/components/Sidebar.jsx` - left menu and who can open which page
- `src/pages/` - one file per page
- `src/styles.css` - all colors and layout

## Setup
1. Supabase > SQL Editor > run `supabase/schema.sql`
2. Supabase > Authentication > Users > Add user (check "Auto Confirm User")
3. Log in once, or set the role in Table Editor > `profiles` (admin, doctor, cashier)
4. Copy `.env.example` to `.env`, paste your Project URL and anon key
5. `npm install` then `npm run dev`

## Online
Push to GitHub, import in vercel.com, add the 2 `.env` values as Environment Variables.

## Roles
- admin: everything
- doctor: Dashboard, Patients, Appointments, Inventory
- cashier: Dashboard, POS, Sales History
