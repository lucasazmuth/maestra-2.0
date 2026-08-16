import { FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';

import { supabase } from '../../lib/supabase';
import { MaestraBrand } from '../../components/MaestraBrand';
import styles from './Welcome.module.scss';

const REDUCE_MOTION =
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const GREETING =
  'Bem-vindo à Maestra! Aqui a sua carreira vira estratégia, com a Nyta te guiando. Bora criar o seu primeiro perfil?';

// Tela de boas-vindas pós-cadastro: a Maestra dá as boas-vindas (efeito de digitação) e
// convida o artista a criar o primeiro perfil. Repintada no design claro do app — o
// AuroraBackdrop saiu junto com o fundo preto.
const Welcome: FC = () => {
  const navigate = useNavigate();

  const [typed, setTyped] = useState(REDUCE_MOTION ? GREETING : '');
  const done = typed.length >= GREETING.length;

  // Quem ainda não tem perfil nenhum vai direto criar o primeiro — é o que a saudação promete
  // ("bora criar o seu primeiro perfil?"), e mandar para a lista vazia era um passo a mais sem
  // ganho. `null` enquanto carrega.
  //
  // Sem filtro por user_id de propósito: a RLS de `artists` já devolve os próprios E os
  // compartilhados, então quem foi convidado para a equipe de alguém não é empurrado a criar um
  // perfil que não precisa.
  const [temPerfil, setTemPerfil] = useState<boolean | null>(null);

  useEffect(() => {
    let vivo = true;
    supabase
      .from('artists')
      .select('id', { count: 'exact', head: true })
      .then(({ count, error }) => {
        if (vivo) setTemPerfil(error ? null : (count ?? 0) > 0);
      });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    if (REDUCE_MOTION) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(GREETING.slice(0, i));
      if (i >= GREETING.length) window.clearInterval(id);
    }, 32);
    return () => window.clearInterval(id);
  }, []);

  // Só desvia para a criação quando a contagem confirmou que não há perfil. Em dúvida (consulta
  // ainda em voo ou falha), vai para a lista — que sabe lidar com os dois casos.
  const comecar = () =>
    navigate(temPerfil === false ? '/criar-artista' : '/artists', { replace: true });

  return (
    <div className={styles.page}>
      <div className={styles.pillWrap}>
        <div className={styles.pillGlow} aria-hidden />
        <div className={styles.pill}>
          <MaestraBrand variant='lockup' tone='dark' className={styles.pillText} />
        </div>
      </div>

      <p className={styles.greeting}>
        {typed}
        {!done && <span className={styles.caret} aria-hidden />}
      </p>

      <div className={`${styles.actions} ${done ? styles.actionsVisible : ''}`}>
        <button type='button' className={styles.cta} onClick={comecar} disabled={!done}>
          Começar <FiArrowRight />
        </button>
      </div>
    </div>
  );
};

export default Welcome;
