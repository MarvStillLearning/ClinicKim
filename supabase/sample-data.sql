-- Demo data for the clinic system. Run schema.sql and appointment-schedule.sql first.
-- Safe to run repeatedly: stable sample keys prevent duplicate patients,
-- appointments, records, products, sales, and sale items.
-- This script does not create, change, or delete auth.users or public.profiles.

begin;

-- Products and services for the inventory and POS screens.
insert into public.products (name, category, price, stock)
select sample.name, sample.category, sample.price, sample.stock
from (values
  ('Paracetamol 500 mg', 'Medicine', 5.00, 100),
  ('Paracetamol 120 mg/5 mL Suspension', 'Medicine', 85.00, 20),
  ('Amoxicillin 500 mg', 'Medicine', 12.00, 50),
  ('Amoxicillin 250 mg/5 mL Suspension', 'Medicine', 135.00, 15),
  ('Cetirizine 10 mg', 'Medicine', 8.00, 60),
  ('Loratadine 10 mg', 'Medicine', 10.00, 50),
  ('Oral Rehydration Salts', 'Medicine', 18.00, 40),
  ('Vitamin C 500 mg', 'Medicine', 6.00, 100),
  ('Multivitamins', 'Medicine', 9.00, 60),
  ('Ferrous Sulfate 325 mg', 'Medicine', 7.00, 60),
  ('Ibuprofen 200 mg', 'Medicine', 6.00, 80),
  ('Omeprazole 20 mg', 'Medicine', 12.00, 50),
  ('Loperamide 2 mg', 'Medicine', 7.00, 40),
  ('Antacid Tablet', 'Medicine', 5.00, 80),
  ('Salbutamol 2 mg Tablet', 'Medicine', 8.00, 30),
  ('Povidone-Iodine 60 mL', 'Medicine', 65.00, 20),
  ('Hydrogen Peroxide 120 mL', 'Medicine', 35.00, 20),
  ('Alcohol 70% 250 mL', 'Medicine', 55.00, 25),
  ('Sterile Gauze Pad', 'Medicine', 12.00, 50),
  ('Adhesive Bandage Pack', 'Medicine', 25.00, 30),
  ('General Consultation', 'Service', 500.00, 0),
  ('Follow-up Consultation', 'Service', 300.00, 0),
  ('Teleconsultation', 'Service', 400.00, 0),
  ('Medical Certificate', 'Service', 200.00, 0),
  ('Fit-to-Work Assessment', 'Service', 500.00, 0),
  ('Blood Pressure Check', 'Service', 50.00, 0),
  ('Basic Wound Care', 'Service', 250.00, 0),
  ('Wound Dressing', 'Service', 200.00, 0),
  ('Nebulization', 'Service', 250.00, 0),
  ('Injection Administration', 'Service', 100.00, 0),
  ('Complete Blood Count', 'Service', 350.00, 0),
  ('Urinalysis', 'Service', 150.00, 0),
  ('Fecalysis', 'Service', 180.00, 0),
  ('Blood Glucose Test', 'Service', 120.00, 0),
  ('Pregnancy Test', 'Service', 200.00, 0),
  ('ECG', 'Service', 500.00, 0),
  ('Minor Procedure', 'Service', 750.00, 0),
  ('Health Screening', 'Service', 350.00, 0),
  ('Vaccination Administration', 'Service', 150.00, 0),
  ('Home Visit Consultation', 'Service', 800.00, 0)
) as sample(name, category, price, stock)
where not exists (
  select 1 from public.products p
  where lower(trim(p.name)) = lower(sample.name)
    and p.category = sample.category
);

-- Fictional patients. The demo phone numbers are identifiers for repeat runs.
insert into public.patients (
  full_name, phone, birthdate, sex, address, allergies,
  emergency_contact_name, emergency_contact
)
select sample.full_name, sample.phone, sample.birthdate, sample.sex,
  sample.address, sample.allergies, sample.emergency_contact_name,
  sample.emergency_contact
from (values
  ('Ava Santos', '09990001001', date '1992-04-18', 'Female', 'Centro, Sta. Ana, Cagayan', 'None known', 'Rosa Santos', '09990002001'),
  ('Noah Reyes', '09990001002', date '1985-11-02', 'Male', 'San Vicente, Sta. Ana, Cagayan', 'Penicillin', 'Liza Reyes', '09990002002'),
  ('Mia Dela Cruz', '09990001003', date '2001-07-25', 'Female', 'Centro, Gattaran, Cagayan', 'None known', 'Jose Dela Cruz', '09990002003'),
  ('Ethan Garcia', '09990001004', date '1978-01-09', 'Male', 'Nassiping, Gattaran, Cagayan', 'Shellfish', 'Lina Garcia', '09990002004'),
  ('Sofia Mendoza', '09990001005', date '1996-09-14', 'Female', 'Centro, Sta. Ana, Cagayan', 'None known', 'Ana Mendoza', '09990002005'),
  ('Liam Torres', '09990001006', date '2012-03-30', 'Male', 'Dodan, Sta. Ana, Cagayan', 'Dust', 'Carla Torres', '09990002006'),
  ('Isabella Flores', '09990001007', date '1969-06-06', 'Female', 'Centro, Gattaran, Cagayan', 'None known', 'Marco Flores', '09990002007'),
  ('Lucas Villanueva', '09990001008', date '1989-12-21', 'Male', 'Poblacion, Gattaran, Cagayan', 'Latex', 'Elena Villanueva', '09990002008'),
  ('Amara Bautista', '09990001009', date '2005-02-11', 'Female', 'Centro, Sta. Ana, Cagayan', 'None known', 'Nina Bautista', '09990002009'),
  ('Gabriel Aquino', '09990001010', date '1958-08-03', 'Male', 'San Vicente, Sta. Ana, Cagayan', 'None known', 'Ramon Aquino', '09990002010')
) as sample(full_name, phone, birthdate, sex, address, allergies, emergency_contact_name, emergency_contact)
where not exists (
  select 1 from public.patients p where p.phone = sample.phone
);

-- Sample clinical records linked to the fictional patients above.
insert into public.records (
  patient_id, diagnosis, treatment, complaint, bp, temperature, weight, notes
)
select p.id, sample.diagnosis, sample.treatment, sample.complaint,
  sample.bp, sample.temperature, sample.weight, 'DEMO SAMPLE RECORD'
from (values
  ('09990001001', 'Upper respiratory infection', 'Rest, fluids, and supportive care', 'Cough and sore throat for 3 days', '118/76', '37.2', 58.4),
  ('09990001002', 'Allergic rhinitis', 'Avoid known triggers; follow prescribed plan', 'Sneezing and nasal congestion', '124/80', '36.8', 72.0),
  ('09990001003', 'Acute gastritis', 'Dietary advice and follow-up if symptoms persist', 'Intermittent stomach discomfort', '110/70', '36.9', 54.2),
  ('09990001004', 'Essential hypertension', 'Blood pressure monitoring and lifestyle counseling', 'Routine blood pressure follow-up', '146/92', '36.7', 81.5),
  ('09990001005', 'Minor skin wound', 'Wound cleaning and dressing', 'Small cut on left hand', '116/74', '36.8', 61.1),
  ('09990001006', 'Well-child check', 'Routine health guidance', 'Routine checkup', '102/66', '36.6', 43.0),
  ('09990001007', 'Type 2 diabetes follow-up', 'Continue monitoring and return for review', 'Follow-up consultation', '132/82', '36.7', 68.8),
  ('09990001008', 'Low back strain', 'Activity modification and home-care advice', 'Back discomfort after lifting', '120/78', '36.9', 76.3)
) as sample(phone, diagnosis, treatment, complaint, bp, temperature, weight)
join public.patients p on p.phone = sample.phone
where not exists (
  select 1 from public.records r
  where r.patient_id = p.id and r.notes = 'DEMO SAMPLE RECORD'
);

-- Make the next 30 days schedulable at both clinic locations.
insert into public.doctor_schedule_dates (doctor, location, available_date)
select 'Monique Nolasco - Pet', locations.location,
  (now() at time zone 'Asia/Manila')::date + days.day_offset
from generate_series(1, 30) as days(day_offset)
cross join (values ('Sta. Ana, Cagayan'), ('Gattaran, Cagayan')) as locations(location)
on conflict (doctor, location, available_date) do nothing;

-- Upcoming sample appointments, each assigned a stable demo booking ID.
with sample_appointments(booking_code, phone, day_offset, hour_number, location, reason) as (
  values
    ('DEMO-APT-0001', '09990001001', 1, 8, 'Sta. Ana, Cagayan', 'DEMO: Follow-up consultation'),
    ('DEMO-APT-0002', '09990001002', 2, 9, 'Sta. Ana, Cagayan', 'DEMO: Allergy consultation'),
    ('DEMO-APT-0003', '09990001003', 3, 10, 'Gattaran, Cagayan', 'DEMO: Stomach discomfort'),
    ('DEMO-APT-0004', '09990001004', 4, 11, 'Gattaran, Cagayan', 'DEMO: Blood pressure follow-up'),
    ('DEMO-APT-0005', '09990001005', 5, 13, 'Sta. Ana, Cagayan', 'DEMO: Wound check'),
    ('DEMO-APT-0006', '09990001006', 6, 14, 'Sta. Ana, Cagayan', 'DEMO: Routine checkup'),
    ('DEMO-APT-0007', '09990001007', 7, 15, 'Gattaran, Cagayan', 'DEMO: Diabetes follow-up'),
    ('DEMO-APT-0008', '09990001008', 8, 8, 'Gattaran, Cagayan', 'DEMO: Back pain consultation')
)
insert into public.appointments (booking_code, patient_id, appt_at, reason, doctor, location, status)
select sample.booking_code, p.id,
  (((now() at time zone 'Asia/Manila')::date + sample.day_offset)
    + make_time(sample.hour_number, 0, 0)) at time zone 'Asia/Manila',
  sample.reason, 'Monique Nolasco - Pet', sample.location, 'Scheduled'
from sample_appointments sample
join public.patients p on p.phone = sample.phone
where not exists (
  select 1 from public.appointments a where a.booking_code = sample.booking_code
);

-- Past POS transactions for the sales history screen. No login account is
-- attached as cashier_id, and existing inventory stock is not changed.
with sample_sales(phone, days_ago, hour_number, product_name, category, quantity, discount, payment_method) as (
  values
    ('09990001001', 1, 10, 'General Consultation', 'Service', 1, 0.00, 'Cash'),
    ('09990001002', 2, 11, 'Cetirizine 10 mg', 'Medicine', 2, 0.00, 'GCash'),
    ('09990001003', 3, 9, 'Complete Blood Count', 'Service', 1, 0.00, 'Cash'),
    ('09990001004', 4, 14, 'Paracetamol 500 mg', 'Medicine', 10, 5.00, 'Card'),
    ('09990001005', 5, 13, 'Wound Dressing', 'Service', 1, 0.00, 'Cash'),
    ('09990001006', 6, 10, 'Vitamin C 500 mg', 'Medicine', 5, 0.00, 'GCash'),
    ('09990001007', 7, 15, 'Blood Pressure Check', 'Service', 1, 0.00, 'Cash'),
    ('09990001008', 8, 8, 'Amoxicillin 500 mg', 'Medicine', 6, 0.00, 'Cash')
), prepared as (
  select p.id as patient_id, sample.days_ago, sample.hour_number,
    sample.product_name, sample.category, sample.quantity, sample.discount,
    sample.payment_method, product.price * sample.quantity as subtotal,
    (((now() at time zone 'Asia/Manila')::date - sample.days_ago)
      + make_time(sample.hour_number, 0, 0)) at time zone 'Asia/Manila' as sold_at
  from sample_sales sample
  join public.patients p on p.phone = sample.phone
  join public.products product
    on product.name = sample.product_name and product.category = sample.category
)
insert into public.sales (
  patient_id, subtotal, discount, total, amount_paid, change_amount,
  payment_method, cashier_id, created_at
)
select prepared.patient_id, prepared.subtotal, prepared.discount,
  prepared.subtotal - prepared.discount,
  ceil((prepared.subtotal - prepared.discount) / 50.0) * 50.0,
  ceil((prepared.subtotal - prepared.discount) / 50.0) * 50.0
    - (prepared.subtotal - prepared.discount),
  prepared.payment_method, null, prepared.sold_at
from prepared
where not exists (
  select 1 from public.sales s
  where s.patient_id = prepared.patient_id and s.created_at = prepared.sold_at
);

-- Attach line items to the sample sales; safe to rerun if a prior run stopped midway.
with sample_sale_items(phone, days_ago, hour_number, product_name, category, quantity) as (
  values
    ('09990001001', 1, 10, 'General Consultation', 'Service', 1),
    ('09990001002', 2, 11, 'Cetirizine 10 mg', 'Medicine', 2),
    ('09990001003', 3, 9, 'Complete Blood Count', 'Service', 1),
    ('09990001004', 4, 14, 'Paracetamol 500 mg', 'Medicine', 10),
    ('09990001005', 5, 13, 'Wound Dressing', 'Service', 1),
    ('09990001006', 6, 10, 'Vitamin C 500 mg', 'Medicine', 5),
    ('09990001007', 7, 15, 'Blood Pressure Check', 'Service', 1),
    ('09990001008', 8, 8, 'Amoxicillin 500 mg', 'Medicine', 6)
), resolved as (
  select sale.id as sale_id, product.id as product_id, product.name,
    product.price, sample.quantity
  from sample_sale_items sample
  join public.patients p on p.phone = sample.phone
  join public.sales sale on sale.patient_id = p.id
    and sale.created_at = (((now() at time zone 'Asia/Manila')::date - sample.days_ago)
      + make_time(sample.hour_number, 0, 0)) at time zone 'Asia/Manila'
  join public.products product
    on product.name = sample.product_name and product.category = sample.category
)
insert into public.sale_items (sale_id, product_id, name, price, qty)
select resolved.sale_id, resolved.product_id, resolved.name, resolved.price, resolved.quantity
from resolved
where not exists (
  select 1 from public.sale_items item
  where item.sale_id = resolved.sale_id and item.product_id = resolved.product_id
);

commit;
