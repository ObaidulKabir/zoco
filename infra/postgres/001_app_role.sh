#!/bin/sh
# Creates the role the API connects as. It must not be a superuser: Postgres
# bypasses row-level security for superusers, which would silently disable the
# tenant policies in 002_org.sql. The role owns the schema objects it creates,
# so those policies are declared `force row level security`.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  create role zoqo_app login password '${APP_DB_PASSWORD:-zoqo_app}'
    nosuperuser nocreatedb nocreaterole nobypassrls;
  grant create, usage on schema public to zoqo_app;
  -- 000_rls_helper.sql ran a moment ago as the superuser, so the superuser owns
  -- the function. The migrator re-applies that file as zoqo_app, and
  -- "create or replace" on a function you do not own is an error. Hand it over.
  alter function zoqo_set_tenant(uuid) owner to zoqo_app;
EOSQL
