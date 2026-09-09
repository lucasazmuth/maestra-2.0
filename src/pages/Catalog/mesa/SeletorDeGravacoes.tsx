import { FC } from 'react';
import { FiStar } from 'react-icons/fi';

import type { CatalogVersion } from '@maestra/core/interfaces/maestra';

import styles from './mesa.module.scss';

// Qual gravação está aberta no editor.
//
// ─── O que esta fila substitui ───────────────────────────────────────────────
//
// Antes, cada versão era um CARTÃO com play e onda próprios, empilhados. Isso desenhava as
// versões como coisas que tocam ao mesmo tempo — e elas são ALTERNATIVAS: V1, V2 e V3 são a
// mesma música gravada de novo, ouve-se uma de cada vez. Quem toca junto são os stems, e é isso
// que a mesa abaixo mostra.

export const SeletorDeGravacoes: FC<{
  versoes: CatalogVersion[];
  abertaId: string | null;
  principalId?: string | null;
  aoAbrir: (versao: CatalogVersion) => void;
}> = ({ versoes, abertaId, principalId, aoAbrir }) => (
  <div className={styles.gravacoes}>
    <span className={styles.rotuloDaFila}>Gravações desta música</span>
    <div className={styles.fila}>
      {versoes.map((versao) => {
        const aberta = versao.id === abertaId;
        const principal = versao.id === principalId;
        return (
          <button
            key={versao.id}
            type='button'
            className={`${styles.ficha} ${aberta ? styles.fichaAberta : ''}`}
            onClick={() => aoAbrir(versao)}
            aria-pressed={aberta}
            aria-label={`Abrir V${versao.version_number}${versao.title ? `, ${versao.title}` : ''}${principal ? ', gravação principal' : ''}`}
          >
            <small>V{versao.version_number}</small>
            {principal && <FiStar aria-hidden className={styles.estrelaDaFicha} />}
            <span>{versao.title || 'Sem título'}</span>
          </button>
        );
      })}
    </div>
  </div>
);
