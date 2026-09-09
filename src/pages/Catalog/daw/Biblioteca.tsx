import { FC, useRef, useState } from 'react';
import { FiFolder, FiMusic, FiUploadCloud } from 'react-icons/fi';

import { DS, LARGURA_DAS_FERRAMENTAS } from './tokens';

// A BIBLIOTECA: os ficheiros do computador, antes de serem nossos.
//
// ─── Por que pré-visualizar em vez de enviar ─────────────────────────────────
//
// Escolher uma pasta com doze stems e ver os doze subirem é o caminho errado por dois motivos:
// paga-se armazenamento e egress por tudo o que entrou, inclusive o que a pessoa nem ia usar; e
// enche-se a montagem de pistas que ninguém pediu.
//
// Aqui a pasta é lida NO NAVEGADOR — os ficheiros nunca saem da máquina — e mostram-se como uma
// lista. Só quando um deles é arrastado para uma faixa é que ele sobe. O gesto é o mesmo de
// qualquer editor, e a conta de armazenamento passa a ser exatamente o que foi usado.

/** O que uma linha da biblioteca guarda. O `File` é o do navegador: bytes ainda no disco. */
export interface ItemDaBiblioteca {
  id: string;
  nome: string;
  tamanho: number;
  arquivo: File;
}

/** O tipo que viaja no arrasto. Quem larga usa isto para saber que veio daqui. */
export const TIPO_DO_ARRASTO = 'application/x-maestra-biblioteca';

const emMegabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const ehAudio = (nome: string) => /\.(mp3|wav)$/i.test(nome);

export const Biblioteca: FC<{
  itens: ItemDaBiblioteca[];
  aoAbrirPasta: (itens: ItemDaBiblioteca[]) => void;
  /** O envio direto, para quem prefere o botão ao arrasto. */
  aoEnviar: (arquivos: File[]) => void;
  podeEditar: boolean;
  /** Aparece quando a gravação ainda não foi montada em pistas. */
  aoMontar?: () => void;
}> = ({ itens, aoAbrirPasta, aoEnviar, podeEditar, aoMontar }) => {
  const pasta = useRef<HTMLInputElement>(null);
  const soltos = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);

  const lerEscolha = (lista: FileList | null) => {
    const arquivos = Array.from(lista || []).filter((a) => ehAudio(a.name));
    aoAbrirPasta(arquivos.map((arquivo, i) => ({
      // O caminho relativo distingue dois `voz.wav` de pastas diferentes; o índice fecha o caso
      // de dois ficheiros com o mesmo caminho, que o seletor de vários permite.
      id: `${(arquivo as File & { webkitRelativePath?: string }).webkitRelativePath || arquivo.name}#${i}`,
      nome: arquivo.name,
      tamanho: arquivo.size,
      arquivo,
    })));
  };

  return (
    <div style={{
      width: LARGURA_DAS_FERRAMENTAS, flexShrink: 0,
      background: DS.color.bgPainel, borderRight: `1px solid ${DS.color.borda}`,
      padding: 16, overflowY: 'auto',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: DS.color.texto }}>Biblioteca</h2>

      <button
        type='button'
        onClick={() => pasta.current?.click()}
        disabled={!podeEditar}
        aria-label='Abrir uma pasta do computador'
        style={{
          width: '100%', height: 38,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: DS.color.bgPista, border: `1px solid ${DS.color.borda}`,
          borderRadius: DS.raio.medio, color: DS.color.texto,
          fontSize: 13, cursor: podeEditar ? 'pointer' : 'not-allowed',
          fontFamily: DS.font.display,
        }}
      >
        <FiFolder size={14} />
        Abrir pasta
      </button>

      <button
        type='button'
        onClick={() => soltos.current?.click()}
        disabled={!podeEditar}
        aria-label='Escolher arquivos'
        style={{
          width: '100%', height: 38,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: 'transparent', border: `1px solid ${DS.color.borda}`,
          borderRadius: DS.raio.medio, color: DS.color.textoApoio,
          fontSize: 13, cursor: podeEditar ? 'pointer' : 'not-allowed',
          fontFamily: DS.font.display,
        }}
      >
        <FiUploadCloud size={14} />
        Escolher arquivos
      </button>

      {/* `webkitdirectory` é o único jeito de o navegador dar uma PASTA. Fora do padrão no nome,
          suportado em todo lado, e o React não o conhece — daí o atributo em minúsculas. */}
      <input
        ref={pasta}
        type='file'
        multiple
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore — atributo não padronizado, e é ele que abre uma pasta
        webkitdirectory=''
        directory=''
        style={{ display: 'none' }}
        onChange={(evento) => { lerEscolha(evento.target.files); evento.target.value = ''; }}
      />
      <input
        ref={soltos}
        type='file'
        multiple
        accept='.mp3,.wav,audio/mpeg,audio/wav'
        style={{ display: 'none' }}
        onChange={(evento) => { lerEscolha(evento.target.files); evento.target.value = ''; }}
      />

      {itens.length === 0 ? (
        <p style={{ margin: '6px 0 0', fontSize: 11, lineHeight: 1.6, color: DS.color.textoFraco }}>
          Abra uma pasta para ver os áudios dela aqui. Nada sobe para a nuvem enquanto você não
          arrastar um deles para uma faixa.
        </p>
      ) : (
        <>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: DS.color.textoFraco }}>
            Arraste para uma faixa. Só então o arquivo é enviado.
          </p>

          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
            {itens.map((item) => (
              <li key={item.id}>
                <div
                  draggable={podeEditar}
                  onDragStart={(evento) => {
                    evento.dataTransfer.setData(TIPO_DO_ARRASTO, item.id);
                    evento.dataTransfer.effectAllowed = 'copy';
                    setArrastando(item.id);
                  }}
                  onDragEnd={() => setArrastando(null)}
                  title={item.nome}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: DS.raio.medio,
                    background: DS.color.bgPista,
                    border: `1px solid ${arrastando === item.id ? DS.color.primaria : DS.color.borda}`,
                    cursor: podeEditar ? 'grab' : 'default',
                    opacity: arrastando === item.id ? 0.5 : 1,
                  }}
                >
                  <FiMusic size={13} color={DS.color.textoFraco} />
                  <span style={{
                    flex: 1, minWidth: 0, fontSize: 12, color: DS.color.texto,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.nome}
                  </span>
                  <span style={{ fontSize: 10, color: DS.color.textoFraco, fontFamily: DS.font.mono }}>
                    {emMegabytes(item.tamanho)}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <button
            type='button'
            onClick={() => aoEnviar(itens.map((i) => i.arquivo))}
            disabled={!podeEditar}
            style={{
              width: '100%', height: 34, marginTop: 4,
              background: 'transparent', border: `1px solid ${DS.color.bordaForte}`,
              borderRadius: DS.raio.medio, color: DS.color.textoApoio,
              fontSize: 12, cursor: podeEditar ? 'pointer' : 'not-allowed',
              fontFamily: DS.font.display,
            }}
          >
            Enviar todos como pistas
          </button>
        </>
      )}

      {!!aoMontar && (
        <button
          type='button'
          onClick={aoMontar}
          title='Transforma esta gravação numa pista que se pode arrastar e cortar'
          style={{
            width: '100%', height: 34, marginTop: 6,
            background: 'transparent', border: `1px solid ${DS.color.bordaForte}`,
            borderRadius: DS.raio.medio, color: DS.color.textoApoio,
            fontSize: 12, cursor: 'pointer', fontFamily: DS.font.display,
          }}
        >
          Montar em pistas
        </button>
      )}

      <p style={{ margin: 'auto 0 0', paddingTop: 12, fontSize: 10, lineHeight: 1.6, color: DS.color.textoFraco }}>
        WAV para sincronia exata. Stems em MP3 só alinham entre si se saíram do mesmo programa:
        cada codificador acrescenta um silêncio de alguns milissegundos no início.
      </p>
    </div>
  );
};
