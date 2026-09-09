import { FC, useRef, useState } from 'react';
import { FiAlertTriangle, FiPlus } from 'react-icons/fi';

import type { EnvioDePista, Recusa } from '@maestra/core/audio/envioDePistas';
import { MAXIMO_DE_PISTAS } from '@maestra/core/constants/maestra';

import styles from './mesa.module.scss';

// O "+ Adicionar pista", o que está a subir e o que não entrou.
//
// Na web ele é também uma ZONA DE LARGAR: quem exporta stems de uma DAW tem os seis ficheiros
// abertos numa janela do Finder, e arrastá-los para cá é o gesto que a pessoa já ia fazer.
//
// ─── O aviso do MP3 fica AQUI, e não escondido numa ajuda ────────────────────
//
// Quem manda stems em MP3 e ouve tudo desalinhado vai abrir um chamado a dizer que o editor
// está quebrado, e não está: cada codificador de MP3 acrescenta ~25 a 50 ms de silêncio no
// princípio do ficheiro. Uma frase no lugar onde se escolhe o ficheiro custa duas linhas; o
// mesmo aviso depois do upload custa a confiança de quem já ouviu errado.

export const AdicionarPista: FC<{
  /** Quantos stems a gravação já tem. Decide se ainda cabe alguma. */
  quantas: number;
  envios: EnvioDePista[];
  recusados: Recusa[];
  aoEscolher: (arquivos: File[]) => void;
  aoLimparRecusas: () => void;
}> = ({ quantas, envios, recusados, aoEscolher, aoLimparRecusas }) => {
  const entrada = useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = useState(false);

  const cheio = quantas >= MAXIMO_DE_PISTAS;
  const subindo = envios.filter((e) => e.estado === 'enviando' || e.estado === 'na-fila').length;
  const inerte = cheio || subindo > 0;

  const largar = (evento: React.DragEvent) => {
    evento.preventDefault();
    setSobre(false);
    if (inerte) return;
    aoEscolher(Array.from(evento.dataTransfer.files));
  };

  return (
    <div className={styles.adicionar}>
      {/* Cada ficheiro aceito já é uma LINHA aqui, esmaecida, antes de existir no banco: sem
          isso, mandar quatro stems é olhar para uma tela parada durante um minuto. */}
      {envios.filter((envio) => envio.estado !== 'pronta').map((envio) => (
        <div key={envio.nome} className={styles.envio}>
          <span>{envio.nome}</span>
          <em className={envio.estado === 'erro' ? styles.envioErro : undefined}>
            {envio.estado === 'erro' ? (envio.erro || 'Falhou') : envio.estado === 'enviando' ? 'Enviando…' : 'Na fila'}
          </em>
        </div>
      ))}

      {!!recusados.length && (
        <button type='button' className={styles.recusa} onClick={aoLimparRecusas}>
          <FiAlertTriangle aria-hidden />
          <span>{recusados.map((r) => `${r.nome}: ${r.motivo}`).join(' · ')}</span>
        </button>
      )}

      <button
        type='button'
        className={`${styles.soltar} ${sobre ? styles.soltarSobre : ''} ${cheio ? styles.soltarCheio : ''}`}
        onClick={() => entrada.current?.click()}
        disabled={inerte}
        onDragOver={(evento) => { evento.preventDefault(); setSobre(true); }}
        onDragLeave={() => setSobre(false)}
        onDrop={largar}
      >
        <FiPlus aria-hidden />
        {cheio
          ? `Limite de ${MAXIMO_DE_PISTAS} pistas`
          : subindo > 0 ? `Enviando ${subindo}…` : 'Adicionar pista — arraste os arquivos ou clique'}
      </button>

      <input
        ref={entrada}
        type='file'
        accept='.mp3,.wav,audio/mpeg,audio/wav'
        multiple
        style={{ display: 'none' }}
        onChange={(evento) => {
          const escolhidos = Array.from(evento.target.files || []);
          // Zera para que escolher os MESMOS ficheiros de novo continue disparando o change.
          evento.target.value = '';
          if (escolhidos.length) aoEscolher(escolhidos);
        }}
      />

      {!cheio && (
        <p className={styles.dica}>
          WAV para sincronia exata. Stems em MP3 só alinham entre si se saíram do mesmo programa:
          cada codificador acrescenta um silêncio de alguns milissegundos no início.
        </p>
      )}
    </div>
  );
};
