-- Tira do papel `anon` a permissão de executar a função de registro de push.
--
-- A migration anterior fazia `revoke all ... from public`, o que NÃO alcança o `anon`: o Supabase
-- concede EXECUTE a anon/authenticated/service_role por privilégio padrão do schema, e um revoke
-- do pseudo-papel PUBLIC não desfaz uma concessão explícita. Conferido em produção depois de
-- aplicar: o ACL ficou `anon=X/postgres`.
--
-- Na prática não havia brecha — a função levanta exceção quando auth.uid() é nulo, e a chamada
-- anônima já era recusada. Mas é uma função SECURITY DEFINER, e deixar anon na lista só somaria
-- ao apontamento `anon_security_definer_function_executable` que o levantamento de segurança já
-- registra 32 vezes nesta base. A guarda em runtime continua: são as duas camadas.

revoke execute on function public.fn_registrar_push_subscription(text, text, text, bigint) from anon;
