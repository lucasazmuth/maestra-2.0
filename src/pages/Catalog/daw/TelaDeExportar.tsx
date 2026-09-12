import { FC } from 'react';
import { FiArchive, FiFileText, FiLoader } from 'react-icons/fi';

import { IconeDeBaixar } from './icones';

import { DS } from './tokens';

// EXPORTAR: tirar da tela o que está montado, para levar a outro lugar.
//
// Duas coisas saem daqui, e são coisas DIFERENTES — por isso duas seções, e não uma lista:
//
// · Os STEMS: cada pista, sozinha, num ZIP — para levar a outro programa (Ableton, Logic,
//   Pro Tools) e continuar o trabalho lá. É a matéria-prima da mistura.
// · A GUIA: a soma de tudo, o mesmo ficheiro que a lista de Músicas toca — para ouvir, mandar
//   para alguém ouvir, ou arquivar. É o resultado, não a matéria-prima.
//
// A tela é PURA: quem gera os arquivos e dispara o download é o `ProjectSpace` (é lá que mora
// a mesa, o `mesa.renderizar`, e a URL da guia já salva). Esta tela só mostra o que há para
// baixar, e avisa enquanto algo está a ser preparado — a MESMA separação que a Ficha já usa
// entre "os campos" (`campos.tsx`) e "onde eles são salvos" (`ProjectSpace.tsx`).

const botao = (desabilitado: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  height: 38, padding: '0 18px', borderRadius: DS.raio.medio,
  background: desabilitado ? DS.color.bgCampo : DS.color.primaria,
  border: 'none', color: desabilitado ? DS.color.textoInerte : '#fff',
  fontSize: 13, fontWeight: 600, fontFamily: DS.font.display,
  cursor: desabilitado ? 'default' : 'pointer', whiteSpace: 'nowrap',
});

const girando: React.CSSProperties = { animation: 'girar 0.9s linear infinite' };

export const TelaDeExportar: FC<{
  /** As pistas desta gravação — o que vira o ZIP de stems. */
  pistas: { id: string; nome: string }[];
  /** Se há alguma pista com áudio para exportar. Sem isto, os dois botões de stem ficam mudos. */
  temStems: boolean;
  /** Se já existe uma guia gerada — a lista de Músicas já tem o que tocar. */
  temGuia: boolean;
  /** Qual exportação está em curso, para desabilitar o botão certo e mostrar "Preparando…". */
  emCurso: 'stems' | 'guia-wav' | 'guia-mp3' | null;
  aoBaixarStems: () => void;
  aoBaixarGuiaWav: () => void;
  aoBaixarGuiaMp3: () => void;
}> = ({ pistas, temStems, temGuia, emCurso, aoBaixarStems, aoBaixarGuiaWav, aoBaixarGuiaMp3 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 640 }}>
    <style>{'@keyframes girar { to { transform: rotate(360deg); } }'}</style>

    {/* ── STEMS ── */}
    <section>
      <h2 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: DS.color.texto }}>
        Stems
      </h2>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: DS.color.textoFraco, lineHeight: 1.5 }}>
        Cada pista, sozinha, num ZIP para levar a outro programa e continuar o trabalho lá.
        Sai em WAV, sem perda, com o volume e o panorama que você já ajustou aqui.
      </p>

      <div style={{
        border: `1px solid ${DS.color.borda}`, borderRadius: DS.raio.grande,
        background: DS.color.bgPainel, overflow: 'hidden',
      }}>
        {pistas.length === 0 ? (
          <div style={{ padding: 20, fontSize: 13, color: DS.color.textoFraco, textAlign: 'center' }}>
            Nenhuma pista para exportar ainda.
          </div>
        ) : (
          pistas.map((pista, i) => (
            <div
              key={pista.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                borderTop: i === 0 ? 'none' : `1px solid ${DS.color.borda}`,
              }}
            >
              <FiFileText size={14} color={DS.color.textoFraco} />
              <span style={{
                flex: 1, minWidth: 0, fontSize: 13, color: DS.color.texto,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {pista.nome}
              </span>
              <span style={{ fontSize: 11, color: DS.color.textoInerte, fontFamily: DS.font.mono }}>
                .wav
              </span>
            </div>
          ))
        )}
      </div>

      <button
        type='button'
        onClick={aoBaixarStems}
        disabled={!temStems || !!emCurso}
        style={{ ...botao(!temStems || !!emCurso), marginTop: 14 }}
        aria-label='Baixar todas as faixas num ZIP'
      >
        {emCurso === 'stems'
          ? <><FiLoader size={15} style={girando} /> Preparando o ZIP…</>
          : <><FiArchive size={15} /> Baixar stems (.zip)</>}
      </button>
    </section>

    {/* ── GUIA ── */}
    <section>
      <h2 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: DS.color.texto }}>
        Guia
      </h2>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: DS.color.textoFraco, lineHeight: 1.5 }}>
        A soma de todas as pistas num arquivo só, o mesmo que toca na lista de Músicas.
        {!temGuia && ' Ela é gerada ao sair do editor; abra a Timeline e feche para gerar a primeira.'}
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type='button'
          onClick={aoBaixarGuiaMp3}
          disabled={!temGuia || !!emCurso}
          style={botao(!temGuia || !!emCurso)}
          aria-label='Baixar a guia em MP3'
        >
          <IconeDeBaixar /> Baixar guia (.mp3)
        </button>

        <button
          type='button'
          onClick={aoBaixarGuiaWav}
          disabled={!temStems || !!emCurso}
          style={botao(!temStems || !!emCurso)}
          aria-label='Baixar a guia em WAV, sem perda'
        >
          {emCurso === 'guia-wav'
            ? <><FiLoader size={15} style={girando} /> Renderizando…</>
            : <><IconeDeBaixar /> Baixar guia (.wav)</>}
        </button>
      </div>
    </section>
  </div>
);
