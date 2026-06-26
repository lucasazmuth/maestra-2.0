import { FC, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight, FiCheckCircle } from 'react-icons/fi';

import type { Artist } from '../../interfaces/maestra';
import { RealBadge, altasForPattern, tierForPattern } from '../RealBadge';
import { PRODUCT_THEME as PRODUCTS } from '../productTheme';
import './journey.scss';

// Hub "Jornada Maestra" (home do Dashboard): o ciclo de crescimento como 3 etapas conectadas —
// REAL (onde estou) → Planejamento (para onde vou) → Plano de Ação (como chego) → ↺ re-diagnóstico.
// Cada etapa mostra status + CTA. Deixa explícita a relação entre os módulos e o loop de evolução.

const kicker: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' };
const stageTitle: React.CSSProperties = { fontFamily: 'SpotifyMixUITitle', fontWeight: 800, fontSize: 18, color: '#fff', margin: '2px 0 0', lineHeight: 1.15 };
const sub: React.CSSProperties = { color: '#8a8a92', fontSize: 12.5, margin: '2px 0 0' };

const StageCard: FC<{ accent: string; bg: string; children: ReactNode }> = ({ accent, bg, children }) => (
  <div
    className="journey-stage"
    style={{
      position: 'relative',
      // Gradiente do produto por trás de um scrim escuro: vira um brilho sutil, não um fundo gritante.
      backgroundColor: '#0c0c0e',
      backgroundImage: `linear-gradient(158deg, rgba(11,11,13,0.55) 0%, rgba(11,11,13,0.82) 52%, rgba(11,11,13,0.94) 100%), url(${bg})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      border: `1px solid rgba(${accent},0.30)`,
      boxShadow: `0 12px 32px -16px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)`,
      borderRadius: 16,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
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
  // Cores fixas de cada produto (a placa/escada lá dentro continuam na cor do tier).
  const REAL = PRODUCTS.real.accent;
  const PLAN = PRODUCTS.planning.accent;
  const ACTION = PRODUCTS.action.accent;

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
        <StageCard accent={REAL} bg={PRODUCTS.real.bg}>
          <div>
            <div style={{ ...kicker, color: `rgb(${REAL})` }}>1 · REAL · Diagnóstico</div>
            <div style={stageTitle}>Onde você está</div>
          </div>
          {ri?.profile ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <RealBadge tier={tier} label={String(altasForPattern(ri.pattern))} size={42} />
                <div>
                  <div style={{ color: '#fff', fontWeight: 800, fontSize: 18, lineHeight: 1.1 }}>{ri.profile.name}</div>
                  <div style={{ color: '#8a8a92', fontSize: 12 }}>fase atual · entre os 16</div>
                </div>
              </div>
              <StageCta accent={REAL} label="Ver diagnóstico" onClick={() => go('diagnostico')} ghost />
            </>
          ) : (
            <>
              <p style={{ ...sub, fontSize: 13, color: '#cfcfd4' }}>Descubra sua fase de carreira (entre 16 perfis) com dados reais.</p>
              <StageCta accent={REAL} label="Fazer diagnóstico" onClick={() => go('diagnostico')} />
            </>
          )}
        </StageCard>

        <Connector />

        {/* 2 — Planejamento (para onde vou) */}
        <StageCard accent={PLAN} bg={PRODUCTS.planning.bg}>
          <div>
            <div style={{ ...kicker, color: `rgb(${PLAN})` }}>2 · Planejamento</div>
            <div style={stageTitle}>Para onde vai</div>
          </div>
          {hasPlan ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#5ec27e', fontWeight: 700, fontSize: 14 }}>
                <FiCheckCircle size={18} /> Planejamento criado
              </div>
              <p style={sub}>Visão, missão, objetivos e estratégias definidos.</p>
              <StageCta accent={PLAN} label="Ver planejamento" onClick={() => go('perfil')} ghost />
            </>
          ) : (
            <>
              <p style={{ ...sub, fontSize: 13, color: '#cfcfd4' }}>Defina visão, missão, objetivos e estratégias com a Nyta.</p>
              <StageCta accent={PLAN} label="Criar planejamento" onClick={() => go('action-plan')} />
            </>
          )}
        </StageCard>

        <Connector />

        {/* 3 — Plano de Ação (como chego) */}
        <StageCard accent={ACTION} bg={PRODUCTS.action.bg}>
          <div>
            <div style={{ ...kicker, color: `rgb(${ACTION})` }}>3 · Plano de Ação</div>
            <div style={stageTitle}>Como chegar lá</div>
          </div>
          {hasPlan ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: `rgb(${ACTION})`, transition: 'width .4s' }} />
                </div>
                <span style={{ color: `rgb(${ACTION})`, fontWeight: 800, fontSize: 14 }}>{pct}%</span>
              </div>
              <p style={sub}>{total ? `${done} de ${total} tarefas concluídas.` : 'Adicione tarefas às suas estratégias.'}</p>
              <StageCta accent={ACTION} label="Abrir plano" onClick={() => go('action-plan')} ghost />
            </>
          ) : (
            <>
              <p style={{ ...sub, fontSize: 13, color: '#cfcfd4' }}>Execute suas estratégias em tarefas e acompanhe o progresso.</p>
              <StageCta accent={ACTION} label="Abrir plano" onClick={() => go('action-plan')} ghost />
            </>
          )}
        </StageCard>
      </div>
    </section>
  );
};

export default JourneyMap;
