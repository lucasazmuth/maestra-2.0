import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@maestra/core/lib/supabase';

/**
 * A sessao do usuario, do jeito que o app precisa dela: com um estado de "ainda nao sei".
 *
 * A distincao entre `carregando` e `sem sessao` e o que evita o piscar classico — mandar a
 * pessoa para a tela de login por meio segundo, e depois tirar ela de la porque a sessao
 * estava no disco o tempo todo.
 */
export const useSessao = () => {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return;
      setSessao(data.session);
      setCarregando(false);
    });

    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento, nova) => {
      setSessao(nova);
      setCarregando(false);
    });

    return () => {
      vivo = false;
      assinatura.subscription.unsubscribe();
    };
  }, []);

  return { sessao, carregando };
};
