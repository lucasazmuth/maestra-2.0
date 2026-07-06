import { FC, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';

import type { Artist } from '../../interfaces/maestra';
import { useJourneyState, type JourneyStage } from '../../hooks/useJourneyState';
import { DiagnosticoIcon, PlanejamentoIcon, PlanoAcaoIcon } from '../Icons/system';
import { AiGlow } from '../AiGlow';

// "Seu próximo passo": âncora diária no topo da home. Mostra UM foco por vez, conforme o estágio
// do ciclo (diagnóstico → planejamento → tarefas → evolução). É o que traz o usuário leigo de volta
// todo dia sem precisar decidir por onde começar.
//
// Sem imagem de fundo (era o mesmo SVG decorativo pra todo mundo, poluía mais do que ajudava) —
// fundo liso + a mesma luz "aurora" que percorre a borda do botão da Nyta, pra chamar a atenção
// do jeito que a foto tentava, mas de forma mais limpa e consistente com o resto do produto.

const iconForStage = (stage: JourneyStage, size: number): ReactNode =>
  stage === 'plan' ? <PlanejamentoIcon size={size} />
  : stage === 'tasks' ? <PlanoAcaoIcon size={size} />
  : <DiagnosticoIcon size={size} />;

export const NextStepCard: FC<{ artist: Artist }> = ({ artist }) => {
  const navigate = useNavigate();
  const { next } = useJourneyState(artist);
  const accent = next.accent;
  // Tinta do texto do botão conforme o brilho do accent: escura em accents claros
  // (ex.: roxo da marca), branca em accents escuros (verde/azul dos outros passos).
  const ink = (() => {
    const [r, g, b] = accent.split(',').map((n) => parseInt(n.trim(), 10));
    return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? '#1a1a1a' : '#fff';
  })();

  return (
    <section style={{ marginBottom: 24 }}>
      <AiGlow style={{ display: 'block', width: '100%', borderRadius: 18 }}>
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: '#141416',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 18,
            padding: 26,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/* Ícone decorativo grande, integrado ao fundo — cinza bem sutil (neutro, não compete com o accent do kicker/botão) */}
          <span aria-hidden style={{ position: 'absolute', right: -18, bottom: -28, color: 'rgba(255,255,255,0.05)', pointerEvents: 'none', lineHeight: 0 }}>
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
              color: ink,
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
      </AiGlow>
    </section>
  );
};

export default NextStepCard;
