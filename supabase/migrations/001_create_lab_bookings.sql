create table if not exists public.lab_bookings (
  id text primary key,
  name text not null,
  bench text not null check (bench in ('超净台1（动物）', '超净台2（细胞）')),
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  purpose text not null default '',
  created_at timestamptz not null default now(),
  constraint lab_bookings_valid_time check (end_time > start_time)
);

create index if not exists lab_bookings_date_bench_idx
  on public.lab_bookings (booking_date, bench, start_time);
