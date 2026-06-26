import { FC, useMemo, useState } from 'react';

import type { RealIndex } from '../interfaces/maestra';
import { PROFILES } from '../services/realEngine';
import { RealBadge, tierForAltas, TIER_ACCENT, altasForPattern } from './RealBadge';
import { realProgression } from './realProgression';

// Escada de níveis do REAL: os 5 marcos (0→4 dimensões altas) como placas, e ENTRE eles as 16 fases
// como bolinhas (cada fase = 1 dos 16 perfis), distribuídas por nº de altas. A linha vai sendo
// preenchida (cor do tier) até a fase atual da artista, e cada bolinha mostra o nome no hover.

const LEVELS = [0, 1, 2, 3, 4];

// Agrupa os 16 perfis por nº de R·E·A·L altas (conta os '1' da chave-bit), preservando a ordem.
const profilesByAltas = (() => {
  const groups: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
  Object.entries(PROFILES).forEach(([bits, def]) => {
    const altas = bits.split('').filter((b) => b === '1').length;
    groups[altas].push(def.name);
  });
  return groups;
})();

// Fração 0..1 de um nível N na linha (marco N fica em N/4).
const levelFrac = (n: number) => n / 4;

// Posição (fração) de uma fase: o 1º perfil do nível N fica NO marco N (N/4) — o marco já o
// representa; os demais perfis do nível se espalham no segmento [N, N+1] (você alcançou N, rumo a N+1).
const phaseFrac = (altas: number, idxInGroup: number, groupLen: number) =>
  levelFrac(altas) + (idxInGroup / Math.max(groupLen, 1)) * 0.25;

export const RealLevelLadder: FC<{ ri: RealIndex; badgeSize?: number }> = ({ ri, badgeSize = 32 }) => {
  const { altas, atTop, driver } = realProgression(ri);
  const accent = TIER_ACCENT[tierForAltas(altas)];
  const [hover, setHover] = useState<{ name: string; frac: number; color: string } | null>(null);

  // Posição atual da artista na linha (pela fase exata entre as 16).
  const currentFrac = useMemo(() => {
    const curAltas = altasForPattern(ri.pattern);
    if (curAltas <= 0) return 0;
    if (curAltas >= 4) return 1;
    const group = profilesByAltas[curAltas] || [];
    const idx = group.indexOf(ri.profile?.name || '');
    return phaseFrac(curAltas, idx < 0 ? 0 : idx, group.length);
  }, [ri]);

  // As bolinhas das fases dos níveis 1–3 — exceto o 1º perfil de cada grupo, que já é o próprio marco.
  const dots = useMemo(
    () =>
      [1, 2, 3].flatMap((lvl) => {
        const group = profilesByAltas[lvl] || [];
        const color = `rgb(${TIER_ACCENT[tierForAltas(lvl)]})`;
        return group.flatMap((name, idx) =>
          idx === 0 ? [] : [{ name, lvl, color, frac: phaseFrac(lvl, idx, group.length) }]
        );
      }),
    []
  );

  const dotSize = 11;
  const badgeHalf = badgeSize / 2 + 3; // +3 = padding do anel em volta da placa
  const topRoom = 26; // espaço pro tooltip acima das placas
  const trackY = topRoom + badgeHalf; // linha no centro vertical das placas/bolinhas
  const labelY = trackY + badgeHalf + 8; // "Você está aqui" com folga abaixo das placas
  const height = labelY + 18;
  const isCurrent = (frac: number) => Math.abs(frac - currentFrac) < 0.001;

  return (
    <div>
      <div style={{ position: 'relative', height, padding: `0 ${badgeSize / 2}px` }}>
        <div style={{ position: 'relative', height: '100%' }}>
          {/* Trilho de fundo + preenchimento (cor do tier) até a fase atual */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: trackY - 1.5, height: 3, borderRadius: 3, background: '#3a3a3a' }} />
          <div style={{ position: 'absolute', left: 0, width: `${currentFrac * 100}%`, top: trackY - 1.5, height: 3, borderRadius: 3, background: `rgb(${accent})`, boxShadow: `0 0 8px rgba(${accent},0.5)`, transition: 'width .5s cubic-bezier(0.4,0,0.2,1)' }} />

          {/* Bolinhas das 16 fases (níveis 1–3) */}
          {dots.map((d) => {
            const reached = d.frac <= currentFrac + 0.001;
            const cur = isCurrent(d.frac);
            return (
              <div
                key={d.name}
                onMouseEnter={() => setHover({ name: d.name, frac: d.frac, color: d.color })}
                onMouseLeave={() => setHover((h) => (h?.name === d.name ? null : h))}
                style={{
                  position: 'absolute', left: `${d.frac * 100}%`, top: trackY, transform: 'translate(-50%, -50%)',
                  width: cur ? dotSize + 6 : dotSize, height: cur ? dotSize + 6 : dotSize, borderRadius: '50%',
                  background: reached ? d.color : '#4a4a52',
                  border: cur ? `2px solid #fff` : `2px solid ${reached ? d.color : '#2a2a2a'}`,
                  boxShadow: cur ? `0 0 0 3px rgba(${accent},0.4)` : 'none',
                  cursor: 'pointer', zIndex: cur ? 4 : 2,
                }}
              />
            );
          })}

          {/* Marcos 0–4 (placas) */}
          {LEVELS.map((n) => {
            const frac = levelFrac(n);
            const cur = isCurrent(frac);
            // O marco representa o 1º perfil do nível (Beginner / Influencer / Digital / Hit / Icon).
            const nodeName = profilesByAltas[n]?.[0] || null;
            return (
              <div
                key={n}
                onMouseEnter={() => nodeName && setHover({ name: nodeName, frac, color: `rgb(${TIER_ACCENT[tierForAltas(n)]})` })}
                onMouseLeave={() => setHover((h) => (h?.name === nodeName ? null : h))}
                style={{ position: 'absolute', left: `${frac * 100}%`, top: trackY, transform: 'translate(-50%, -50%)', zIndex: cur ? 5 : 3, opacity: n <= altas ? 1 : 0.5 }}
              >
                <span
                  style={{ display: 'inline-flex', borderRadius: '50%', padding: 3, boxShadow: cur ? `0 0 0 2px rgb(${accent})` : 'none', cursor: nodeName ? 'pointer' : 'default' }}
                >
                  <RealBadge tier={tierForAltas(n)} label={String(n)} size={badgeSize} />
                </span>
              </div>
            );
          })}

          {/* "Você está aqui" sob a posição atual */}
          <span style={{ position: 'absolute', left: `${currentFrac * 100}%`, top: labelY, transform: 'translateX(-50%)', fontSize: 10, fontWeight: 800, color: `rgb(${accent})`, whiteSpace: 'nowrap' }}>
            Você está aqui
          </span>

          {/* Tooltip da fase no hover */}
          {hover && (
            <span
              style={{
                position: 'absolute', left: `${hover.frac * 100}%`, top: trackY - badgeHalf - 24, transform: 'translateX(-50%)',
                padding: '3px 9px', borderRadius: 7, background: '#0d0d0f', border: `1px solid ${hover.color}`,
                color: '#fff', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', zIndex: 6, pointerEvents: 'none',
                boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
              }}
            >
              {hover.name}
            </span>
          )}
        </div>
      </div>

      <p style={{ fontSize: 13, lineHeight: 1.5, color: '#cfcfd4', margin: '16px 0 0' }}>
        {atTop ? (
          <>Topo da escada — agora é <b style={{ color: '#fff' }}>manter e escalar</b> as quatro frentes.</>
        ) : driver ? (
          <>
            Pra subir de nível, eleve <b style={{ color: '#fff' }}>{driver.label}</b>
            {driver.gap != null && driver.gap > 0 ? (
              <> — você está a <b style={{ color: `rgb(${accent})` }}>{driver.gap} pts</b> de torná-lo alto.</>
            ) : (
              <>.</>
            )}
          </>
        ) : (
          <>Eleve uma das suas frentes R·E·A·L pra subir de nível.</>
        )}
      </p>
    </div>
  );
};

export default RealLevelLadder;
