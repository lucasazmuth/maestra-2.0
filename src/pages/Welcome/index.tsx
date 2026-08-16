import { FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';

import { supabase } from '../../lib/supabase';
import * as membersDb from '../../services/db/members';
import { MaestraBrand } from '../../components/MaestraBrand';
import styles from './Welcome.module.scss';

const REDUCE_MOTION =
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Duas saudações, porque são duas pessoas diferentes chegando aqui.
const SAUDACAO_ARTISTA =
  'Bem-vindo à Maestra! Aqui a sua carreira vira estratégia, com a Nyta te guiando. Bora criar o seu primeiro perfil?';
const SAUDACAO_CONVIDADO =
  'Bem-vindo à Maestra! Você tem um convite esperando por você. Vamos dar uma olhada?';

/** Para onde o botão leva, e o que a saudação deve dizer. */
type Chegada = { rota: string; convidado: boolean };

// Tela de boas-vindas pós-cadastro. Repintada no design claro do app — o AuroraBackdrop saiu
// junto com o fundo preto.
//
// Quem chega aqui pode ser dois tipos de pessoa, e mandar as duas para o mesmo lugar confunde
// justamente quem tem menos contexto:
//
//   • artista sem perfil nenhum  → criar o primeiro perfil
//   • convidado para a equipe de alguém → ver e aceitar o convite
//
// O convite pendente NÃO conta como perfil: `get_shared_artist_ids_v2` só devolve membros com
// status 'active', então a contagem de artistas dá zero para quem ainda não aceitou. Sem a
// checagem de convites, o convidado era empurrado a criar um perfil que ele não veio criar.
const Welcome: FC = () => {
  const navigate = useNavigate();

  const [chegada, setChegada] = useState<Chegada | null>(null);
  const saudacao = chegada?.convidado ? SAUDACAO_CONVIDADO : SAUDACAO_ARTISTA;

  const [typed, setTyped] = useState('');
  const done = typed.length >= saudacao.length;

  useEffect(() => {
    let vivo = true;
    const decidir = (c: Chegada) => { if (vivo) setChegada(c); };

    Promise.all([
      // Sem filtro por user_id: a RLS de `artists` já devolve os próprios E os compartilhados.
      supabase.from('artists').select('id', { count: 'exact', head: true }),
      membersDb.fetchPendingInvites().catch(() => []),
    ])
      .then(([perfis, convites]) => {
        const temPerfil = !perfis.error && (perfis.count ?? 0) > 0;
        const temConvite = convites.length > 0;
        decidir({
          rota: temPerfil || temConvite ? '/artists' : '/criar-artista',
          convidado: !temPerfil && temConvite,
        });
      })
      // Em caso de falha, a lista de perfis é o destino seguro: ela lida com os dois casos e é
      // onde o convite pendente aparece.
      .catch(() => decidir({ rota: '/artists', convidado: false }));

    return () => { vivo = false; };
  }, []);

  // A digitação só começa quando sabemos qual das duas saudações usar — senão a frase trocaria
  // no meio, na frente da pessoa.
  useEffect(() => {
    if (!chegada) return;
    if (REDUCE_MOTION) { setTyped(saudacao); return; }
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(saudacao.slice(0, i));
      if (i >= saudacao.length) window.clearInterval(id);
    }, 32);
    return () => window.clearInterval(id);
  }, [chegada, saudacao]);

  const comecar = () => navigate(chegada?.rota || '/artists', { replace: true });

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
          {chegada?.convidado ? 'Ver meu convite' : 'Começar'} <FiArrowRight />
        </button>
      </div>
    </div>
  );
};

export default Welcome;
