import { FC, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight, FiCheck } from 'react-icons/fi';

import type { Artist } from '../../interfaces/maestra';
import { PRODUCT_THEME as PRODUCTS } from '../productTheme';
import './journey.scss';

// "Sua jornada": UM componente coeso (não 3 cards soltos) — um stepper inline do ciclo
// Diagnóstico REAL → Planejamento → Plano de Ação. É só orientação (onde estou no ciclo); a AÇÃO
// do dia mora no card "Seu próximo passo". Só a etapa ATUAL recebe cor; o resto fica neutro.

const MUTED = '#74747e';

// Indicador da etapa: concluída (✓ verde), atual (preenchida na cor) ou futura (contorno).
const StepDot: FC<{ n: number; done?: boolean; current?: boolean; accent: string }> = ({ n, done, current, accent }) => (
  <span
    style={{
      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 800,
      background: done ? 'rgba(94,194,126,0.15)' : current ? `rgb(${accent})` : 'transparent',
      border: done ? '1px solid rgba(94,194,126,0.45)' : current ? 'none' : '1.5px solid rgba(255,255,255,0.16)',
      color: done ? '#5ec27e' : current ? '#fff' : MUTED,
    }}
  >
    {done ? <FiCheck size={15} /> : n}
  </span>
);

interface Node { n: number; label: string; detail: string; accent: string; done: boolean; current: boolean; to: string; }

export const JourneyMap: FC<{ artist: Artist }> = ({ artist }) => {
  const navigate = useNavigate();
  const go = (suffix: string) => navigate(`/artists/${artist.id}/${suffix}`);

  const ri = artist.content?.realIndex;
  const hasDiagnostic = !!ri?.profile;
  const hasPlan = !!artist.content?.strategies?.length;

  const allTasks = (artist.content?.strategies || []).flatMap((s) => (s.tasks || []).filter((t) => t.status !== 'archived'));
  const total = allTasks.length;
  const done = allTasks.filter((t) => t.status === 'done').length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const s1done = hasDiagnostic;
  const s2done = hasPlan;
  const s3done = hasPlan && total > 0 && done === total;
  const current = !s1done ? 1 : !s2done ? 2 : 3;

  const nodes: Node[] = [
    { n: 1, label: 'Diagnóstico REAL', detail: hasDiagnostic ? ri!.profile!.name : 'a fazer', accent: PRODUCTS.real.accent, done: s1done, current: current === 1, to: 'diagnostico' },
    { n: 2, label: 'Planejamento', detail: s2done ? 'concluído' : current === 2 ? 'a criar' : 'a fazer', accent: PRODUCTS.planning.accent, done: s2done, current: current === 2, to: hasPlan ? 'perfil' : 'wizard' },
    { n: 3, label: 'Plano de Ação', detail: hasPlan ? `${pct}% concluído` : 'bloqueado', accent: PRODUCTS.action.accent, done: s3done, current: current === 3, to: hasPlan ? 'action-plan' : 'wizard' },
  ];

  const nameColor = (nd: Node) => (nd.current ? `rgb(${nd.accent})` : nd.done ? '#e6e6ea' : MUTED);

  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <h2 style={{ fontFamily: 'SpotifyMixUITitle', fontWeight: 800, fontSize: 20, color: '#fff', margin: 0 }}>Sua jornada</h2>
        <span style={{ color: '#8a8a92', fontSize: 13 }}>onde você está no ciclo</span>
      </div>

      <div style={{ background: '#0e0e10', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px 20px' }}>
        <div className="journey-row">
          {nodes.map((nd, i) => (
            <Fragment key={nd.n}>
              {i > 0 && (
                <div className="journey-connector" aria-hidden>
                  <FiArrowRight size={18} />
                </div>
              )}
              <button className="journey-node" onClick={() => go(nd.to)}>
                <StepDot n={nd.n} done={nd.done} current={nd.current} accent={nd.accent} />
                <span className="journey-node-name" style={{ color: nameColor(nd) }}>{nd.label}</span>
                <span style={{ fontSize: 12, color: '#8a8a92' }}>{nd.detail}</span>
              </button>
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
};

export default JourneyMap;
