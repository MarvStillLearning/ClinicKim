# Gabay sa pag-edit ng ClinicKim

Para ito sa may-ari o susunod na developer ng clinic system na gustong malaman kung saan babaguhin ang isang feature. Naka-Tagalog ang paliwanag; karamihan sa source code at text ng app ay English.

## Mabilisang sagot: saan ako mag-e-edit?

| Gusto mong baguhin | Buksan ito |
| --- | --- |
| Pangalan ng clinic na nasa sidebar, login, booking, at prescription | `src/lib/format.js` — `CLINIC_NAME` |
| Pangalan ng tab sa browser | `index.html` — `<title>` |
| Kulay, dark mode, font, laki, spacing, layout | `src/styles.css` |
| Sidebar menu, label, icon, pagkakasunod-sunod, menu group | `src/components/Sidebar.jsx` |
| Aling role ang nakakakita/makakagamit ng page sa app | `src/App.jsx` at `src/components/Sidebar.jsx`; tingnan din ang database policies sa `supabase/schema.sql` |
| Nilalaman o itsura ng isang page | Katumbas na file sa `src/pages/` (tingnan ang talaan sa ibaba) |
| POS na pangalan, presyo, stock ng item | **Inventory page** sa app o `supabase/sample-products.sql` kung demo seed data ang papalitan |
| Database table, column, policy, trigger, o database function | SQL files sa `supabase/` |
| Pampublikong appointment booking at availability | `src/pages/PublicAppointment.jsx`, `supabase/functions/public-appointment/index.ts`, at mga kaugnay na SQL sa `supabase/` |
| Email ng pampublikong appointment | Supabase Edge Function secrets; ang email logic ay nasa `supabase/functions/public-appointment/index.ts` |
| Paglikha/pag-edit/pagtanggal ng staff account | `src/pages/Staff.jsx` at `supabase/functions/staff-admin/index.ts` |
| Supabase project na kinokonektahan ng frontend | Local `.env` o Vercel Environment Variables; huwag ilagay ang secret keys sa source code |
| URL rewrite para gumana ang direct page links sa Vercel | `vercel.json` |
| Animation o galaw sa page transitions | `src/App.jsx` at `framer-motion` code sa kaukulang component |

Kung simpleng pagbabago ng produkto, presyo, o stock lang, gamitin muna ang Inventory page. Hindi kailangan mag-edit ng SQL o source code.

## Paano nakaayos ang app

- Pinanatili ang kasalukuyang folders at file paths para hindi kailangang baguhin ang imports o deployment setup.
- `src/main.jsx` ang entry point: inilulunsad nito ang React app at ini-import ang global CSS.
- `src/App.jsx` ang pangunahing router at access map. Dito ikinakabit ang mga page, public route, login state, at role.
- `src/pages/` ang pangunahing nilalaman ng bawat screen.
- `src/components/` ang mga pirasong ginagamit muli sa maraming screen.
- `src/lib/format.js` ang mga shared na clinic at date/price helper.
- `src/supabaseClient.js` ang koneksyon ng browser papunta sa Supabase.
- `supabase/` ang database setup/migration scripts at server-side Edge Functions.
- `src/styles.css` ang global theme at layout rules.

## Mga page at kung ano ang babaguhin doon

| File | Para saan |
| --- | --- |
| `src/pages/Login.jsx` | Login screen at mga link para mag-book ng appointment o tumingin ng presyo |
| `src/pages/Dashboard.jsx` | Dashboard cards, bilang at buod ng sales, appointments, pasyente, at low stock |
| `src/pages/Patients.jsx` | Patient list, paghahanap, profile, detalye at form ng pasyente |
| `src/pages/Clinical.jsx` | Konsultasyon, clinical notes, diagnosis/treatment, consultation history, prescription printout |
| `src/pages/Appointments.jsx` | Appointment list, status, pagdagdag/pag-edit, at admin schedule controls |
| `src/components/AppointmentAvailabilityPicker.jsx` | Shared na available date/doctor/time picker para pareho ang schedule choices ng staff at public booking |
| `src/pages/Inventory.jsx` | Product/service list, presyo, stock, expiry date, add/edit/delete at low-stock view |
| `src/pages/POS.jsx` | Cashier screen, pagpili ng item/pasyente at pagproseso ng sale |
| `src/pages/Sales.jsx` | Sales history, filters, transaction at sale item details |
| `src/pages/Staff.jsx` | Staff list at admin tools para gumawa, mag-edit, o magtanggal ng account |
| `src/pages/AuditLogs.jsx` | Audit trail ng sensitibong patient, staff, at sales actions |
| `src/pages/PublicAppointment.jsx` | Public booking, pagpili ng lokasyon/doctor/oras, at pagbabago ng booking |
| `src/pages/PublicPrices.jsx` | Public list ng medicine at service prices |

### Mga reusable component

| File | Para saan |
| --- | --- |
| `src/components/Sidebar.jsx` | Aktuwal na sidebar, pangalan ng clinic, menu at role-based visibility, theme switch, logout |
| `src/components/AppTopbar.jsx` | Top bar, date/user information, page search |
| `src/components/DoctorScheduleManager.jsx` | Admin calendar para magtakda ng available dates/doctor/location |
| `src/components/Modal.jsx` | Shared modal/dialog container |
| `src/components/ActionLoadingDialog.jsx` | Loading dialog habang nagsa-save, naglo-login, nagla-logout, atbp. |
| `src/components/Pagination.jsx` | Shared pagination controls |
| `src/components/ThemeToggle.jsx` | Theme toggle component; kung binabago ang aktuwal na sidebar toggle, tingnan din ang `Sidebar.jsx` |

## Mga karaniwang pagbabago

### Pangalan, currency, petsa at oras

- Palitan ang `CLINIC_NAME` sa `src/lib/format.js` para sa pangalan na ginagamit sa maraming screen at sa prescription.
- Ang `peso()` helper sa parehong file ang nagpo-format ng presyo bilang Philippine peso.
- Ang appointment date/time helpers ay gumagamit ng `Asia/Manila`. Mag-ingat kapag babaguhin ang timezone dahil puwedeng maiba ang araw/oras ng booking.
- Palitan ang browser tab title sa `index.html`.

### Kulay, font at layout

Sa `src/styles.css`, magsimula sa CSS guide sa itaas ng file at sa CSS variables sa unang bahagi para sa brand colors at theme. Nandoon din ang styles ng mga button, cards, forms, tables, sidebar at page layout. Ang mga visual override at theme rules ay nasa bandang ibaba: **mahalaga ang pagkakasunod-sunod**, dahil puwedeng palitan ng nasa huli ang style na nasa itaas. May light at dark theme; gumamit ng existing CSS variable kung maaari para parehong theme ang maapektuhan nang tama.

### Menu, page route at access

- Ang menu labels, icons, at groups ay nasa `ALL_PAGES` sa `src/components/Sidebar.jsx`.
- Ang aktuwal na role list ng app ay nasa `accessByRole` sa `src/App.jsx`; dapat tumugma rito ang sidebar `ACCESS` sa `Sidebar.jsx`.
- Ang route/page component wiring ay nasa `src/App.jsx`. May public routes din na `/login`, `/book-appointment`, at `/prices`.
- Kapag nagdagdag o nagtanggal ng page, tingnan ang lahat ng bahaging ito: `PAGE_IDS`, `accessByRole`, `ALL_PAGES`/`ACCESS`, imports at page rendering sa `App.jsx`, at Vercel rewrite kung naaangkop.
- Hindi sapat ang pagtatago ng menu para protektado ang data. Ang database Row Level Security (RLS) policies ang mahalaga para sa data access; suriin ang `supabase/schema.sql` bago baguhin ang roles o permissions.

### POS products at sample data

- Para sa totoong products, services, prices at stock: gamitin ang Inventory page. Ise-save ang mga ito sa `products` table.
- Ang `supabase/sample-products.sql` ay **opsyonal na demo seed** para magdagdag ng halimbawang medicines at services. Maaari mong palitan ang mga row doon bago ito patakbuhin sa Supabase SQL Editor.
- Ang bawat sample row ay may `name`, `category`, `price`, at `stock`. Ang mga halimbawang presyo/stock ay hindi dapat ipagpalagay na angkop sa totoong clinic.
- Seed script na ito ay nilalayong laktawan ang umiiral nang product na kapareho ang pangalan at category. Hindi nito ina-update ang presyo o stock ng existing product.
- Huwag patakbuhin ang demo seed sa production database nang hindi muna sinusuri ang lahat ng row.

## Database scripts: ano ang laman at kailan gagamitin

Patakbuhin lamang ang SQL na nauugnay sa pagbabago. Bago magpatakbo ng SQL sa production, mag-backup at siguraduhing naiintindihan ang epekto nito.

| File | Layunin |
| --- | --- |
| `supabase/schema.sql` | Pangunahing tables, columns, roles, RLS policies, functions, triggers, audit logging at POS checkout. Ito ang base schema. |
| `supabase/public-booking.sql` | Public booking-related columns/functions para sa appointment flow. |
| `supabase/appointment-schedule.sql` | Doctor availability per date/location at schedule-based booking rules. Gamitin pagkatapos ng base schema/public booking setup ayon sa README. |
| `supabase/staff-appointment.sql` | Server-side validation para ang staff booking ay tumugma sa available date, doctor, at oras; patakbuhin pagkatapos ng `appointment-schedule.sql`. |
| `supabase/appointment-time-slots.sql` | Limitasyon sa 30-minute appointment options mula 8:00 AM hanggang 5:00 PM; patakbuhin pagkatapos ng `appointment-schedule.sql`. |
| `supabase/public-prices.sql` | Pinapahintulutan ang public page na magbasa ng medicine/service prices. |
| `supabase/emergency-contact-name.sql` | Migration para sa lumang database na wala pang emergency contact name column. |
| `supabase/staff-account-delete.sql` | Migration para mapanatili ang sales at audit history kapag binura ang staff account; inaalis lang ang link sa account. |
| `supabase/sample-products.sql` | Opsyonal na demo medicines/services; hindi ito base database schema. |

Hindi pare-pareho ang panganib ng mga SQL file. Ang schema/policy/function changes ay maaaring makaapekto sa data at access. Huwag mag-edit o magpatakbo ng SQL nang walang backup at pagsusuri.

## Supabase Edge Functions at secrets

- `supabase/functions/public-appointment/index.ts` ang server-side endpoint para sa public appointment create/lookup/update at notification email.
- `supabase/functions/staff-admin/index.ts` ang server-side admin endpoint sa paggawa/pag-update/pagtanggal ng staff accounts.
- Ang `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, at iba pang server-only secret ay dapat ilagay sa Supabase Function secrets, hindi sa frontend code, hindi sa `VITE_` variable, at hindi sa Git.
- Ang `CLINIC_APP_ORIGIN`, `APPOINTMENT_FROM_EMAIL`, at `APPOINTMENT_NOTIFICATION_EMAIL` ay configuration ng Edge Function. Ang `CLINIC_APP_ORIGIN` ay comma-separated exact origins at puwedeng magsama ng `http://localhost:5173` at live site. Tingnan ang README para sa setup.
- Para magamit ang Staff & Roles admin controls, kailangang i-deploy ang `staff-admin` function: `npx supabase functions deploy staff-admin`.
- Ang `src/supabaseClient.js` ay gumagamit lang ng `VITE_SUPABASE_URL` at `VITE_SUPABASE_ANON_KEY`. Kahit ginagamit sa browser ang anon key, kailangang tama ang RLS policies.

## Mga file na mukhang bahagi ng app pero hindi ginagamit ngayon

- `src/pages/Laboratory.jsx` ay umiiral sa repository pero hindi naka-import o naka-route sa `src/App.jsx`. Huwag asahang lumalabas ito sa menu. Bago ito i-activate, kailangang tiyakin ang `lab_orders` table, policies, at UI flow.
- `src/components/Navbar.jsx` ay lumang/alternatibong navbar at hindi ito ang sidebar na ginagamit ng kasalukuyang `App.jsx`. Para sa aktuwal na navigation, baguhin ang `Sidebar.jsx`.
- `src/components/ThemeToggle.jsx` ay hiwalay na component; ang theme control na nakikita sa kasalukuyang sidebar ay nasa `Sidebar.jsx`.
- `dist/` at `node_modules/` ay generated/build/dependency files. Huwag doon mag-edit; ang source files ay nasa `src/`.
- `.env` ay local configuration at sensitibo. Huwag i-paste o i-commit ang laman nito. Kopyahin ang format mula sa `.env.example`.

## Pagpapatakbo at pag-check ng pagbabago

Sa terminal sa project folder:

```powershell
npm run dev
```

Buksan ang local URL na ipapakita sa terminal (karaniwang `http://localhost:5173`). Pagkatapos ng pagbabago, subukan ang mismong flow na naapektuhan: role, form, database save, mobile layout, at public route kung naaangkop.

Para tiyakin na nakakagawa ng production build:

```powershell
npm run build
```

May `npm run preview` para makita ang built version locally. Ang Vercel deployment ay gumagamit ng `vercel.json` rewrite para ma-load ang app sa direct routes gaya ng `/patients`.

## Mabilis na troubleshooting

- **Blank/error sa app pagkabukas:** tiyaking may `.env` na may tamang Supabase URL at anon key; tingnan ang browser console.
- **Hindi makapag-save o permission error:** tingnan kung tumatakbo ang tamang SQL migration at kung pinapayagan ng RLS policy ang role.
- **Hindi nakikita ang page:** tingnan ang role sa profile, `accessByRole` sa `App.jsx`, at `ACCESS` sa `Sidebar.jsx`.
- **Maling clinic name:** tingnan ang `CLINIC_NAME` sa `src/lib/format.js`; browser tab title naman ay `index.html`.
- **Hindi nagbabago ang online app:** tiyaking na-deploy ang pinakabagong frontend at na-set ang Vercel Environment Variables, saka mag-redeploy.
- **Nai-save ang public appointment pero walang email:** tingnan ang Supabase Edge Function logs at ang Resend/appointment secrets. Magkaibang bagay ang appointment save at email delivery.

