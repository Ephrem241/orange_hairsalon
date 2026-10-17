/**
 * Runs the real Supabase migrations inside PGlite (Postgres compiled to WASM) so
 * the booking engine, constraints and row-level security can be tested without
 * Docker or a hosted project.
 *
 * Supabase-specific pieces (the auth/storage schemas, API roles, auth.uid() and
 * default privileges) are recreated by a small shim that mirrors how Supabase
 * sets them up. Requests are simulated the way PostgREST does it: SET LOCAL ROLE
 * plus `request.jwt.claims` inside a transaction.
 */
import { PGlite, type Transaction } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'supabase', 'migrations')

const SUPABASE_SHIM = /* sql */ `
  create schema extensions;
  create schema auth;
  create schema storage;

  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  grant usage on schema public, extensions, auth, storage to anon, authenticated, service_role;

  -- Supabase hands every API role full privileges on new objects by default;
  -- the migrations are expected to narrow these down.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

  create table auth.users (id uuid primary key, email text);

  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt() ->> 'sub', '')::uuid
  $$;
  create function auth.role() returns text language sql stable as $$
    select auth.jwt() ->> 'role'
  $$;
  grant execute on all functions in schema auth to anon, authenticated, service_role;

  create table storage.buckets (
    id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id), name text, owner uuid
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select string_to_array(name, '/')
  $$;
`

export type Db = PGlite
export type Tx = Transaction

export async function createTestDb(): Promise<Db> {
  const db = await PGlite.create({ extensions: { btree_gist, pgcrypto } })
  await db.exec(SUPABASE_SHIM)
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`)
    }
  }
  return db
}

export type Caller =
  | { role: 'anon' }
  | { role: 'service_role' }
  | { role: 'authenticated'; userId: string }

/** Run `fn` as an API caller, exactly as PostgREST would scope the request. */
export async function as<T>(db: Db, caller: Caller, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const claims =
      caller.role === 'authenticated'
        ? { role: 'authenticated', sub: caller.userId }
        : { role: caller.role }
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)])
    await tx.exec(`set local role ${caller.role}`)
    return fn(tx)
  })
}

/** Convenience for a single statement as a caller. */
export async function queryAs<R = Record<string, unknown>>(
  db: Db,
  caller: Caller,
  sql: string,
  params: unknown[] = [],
): Promise<R[]> {
  return as(db, caller, async (tx) => (await tx.query<R>(sql, params)).rows)
}

/** The message of the Postgres error a promise rejects with (e.g. "SLOT_TAKEN"). */
export async function errorOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    return (error as Error).message
  }
  throw new Error('Expected the statement to fail, but it succeeded')
}
