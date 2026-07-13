-- Ponte interna para a Edge Function ler secrets do Vault sem expô-los ao cliente.
create or replace function public.get_push_config()
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'forbidden';
  end if;

  return jsonb_build_object(
    'vapid_private_key', (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_private_key'),
    'push_webhook_secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_webhook_secret')
  );
end;
$$;

revoke all on function public.get_push_config() from public;
grant execute on function public.get_push_config() to service_role;
