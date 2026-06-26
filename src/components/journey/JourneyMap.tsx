import { FC, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight, FiRefreshCw, FiCheckCircle, FiRotateCcw } from 'react-icons/fi';

import type { Artist } from '../../interfaces/maestra';
import { RealBadge, PROFILE_ABBR, tierForPattern, TIER_ACCENT } from '../RealBadge';
import { RealLevelLadder } from '../RealLevelLadder';
import './journey.scss';

// Hub "Jornada Maestra" (home do Dashboard): o ciclo de crescimento como 3 etapas conectadas —
// REAL (onde estou) → Planejamento (para onde vou) → Plano de Ação (como chego) → ↺ re-diagnóstico.
// Cada etapa mostra status + CTA. Deixa explícita a relação entre os módulos e o loop de evolução.

const kicker: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' };
const stageTitle: React.CSSProperties = { fontFamily: 'SpotifyMixUITitle', fontWeight: 800, fontSize: 18, color: '#fff', margin: '2px 0 0', lineHeight: 1.15 };
const sub: React.CSSProperties = { color: '#8a8a92', fontSize: 12.5, margin: '2px 0 0' };

const StageCard: FC<{ accent: string; children: ReactNode }> = ({ accent, children }) => (
  <div
    className="journey-stage"
    style={{
      position: 'relative',
      background: `radial-gradient(120% 130% at 0% 0%, rgba(${accent},0.10), #161616 62%)`,
      border: `1px solid rgba(${accent},0.28)`,
      borderRadius: 14,
      padding: 18,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}
  >
    {children}
  </div>
);

const StageCta: FC<{ accent: string; label: string; onClick: () => void; ghost?: boolean }> = ({ accent, label, onClick, ghost }) => (
  <button
    onClick={onClick}
    style={{
      marginTop: 'auto',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      background: ghost ? 'transparent' : `rgb(${accent})`,
      border: ghost ? `1px solid rgba(${accent},0.5)` : 'none',
      color: ghost ? `rgb(${accent})` : '#fff',
      padding: '8px 16px',
      borderRadius: 9999,
      cursor: 'pointer',
      fontWeight: 700,
      fontSize: 13,
    }}
  >
    {label} <FiArrowRight size={14} />
  </button>
);

// Seta entre etapas (vira ↓ quando empilha no mobile — controlado por journey.scss).
const Connector: FC = () => (
  <div className="journey-connector" aria-hidden>
    <FiArrowRight size={22} />
  </div>
);

export const JourneyMap: FC<{ artist: Artist }> = ({ artist }) => {
  const navigate = useNavigate();
  const go = (suffix: string) => navigate(`/artists/${artist.id}/${suffix}`);

  const ri = artist.content?.realIndex;
  const hasPlan = !!artist.content?.strategies?.length;

  const tier = ri?.pattern ? tierForPattern(ri.pattern) : 'standard';
  const realAccent = ri?.pattern ? TIER_ACCENT[tier] : '175, 40, 150';
  const MAGENTA = '175, 40, 150';
  const PURPLE = '109, 59, 209';

  // Progresso das tarefas (mesma fonte do Plano de Ação): ativas (não arquivadas), concluídas.
  const allTasks = (artist.content?.strategies || []).flatMap((s) => (s.tasks || []).filter((t) => t.status !== 'archived'));
  const total = allTasks.length;
  const done = allTasks.filter((t) => t.status === 'done').length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
        <h2 style={{ fontFamily: 'SpotifyMixUITitle', fontWeight: 800, fontSize: 20, color: '#fff', margin: 0 }}>Sua jornada</h2>
        <span style={{ color: '#8a8a92', fontSize: 13 }}>o ciclo que faz sua carreira evoluir</span>
      </div>

      <div className="journey-row">
        {/* 1 — REAL · Diagnóstico (onde estou) */}
        <StageCard accent={realAccent}>
          <div>
            <div style={{ ...kicker, color: `rgb(${realAccent})` }}>1 · REAL · Diagnóstico</div>
            <div style={stageTitle}>Onde você está</div>
          </div>
          {ri?.profile ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <RealBadge tier={tier} label={PROFILE_ABBR[ri.profile.name] || ri.profile.name.slice(0, 2)} size={42} />
                <div>
                  <div style={{ color: '#fff', fontWeight: 800, fontSize: 18, lineHeight: 1.1 }}>{ri.profile.name}</div>
                  <div style={{ color: '#8a8a92', fontSize: 12 }}>fase atual · entre os 16</div>
                </div>
              </div>
              <RealLevelLadder ri={ri} badgeSize={26} />
              <StageCta accent={realAccent} label="Ver diagnóstico" onClick={() => go('diagnostico')} ghost />
            </>
          ) : (
            <>
              <p style={{ ...sub, fontSize: 13, color: '#cfcfd4' }}>Descubra sua fase de carreira (entre 16 perfis) com dados reais.</p>
              <StageCta accent={realAccent} label="Fazer diagnóstico" onClick={() => go('diagnostico')} />
            </>
          )}
        </StageCard>

        <Connector />

        {/* 2 — Planejamento (para onde vou) */}
        <StageCard accent={MAGENTA}>
          <div>
            <div style={{ ...kicker, color: `rgb(${MAGENTA})` }}>2 · Planejamento</div>
            <div style={stageTitle}>Para onde vai</div>
          </div>
          {hasPlan ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#5ec27e', fontWeight: 700, fontSize: 14 }}>
                <FiCheckCircle size={18} /> Planejamento criado
              </div>
              <p style={sub}>Visão, missão, objetivos e estratégias definidos.</p>
              <StageCta accent={MAGENTA} label="Ver planejamento" onClick={() => go('perfil')} ghost />
            </>
          ) : (
            <>
              <p style={{ ...sub, fontSize: 13, color: '#cfcfd4' }}>Defina visão, missão, objetivos e estratégias com a Nyta.</p>
              <StageCta accent={MAGENTA} label="Criar planejamento" onClick={() => go('action-plan')} />
            </>
          )}
        </StageCard>

        <Connector />

        {/* 3 — Plano de Ação (como chego) */}
        <StageCard accent={PURPLE}>
          <div>
            <div style={{ ...kicker, color: `rgb(${PURPLE})` }}>3 · Plano de Ação</div>
            <div style={stageTitle}>Como chegar lá</div>
          </div>
          {hasPlan ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: `rgb(${PURPLE})`, transition: 'width .4s' }} />
                </div>
                <span style={{ color: `rgb(${PURPLE})`, fontWeight: 800, fontSize: 14 }}>{pct}%</span>
              </div>
              <p style={sub}>{total ? `${done} de ${total} tarefas concluídas.` : 'Adicione tarefas às suas estratégias.'}</p>
              <StageCta accent={PURPLE} label="Abrir plano" onClick={() => go('action-plan')} ghost />
            </>
          ) : (
            <>
              <p style={{ ...sub, fontSize: 13, color: '#cfcfd4' }}>Execute suas estratégias em tarefas e acompanhe o progresso.</p>
              <StageCta accent={PURPLE} label="Abrir plano" onClick={() => go('action-plan')} ghost />
            </>
          )}
        </StageCard>
      </div>

      {/* Loop: fecha o ciclo (executar → re-diagnosticar → subir de fase) */}
      {ri?.profile && hasPlan && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            marginTop: 10, padding: '12px 16px', borderRadius: 12,
            background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.12)',
          }}
        >
          <FiRotateCcw size={18} style={{ color: '#8a8a92', flexShrink: 0 }} />
          <span style={{ color: '#cfcfd4', fontSize: 13.5 }}>
            Executou o plano e cresceu? <b style={{ color: '#fff' }}>Refaça o REAL</b> pra ver sua fase subir.
          </span>
          <button
            onClick={() => navigate(`/artists/${artist.id}/diagnostico/refazer`)}
            style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '7px 14px', borderRadius: 9999, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
          >
            <FiRefreshCw size={14} /> Refazer diagnóstico
          </button>
        </div>
      )}
    </section>
  );
};

export default JourneyMap;
