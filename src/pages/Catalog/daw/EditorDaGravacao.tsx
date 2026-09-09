import { FC, ReactNode, useRef, useState } from 'react';
import {
  FiChevronDown, FiCircle, FiHeadphones, FiMaximize2, FiPause, FiPlay,
  FiSkipBack, FiSquare, FiTrash2, FiVolume2, FiVolumeX, FiX, FiZoomIn, FiZoomOut,
} from 'react-icons/fi';

import type { EstadoDaMesa } from '@maestra/core/audio/mesa';
import type { CatalogTrack, CatalogVersion } from '@maestra/core/interfaces/maestra';

import { Biblioteca, TIPO_DO_ARRASTO, type ItemDaBiblioteca } from './Biblioteca';
import { IconeDaTimeline, IconeDoMixer } from './icones';
import { Clipe } from './Clipe';
import casca from './editor.module.scss';
import {
  ALTURA_DA_PISTA, ALTURA_DA_REGUA, ALTURA_DO_TITULO, ALTURA_DO_TRANSPORTE, DS, DURACAO_MINIMA,
  ENCAIXE, LARGURA_DAS_PISTAS, PIXELS_POR_SEGUNDO, TIPOS_DE_PISTA,
  ZOOM_MAXIMO, ZOOM_MINIMO, corDaPista,
} from './tokens';

// O EDITOR: o Espaço JAM como um editor de música.
//
// O desenho é o da referência que o dono do produto mandou: a fila do título com as abas
// Timeline/Mixer e o Master à direita; a coluna das ferramentas e da biblioteca à esquerda; a
// coluna dos cabeçalhos de pista (tipo, M/S/AT, volume e panorama); e a linha do tempo com o
// transporte, a régua em segundos e a agulha vermelha.
//
// ⚠️ ESTA TELA É ESCURA, e é a única do produto que é. Não é gosto: um editor de música é denso
// e de contraste alto porque se olha para ele durante horas e o que interessa são formas de
// onda, não texto.

const relogio = (segundos: number) => {
  const s = Math.max(0, segundos);
  const m = Math.floor(s / 60);
  const resto = Math.floor(s % 60);
  const decimo = Math.floor((s % 1) * 10);
  return `${String(m).padStart(2, '0')}:${String(resto).padStart(2, '0')}.${decimo}`;
};

const botaozinho = (ativo: boolean, corAtiva?: string) => ({
  height: 24, minWidth: 28, padding: '0 7px',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 3,
  background: ativo && corAtiva ? corAtiva : DS.color.bgCampo,
  border: `1px solid ${ativo && corAtiva ? corAtiva : DS.color.borda}`,
  borderRadius: DS.raio.pequeno,
  color: ativo && corAtiva ? '#0d0d10' : DS.color.textoApoio,
  fontSize: 11, fontWeight: 700, cursor: 'pointer',
  fontFamily: DS.font.display,
});

export interface AcoesDoEditor {
  aoSair: () => void;
  aoRenomear: (nome: string) => void;
  aoAbrirGravacao: (id: string) => void;
  aoAbrirCompleta: () => void;
  /** `pistaAlvo` vazio cria uma pista nova para cada ficheiro. */
  aoAdicionarArquivos: (arquivos: File[], inicio: number, pistaAlvo?: string) => void;
  aoMoverClipe: (clipeId: string, inicio: number) => void;
  aoCortarClipe: (clipeId: string, emSegundo: number) => void;
  aoApagarClipe: (clipeId: string) => void;
  aoMudarPista: (pistaId: string, parte: Partial<CatalogTrack>) => void;
  aoApagarPista: (pistaId: string) => void;
  aoSolar: (pistaId: string, solo: boolean) => void;
  aoMestre: (valor: number) => void;
}

export const EditorDaGravacao: FC<{
  titulo: string;
  selo: 'parado' | 'salvando' | 'salvo' | 'erro';
  /** O lote em curso, se houver: dez stems levam um minuto, e um minuto sem sinal é um bug. */
  envio?: { feitos: number; total: number } | null;
  gravacoes: CatalogVersion[];
  abertaId: string | null;
  principalId?: string | null;
  pistas: CatalogTrack[];
  pistaFixaId?: string | null;
  aoMontar?: () => void;
  estado: EstadoDaMesa;
  picos: (clipeId: string, n: number) => number[];
  transporte: { alternar: () => void; parar: () => void; irPara: (s: number) => void };
  /** Os campos da música (status, BPM, tom), vestidos por quem chama. */
  ficha: ReactNode;
  podeEditar: boolean;
  acoes: AcoesDoEditor;
}> = ({
  titulo, selo, envio, gravacoes, abertaId, principalId, pistas, pistaFixaId, aoMontar,
  estado, picos, transporte, ficha, podeEditar, acoes,
}) => {
  const [aba, setAba] = useState<'linha' | 'mesa'>('linha');
  const [zoom, setZoom] = useState(1);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [editandoNome, setEditandoNome] = useState(false);
  const [rascunho, setRascunho] = useState(titulo);
  const [gravacoesAbertas, setGravacoesAbertas] = useState(false);
  const [biblioteca, setBiblioteca] = useState<ItemDaBiblioteca[]>([]);
  const [sobre, setSobre] = useState(false);

  const linha = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ clipeId: string; deslocamentoX: number } | null>(null);
  const agulhaPresa = useRef(false);

  const escala = PIXELS_POR_SEGUNDO * zoom;
  const duracao = Math.max(DURACAO_MINIMA, Math.ceil(estado.duracao) + 10);
  const largura = duracao * escala + 80;
  const agulha = estado.posicao;
  const aberta = gravacoes.find((v) => v.id === abertaId) ?? null;

  /** De quantos em quantos segundos a régua põe um número, para os rótulos não se colarem. */
  const passo = escala >= 80 ? 1 : escala >= 40 ? 2 : escala >= 20 ? 5 : 10;

  const segundoDoEvento = (evento: { clientX: number }) => {
    const caixa = linha.current;
    if (!caixa) return 0;
    const x = evento.clientX - caixa.getBoundingClientRect().left + caixa.scrollLeft;
    return Math.max(0, Math.min(x / escala, duracao));
  };

  const aoMover = (evento: React.MouseEvent) => {
    if (agulhaPresa.current) { transporte.irPara(segundoDoEvento(evento)); return; }
    const puxado = arrasto.current;
    if (!puxado) return;
    // O encaixe é ao LARGAR, não durante: encaixar a cada pixel faz o clipe saltar debaixo do
    // dedo, e a pessoa deixa de saber onde ele vai cair.
    acoes.aoMoverClipe(puxado.clipeId, Math.max(0, segundoDoEvento(evento) - puxado.deslocamentoX / escala));
  };

  const aoLargar = (evento: React.MouseEvent) => {
    if (agulhaPresa.current) { agulhaPresa.current = false; return; }
    const puxado = arrasto.current;
    if (!puxado) return;
    arrasto.current = null;
    const bruto = segundoDoEvento(evento) - puxado.deslocamentoX / escala;
    acoes.aoMoverClipe(puxado.clipeId, Math.max(0, Math.round(bruto / ENCAIXE) * ENCAIXE));
  };

  const escolherArquivos = (arquivos: File[], inicio: number, pistaAlvo?: string) => {
    if (!arquivos.length || !podeEditar) return;
    acoes.aoAdicionarArquivos(arquivos, inicio, pistaAlvo);
  };

  /**
   * O que largar numa faixa.
   *
   * Duas origens, um gesto: um ficheiro vindo da BIBLIOTECA (que só existe no computador até
   * este instante — é aqui que ele sobe) ou um vindo de fora do navegador.
   */
  const largarNaFaixa = (evento: React.DragEvent, faixaId: string) => {
    evento.preventDefault();
    evento.stopPropagation();
    setSobre(false);
    if (!podeEditar) return;
    const segundo = Math.round(segundoDoEvento(evento) / ENCAIXE) * ENCAIXE;

    const daBiblioteca = evento.dataTransfer.getData(TIPO_DO_ARRASTO);
    if (daBiblioteca) {
      const item = biblioteca.find((i) => i.id === daBiblioteca);
      if (item) escolherArquivos([item.arquivo], segundo, faixaId);
      return;
    }
    escolherArquivos(Array.from(evento.dataTransfer.files), segundo, faixaId);
  };

  // ─── As peças ─────────────────────────────────────────────────────────────

  const cabecalhoDaPista = (faixa: CatalogTrack, indice: number) => {
    const cor = corDaPista(faixa.color_index ?? indice);
    const daMesa = estado.pistas.find((p) => p.id === faixa.id);
    const calada = Boolean(daMesa?.muda);
    const fixa = faixa.id === pistaFixaId;
    const pan = daMesa?.pan ?? (Number(faixa.pan) || 0);

    return (
      <div
        key={faixa.id}
        style={{
          height: ALTURA_DA_PISTA, flexShrink: 0,
          padding: '10px 12px',
          display: 'flex', flexDirection: 'column', gap: 8,
          background: DS.color.bgPista,
          borderBottom: `1px solid ${DS.color.borda}`,
          borderLeft: `3px solid ${calada ? DS.color.textoInerte : cor}`,
          opacity: calada ? 0.6 : 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            value={faixa.name}
            onChange={(e) => acoes.aoMudarPista(faixa.id, { name: e.target.value })}
            disabled={!podeEditar || fixa}
            aria-label={`Nome da pista ${faixa.name}`}
            style={{
              flex: 1, minWidth: 0, padding: 0, background: 'transparent', border: 'none',
              outline: 'none', color: DS.color.texto, fontSize: 13, fontWeight: 600,
              fontFamily: DS.font.display,
            }}
          />
          {podeEditar && !fixa && (
            <button
              type='button'
              onClick={() => acoes.aoApagarPista(faixa.id)}
              title='Apagar a pista'
              aria-label={`Apagar a pista ${faixa.name}`}
              style={{
                background: 'transparent', border: 'none', color: DS.color.textoFraco,
                cursor: 'pointer', display: 'flex', padding: 2,
              }}
            >
              <FiTrash2 size={13} />
            </button>
          )}
        </div>

        <select
          value={faixa.kind ?? 'audio'}
          onChange={(e) => acoes.aoMudarPista(faixa.id, { kind: e.target.value as CatalogTrack['kind'] })}
          disabled={!podeEditar || fixa}
          aria-label={`Tipo da pista ${faixa.name}`}
          style={{
            width: '100%', height: 28, padding: '0 8px',
            background: DS.color.bgCampo, border: `1px solid ${DS.color.borda}`,
            borderRadius: DS.raio.pequeno, color: DS.color.texto,
            fontSize: 12, fontFamily: DS.font.display, outline: 'none',
            cursor: podeEditar && !fixa ? 'pointer' : 'default',
          }}
        >
          {TIPOS_DE_PISTA.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type='button'
            onClick={() => acoes.aoMudarPista(faixa.id, { muted: !calada })}
            aria-label={calada ? `Ouvir ${faixa.name}` : `Silenciar ${faixa.name}`}
            aria-pressed={calada}
            title={calada ? 'Ouvir' : 'Silenciar'}
            // ⚠️ Mudo e solo têm CORES DIFERENTES: são as duas ações mais usadas de uma mesa e
            // são opostas. Pintadas iguais quando acesas, ninguém sabe qual carregou.
            style={botaozinho(calada, DS.color.textoFraco)}
          >
            M
          </button>
          <button
            type='button'
            onClick={() => acoes.aoSolar(faixa.id, !daMesa?.solo)}
            aria-label={daMesa?.solo ? 'Ouvir tudo de novo' : `Ouvir só ${faixa.name}`}
            aria-pressed={Boolean(daMesa?.solo)}
            title={daMesa?.solo ? 'Ouvir tudo' : 'Ouvir só esta'}
            style={botaozinho(Boolean(daMesa?.solo), '#f59e0b')}
          >
            S
          </button>
          <button
            type='button'
            disabled
            title='Automação — ainda não disponível'
            style={{ ...botaozinho(false), color: DS.color.textoInerte, cursor: 'not-allowed' }}
          >
            AT
          </button>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <FiVolume2 size={13} color={DS.color.textoFraco} />
          <input
            type='range' min={0} max={100}
            value={Math.round((daMesa?.ganho ?? faixa.gain ?? 1) * 100)}
            onChange={(e) => acoes.aoMudarPista(faixa.id, { gain: Number(e.target.value) / 100 })}
            disabled={!podeEditar}
            aria-label={`Volume de ${faixa.name}`}
            style={{ flex: 1, minWidth: 0, accentColor: DS.color.primaria, cursor: 'pointer' }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <FiHeadphones size={13} color={DS.color.textoFraco} />
          <input
            type='range' min={-100} max={100}
            value={Math.round(pan * 100)}
            onChange={(e) => acoes.aoMudarPista(faixa.id, { pan: Number(e.target.value) / 100 })}
            disabled={!podeEditar}
            aria-label={`Panorama de ${faixa.name}`}
            style={{ flex: 1, minWidth: 0, accentColor: DS.color.primaria, cursor: 'pointer' }}
          />
          <span style={{
            width: 16, fontSize: 10, color: DS.color.textoFraco, fontFamily: DS.font.mono,
          }}>
            {/* C de centro; senão, o lado e quanto. */}
            {Math.abs(pan) < 0.02 ? 'C' : `${pan < 0 ? 'E' : 'D'}${Math.round(Math.abs(pan) * 100)}`}
          </span>
        </label>
      </div>
    );
  };

  return (
    <div className={casca.tela} style={{ background: DS.color.bgBase, color: DS.color.texto, fontFamily: DS.font.display }}>
      {/* ══════════ FILA DO TÍTULO ══════════ */}
      <div style={{
        height: ALTURA_DO_TITULO, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px',
        background: DS.color.bgPainel, borderBottom: `1px solid ${DS.color.borda}`,
      }}>
        <button
          type='button'
          onClick={acoes.aoSair}
          title='Voltar para Músicas'
          aria-label='Voltar para Músicas'
          style={{
            width: 28, height: 28, borderRadius: DS.raio.medio,
            background: DS.color.bgCampo, border: `1px solid ${DS.color.borda}`,
            color: DS.color.textoApoio, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <FiX size={13} />
        </button>

        {editandoNome ? (
          <input
            autoFocus
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            onBlur={() => { setEditandoNome(false); acoes.aoRenomear(rascunho.trim() || titulo); }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            aria-label='Nome da música'
            style={{
              background: DS.color.bgCampo, border: `1px solid ${DS.color.primaria}`,
              borderRadius: DS.raio.medio, color: DS.color.texto,
              fontSize: 17, fontWeight: 700, padding: '4px 10px', outline: 'none',
              fontFamily: DS.font.display, minWidth: 200,
            }}
          />
        ) : (
          <h1
            onClick={() => { if (podeEditar) { setRascunho(titulo); setEditandoNome(true); } }}
            title={podeEditar ? 'Clique para renomear' : undefined}
            style={{
              margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em',
              color: DS.color.texto, cursor: podeEditar ? 'text' : 'default',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320,
            }}
          >
            {titulo}
          </h1>
        )}

        {/* As duas vistas da mesma montagem: a linha do tempo e a mesa. */}
        <div style={{
          display: 'flex', gap: 2, padding: 3,
          background: DS.color.bgCampo, borderRadius: DS.raio.grande, flexShrink: 0,
        }}>
          {([['linha', 'Timeline'], ['mesa', 'Mixer']] as const).map(([chave, rotulo]) => (
            <button
              key={chave}
              type='button'
              onClick={() => setAba(chave)}
              aria-pressed={aba === chave}
              style={{
                height: 28, padding: '0 14px',
                display: 'flex', alignItems: 'center', gap: 6,
                background: aba === chave ? DS.color.bgHover : 'transparent',
                border: 'none', borderRadius: DS.raio.medio,
                color: aba === chave ? DS.color.texto : DS.color.textoFraco,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: DS.font.display,
              }}
            >
              {chave === 'linha' ? <IconeDaTimeline /> : <IconeDoMixer />}
              {rotulo}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0 }} />

        {ficha}

        {!!envio && (
          <span style={{ fontSize: 11, color: DS.color.primaria, fontFamily: DS.font.mono, flexShrink: 0 }}>
            Enviando {envio.feitos + 1} de {envio.total}…
          </span>
        )}

        {!envio && selo !== 'parado' && (
          <span
            aria-live='polite'
            style={{
              fontSize: 11, fontFamily: DS.font.mono, flexShrink: 0,
              color: selo === 'erro' ? DS.color.agulha : selo === 'salvando' ? DS.color.textoFraco : '#22c55e',
            }}
          >
            {selo === 'salvando' ? 'Salvando…' : selo === 'erro' ? 'Falha ao salvar' : 'Salvo'}
          </span>
        )}

        {/* A gravação aberta: V1, V2 e V3 são ALTERNATIVAS — ouve-se uma de cada vez —, e é por
            isso que são um menu, e não faixas empilhadas. */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            type='button'
            onClick={() => setGravacoesAbertas((v) => !v)}
            aria-label='Trocar de gravação'
            style={{
              display: 'flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px',
              background: DS.color.bgCampo, border: `1px solid ${DS.color.borda}`,
              borderRadius: DS.raio.medio, color: DS.color.texto,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {aberta ? `V${aberta.version_number}` : '—'}
            {aberta?.id === principalId && <span style={{ color: '#f59e0b' }}>★</span>}
            <FiChevronDown size={11} />
          </button>

          {gravacoesAbertas && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 40,
              minWidth: 240, padding: 4,
              background: DS.color.bgPainel, border: `1px solid ${DS.color.bordaForte}`,
              borderRadius: DS.raio.grande, boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}>
              {gravacoes.map((gravacao) => (
                <button
                  key={gravacao.id}
                  type='button'
                  onClick={() => { acoes.aoAbrirGravacao(gravacao.id); setGravacoesAbertas(false); }}
                  aria-label={`Abrir V${gravacao.version_number}${gravacao.title ? `, ${gravacao.title}` : ''}`}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: DS.raio.medio,
                    background: gravacao.id === abertaId ? DS.color.bgHover : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    color: gravacao.id === abertaId ? DS.color.texto : DS.color.textoApoio,
                    fontSize: 12, fontFamily: DS.font.display,
                  }}
                >
                  <strong style={{ fontSize: 11 }}>V{gravacao.version_number}</strong>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {gravacao.title || 'Sem título'}
                  </span>
                  {gravacao.id === principalId && <span style={{ color: '#f59e0b' }}>★</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type='button'
          onClick={acoes.aoAbrirCompleta}
          title='Abrir a sala desta gravação'
          aria-label='Abrir a sala desta gravação'
          style={{
            width: 28, height: 28, borderRadius: DS.raio.medio,
            background: 'transparent', border: `1px solid ${DS.color.borda}`,
            color: DS.color.textoFraco, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <FiMaximize2 size={12} />
        </button>

        {/* O MASTER: o fader que fica depois de todos os outros. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: DS.color.textoApoio }}>Master</span>
          <FiVolume2 size={14} color={DS.color.textoFraco} />
          <input
            type='range' min={0} max={100}
            value={Math.round(estado.mestre * 100)}
            onChange={(e) => acoes.aoMestre(Number(e.target.value) / 100)}
            aria-label='Volume geral'
            style={{ width: 120, accentColor: DS.color.primaria, cursor: 'pointer' }}
          />
          <span style={{ width: 34, fontSize: 12, color: DS.color.textoApoio, fontFamily: DS.font.mono }}>
            {Math.round(estado.mestre * 100)}%
          </span>
        </div>
      </div>

      {/* ══════════ CORPO ══════════ */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Biblioteca
          itens={biblioteca}
          aoAbrirPasta={setBiblioteca}
          // Em LOTE: um projeto de stems tem dez, doze faixas, e mandar uma a uma é o tipo de
          // trabalho que faz a pessoa desistir da tela.
          aoEnviar={(arquivos) => escolherArquivos(arquivos, 0)}
          podeEditar={podeEditar}
          aoMontar={aoMontar}
        />

        {/* ── Transporte + pistas ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            height: ALTURA_DO_TRANSPORTE, flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px',
            background: DS.color.bgPainel, borderBottom: `1px solid ${DS.color.borda}`,
          }}>
            <button
              type='button'
              onClick={() => transporte.irPara(0)}
              title='Voltar ao início'
              aria-label='Voltar ao início'
              style={{
                width: 32, height: 32, borderRadius: DS.raio.medio,
                background: 'transparent', border: 'none', color: DS.color.textoApoio,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <FiSkipBack size={16} />
            </button>

            <button
              type='button'
              onClick={transporte.alternar}
              disabled={estado.carregando}
              title={estado.carregando ? 'Preparando as pistas' : estado.tocando ? 'Pausar' : 'Tocar'}
              aria-label={estado.carregando ? 'Preparando as pistas' : estado.tocando ? 'Pausar' : 'Tocar'}
              style={{
                width: 42, height: 42, borderRadius: '50%',
                background: estado.carregando ? DS.color.bgCampo : DS.color.primaria,
                border: 'none', color: '#fff',
                cursor: estado.carregando ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: estado.carregando ? 'none' : `0 0 16px ${DS.color.primaria}55`,
              }}
            >
              {estado.tocando ? <FiPause size={18} /> : <FiPlay size={18} style={{ marginLeft: 2 }} />}
            </button>

            <button
              type='button'
              onClick={transporte.parar}
              title='Parar'
              aria-label='Parar'
              style={{
                width: 32, height: 32, borderRadius: DS.raio.medio,
                background: 'transparent', border: 'none', color: DS.color.textoApoio,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <FiSquare size={15} />
            </button>

            <button
              type='button'
              disabled
              title='Gravar — ainda não disponível'
              aria-label='Gravar — ainda não disponível'
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'transparent', border: `2px solid ${DS.color.gravar}`,
                color: DS.color.gravar, opacity: 0.4, cursor: 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <FiCircle size={11} fill='currentColor' />
            </button>

            <div style={{ flex: 1 }} />

            <div style={{
              padding: '6px 14px', borderRadius: DS.raio.medio,
              background: DS.color.bgCampo, border: `1px solid ${DS.color.borda}`,
              fontFamily: DS.font.mono, fontSize: 14, color: DS.color.texto, letterSpacing: '0.04em',
            }}>
              {relogio(agulha)}
            </div>

            <button
              type='button'
              onClick={() => setZoom((z) => Math.max(ZOOM_MINIMO, z / 1.5))}
              title='Afastar'
              aria-label='Afastar a linha do tempo'
              style={{
                width: 30, height: 30, borderRadius: DS.raio.medio, background: 'transparent',
                border: 'none', color: DS.color.textoApoio, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <FiZoomOut size={14} />
            </button>
            <span style={{ width: 42, textAlign: 'center', fontSize: 12, color: DS.color.textoApoio, fontFamily: DS.font.mono }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              type='button'
              onClick={() => setZoom((z) => Math.min(ZOOM_MAXIMO, z * 1.5))}
              title='Aproximar'
              aria-label='Aproximar a linha do tempo'
              style={{
                width: 30, height: 30, borderRadius: DS.raio.medio, background: 'transparent',
                border: 'none', color: DS.color.textoApoio, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <FiZoomIn size={14} />
            </button>
          </div>

          {aba === 'mesa' ? (
            <MesaDeCanais
              pistas={pistas}
              estado={estado}
              podeEditar={podeEditar}
              pistaFixaId={pistaFixaId}
              acoes={acoes}
            />
          ) : (
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
              {/* Cabeçalhos das pistas */}
              <div style={{
                width: LARGURA_DAS_PISTAS, flexShrink: 0,
                background: DS.color.bgPainel, borderRight: `1px solid ${DS.color.borda}`,
                overflowY: 'auto',
              }}>
                <div style={{
                  height: ALTURA_DA_REGUA,
                  borderBottom: `1px solid ${DS.color.borda}`,
                  display: 'flex', alignItems: 'center', padding: '0 12px',
                  fontSize: 10, letterSpacing: '0.08em', color: DS.color.textoFraco, fontWeight: 600,
                }}>
                  PISTAS
                </div>

                {pistas.map(cabecalhoDaPista)}

                {podeEditar && (
                  <button
                    type='button'
                    onClick={() => document.querySelector<HTMLButtonElement>('[aria-label="Escolher arquivos"]')?.click()}
                    aria-label='Adicionar pista'
                    style={{
                      width: '100%', height: 46,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      background: 'transparent', border: 'none',
                      borderBottom: `1px solid ${DS.color.borda}`,
                      color: DS.color.textoApoio, fontSize: 13, cursor: 'pointer',
                      fontFamily: DS.font.display,
                    }}
                  >
                    + Adicionar pista
                  </button>
                )}
              </div>

              {/* Linha do tempo */}
              <div
                ref={linha}
                onMouseMove={aoMover}
                onMouseUp={aoLargar}
                onMouseLeave={aoLargar}
                onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
                onDragLeave={() => setSobre(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setSobre(false);
                  if (!podeEditar) return;
                  // Fora de uma faixa: cada ficheiro vira uma PISTA nova, no segundo em que foi
                  // largado. É o gesto que quem vem de uma DAW já faz sem pensar.
                  const inicio = Math.round(segundoDoEvento(e) / ENCAIXE) * ENCAIXE;
                  const daBiblioteca = e.dataTransfer.getData(TIPO_DO_ARRASTO);
                  if (daBiblioteca) {
                    const item = biblioteca.find((i) => i.id === daBiblioteca);
                    if (item) escolherArquivos([item.arquivo], inicio);
                    return;
                  }
                  escolherArquivos(Array.from(e.dataTransfer.files), inicio);
                }}
                style={{
                  flex: 1, minWidth: 0, overflow: 'auto', position: 'relative',
                  background: DS.color.bgFundoDaLinha,
                  outline: sobre ? `2px dashed ${DS.color.primaria}` : 'none',
                  outlineOffset: -2,
                }}
              >
                <div
                  onMouseDown={(evento) => { agulhaPresa.current = true; transporte.irPara(segundoDoEvento(evento)); }}
                  style={{
                    height: ALTURA_DA_REGUA, width: largura,
                    position: 'sticky', top: 0, zIndex: 10,
                    background: DS.color.bgPainel,
                    borderBottom: `1px solid ${DS.color.borda}`,
                    cursor: 'pointer', userSelect: 'none',
                  }}
                >
                  {Array.from({ length: Math.floor(duracao / passo) + 1 }, (_, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute', left: i * passo * escala, top: 0, bottom: 0,
                        paddingLeft: 6, borderLeft: `1px solid ${DS.color.grelhaForte}`,
                        fontSize: 10, color: DS.color.textoFraco, lineHeight: `${ALTURA_DA_REGUA}px`,
                      }}
                    >
                      {i * passo}s
                    </div>
                  ))}
                  <span style={{
                    position: 'absolute', right: 12, top: 0, lineHeight: `${ALTURA_DA_REGUA}px`,
                    fontSize: 10, color: DS.color.textoInerte,
                  }}>
                    Clique duplo num clipe para remover
                  </span>
                </div>

                <div style={{ position: 'relative', width: largura }}>
                  {pistas.map((faixa, indice) => {
                    const cor = corDaPista(faixa.color_index ?? indice);
                    return (
                      <div
                        key={faixa.id}
                        onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
                        onDrop={(e) => largarNaFaixa(e, faixa.id)}
                        style={{
                          height: ALTURA_DA_PISTA,
                          borderBottom: `1px solid ${DS.color.borda}`,
                          position: 'relative',
                        }}
                      >
                        {Array.from({ length: Math.floor(duracao / passo) + 1 }, (_, i) => (
                          <div
                            key={i}
                            style={{
                              position: 'absolute', left: i * passo * escala, top: 0, bottom: 0,
                              width: 1, background: DS.color.grelhaFraca,
                            }}
                          />
                        ))}

                        {(faixa.clips ?? []).map((clipe, ordem) => (
                          <Clipe
                            key={clipe.id}
                            clipe={clipe}
                            indice={ordem}
                            cor={cor}
                            // Uma barra a cada três pixels: um número fixo faz a onda de meio
                            // segundo ficar rendilhada e a de quatro minutos virar um bloco.
                            picos={picos(clipe.id, Math.max(40, Math.min(900, Math.round(((Number(clipe.duration_seconds) || 0) * escala) / 3))))}
                            escala={escala}
                            agulha={agulha}
                            altura={ALTURA_DA_PISTA}
                            selecionado={selecionado === clipe.id}
                            fixo={faixa.id === pistaFixaId}
                            aoSelecionar={() => setSelecionado((atual) => (atual === clipe.id ? null : clipe.id))}
                            aoArrastar={(evento) => {
                              if (!podeEditar || faixa.id === pistaFixaId) return;
                              const caixa = linha.current;
                              if (!caixa) return;
                              const x = evento.clientX - caixa.getBoundingClientRect().left + caixa.scrollLeft;
                              arrasto.current = {
                                clipeId: clipe.id,
                                deslocamentoX: x - (Number(clipe.start_seconds) || 0) * escala,
                              };
                            }}
                            aoCortar={() => { acoes.aoCortarClipe(clipe.id, agulha); setSelecionado(null); }}
                            aoApagar={() => { acoes.aoApagarClipe(clipe.id); setSelecionado(null); }}
                          />
                        ))}
                      </div>
                    );
                  })}

                  {pistas.length === 0 && (
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 8,
                      pointerEvents: 'none', paddingTop: 60,
                    }}>
                      <p style={{ margin: 0, fontSize: 13, color: DS.color.textoFraco }}>
                        Arraste os stems desta gravação para aqui.
                      </p>
                    </div>
                  )}

                  {/* A agulha. Fica por cima de tudo, e é ela que diz onde o corte cai. */}
                  <div
                    onMouseDown={() => { agulhaPresa.current = true; }}
                    style={{
                      position: 'absolute', left: agulha * escala, top: 0,
                      height: Math.max(pistas.length, 1) * ALTURA_DA_PISTA,
                      width: 2, background: DS.color.agulha, cursor: 'grab', zIndex: 100,
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                      width: 11, height: 11, borderRadius: '50%',
                      background: DS.color.agulha, boxShadow: `0 0 8px ${DS.color.agulha}`,
                    }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* O canto de ajuda da referência: o que os botões fazem, sem sair da tela. */}
      <details className={casca.ajuda}>
        <summary title='Ajuda' aria-label='Ajuda'>?</summary>
        <div>
          <strong>Como se monta</strong>
          <p>Arraste os stems para a linha do tempo, ou use <em>Enviar áudio</em>. Cada ficheiro
            vira uma pista; com uma <em>pista de destino</em> escolhida, vira um clipe nela.</p>
          <p>Arraste um clipe para o mover — ele encaixa de um quarto de segundo. Selecione-o e
            use <em>dividir</em> para o cortar onde a agulha está. Clique duplo remove.</p>
          <p><strong>M</strong> cala a pista, <strong>S</strong> deixa só ela. O primeiro
            controlo é o volume; o segundo, o panorama entre os dois alto-falantes.</p>
        </div>
      </details>
    </div>
  );
};

/**
 * A MESA: as mesmas pistas, vistas como canais.
 *
 * A linha do tempo responde "o que toca quando"; a mesa responde "como isto soa junto". É a
 * mesma montagem — o que muda é a pergunta, e por isso é uma aba e não outra tela.
 */
const MesaDeCanais: FC<{
  pistas: CatalogTrack[];
  estado: EstadoDaMesa;
  podeEditar: boolean;
  pistaFixaId?: string | null;
  acoes: AcoesDoEditor;
}> = ({ pistas, estado, podeEditar, acoes }) => (
  <div style={{
    flex: 1, minHeight: 0, overflow: 'auto', padding: 20,
    display: 'flex', gap: 14, alignItems: 'stretch',
    background: DS.color.bgFundoDaLinha,
  }}>
    {pistas.map((faixa, indice) => {
      const cor = corDaPista(faixa.color_index ?? indice);
      const daMesa = estado.pistas.find((p) => p.id === faixa.id);
      const calada = Boolean(daMesa?.muda);
      const pan = daMesa?.pan ?? (Number(faixa.pan) || 0);
      return (
        <div
          key={faixa.id}
          style={{
            width: 116, flexShrink: 0, padding: 12,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            background: DS.color.bgPista, border: `1px solid ${DS.color.borda}`,
            borderTop: `3px solid ${calada ? DS.color.textoInerte : cor}`,
            borderRadius: DS.raio.grande, opacity: calada ? 0.6 : 1,
          }}
        >
          <span style={{
            width: '100%', fontSize: 12, fontWeight: 600, color: DS.color.texto,
            textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {faixa.name}
          </span>

          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <input
              type='range' min={-100} max={100}
              value={Math.round(pan * 100)}
              onChange={(e) => acoes.aoMudarPista(faixa.id, { pan: Number(e.target.value) / 100 })}
              disabled={!podeEditar}
              aria-label={`Panorama de ${faixa.name} na mesa`}
              style={{ width: 84, accentColor: DS.color.primaria, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 10, color: DS.color.textoFraco, fontFamily: DS.font.mono }}>
              {Math.abs(pan) < 0.02 ? 'C' : `${pan < 0 ? 'E' : 'D'}${Math.round(Math.abs(pan) * 100)}`}
            </span>
          </label>

          {/* O fader vertical: é a forma de uma mesa, e é o que deixa comparar seis níveis de
              relance — deitados, seis linhas empilhadas não se comparam. */}
          <input
            type='range' min={0} max={100}
            value={Math.round((daMesa?.ganho ?? faixa.gain ?? 1) * 100)}
            onChange={(e) => acoes.aoMudarPista(faixa.id, { gain: Number(e.target.value) / 100 })}
            disabled={!podeEditar}
            aria-label={`Volume de ${faixa.name} na mesa`}
            style={{
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              writingMode: 'vertical-lr' as React.CSSProperties['writingMode'],
              direction: 'rtl', width: 28, height: 150,
              accentColor: cor, cursor: 'pointer',
            }}
          />

          <span style={{ fontSize: 11, color: DS.color.textoApoio, fontFamily: DS.font.mono }}>
            {Math.round((daMesa?.ganho ?? faixa.gain ?? 1) * 100)}
          </span>

          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type='button'
              onClick={() => acoes.aoMudarPista(faixa.id, { muted: !calada })}
              aria-label={calada ? `Ouvir ${faixa.name} na mesa` : `Silenciar ${faixa.name} na mesa`}
              aria-pressed={calada}
              style={botaozinho(calada, DS.color.textoFraco)}
            >
              {calada ? <FiVolumeX size={11} /> : <FiVolume2 size={11} />}
            </button>
            <button
              type='button'
              onClick={() => acoes.aoSolar(faixa.id, !daMesa?.solo)}
              aria-label={daMesa?.solo ? 'Ouvir tudo de novo na mesa' : `Ouvir só ${faixa.name} na mesa`}
              aria-pressed={Boolean(daMesa?.solo)}
              style={botaozinho(Boolean(daMesa?.solo), '#f59e0b')}
            >
              S
            </button>
          </div>
        </div>
      );
    })}

    {pistas.length === 0 && (
      <p style={{ margin: 'auto', fontSize: 13, color: DS.color.textoFraco }}>
        Sem pistas para misturar ainda.
      </p>
    )}
  </div>
);
