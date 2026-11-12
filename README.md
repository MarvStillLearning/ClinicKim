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

For an existing database missing the emergency contact name field, run `supabase/emergency-contact-name.sql` in Supabase SQL Editor.

### Email notifications for public appointments
1. Run `supabase/public-booking.sql` in Supabase SQL Editor.
2. Create a [Resend](https://resend.com) account and verify the sender domain/address you want to send appointment emails from.
3. Deploy `supabase/functions/public-appointment` with the Supabase CLI: `supabase functions deploy public-appointment`.
4. In Supabase Edge Function secrets, set `CLINIC_APP_ORIGIN` to the exact public URL of your app, `RESEND_API_KEY` to your Resend API key, `APPOINTMENT_FROM_EMAIL` to the verified sender address, and `APPOINTMENT_NOTIFICATION_EMAIL` to `marvinliban1414@gmail.com`.
5. Submit a test booking. If the appointment saves but email delivery fails, the booking confirmation will say so; check the Edge Function logs and Resend configuration.

## Online
Push to GitHub, import in vercel.com, add the 2 `.env` values as Environment Variables.

## Roles
- admin: everything
- doctor: Dashboard, Patients, Appointments, Inventory
- cashier: Dashboard, POS, Sales History
