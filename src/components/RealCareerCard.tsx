import { FC, CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight, FiCheckCircle } from 'react-icons/fi';

import type { Artist } from '../interfaces/maestra';
import { RealBadge, PROFILE_ABBR, tierForPattern, TIER_ACCENT } from './RealBadge';

// Card unificado de "fase de carreira": o perfil REAL (1 dos 16) é a FASE do artista — sobe de
// nível quando ele re-diagnostica — e logo abaixo a barra de progresso das tarefas do plano.
// Substitui o antigo PhaseCard (FASE numérica + "Avançar de fase") e o RealProfileSummary do topo.

interface TaskCounts {
  todo: number;
  inProgress: number;
  done: number;
  total: number;
}

const DIMS: { k: 'r' | 'e' | 'a' | 'l'; letter: string }[] = [
  { k: 'r', letter: 'R' }, { k: 'e', letter: 'E' }, { k: 'a', letter: 'A' }, { k: 'l', letter: 'L' },
];

const clean = (s: string) => s.replace(/\s*—\s*/g, ', ');

const card: CSSProperties = {
  position: 'relative',
  background: 'radial-gradient(120% 130% at 0% 0%, rgba(175,40,150,0.10), #181818 60%)',
  border: '1px solid rgba(175,40,150,0.22)',
  borderRadius: 14,
  padding: 22,
  marginBottom: 24,
};
const kicker: CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#af2896' };
const titleStyle: CSSProperties = { fontFamily: 'SpotifyMixUITitle', fontWeight: 800, fontSize: 34, color: '#fff', margin: 0, lineHeight: 1, letterSpacing: '-0.01em' };
const linkBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#9a9aa5', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0 };
const ctaBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, background: '#af2896', border: 'none', color: '#fff', padding: '10px 22px', borderRadius: 9999, cursor: 'pointer', fontWeight: 700 };

// Barra de progresso das tarefas + estado (concluído / vazio). Exportada pra o Plano de Ação
// reusar a barra fora do card (a "fase" REAL saiu de lá).
export const TaskProgress: FC<{ counts: TaskCounts }> = ({ counts }) => {
  const pct = counts.total ? Math.round((counts.done / counts.total) * 100) : 0;
  const complete = counts.total > 0 && counts.done === counts.total;
  const noTasks = counts.total === 0;

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: '#af2896', transition: 'width .4s cubic-bezier(0.4,0,0.2,1)' }} />
        </div>
        <span style={{ color: '#af2896', fontWeight: 800, fontSize: 14, minWidth: 42, textAlign: 'right' }}>{pct}%</span>
      </div>
      {complete ? (
        <p style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#5ec27e', fontSize: 14, fontWeight: 700, margin: '12px 0 0' }}>
          <FiCheckCircle size={16} /> Concluído — crie novas tarefas ou estratégias para continuar evoluindo.
        </p>
      ) : noTasks ? (
        <p style={{ color: '#6b7280', fontSize: 13, margin: '12px 0 0' }}>
          Adicione tarefas às suas estratégias para acompanhar o progresso.
        </p>
      ) : (
        <p style={{ color: '#9a9aa5', fontSize: 13, margin: '12px 0 0' }}>
          {counts.done} de {counts.total} tarefas concluídas.
        </p>
      )}
    </div>
  );
};

export const RealCareerCard: FC<{ artist: Artist; taskCounts: TaskCounts; style?: CSSProperties; showProgress?: boolean }> = ({ artist, taskCounts, style, showProgress = true }) => {
  const navigate = useNavigate();
  const ri = artist.content?.realIndex;

  // Sem diagnóstico REAL ainda — convida a fazer (a fase depende dele).
  if (!ri?.profile) {
    return (
      <section style={{ ...card, ...style }}>
        <span style={kicker}>Sua fase de carreira</span>
        <h2 style={{ ...titleStyle, fontSize: 26, margin: '10px 0 8px' }}>Faça seu diagnóstico</h2>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: '#cfcfd4', margin: '0 0 16px', maxWidth: 560 }}>
          O diagnóstico REAL define sua fase de carreira (entre 16 perfis) e atualiza conforme você evolui.
        </p>
        <button onClick={() => navigate(`/artists/${artist.id}/diagnostico`)} style={ctaBtn}>
          Fazer diagnóstico <FiArrowRight />
        </button>
        {showProgress && <TaskProgress counts={taskCounts} />}
      </section>
    );
  }

  // O card segue a cor do tier da placa (verde/azul/prata/ouro) pra ficar coerente com a gamificação.
  const tier = tierForPattern(ri.pattern);
  const accent = TIER_ACCENT[tier];
  const tierCard: CSSProperties = {
    ...card,
    background: `radial-gradient(120% 130% at 0% 0%, rgba(${accent},0.12), #181818 60%)`,
    border: `1px solid rgba(${accent},0.28)`,
  };

  return (
    <section style={{ ...tierCard, ...style }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ ...kicker, color: `rgb(${accent})` }}>Sua fase de carreira</span>
        <button onClick={() => navigate(`/artists/${artist.id}/diagnostico`)} style={linkBtn}>
          Ver completo <FiArrowRight size={14} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '10px 0 12px', flexWrap: 'wrap' }}>
        <RealBadge tier={tier} label={PROFILE_ABBR[ri.profile.name] || ri.profile.name.slice(0, 2)} size={56} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h2 style={{ ...titleStyle, margin: 0 }}>{ri.profile.name}</h2>
          <span style={{ fontSize: 13, color: '#8a8a92' }}>Seu perfil entre os 16</span>
        </div>
      </div>

      <p style={{ fontSize: 14, lineHeight: 1.5, color: '#cfcfd4', margin: '0 0 14px', maxWidth: 560 }}>
        {clean(ri.profile.description)}
      </p>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {DIMS.map((d) => {
          const high = ri.pattern[d.k];
          return (
            <div key={d.k} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: 'italic', fontWeight: 700, fontSize: 26, lineHeight: 1, letterSpacing: '0.01em', color: high ? `rgb(${accent})` : '#71717a' }}>{d.letter}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: high ? '#cfcfd4' : '#8a8a92' }}>{high ? 'Alto' : 'Baixo'}</span>
            </div>
          );
        })}
      </div>

      {showProgress && <TaskProgress counts={taskCounts} />}
    </section>
  );
};

export default RealCareerCard;
