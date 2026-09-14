-- Admin da plataforma não tem trava de criação de perfil: sem limite de 3 pendentes, sem
-- cooldown de exclusão. Os números continuam reais (o admin ainda vê o que está pendente),
-- só o bloqueio (`can_create`) cai para quem está em `platform_admins`.
CREATE OR REPLACE FUNCTION public.check_artist_rate_limit(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_pending_count int;
  v_last_created_at timestamptz;
  v_deletions_30d int;
  v_cooldown_seconds int;
  v_remaining_seconds int;
  v_is_admin boolean;
BEGIN
  -- Conta perfis pendentes do usuário
  SELECT count(*) INTO v_pending_count
  FROM artists
  WHERE user_id = p_user_id AND is_locked = true;

  -- Última criação do usuário
  SELECT max(created_at) INTO v_last_created_at
  FROM artists
  WHERE user_id = p_user_id;

  -- Contagem de exclusões de perfis pendentes nos últimos 30 dias
  SELECT count(*) INTO v_deletions_30d
  FROM artist_deletions
  WHERE user_id = p_user_id
    AND was_locked = true
    AND deleted_at > now() - interval '30 days';

  -- Calcula cooldown aplicável
  v_cooldown_seconds := CASE
    WHEN v_deletions_30d = 0 THEN 0
    WHEN v_deletions_30d = 1 THEN 600        -- 10 minutos
    WHEN v_deletions_30d BETWEEN 2 AND 4 THEN 86400  -- 24 horas
    ELSE 604800                                -- 7 dias
  END;

  -- Calcula tempo restante
  IF v_last_created_at IS NULL OR v_cooldown_seconds = 0 THEN
    v_remaining_seconds := 0;
  ELSE
    v_remaining_seconds := GREATEST(0,
      v_cooldown_seconds - EXTRACT(EPOCH FROM (now() - v_last_created_at))::int
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM platform_admins WHERE user_id = p_user_id
  ) INTO v_is_admin;

  IF v_is_admin THEN
    v_remaining_seconds := 0;
  END IF;

  RETURN jsonb_build_object(
    'can_create', v_is_admin OR (v_pending_count < 3 AND v_remaining_seconds = 0),
    'pending_count', v_pending_count,
    'pending_limit', CASE WHEN v_is_admin THEN v_pending_count + 1 ELSE 3 END,
    'cooldown_remaining_seconds', v_remaining_seconds,
    'cooldown_total_seconds', v_cooldown_seconds,
    'deletions_30d', v_deletions_30d
  );
END;
$function$;
