import { FC } from 'react';
import { FiAlertCircle, FiMoreVertical } from 'react-icons/fi';

import { corDaPista } from '@maestra/core/constants/design';
import type { EstadoDaPista } from '@maestra/core/audio/mesa';

import { Fader } from './Fader';
import { MiniOnda } from './MiniOnda';
import styles from './mesa.module.scss';

// Uma pista da mesa.
//
// ─── O que diz que a pista está calada ───────────────────────────────────────
//
// Três sinais ao mesmo tempo, e de propósito: a FAIXA de cor à esquerda fica cinzenta, a linha
// inteira perde opacidade, e a onda perde a cor. Assim lê-se o estado de seis pistas de
// relance, sem procurar botão nenhum — que é como se lê uma mesa de verdade.
//
// ⚠️ MUTAR E SOLAR TÊM CORES DIFERENTES, e isso não é gosto. São ações opostas: mutar é "esta
// não", solar é "só esta". Pintados da mesma cor quando ativos, a pessoa deixa de saber qual
// carregou — e num editor de stems são as duas ações principais. Mutar fica cinzento (a cor de
// estar apagado); solar fica âmbar, a mesma cor da estrela da gravação principal.

export const Pista: FC<{
  pista: EstadoDaPista;
  indice: number;
  picos: number[];
  /** 0..1 do que já tocou. */
  progresso: number;
  /** Alguma pista está solada? Muda o que "apagada" quer dizer para as outras. */
  haSolo: boolean;
  aoMudar: () => void;
  aoSolar: () => void;
  aoGanho: (valor: number) => void;
  /** Ausente na pista da mix: ela não se renomeia, não se move e não se apaga. */
  aoAbrirOpcoes?: () => void;
}> = ({ pista, indice, picos, progresso, haSolo, aoMudar, aoSolar, aoGanho, aoAbrirOpcoes }) => {
  const calada = pista.muda || (haSolo && !pista.solo);
  const carregando = pista.carga === 'na-fila' || pista.carga === 'carregando';
  const falhou = pista.carga === 'erro';

  return (
    <div className={`${styles.pista} ${calada ? styles.pistaCalada : ''}`}>
      {/* A faixa de cor: o sinal de estado mais forte da linha, e o que dá identidade à pista. */}
      <i className={styles.faixa} style={{ background: calada ? '#b7c4da' : corDaPista(indice) }} />

      <div className={styles.pistaMiolo}>
        <div className={styles.pistaCabeca}>
          <strong title={pista.nome}>{pista.nome}</strong>

          {carregando && <em className={styles.carga}>preparando…</em>}

          {!carregando && !falhou && (
            <>
              <button
                type='button'
                className={`${styles.chave} ${pista.muda ? styles.chaveMuda : ''}`}
                onClick={aoMudar}
                aria-pressed={pista.muda}
                aria-label={pista.muda ? `Ouvir ${pista.nome}` : `Silenciar ${pista.nome}`}
                title={pista.muda ? 'Ouvir' : 'Silenciar'}
              >
                M
              </button>
              <button
                type='button'
                className={`${styles.chave} ${pista.solo ? styles.chaveSolo : ''}`}
                onClick={aoSolar}
                aria-pressed={pista.solo}
                aria-label={pista.solo ? 'Ouvir tudo de novo' : `Ouvir só ${pista.nome}`}
                title={pista.solo ? 'Ouvir tudo' : 'Ouvir só esta'}
              >
                S
              </button>
            </>
          )}

          {!!aoAbrirOpcoes && (
            <button
              type='button'
              className={styles.opcoes}
              onClick={aoAbrirOpcoes}
              aria-label={`Opções de ${pista.nome}`}
              title='Renomear, mover ou remover'
            >
              <FiMoreVertical />
            </button>
          )}
        </div>

        {falhou ? (
          <p className={styles.erroDaPista}>
            <FiAlertCircle aria-hidden /> {pista.erro || 'Não consegui carregar esta pista.'}
          </p>
        ) : (
          // As duas filas alinham à MESMA margem: recuar a segunda cria uma coluna fantasma e o
          // olho perde a fila dos controles entre pistas.
          <div className={styles.pistaControles}>
            <MiniOnda picos={picos} progresso={progresso} apagada={calada} />
            <Fader valor={pista.ganho} nome={pista.nome} apagado={calada} aoMudar={aoGanho} />
          </div>
        )}
      </div>
    </div>
  );
};
