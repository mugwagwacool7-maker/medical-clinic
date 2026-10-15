-- Rhodes Dental — Supabase schema
-- Run this once in the Supabase dashboard: SQL Editor → New query → Run.
-- The API handler uses the service role key, which bypasses Row Level Security.

create sequence if not exists appointment_code_seq start with 1001;

create table if not exists services (
  id text primary key,
  tag text not null,
  name text not null,
  "desc" text not null,
  duration text not null,
  price text not null
);

create table if not exists doctors (
  id text primary key,
  name text not null,
  focus text not null
);

create table if not exists time_slots (
  id bigserial primary key,
  label text not null unique,
  sort_order integer not null
);

create table if not exists appointments (
  code text primary key default ('WB-' || nextval('appointment_code_seq')),
  service_id text not null references services(id),
  doctor_id text not null references doctors(id),
  date date not null,
  time text not null,
  patient_name text not null,
  phone text not null,
  email text not null,
  patient_type text not null default 'New patient',
  notes text default '',
  created_at timestamptz not null default now(),
  unique (doctor_id, date, time)
);

create table if not exists blocked_slots (
  id bigserial primary key,
  doctor_id text not null references doctors(id),
  date date not null,
  slot_label text not null
);

-- Seed data --------------------------------------------------------------

insert into services (id, tag, name, "desc", duration, price) values
  ('cleaning',   'PREVENTIVE',  'Routine Cleaning & Exam',      'A full checkup and polish to keep things on track.',              '30 min', '$45'),
  ('whitening',  'COSMETIC',    'Teeth Whitening',              'In-office whitening for a noticeably brighter smile.',            '60 min', '$120'),
  ('filling',    'RESTORATIVE', 'Cavity Filling',               'Comfortable, tooth-colored fillings for minor decay.',            '45 min', '$80'),
  ('extraction', 'SURGICAL',    'Tooth Extraction',             'Safe removal with local anesthesia and aftercare guidance.',      '45 min', '$95'),
  ('rootcanal',  'RESTORATIVE', 'Root Canal Therapy',           'Relieve pain and save the tooth in a single focused visit.',      '90 min', '$260'),
  ('consult',    'GENERAL',     'New Patient Consultation',     'A first visit to assess your dental health and plan next steps.', '30 min', '$30')
on conflict (id) do nothing;

insert into doctors (id, name, focus) values
  ('Finity',   'Dr. Finity',   'General & preventive care'),
  ('Mutenje',  'Dr. Mutenje',  'Cosmetic dentistry'),
  ('Gwenhamo', 'Dr. Gwenhamo', 'Oral surgery'),
  ('Moyo',     'Dr. Moyo',     'Endodontics (root canals)')
on conflict (id) do nothing;

insert into time_slots (label, sort_order) values
  ('8:00 AM', 0), ('8:40 AM', 1), ('9:20 AM', 2), ('10:00 AM', 3),
  ('10:40 AM', 4), ('11:20 AM', 5), ('1:00 PM', 6), ('1:40 PM', 7),
  ('2:20 PM', 8), ('3:00 PM', 9), ('3:40 PM', 10), ('4:20 PM', 11)
on conflict (label) do nothing;

-- Lock down public access. The service role key used by the API bypasses RLS.
alter table services enable row level security;
alter table doctors enable row level security;
alter table time_slots enable row level security;
alter table appointments enable row level security;
alter table blocked_slots enable row level security;
