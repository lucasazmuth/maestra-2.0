create or replace function public.get_push_config()
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'forbidden';
  end if;
  return jsonb_build_object(
    'vapid_private_key', (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_private_key'),
    'push_webhook_secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_webhook_secret')
  );
end;
$$;

revoke execute on function public.get_push_config() from public, anon, authenticated;
grant execute on function public.get_push_config() to service_role;
