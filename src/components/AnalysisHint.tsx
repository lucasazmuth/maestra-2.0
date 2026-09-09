import { FC } from 'react';
import { Button, Spin } from 'antd';
import { FiActivity } from 'react-icons/fi';

import { bpmLegivel, tomInseguro, tomLegivel } from '@maestra/core/services/db/audioJobs';
import { useAnaliseDaVersao } from '@maestra/core/hooks/useAnaliseDaVersao';

import styles from './AnalysisHint.module.scss';

// O BPM e o tom que a máquina ouviu — o espelho web de `casca/jam/SugestaoDaAnalise.tsx`.
//
// ⚠️ ELE NÃO ESCREVE NADA SOZINHO. O detetado aparece aqui, e só entra na ficha quando alguém
// clica em "usar". O detector erra de um jeito específico: o `KeyExtractor` confunde relativa
// maior com menor a toda a hora, porque Am e C têm as mesmas notas. Um número que se instala
// por cima do que o artista digitou apaga trabalho de gente sem avisar, e às vezes está errado.

const AnalysisHint: FC<{
  /** A versão principal: é o áudio que representa a música. */
  versionId?: string | null;
  disabled?: boolean;
  onUse: (valores: { bpm: string; tom: string }) => void;
}> = ({ versionId, disabled, onUse }) => {
  const { analise, emCurso, ultimoErro, carregando, pedindo, erro, pedir } =
    useAnaliseDaVersao(versionId);

  if (!versionId || carregando) return null;

  const andando = emCurso('bpm_tom') || pedindo === 'bpm_tom';
  const falhou = erro || ultimoErro('bpm_tom');

  if (andando) {
    return (
      <div className={styles.hint}>
        <Spin size='small' />
        <span className={styles.muted}>Ouvindo o áudio… isso leva alguns minutos.</span>
      </div>
    );
  }

  if (analise?.bpm) {
    const tom = tomLegivel(analise.tom, analise.tom_escala);
    const inseguro = tomInseguro(analise);
    return (
      <div className={styles.hint}>
        <FiActivity aria-hidden />
        <div className={styles.body}>
          <strong>Ouvi {bpmLegivel(analise.bpm)} BPM{tom ? ` · ${tom}` : ''}</strong>
          {inseguro && (
            <small>O tom veio com pouca certeza. Confira antes de usar.</small>
          )}
        </div>
        <Button
          type='link'
          size='small'
          disabled={disabled}
          onClick={() => onUse({ bpm: bpmLegivel(analise.bpm), tom })}
        >
          Usar
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.hint}>
      <FiActivity aria-hidden />
      <div className={styles.body}>
        <Button
          type='link'
          size='small'
          disabled={disabled}
          className={styles.action}
          onClick={() => void pedir('bpm_tom')}
        >
          Detectar BPM e tom
        </Button>
        {!!falhou && <small className={styles.error}>{falhou}</small>}
      </div>
    </div>
  );
};

export default AnalysisHint;
