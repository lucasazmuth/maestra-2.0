import styles from './ArtistCreate.module.scss';

// Header de macro-fluxo compartilhado entre /criar-artista e /desbloquear pra a jornada parecer
// contínua. Em vez de exibir os 3 rótulos de uma vez (poluído), mostramos um progresso enxuto:
// dots (concluído / atual / a fazer) + o nome de SÓ a etapa atual. `full` = desktop; `short` = mobile.
export const FLOW_PHASES = [
  { full: 'Criar perfil', short: 'Perfil' },
  { full: 'Diagnóstico REAL', short: 'Diagnóstico' },
  { full: 'Planejamento Estratégico', short: 'Planejamento' },
] as const;

export const FlowHeader = ({ phase }: { phase: number }) => {
  const current = FLOW_PHASES[Math.min(phase, FLOW_PHASES.length - 1)];
  const isDiag = current.full === 'Diagnóstico REAL';
  return (
    <nav
      className={styles.flow}
      aria-label={`Etapa ${phase + 1} de ${FLOW_PHASES.length}: ${current.full}`}
    >
      <span className={styles.flowDots} aria-hidden>
        {FLOW_PHASES.map((p, i) => (
          <span
            key={p.full}
            className={`${styles.flowDot} ${i < phase ? styles.flowDotDone : i === phase ? styles.flowDotCur : ''}`}
          />
        ))}
      </span>
      <span className={styles.flowLabel}>
        {/* Desktop: rótulo completo (com "REAL" estilizado); mobile: rótulo curto. */}
        <span className={styles.flowFull}>
          {isDiag ? <>Diagnóstico&nbsp;<span className={styles.flowReal}>REAL</span></> : current.full}
        </span>
        <span className={styles.flowShort}>{current.short}</span>
      </span>
    </nav>
  );
};
