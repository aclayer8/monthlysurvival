# Supabase Setup

This app uses Supabase Auth plus a simple JSON snapshot table. The browser app only needs a publishable key. Never add a service-role key or database password to the app, Vercel, or this repository.

## Environment Variables

Use the project URL without `/rest/v1`.

```text
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

## Database Schema

Run the SQL below in the Supabase SQL Editor. It creates the household tables required before `finance_snapshots` can be saved.

```sql
create extension if not exists pgcrypto;

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Monthly Survival',
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists finance_snapshots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  data jsonb not null,
  source text not null default 'web',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists households_owner_id_idx
on households(owner_id);

create index if not exists household_members_user_id_idx
on household_members(user_id);

create index if not exists finance_snapshots_household_created_at_idx
on finance_snapshots(household_id, created_at desc);
```

## Row Level Security

Enable RLS and create least-privilege policies for authenticated household members.

```sql
alter table households enable row level security;
alter table household_members enable row level security;
alter table finance_snapshots enable row level security;

drop policy if exists "owners can create households" on households;
create policy "owners can create households"
on households for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "members can read households" on households;
create policy "members can read households"
on households for select
to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1
    from household_members hm
    where hm.household_id = households.id
    and hm.user_id = auth.uid()
  )
);

drop policy if exists "owners can update households" on households;
create policy "owners can update households"
on households for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "owners can create their member row" on household_members;
create policy "owners can create their member row"
on household_members for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from households h
    where h.id = household_members.household_id
    and h.owner_id = auth.uid()
  )
);

drop policy if exists "members can read household members" on household_members;
create policy "members can read household members"
on household_members for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from households h
    where h.id = household_members.household_id
    and h.owner_id = auth.uid()
  )
);

drop policy if exists "owners can manage household members" on household_members;
create policy "owners can manage household members"
on household_members for update
to authenticated
using (
  exists (
    select 1
    from households h
    where h.id = household_members.household_id
    and h.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from households h
    where h.id = household_members.household_id
    and h.owner_id = auth.uid()
  )
);

drop policy if exists "members can manage finance snapshots" on finance_snapshots;
create policy "members can manage finance snapshots"
on finance_snapshots for all
to authenticated
using (
  exists (
    select 1
    from household_members hm
    where hm.household_id = finance_snapshots.household_id
    and hm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from household_members hm
    where hm.household_id = finance_snapshots.household_id
    and hm.user_id = auth.uid()
  )
);
```

## Validation Steps

1. Deploy with only the public Supabase environment variables above.
2. Create or login with an email/password user in the app.
3. Load a valid Monthly Survival JSON backup.
4. Confirm the app shows `Auto-saved to Supabase cloud`.
5. In Supabase, verify a new row exists in `finance_snapshots`.
6. Click `Load Cloud` in the app and confirm the latest imported data appears.

## Rollback

If a bad JSON backup is imported, use an older exported JSON file and load it again. Each cloud save creates a new snapshot row, so older snapshots remain available in Supabase unless manually deleted.
