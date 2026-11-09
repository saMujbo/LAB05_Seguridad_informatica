select
  has_function_privilege('una_chat_backend', 'una_chat_private.get_auth0_client_secret()', 'execute') as backend_execute,
  has_function_privilege('anon', 'una_chat_private.get_auth0_client_secret()', 'execute') as anon_execute,
  has_function_privilege('authenticated', 'una_chat_private.get_auth0_client_secret()', 'execute') as authenticated_execute,
  exists (
    select 1
    from pg_proc p,
      lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = 'una_chat_private.get_auth0_client_secret()'::regprocedure
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) as public_execute,
  has_table_privilege('una_chat_backend', 'vault.decrypted_secrets', 'select') as backend_direct_vault,
  has_table_privilege('anon', 'vault.decrypted_secrets', 'select') as anon_direct_vault,
  has_table_privilege('authenticated', 'vault.decrypted_secrets', 'select') as authenticated_direct_vault;
