-- The application reads and writes these tables through protected Next.js API routes
-- using DATABASE_URL. Browser clients must not bypass those APIs through PostgREST
-- or GraphQL with the Supabase publishable key.

do $$
begin
  if to_regclass('public.lab_bookings') is not null then
    alter table public.lab_bookings enable row level security;
    revoke all privileges on table public.lab_bookings from anon, authenticated;
  end if;

  if to_regclass('public.lab_duties') is not null then
    alter table public.lab_duties enable row level security;
    revoke all privileges on table public.lab_duties from anon, authenticated;
  end if;

  if to_regclass('public.lab_people') is not null then
    alter table public.lab_people enable row level security;
    revoke all privileges on table public.lab_people from anon, authenticated;
  end if;
end
$$;
