-- Run as the administrator in the laboratory's test project.
-- First create the login role una_chat_backend with a private password.
begin;

create schema if not exists una_chat_private;
revoke all on schema una_chat_private from public, anon, authenticated;
grant usage on schema una_chat_private to una_chat_backend;

create or replace function una_chat_private.get_auth0_client_secret()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'una_chat_auth0_client_secret'
  limit 1;
$$;

alter function una_chat_private.get_auth0_client_secret() owner to postgres;
revoke all on function una_chat_private.get_auth0_client_secret() from public, anon, authenticated;
grant execute on function una_chat_private.get_auth0_client_secret() to una_chat_backend;

-- Access the single secret through the function, never by querying Vault directly.
revoke all on vault.decrypted_secrets from public, anon, authenticated, una_chat_backend;
revoke all on vault.secrets from public, anon, authenticated, una_chat_backend;
revoke all on schema vault from una_chat_backend;

commit;
