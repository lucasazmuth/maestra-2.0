import { Fragment } from 'react';
import { FiCheck } from 'react-icons/fi';

import styles from './ArtistCreate.module.scss';

// Header de macro-fluxo (abas de texto, estilo Spotify), compartilhado entre /criar-artista e
// /desbloquear pra a jornada parecer contínua: Criar perfil · Diagnóstico REAL · Planejamento Estratégico.
export const FLOW_PHASES = ['Criar perfil', 'Diagnóstico REAL', 'Planejamento Estratégico'] as const;

export const FlowHeader = ({ phase }: { phase: number }) => (
  <nav className={styles.flow} aria-label="Etapas da criação">
    {FLOW_PHASES.map((label, i) => {
      const state = i < phase ? 'done' : i === phase ? 'current' : 'upcoming';
      return (
        <Fragment key={label}>
          {i > 0 && <span className={styles.flowSep} aria-hidden>·</span>}
          <span className={`${styles.flowSeg} ${state === 'done' ? styles.flowDone : state === 'current' ? styles.flowCurrent : ''}`}>
            {state === 'done' && <FiCheck className={styles.flowCheck} size={13} />}
            {label === 'Diagnóstico REAL'
              ? <>Diagnóstico&nbsp;<span className={styles.flowReal}>REAL</span></>
              : label}
          </span>
        </Fragment>
      );
    })}
  </nav>
);
