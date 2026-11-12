-- Optional POS sample data: 20 medicines and 20 services.
-- Prices and stock levels are examples; review and adjust them before real use.
-- Safe to run again: existing products with the same name and category are skipped.

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
  select 1
  from public.products existing
  where lower(trim(existing.name)) = lower(sample.name)
    and existing.category = sample.category
);
