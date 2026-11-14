# ClinicKim Clinic Management System

React + Supabase clinic system. Baguhan sa codebase? Basahin muna ang [Gabay sa pag-edit](./docs/GABAY-SA-PAG-EDIT.md) para malaman kung aling file ang babaguhin para sa pangalan, design, page, menu, products, at database.

## Local setup

1. Sa Supabase SQL Editor, patakbuhin ang `supabase/schema.sql`.
2. Kung wala pang `.env`, kopyahin ang `.env.example` bilang `.env`, pagkatapos ilagay ang Supabase Project URL at anon key. Kung mayroon nang `.env`, huwag itong patungan. Huwag i-commit o ibahagi ang `.env`.
3. Sa Supabase Authentication, gumawa ng user at piliin ang **Auto Confirm User** kung kailangan.
4. Mag-login at itakda ang role ng account sa `profiles` table kung kailangan: `admin`, `doctor`, o `cashier`.
5. Sa project folder, patakbuhin:

   ```powershell
   npm install
   npm run dev
   ```

Para i-check ang production build, patakbuhin ang `npm run build`.

## Pages

Dashboard, POS / Cashier, Patients, Consultations, Appointments, Inventory, Sales History, Staff & Roles, at Audit Log.

Staff workspace tabs use direct URLs gaya ng `/dashboard`, `/patients`, `/appointments`, `/inventory`, at `/sales`. Public pages: `/login`, `/book-appointment`, at `/prices`. Ang top-bar search ay nagfi-filter ng pages na puwedeng buksan ng role; pindutin ang Ctrl+K o Cmd+K para mag-focus.

## Database setup

- Para sa existing database na wala pang emergency contact name field, patakbuhin ang `supabase/emergency-contact-name.sql`.
- Para mapanatili ang sales at audit history kapag nagtanggal ng staff account, patakbuhin ang `supabase/staff-account-delete.sql` sa existing database. Inaalis lang nito ang link sa deleted staff; hindi nito binubura ang history.
- Para sa optional na sample POS products, patakbuhin ang `supabase/sample-products.sql` pagkatapos ng base schema. Demo lamang ang mga presyo at stock; suriin at palitan muna bago gamitin.

## Public appointments at doctor availability

1. Patakbuhin ang `supabase/public-booking.sql`, pagkatapos ay `supabase/appointment-schedule.sql`, `supabase/staff-appointment.sql`, at `supabase/appointment-time-slots.sql` sa Supabase SQL Editor. Ang schedule migration ay nagbibigay ng date-specific availability mula 8:00 AM hanggang 5:00 PM. Pinananatili nito ang dates mula sa dating date-only schedule; ang older weekly schedules ay kino-convert sa dates para sa susunod na 90 araw. Kung binago ng date-only migration ang existing appointments, mananatili ang oras nila bilang 12:00 noon. Ang staff migration ay nagdaragdag ng server-validated booking para sa existing patients; ang time-slot migration ay naglilimita sa booking sa 30-minute intervals mula 8:00 AM hanggang 5:00 PM.
2. Gumawa ng [Resend](https://resend.com) account at i-verify ang sender address/domain.
3. I-deploy ang function sa Supabase gamit ang `npx supabase functions deploy public-appointment`.
4. Sa Supabase Edge Function secrets, itakda ang `CLINIC_APP_ORIGIN` bilang comma-separated na eksaktong origins. Halimbawa: `http://localhost:5173,https://clinic.example.com`. Gamitin ang aktuwal na port na ipinakita ng Vite. Itakda rin ang `RESEND_API_KEY`, `APPOINTMENT_FROM_EMAIL` sa verified sender, at `APPOINTMENT_NOTIFICATION_EMAIL` sa email na tatanggap ng notification.
5. Hindi kailangang i-deploy sa Vercel para subukan sa localhost. Patakbuhin ang `npm run dev` at gamitin ang origin na nasa `CLINIC_APP_ORIGIN`. Para sa live site lang kailangan i-deploy ang frontend sa Vercel. Sa admin account, buksan ang **Appointments → Manage doctor schedule** para pumili at mag-save ng available dates. Bukas ang booking mula 8:00 AM hanggang 5:00 PM; hindi maaaring ma-book nang dalawang beses ang parehong doctor sa eksaktong oras.
6. Subukan ang booking. Para baguhin ang existing booking, gamitin ang Booking ID at orihinal na phone number. Future appointments na `Scheduled` lang ang maaaring baguhin.

Kung na-save ang appointment pero hindi naipadala ang email, tingnan ang Edge Function logs at Resend configuration. Huwag ilagay ang Resend o service-role secrets sa frontend `.env`.

## Online deployment

I-import ang repository sa Vercel, idagdag ang `VITE_SUPABASE_URL` at `VITE_SUPABASE_ANON_KEY` bilang Environment Variables, at i-deploy. Para magamit ang Staff & Roles admin controls:

1. Patakbuhin ang `supabase/staff-account-delete.sql` kung dati nang ginawa ang database gamit ang lumang schema.
2. Itakda ang Supabase Edge Function secret na `CLINIC_APP_ORIGIN` sa comma-separated na exact origins. Halimbawa: `http://localhost:5173,https://clinic.example.com`.
3. I-deploy ang Edge Functions sa Supabase: `npx supabase functions deploy staff-admin` at `npx supabase functions deploy public-appointment`. Pareho silang gumagamit ng `CLINIC_APP_ORIGIN`. Hindi ito frontend deployment; hindi kailangang i-deploy ang app sa Vercel para sa localhost testing.

Hindi puwedeng burahin ng admin ang account na kasalukuyang ginagamit niya. Para sa ibang changes, i-push ang bagong commit sa GitHub para ma-trigger ang deployment.

## Roles

- `admin`: lahat ng kasalukuyang workspace pages
- `doctor`: Dashboard, Patients, Consultations, Appointments, Inventory
- `cashier`: Dashboard, POS, Sales History

Ang menu visibility ay hindi kapalit ng database security. Gumagamit ang app ng Supabase RLS policies; baguhin at subukan ang mga ito nang maingat.
