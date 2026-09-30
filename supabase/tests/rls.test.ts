/**
 * Applies the real migration to an embedded Postgres (PGlite) with a minimal
 * Supabase-like auth shim, then checks Row Level Security behaves as intended.
 */
import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'
const CAT = 'aaaaaaaa-0000-0000-0000-000000000001'
let db: PGlite

async function as<T = Record<string, unknown>>(uid: string, sql: string) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`)
  try {
    return await db.query<T>(sql)
  } finally {
    await db.exec('reset role')
  }
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    insert into auth.users values ('${A}'), ('${B}');
  `)
  const dir = join(import.meta.dirname, '..', 'migrations')
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'))
  // Supabase grants table privileges to `authenticated`; RLS does the row filtering.
  await db.exec('grant usage on schema public to authenticated; grant all on all tables in schema public to authenticated;')
  await as(A, `insert into categories (id, name) values ('${CAT}', 'Job Search')`)
  await as(A, `insert into xp_events (date, amount, source_type, source_id) values ('2026-09-30', 20, 'category', gen_random_uuid())`)
}, 30_000)

describe('row level security', () => {
  it('lets a user read only their own rows', async () => {
    expect((await as<{ n: number }>(A, 'select count(*)::int as n from categories')).rows[0].n).toBe(1)
    expect((await as<{ n: number }>(B, 'select count(*)::int as n from categories')).rows[0].n).toBe(0)
  })
  it('scopes the EXP total view to the caller', async () => {
    expect((await as<{ total_xp: number }>(A, 'select total_xp from user_xp_totals')).rows[0].total_xp).toBe(20)
    expect((await as(B, 'select total_xp from user_xp_totals')).rows).toHaveLength(0)
  })
  it('blocks writing rows for another user', async () => {
    await expect(as(B, `insert into categories (user_id, name) values ('${A}', 'x')`)).rejects.toThrow(/row-level security/)
  })
  it("blocks referencing another user's category", async () => {
    await expect(
      as(B, `insert into time_blocks (date, category_id, start_time, end_time) values ('2026-09-30', '${CAT}', '09:00', '10:00')`),
    ).rejects.toThrow(/does not belong/)
  })
  it('silently ignores updates to rows the user does not own', async () => {
    expect((await as(B, `update categories set name = 'x' where true`)).affectedRows).toBe(0)
  })
  it('rejects negative EXP at the database level', async () => {
    await expect(
      as(A, `insert into xp_events (date, amount, source_type, source_id) values ('2026-09-30', -5, 'category', gen_random_uuid())`),
    ).rejects.toThrow(/check constraint/)
  })
  it('supports the upsert-by-(user,date,category) path the app uses', async () => {
    const ins = (t: string) =>
      as(A, `insert into daily_completions (date, category_id, completion_type) values ('2026-09-30', '${CAT}', '${t}')
             on conflict (user_id, date, category_id) do update set completion_type = excluded.completion_type`)
    await ins('minimum')
    await ins('normal')
    const rows = (await as<{ completion_type: string }>(A, 'select completion_type from daily_completions')).rows
    expect(rows).toEqual([{ completion_type: 'normal' }])
  })
})
