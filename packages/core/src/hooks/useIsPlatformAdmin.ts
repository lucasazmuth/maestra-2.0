import { useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';
import { useAppSelector } from '../store/store';

// Se o usuário logado é admin da plataforma. A checagem estava copiada no guard de rota
// (App.tsx) e na Sidebar; com o menu do topo seria a terceira cópia, então virou hook.
//
// Duas fontes, nessa ordem: a flag no JWT resolve na hora e evita ida ao banco; a tabela
// é o fallback para quem virou admin depois do token ter sido emitido.
//
// Serve só para MOSTRAR ou ESCONDER interface. Quem protege os dados é a RLS e a
// verificação de admin dentro de cada edge function — esconder o menu não protege nada.
export const useIsPlatformAdmin = (): boolean => {
  const user = useAppSelector((s) => s.auth.user);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    const appMeta = (user.app_metadata || {}) as Record<string, unknown>;
    if (appMeta.is_platform_admin) {
      setIsAdmin(true);
      return;
    }

    let active = true;
    supabase
      .from('platform_admins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        // Troca de usuário no meio da consulta não pode aplicar o resultado do anterior.
        if (active) setIsAdmin(!!data);
      });

    return () => {
      active = false;
    };
  }, [user]);

  return isAdmin;
};
