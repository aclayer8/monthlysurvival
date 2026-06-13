# Supabase Setup

## Environment Variables

Use the project URL without `/rest/v1`.

```text
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

Never put the Supabase secret key in this app.

## Snapshot Table

The first cloud-sync implementation stores the whole Monthly Survival data model as a JSON snapshot. This keeps the app safe and simple while the detailed relational tables mature.

Run this SQL in Supabase SQL Editor:

```sql
create table if not exists finance_snapshots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  data jsonb not null,
  source text not null default 'web',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table finance_snapshots enable row level security;

create policy "members can manage finance snapshots"
on finance_snapshots for all
using (
  exists (
    select 1 from household_members hm
    where hm.household_id = finance_snapshots.household_id
    and hm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from household_members hm
    where hm.household_id = finance_snapshots.household_id
    and hm.user_id = auth.uid()
  )
);
```
