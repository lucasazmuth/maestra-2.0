import { Fragment } from 'react';
import { FiCheck } from 'react-icons/fi';

import styles from './ArtistCreate.module.scss';

// Header de macro-fluxo (abas de texto, estilo Spotify), compartilhado entre /criar-artista e
// /desbloquear pra a jornada parecer contínua: Criar perfil · Diagnóstico REAL · Planejamento Estratégico.
// No mobile as etapas usam rótulos curtos (Perfil · Diagnóstico · Planejamento) pra caberem numa
// única linha, sem quebrar. `full` = desktop; `short` = mobile.
export const FLOW_PHASES = [
  { full: 'Criar perfil', short: 'Perfil' },
  { full: 'Diagnóstico REAL', short: 'Diagnóstico' },
  { full: 'Planejamento Estratégico', short: 'Planejamento' },
] as const;

export const FlowHeader = ({ phase }: { phase: number }) => (
  <nav className={styles.flow} aria-label="Etapas da criação">
    {FLOW_PHASES.map(({ full, short }, i) => {
      const state = i < phase ? 'done' : i === phase ? 'current' : 'upcoming';
      const isDiag = full === 'Diagnóstico REAL';
      return (
        <Fragment key={full}>
          {i > 0 && <span className={styles.flowSep} aria-hidden>·</span>}
          <span className={`${styles.flowSeg} ${state === 'done' ? styles.flowDone : state === 'current' ? styles.flowCurrent : ''}`}>
            {state === 'done' && <FiCheck className={styles.flowCheck} size={13} />}
            {/* Desktop: rótulo completo (com "REAL" estilizado no diagnóstico). */}
            <span className={styles.flowFull}>
              {isDiag ? <>Diagnóstico&nbsp;<span className={styles.flowReal}>REAL</span></> : full}
            </span>
            {/* Mobile: rótulo curto, uma linha só. */}
            <span className={styles.flowShort}>{short}</span>
          </span>
        </Fragment>
      );
    })}
  </nav>
);
