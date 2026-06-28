import { FC, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight, FiCheck } from 'react-icons/fi';

import type { Artist } from '../../interfaces/maestra';
import { RealBadge, altasForPattern, tierForPattern } from '../RealBadge';
import { PRODUCT_THEME as PRODUCTS } from '../productTheme';
import './journey.scss';

// Fonte-assinatura do REAL (mesma dos R·E·A·L do diagnóstico) — id visual do produto.
const realFont: React.CSSProperties = { fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: 'italic', fontWeight: 700, textTransform: 'none', letterSpacing: '0.02em' };

// "Sua jornada" (home): mapa CALMO do ciclo REAL → Planejamento → Plano de Ação. É só orientação
// (onde estou no ciclo) — a AÇÃO do dia mora no card "Seu próximo passo". Por isso os cards são
// neutros e só a etapa ATUAL recebe a cor do produto; o resto fica apagado. Sem CTA preenchido aqui.

const MUTED = '#74747e';
const kicker: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' };
const stageTitle: React.CSSProperties = { fontFamily: 'SpotifyMixUITitle', fontWeight: 800, fontSize: 18, color: '#fff', margin: '9px 0 0', lineHeight: 1.15 };
const sub: React.CSSProperties = { color: '#9a9aa3', fontSize: 13, margin: 0, lineHeight: 1.5 };

// Indicador de etapa: concluída (✓ verde), atual (preenchida na cor do produto) ou futura (contorno).
const StepDot: FC<{ n: number; done?: boolean; current?: boolean; accent: string }> = ({ n, done, current, accent }) => (
  <span
    style={{
      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11.5, fontWeight: 800,
      background: done ? 'rgba(94,194,126,0.15)' : current ? `rgb(${accent})` : 'transparent',
      border: done ? '1px solid rgba(94,194,126,0.45)' : current ? 'none' : '1.5px solid rgba(255,255,255,0.16)',
      color: done ? '#5ec27e' : current ? '#fff' : MUTED,
    }}
  >
    {done ? <FiCheck size={13} /> : n}
  </span>
);

const StageCard: FC<{ current?: boolean; accent: string; children: ReactNode }> = ({ current, accent, children }) => (
  <div
    className="journey-stage"
    style={{
      position: 'relative',
      // A etapa atual ganha um leve tom + borda na cor do produto; as outras ficam totalmente neutras.
      background: current ? `linear-gradient(180deg, rgba(${accent},0.06), rgba(${accent},0.015) 60%, transparent), #0e0e10` : '#0e0e10',
      border: current ? `1px solid rgba(${accent},0.40)` : '1px solid rgba(255,255,255,0.07)',
      borderRadius: 16,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
    }}
  >
    {children}
  </div>
);

// Link sutil (sem pílula/preenchimento): a ação principal vive no card "Seu próximo passo".
const StageLink: FC<{ label: string; onClick: () => void; color?: string }> = ({ label, onClick, color }) => (
  <button
    onClick={onClick}
    className="journey-link"
    style={{
      marginTop: 16,
      display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
      background: 'transparent', border: 'none', padding: 0,
      color: color || '#b3b3b3', cursor: 'pointer', fontWeight: 700, fontSize: 13,
    }}
  >
    {label} <FiArrowRight size={14} />
  </button>
);

// Cabeçalho do card: indicador + rótulo do produto (uma linha) + título da etapa.
const StageHead: FC<{ n: number; done?: boolean; current?: boolean; accent: string; label: ReactNode; title: string }> = ({ n, done, current, accent, label, title }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <StepDot n={n} done={done} current={current} accent={accent} />
      <span style={{ ...kicker, color: current ? `rgb(${accent})` : MUTED }}>{label}</span>
    </div>
    <div style={stageTitle}>{title}</div>
  </div>
);

// Conector entre etapas (vira ↓ quando empilha no mobile — controlado por journey.scss).
const Connector: FC = () => (
  <div className="journey-connector" aria-hidden>
    <FiArrowRight size={20} />
  </div>
);

export const JourneyMap: FC<{ artist: Artist }> = ({ artist }) => {
  const navigate = useNavigate();
  const go = (suffix: string) => navigate(`/artists/${artist.id}/${suffix}`);

  const ri = artist.content?.realIndex;
  const hasDiagnostic = !!ri?.profile;
  const hasPlan = !!artist.content?.strategies?.length;
  const tier = ri?.pattern ? tierForPattern(ri.pattern) : 'standard';

  const REAL = PRODUCTS.real.accent;
  const PLAN = PRODUCTS.planning.accent;
  const ACTION = PRODUCTS.action.accent;

  const allTasks = (artist.content?.strategies || []).flatMap((s) => (s.tasks || []).filter((t) => t.status !== 'archived'));
  const total = allTasks.length;
  const done = allTasks.filter((t) => t.status === 'done').length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  // Etapas concluídas e a etapa atual (primeira não-concluída) — define quem recebe cor.
  const s1done = hasDiagnostic;
  const s2done = hasPlan;
  const s3done = hasPlan && total > 0 && done === total;
  const current = !s1done ? 1 : !s2done ? 2 : 3;

  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
        <h2 style={{ fontFamily: 'SpotifyMixUITitle', fontWeight: 800, fontSize: 20, color: '#fff', margin: 0 }}>Sua jornada</h2>
        <span style={{ color: '#8a8a92', fontSize: 13 }}>o ciclo que faz sua carreira evoluir</span>
      </div>

      <div className="journey-row">
        {/* 1 — Diagnóstico REAL (onde estou) */}
        <StageCard current={current === 1} accent={REAL}>
          <StageHead
            n={1} done={s1done} current={current === 1} accent={REAL} title="Onde você está"
            label={<>Diagnóstico <span style={realFont}>REAL</span></>}
          />
          {hasDiagnostic ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 16 }}>
                <RealBadge tier={tier} label={String(altasForPattern(ri!.pattern))} size={40} />
                <div>
                  <div style={{ color: '#fff', fontWeight: 800, fontSize: 17, lineHeight: 1.1 }}>{ri!.profile!.name}</div>
                  <div style={{ color: '#8a8a92', fontSize: 12 }}>fase atual · entre os 16</div>
                </div>
              </div>
              <StageLink label="Ver diagnóstico" onClick={() => go('diagnostico')} />
            </>
          ) : (
            <>
              <p style={{ ...sub, marginTop: 12 }}>Descubra sua fase de carreira, entre 16 perfis, com dados reais.</p>
              <StageLink label="Ver diagnóstico" onClick={() => go('diagnostico')} color={`rgb(${REAL})`} />
            </>
          )}
        </StageCard>

        <Connector />

        {/* 2 — Planejamento (para onde vou) */}
        <StageCard current={current === 2} accent={PLAN}>
          <StageHead n={2} done={s2done} current={current === 2} accent={PLAN} title="Para onde vai" label="Planejamento" />
          {hasPlan ? (
            <>
              <p style={{ ...sub, marginTop: 12 }}>Visão, missão, objetivos e estratégias definidos.</p>
              <StageLink label="Ver planejamento" onClick={() => go('perfil')} />
            </>
          ) : (
            <>
              <p style={{ ...sub, marginTop: 12 }}>Defina visão, missão, objetivos e estratégias com a Nyta.</p>
              <StageLink label="Criar planejamento" onClick={() => go('wizard')} color={current === 2 ? `rgb(${PLAN})` : undefined} />
            </>
          )}
        </StageCard>

        <Connector />

        {/* 3 — Plano de Ação (como chego) */}
        <StageCard current={current === 3} accent={ACTION}>
          <StageHead n={3} done={s3done} current={current === 3} accent={ACTION} title="Como chegar lá" label="Plano de Ação" />
          {hasPlan ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: `rgb(${ACTION})`, transition: 'width .4s' }} />
                </div>
                <span style={{ color: '#cfcfd4', fontWeight: 800, fontSize: 14 }}>{pct}%</span>
              </div>
              <p style={{ ...sub, marginTop: 10 }}>{total ? `${done} de ${total} tarefas concluídas.` : 'Adicione tarefas às suas estratégias.'}</p>
              <StageLink label="Abrir plano" onClick={() => go('action-plan')} />
            </>
          ) : (
            <>
              <p style={{ ...sub, marginTop: 12 }}>Aqui suas estratégias viram tarefas do dia a dia.</p>
              <p style={{ ...sub, color: MUTED, fontSize: 12, marginTop: 'auto', paddingTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}>Disponível após o planejamento</p>
            </>
          )}
        </StageCard>
      </div>
    </section>
  );
};

export default JourneyMap;
