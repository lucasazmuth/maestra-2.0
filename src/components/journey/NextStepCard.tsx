import { FC, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';

import type { Artist } from '../../interfaces/maestra';
import { useJourneyState, type JourneyStage } from '../../hooks/useJourneyState';
import { PRODUCT_THEME } from '../productTheme';
import { DiagnosticoIcon, PlanejamentoIcon, PlanoAcaoIcon } from '../Icons/system';

// "Seu próximo passo": âncora diária no topo da home. Mostra UM foco por vez, conforme o estágio
// do ciclo (diagnóstico → planejamento → tarefas → evolução). É o que traz o usuário leigo de volta
// todo dia sem precisar decidir por onde começar.

const bgForStage = (stage: JourneyStage): string =>
  stage === 'plan' ? PRODUCT_THEME.planning.bg
  : stage === 'tasks' ? PRODUCT_THEME.action.bg
  : PRODUCT_THEME.real.bg;

const iconForStage = (stage: JourneyStage, size: number): ReactNode =>
  stage === 'plan' ? <PlanejamentoIcon size={size} />
  : stage === 'tasks' ? <PlanoAcaoIcon size={size} />
  : <DiagnosticoIcon size={size} />;

export const NextStepCard: FC<{ artist: Artist }> = ({ artist }) => {
  const navigate = useNavigate();
  const { next } = useJourneyState(artist);
  const accent = next.accent;

  return (
    <section style={{ marginBottom: 24 }}>
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#0c0c0e',
          backgroundImage: `linear-gradient(150deg, rgba(11,11,13,0.42) 0%, rgba(11,11,13,0.80) 55%, rgba(11,11,13,0.93) 100%), url(${bgForStage(next.stage)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          border: `1px solid rgba(${accent},0.28)`,
          boxShadow: '0 16px 40px -26px rgba(0,0,0,0.65)',
          borderRadius: 18,
          padding: 26,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* Ícone decorativo grande, integrado ao fundo */}
        <span aria-hidden style={{ position: 'absolute', right: -18, bottom: -28, color: `rgb(${accent})`, opacity: 0.12, pointerEvents: 'none', lineHeight: 0 }}>
          <span style={{ display: 'block', width: 168, height: 168 }}>{iconForStage(next.stage, 168)}</span>
        </span>

        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: `rgb(${accent})` }}>
          Seu próximo passo · {next.kicker}
        </div>
        <h2 style={{ fontFamily: 'SpotifyMixUITitle', fontWeight: 800, fontSize: 24, color: '#fff', margin: 0, lineHeight: 1.18, maxWidth: 560 }}>
          {next.title}
        </h2>
        <p style={{ color: '#cfcfd4', fontSize: 14, margin: 0, maxWidth: 540, lineHeight: 1.5 }}>{next.desc}</p>

        <button
          onClick={() => navigate(`/artists/${artist.id}/${next.to}`)}
          style={{
            marginTop: 8,
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: `rgb(${accent})`,
            border: 'none',
            color: '#fff',
            padding: '11px 22px',
            borderRadius: 9999,
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: 14.5,
          }}
        >
          {next.ctaLabel} <FiArrowRight size={16} />
        </button>
      </div>
    </section>
  );
};

export default NextStepCard;
