# Clinic Management System (React + Supabase)

## Pages
Dashboard, POS / Cashier, Patients (with consultations), Appointments, Inventory, Sales History, Staff & Roles.

Staff workspace tabs use direct URLs such as `/dashboard`, `/patients`, `/appointments`, `/inventory`, and `/sales`. Public pages are available at `/login`, `/book-appointment`, and `/prices`. The top-bar search filters the pages available to the signed-in user's role; use Ctrl+K or Cmd+K to focus it.

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

### Optional POS sample products
After running `supabase/schema.sql`, run `supabase/sample-products.sql` in Supabase SQL Editor to add 20 example medicines and 20 example services. The seed skips products that already exist with the same name and category. Sample prices and stock counts are for demonstration only; review them before real use.

### Public appointments and doctor availability
1. Run `supabase/public-booking.sql` in Supabase SQL Editor.
2. Run `supabase/appointment-schedule.sql` in Supabase SQL Editor. This enables date-specific availability from 8:00 AM to 5:00 PM. Dates saved by the earlier date-only version are retained with those hours. Older weekly schedules are converted to individual available dates for the next 90 days. If the date-only migration changed existing appointments, their saved time remains 12:00 noon.
3. Create a [Resend](https://resend.com) account and verify the sender domain/address you want to send appointment emails from.
4. Deploy `supabase/functions/public-appointment` with the Supabase CLI: `npx supabase functions deploy public-appointment`.
5. In Supabase Edge Function secrets, set `CLINIC_APP_ORIGIN` to the exact public URL of your app, `RESEND_API_KEY` to your Resend API key, `APPOINTMENT_FROM_EMAIL` to the verified sender address, and `APPOINTMENT_NOTIFICATION_EMAIL` to `marvinliban1414@gmail.com`.
6. Push the updated frontend to GitHub so Vercel can deploy it.
7. While logged in as admin, use **Appointments → Manage doctor schedule → Select dates on calendar** to check each available date, including Saturdays and Sundays. Uncheck dates and save changes to remove availability. Patients choose an available date, doctor, and any time from 8:00 AM to 5:00 PM. The same doctor cannot be booked twice at the exact same time.
8. Submit a test booking or use **Change an existing appointment** with the Booking ID and original phone number. Only future appointments still marked Scheduled can be changed. If an appointment saves but email delivery fails, the confirmation will say so; check the Edge Function logs and Resend configuration.

## Online
Push to GitHub, import in vercel.com, add the 2 `.env` values as Environment Variables.

## Roles
- admin: everything
- doctor: Dashboard, Patients, Appointments, Inventory
- cashier: Dashboard, POS, Sales History
