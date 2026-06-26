import { FC, Fragment } from 'react';

import type { RealIndex } from '../interfaces/maestra';
import { RealBadge, tierForAltas, TIER_ACCENT } from './RealBadge';
import { realProgression } from './realProgression';

// Escada de níveis do REAL: os 5 andares (0→4 dimensões altas) como placas, com o andar atual
// destacado e o próximo marcado, + a frase de progressão ("o que falta pra subir"). Reusa RealBadge.

const LEVELS = [0, 1, 2, 3, 4];

export const RealLevelLadder: FC<{ ri: RealIndex; badgeSize?: number }> = ({ ri, badgeSize = 32 }) => {
  const { altas, atTop, driver } = realProgression(ri);
  const accent = TIER_ACCENT[tierForAltas(altas)];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {LEVELS.map((n, i) => {
          const current = n === altas;
          return (
            <Fragment key={n}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, opacity: n <= altas ? 1 : 0.45 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    borderRadius: '50%',
                    padding: 3,
                    boxShadow: current ? `0 0 0 2px rgb(${accent})` : 'none',
                  }}
                >
                  <RealBadge tier={tierForAltas(n)} label={String(n)} size={badgeSize} />
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, height: 12, color: current ? `rgb(${accent})` : 'transparent', whiteSpace: 'nowrap' }}>
                  {current ? 'Você está aqui' : '·'}
                </span>
              </div>
              {i < LEVELS.length - 1 && (
                <span style={{ flex: 1, height: 2, minWidth: 8, borderRadius: 2, background: n < altas ? `rgb(${accent})` : '#3a3a3a', marginBottom: 17 }} />
              )}
            </Fragment>
          );
        })}
      </div>

      <p style={{ fontSize: 13, lineHeight: 1.5, color: '#cfcfd4', margin: '8px 0 0' }}>
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
