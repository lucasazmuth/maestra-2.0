import { FC, ReactNode, useRef, useState } from 'react';
import {
  FiChevronDown, FiMaximize2, FiMusic, FiPause, FiPlay, FiPlus, FiSkipBack, FiSkipForward,
  FiTrash2, FiVolume2, FiVolumeX, FiX, FiZoomIn, FiZoomOut,
} from 'react-icons/fi';

import type { EstadoDaMesa } from '@maestra/core/audio/mesa';
import type { CatalogTrack, CatalogVersion } from '@maestra/core/interfaces/maestra';

import { Clipe } from './Clipe';
import casca from './editor.module.scss';
import {
  ALTURA_DA_PISTA, ALTURA_DA_REGUA, ALTURA_DO_TOPO, DS, DURACAO_MINIMA, ENCAIXE,
  LARGURA_DA_LATERAL, ZOOM_MAXIMO, ZOOM_MINIMO, ZOOM_PADRAO, corDaPista,
} from './tokens';

// O EDITOR: o Espaço JAM como um editor de música.
//
// O desenho é o do projeto de referência que o dono do produto deixou — a barra de topo em duas
// filas, a lateral de instrumentos, a régua em segundos, as faixas com a grelha, os clipes com
// a onda dentro, e a agulha. As dimensões e as cores estão em `tokens.ts`, à vírgula.
//
// ⚠️ ESTA TELA É ESCURA, e é a única do produto que é. Não é gosto: um editor de música é denso
// e de contraste alto porque se olha para ele durante horas e o que interessa são formas de
// onda, não texto. Ableton, Logic, Pro Tools, Reaper — todos escuros, e é o que o olho de quem
// trabalha com áudio espera encontrar.

const relogio = (segundos: number) => {
  const s = Math.max(0, segundos);
  const m = Math.floor(s / 60);
  const resto = Math.floor(s % 60);
  const centesimos = Math.floor((s % 1) * 100);
  return `${m}:${String(resto).padStart(2, '0')}.${String(centesimos).padStart(2, '0')}`;
};

const botaoDoTransporte = (ativo: boolean, cor?: string) => ({
  width: 28, height: 28,
  borderRadius: DS.radius.sm,
  background: ativo && cor ? `${cor}12` : 'transparent',
  border: `1px solid ${ativo && cor ? `${cor}55` : 'transparent'}`,
  color: ativo ? cor ?? DS.color.textSecondary : DS.color.textTertiary,
  cursor: ativo ? 'pointer' : 'default',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  opacity: ativo ? 1 : 0.3,
  transition: DS.transition.fast,
});

export interface AcoesDoEditor {
  aoSair: () => void;
  aoRenomear: (nome: string) => void;
  aoAbrirGravacao: (id: string) => void;
  aoAdicionarArquivos: (arquivos: File[], inicio: number, pistaId?: string) => void;
  aoMoverClipe: (clipeId: string, inicio: number) => void;
  aoCortarClipe: (clipeId: string, emSegundo: number) => void;
  aoApagarClipe: (clipeId: string) => void;
  aoMudarPista: (pistaId: string, parte: Partial<Pick<CatalogTrack, 'name' | 'gain' | 'muted'>>) => void;
  aoApagarPista: (pistaId: string) => void;
  aoSolar: (pistaId: string, solo: boolean) => void;
  /** Abre a sala da gravação — é lá que moram os comentários e o download. */
  aoAbrirCompleta: () => void;
}

export const EditorDaGravacao: FC<{
  titulo: string;
  selo: 'parado' | 'salvando' | 'salvo' | 'erro';
  gravacoes: CatalogVersion[];
  abertaId: string | null;
  principalId?: string | null;
  pistas: CatalogTrack[];
  /**
   * A pista que existe só na tela, e não no banco: a MIX de uma gravação ainda não montada.
   *
   * Ela toca e desenha-se como as outras, mas não se arrasta, não se corta e não se apaga —
   * não há linha nenhuma para gravar a mudança. O botão "montar em pistas" é que a transforma
   * em pista de verdade.
   */
  pistaFixaId?: string | null;
  /** Transforma a mix numa pista editável. Ausente quando não há o que montar. */
  aoMontar?: () => void;
  estado: EstadoDaMesa;
  picos: (clipeId: string, n: number) => number[];
  transporte: { alternar: () => void; irPara: (s: number) => void };
  /** Os campos da música (status, BPM, tom) — vestidos por quem chama, com estas cores. */
  ficha: ReactNode;
  podeEditar: boolean;
  acoes: AcoesDoEditor;
}> = ({
  titulo, selo, gravacoes, abertaId, principalId, pistas, pistaFixaId, aoMontar,
  estado, picos, transporte, ficha, podeEditar, acoes,
}) => {
  const [escala, setEscala] = useState(ZOOM_PADRAO);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [editandoNome, setEditandoNome] = useState(false);
  const [rascunhoDoNome, setRascunhoDoNome] = useState(titulo);
  const [gravacoesAbertas, setGravacoesAbertas] = useState(false);
  const [sobre, setSobre] = useState(false);

  const pista = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const arrasto = useRef<{ clipeId: string; deslocamentoX: number } | null>(null);
  const agulhaPresa = useRef(false);

  const duracao = Math.max(DURACAO_MINIMA, Math.ceil(estado.duracao) + 30);
  const largura = duracao * escala + 100;
  const agulha = estado.posicao;

  const aberta = gravacoes.find((v) => v.id === abertaId) ?? null;
  const totalDeClipes = pistas.reduce((soma, p) => soma + (p.clips?.length ?? 0), 0);

  /** O segundo correspondente a um ponto do rato, já com a rolagem descontada. */
  const segundoDoEvento = (evento: { clientX: number }) => {
    const caixa = pista.current;
    if (!caixa) return 0;
    const x = evento.clientX - caixa.getBoundingClientRect().left + caixa.scrollLeft;
    return Math.max(0, Math.min(x / escala, duracao));
  };

  const aoMover = (evento: React.MouseEvent) => {
    if (agulhaPresa.current) { transporte.irPara(segundoDoEvento(evento)); return; }
    const puxado = arrasto.current;
    if (!puxado) return;
    const bruto = segundoDoEvento(evento) - puxado.deslocamentoX / escala;
    // O encaixe é ao LARGAR, não durante: encaixar a cada pixel faz o clipe saltar debaixo do
    // dedo, e a pessoa deixa de saber onde ele vai cair.
    acoes.aoMoverClipe(puxado.clipeId, Math.max(0, bruto));
  };

  const aoLargar = (evento: React.MouseEvent) => {
    if (agulhaPresa.current) { agulhaPresa.current = false; return; }
    const puxado = arrasto.current;
    if (!puxado) return;
    arrasto.current = null;
    const bruto = segundoDoEvento(evento) - puxado.deslocamentoX / escala;
    acoes.aoMoverClipe(puxado.clipeId, Math.max(0, Math.round(bruto / ENCAIXE) * ENCAIXE));
  };

  return (
    <div
      className={casca.tela}
      style={{
        background: DS.color.bgBase,
        color: DS.color.textPrimary,
        fontFamily: DS.font.display,
      }}
    >
      {/* ══════════════════ TOPO ══════════════════ */}
      <div style={{
        height: ALTURA_DO_TOPO,
        background: DS.color.bgSurface,
        borderBottom: `1px solid ${DS.color.borderDefault}`,
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        {/* ── Fila 1: sair · nome · gravações · ficha ── */}
        <div style={{
          height: 52, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8,
          borderBottom: `1px solid ${DS.color.borderDefault}`,
          background: DS.color.bgRaised, flexShrink: 0,
        }}>
          <button
            type='button'
            onClick={acoes.aoSair}
            title='Voltar para Músicas'
            aria-label='Voltar para Músicas'
            style={{
              width: 28, height: 28, borderRadius: DS.radius.sm,
              background: DS.color.bgRaised, border: `1px solid ${DS.color.borderDefault}`,
              color: DS.color.textTertiary, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <FiX size={12} strokeWidth={2.2} />
          </button>

          <div style={{ width: 1, height: 16, background: DS.color.borderDefault, flexShrink: 0 }} />

          {editandoNome ? (
            <input
              autoFocus
              value={rascunhoDoNome}
              onChange={(e) => setRascunhoDoNome(e.target.value)}
              onBlur={() => { setEditandoNome(false); acoes.aoRenomear(rascunhoDoNome.trim() || titulo); }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              aria-label='Nome da música'
              style={{
                background: DS.color.bgRaised, border: `1px solid ${DS.color.primary}`,
                borderRadius: DS.radius.sm, color: DS.color.textPrimary,
                fontSize: 16, fontWeight: 600, padding: '3px 8px', outline: 'none',
                fontFamily: DS.font.display, minWidth: 160,
              }}
            />
          ) : (
            <div
              onClick={() => { if (podeEditar) { setRascunhoDoNome(titulo); setEditandoNome(true); } }}
              title={podeEditar ? 'Clique para renomear' : undefined}
              style={{
                fontSize: 16, fontWeight: 600, color: DS.color.textPrimary,
                cursor: podeEditar ? 'text' : 'default', letterSpacing: '-0.01em',
                userSelect: 'none', display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              {titulo}
            </div>
          )}

          <div style={{ flex: 1 }} />

          {selo !== 'parado' && (
            <div
              aria-live='polite'
              style={{
                fontSize: 10, fontFamily: DS.font.mono, letterSpacing: '0.03em', flexShrink: 0,
                color: selo === 'erro' ? DS.color.error : selo === 'salvando' ? DS.color.textTertiary : DS.color.success,
              }}
            >
              {selo === 'salvando' ? 'Salvando…' : selo === 'erro' ? 'Falha ao salvar' : 'Salvo'}
            </div>
          )}

          {/* A gravação aberta. É o seletor de "takes" da música: V1, V2, V3 são alternativas,
              ouve-se uma de cada vez — e é por isso que é um menu, e não mais pistas. */}
          {/* A sala da gravação: os comentários e o download vivem lá, e não cabem num editor
              sem lhe roubar a tela. */}
          <button
            type='button'
            onClick={acoes.aoAbrirCompleta}
            title='Abrir a sala desta gravação'
            aria-label='Abrir a sala desta gravação'
            style={{
              width: 28, height: 28, borderRadius: DS.radius.sm,
              background: 'transparent', border: `1px solid ${DS.color.borderDefault}`,
              color: DS.color.textTertiary, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <FiMaximize2 size={11} />
          </button>

          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type='button'
              onClick={() => setGravacoesAbertas((v) => !v)}
              aria-label='Trocar de gravação'
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: gravacoesAbertas ? `${DS.color.primary}18` : 'transparent',
                border: `1px solid ${gravacoesAbertas ? `${DS.color.primary}60` : DS.color.borderDefault}`,
                borderRadius: DS.radius.sm,
                color: gravacoesAbertas ? DS.color.primary : DS.color.textSecondary,
                padding: '4px 9px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
              }}
            >
              <FiMusic size={11} />
              {aberta ? `V${aberta.version_number}` : '—'}
              {aberta?.id === principalId && <span style={{ color: DS.color.warning }}>★</span>}
              <FiChevronDown size={10} />
            </button>

            {gravacoesAbertas && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 40,
                minWidth: 220, padding: 4,
                background: DS.color.bgRaised,
                border: `1px solid ${DS.color.borderStrong}`,
                borderRadius: DS.radius.md,
                boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
              }}>
                {gravacoes.map((gravacao) => (
                  <button
                    key={gravacao.id}
                    type='button'
                    onClick={() => { acoes.aoAbrirGravacao(gravacao.id); setGravacoesAbertas(false); }}
                    aria-label={`Abrir V${gravacao.version_number}${gravacao.title ? `, ${gravacao.title}` : ''}`}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 9px', borderRadius: DS.radius.sm,
                      background: gravacao.id === abertaId ? `${DS.color.primary}14` : 'transparent',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      color: gravacao.id === abertaId ? DS.color.primary : DS.color.textSecondary,
                      fontSize: 12, fontFamily: DS.font.display,
                    }}
                  >
                    <strong style={{ fontSize: 11 }}>V{gravacao.version_number}</strong>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {gravacao.title || 'Sem título'}
                    </span>
                    {gravacao.id === principalId && <span style={{ color: DS.color.warning }}>★</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Fila 2: adicionar · transporte · contadores ── */}
        {/* Três colunas, e não um centro absoluto como na referência: lá a direita tinha dois
            contadores; aqui tem o status, o BPM, o tom e o zoom, e um centro absoluto passava
            POR BAIXO deles. A grelha mantém o transporte no meio sem nunca o deixar colidir. */}
        <div className={casca.controlos} style={{ flex: 1, padding: '0 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {podeEditar && (
            <button
              type='button'
              onClick={() => entrada.current?.click()}
              aria-label='Adicionar pista'
              style={{
                background: 'rgba(233, 82, 22, 0.08)',
                border: '1px solid rgba(233, 82, 22, 0.31)',
                borderRadius: DS.radius.sm,
                color: DS.color.primary,
                fontSize: 12, fontWeight: 700, padding: '0 14px', height: 38,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                letterSpacing: '0.02em', textTransform: 'uppercase',
                fontFamily: DS.font.display, flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 15, lineHeight: 1, fontWeight: 800 }}>+</span>
              ADICIONAR PISTA
            </button>
          )}

          {!!aoMontar && (
            <button
              type='button'
              onClick={aoMontar}
              title='Transforma esta gravação numa pista que se pode arrastar e cortar'
              style={{
                background: 'transparent',
                border: `1px solid ${DS.color.borderStrong}`,
                borderRadius: DS.radius.sm, color: DS.color.textSecondary,
                fontSize: 11, fontWeight: 700, padding: '0 12px', height: 38,
                cursor: 'pointer', letterSpacing: '0.02em', textTransform: 'uppercase',
                fontFamily: DS.font.display, flexShrink: 0, whiteSpace: 'nowrap',
              }}
            >
              Montar em pistas
            </button>
          )}

          <input
            ref={entrada}
            type='file'
            accept='.mp3,.wav,audio/mpeg,audio/wav'
            multiple
            style={{ display: 'none' }}
            onChange={(evento) => {
              const escolhidos = Array.from(evento.target.files || []);
              evento.target.value = '';
              if (escolhidos.length) acoes.aoAdicionarArquivos(escolhidos, 0);
            }}
          />

          </div>

          {/* O transporte é o ponto fixo da tela: fica no meio, aconteça o que acontecer aos
              lados. */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 3, padding: '4px 5px',
            background: DS.color.bgSurface, borderRadius: DS.radius.md,
            border: `1px solid ${DS.color.borderDefault}`,
          }}>
            <button
              type='button'
              onClick={() => transporte.irPara(0)}
              title='Voltar ao início'
              aria-label='Voltar ao início'
              style={botaoDoTransporte(true)}
            >
              <FiSkipBack size={12} strokeWidth={2} />
            </button>

            <button
              type='button'
              onClick={transporte.alternar}
              disabled={!estado.tocando}
              title='Pausar'
              aria-label='Pausar'
              style={botaoDoTransporte(estado.tocando, '#FFC44D')}
            >
              <FiPause size={12} strokeWidth={2} />
            </button>

            <button
              type='button'
              onClick={transporte.alternar}
              disabled={estado.tocando || estado.carregando}
              title={estado.carregando ? 'Preparando as pistas' : 'Tocar'}
              aria-label={estado.carregando ? 'Preparando as pistas' : 'Tocar'}
              style={botaoDoTransporte(!estado.tocando && !estado.carregando, DS.color.success)}
            >
              <FiPlay size={12} strokeWidth={2} />
            </button>

            <button
              type='button'
              onClick={() => transporte.irPara(Math.min(agulha + 4, duracao))}
              title='Avançar'
              aria-label='Avançar quatro segundos'
              style={botaoDoTransporte(true)}
            >
              <FiSkipForward size={12} strokeWidth={2} />
            </button>

            <div style={{ width: 1, height: 16, background: DS.color.borderDefault, margin: '0 4px' }} />

            <div style={{
              fontFamily: DS.font.mono, fontSize: 12, color: DS.color.textPrimary,
              minWidth: 62, textAlign: 'center', letterSpacing: '0.02em',
            }}>
              {relogio(agulha)}
            </div>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, minWidth: 0,
            justifyContent: 'flex-end',
          }}>
          {ficha}

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button
              type='button'
              onClick={() => setEscala((z) => Math.max(ZOOM_MINIMO, Math.round(z / 1.5)))}
              title='Afastar'
              aria-label='Afastar a linha do tempo'
              style={{ ...botaoDoTransporte(true), cursor: 'pointer' }}
            >
              <FiZoomOut size={12} />
            </button>
            <button
              type='button'
              onClick={() => setEscala((z) => Math.min(ZOOM_MAXIMO, Math.round(z * 1.5)))}
              title='Aproximar'
              aria-label='Aproximar a linha do tempo'
              style={{ ...botaoDoTransporte(true), cursor: 'pointer' }}
            >
              <FiZoomIn size={12} />
            </button>
          </div>

          {/* Os contadores são o primeiro a sair quando a tela aperta: são informação, e o
              status, o BPM e o tom são controlos. */}
          <div className={casca.contadores} style={{
            fontSize: 10, color: DS.color.textTertiary, fontFamily: DS.font.mono,
            letterSpacing: '0.03em', flexShrink: 0, whiteSpace: 'nowrap',
          }}>
            {pistas.length} {pistas.length === 1 ? 'pista' : 'pistas'} · {totalDeClipes} {totalDeClipes === 1 ? 'clipe' : 'clipes'} · {relogio(estado.duracao)}
          </div>
          </div>
        </div>
      </div>

      {/* ══════════════════ CONTEÚDO ══════════════════ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ── LATERAL ── */}
        <div style={{
          width: LARGURA_DA_LATERAL, flexShrink: 0,
          background: DS.color.bgSurface,
          borderRight: `2px solid ${DS.color.gridMajor}`,
          display: 'flex', flexDirection: 'column', overflow: 'auto',
        }}>
          <div style={{
            height: ALTURA_DA_REGUA, flexShrink: 0,
            borderBottom: `1px solid ${DS.color.borderDefault}`,
            display: 'flex', alignItems: 'center', padding: '0 16px',
            fontSize: 10, color: DS.color.textTertiary, fontWeight: 600, letterSpacing: 1,
          }}>
            PISTAS
          </div>

          {pistas.length === 0 && (
            <div style={{
              padding: '20px 12px', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `${DS.color.primary}18`,
                border: `1px dashed ${DS.color.primary}60`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FiPlus size={18} color={DS.color.primary} strokeWidth={2} />
              </div>
              <p style={{ fontSize: 10, color: DS.color.textTertiary, textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
                Arraste os stems para cá<br />ou use ADICIONAR PISTA
              </p>
            </div>
          )}

          {pistas.map((faixa, indice) => {
            const cor = corDaPista(faixa.color_index ?? indice);
            const daMesa = estado.pistas.find((p) => p.id === faixa.id);
            const calada = Boolean(daMesa?.muda);
            return (
              <div
                key={faixa.id}
                style={{
                  height: ALTURA_DA_PISTA, flexShrink: 0,
                  borderBottom: `2px solid ${DS.color.borderSubtle}`,
                  borderLeft: `3px solid ${calada ? '#3A3A4A' : cor}`,
                  display: 'flex', flexDirection: 'column', justifyContent: 'center',
                  padding: '0 10px', gap: 5,
                  opacity: calada ? 0.55 : 1,
                  transition: 'opacity 0.2s, border-color 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 7,
                    background: `${cor}20`, border: `1px solid ${cor}35`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, boxShadow: `0 0 8px ${cor}22`,
                  }}>
                    <FiMusic size={15} color={cor} />
                  </div>
                  <input
                    value={faixa.name}
                    onChange={(e) => acoes.aoMudarPista(faixa.id, { name: e.target.value })}
                    disabled={!podeEditar || faixa.id === pistaFixaId}
                    aria-label={`Nome da pista ${faixa.name}`}
                    style={{
                      flex: 1, minWidth: 0, padding: 0, background: 'transparent', border: 'none',
                      outline: 'none', color: calada ? DS.color.textTertiary : DS.color.textPrimary,
                      fontSize: 12, fontWeight: 700, fontFamily: DS.font.display,
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 38 }}>
                  <button
                    type='button'
                    onClick={() => acoes.aoMudarPista(faixa.id, { muted: !calada })}
                    title={calada ? 'Ouvir' : 'Silenciar'}
                    aria-label={calada ? `Ouvir ${faixa.name}` : `Silenciar ${faixa.name}`}
                    aria-pressed={calada}
                    style={{
                      height: 20, padding: '0 7px', borderRadius: 4,
                      background: calada ? '#3A3A4A' : DS.color.bgCard,
                      border: `1px solid ${DS.color.borderDefault}`,
                      color: calada ? '#fff' : DS.color.textSecondary,
                      cursor: 'pointer', fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', gap: 3,
                    }}
                  >
                    {calada ? <FiVolumeX size={9} /> : <FiVolume2 size={9} />} M
                  </button>

                  {/* ⚠️ Solo e mudo têm CORES DIFERENTES. São ações opostas e as duas mais usadas
                      de uma mesa; pintadas iguais quando acesas, ninguém sabe qual carregou. */}
                  <button
                    type='button'
                    onClick={() => acoes.aoSolar(faixa.id, !daMesa?.solo)}
                    title={daMesa?.solo ? 'Ouvir tudo' : 'Ouvir só esta'}
                    aria-label={daMesa?.solo ? 'Ouvir tudo de novo' : `Ouvir só ${faixa.name}`}
                    aria-pressed={Boolean(daMesa?.solo)}
                    style={{
                      height: 20, padding: '0 8px', borderRadius: 4,
                      background: daMesa?.solo ? DS.color.warning : DS.color.bgCard,
                      border: `1px solid ${daMesa?.solo ? DS.color.warning : DS.color.borderDefault}`,
                      color: daMesa?.solo ? '#1A1A1A' : DS.color.textSecondary,
                      cursor: 'pointer', fontSize: 10, fontWeight: 700,
                    }}
                  >
                    S
                  </button>

                  <input
                    type='range'
                    min={0} max={100}
                    value={Math.round((daMesa?.ganho ?? faixa.gain ?? 1) * 100)}
                    onChange={(e) => acoes.aoMudarPista(faixa.id, { gain: Number(e.target.value) / 100 })}
                    disabled={!podeEditar}
                    aria-label={`Volume de ${faixa.name}`}
                    style={{ flex: 1, minWidth: 0, height: 20, accentColor: cor, cursor: 'pointer' }}
                  />

                  {podeEditar && faixa.id !== pistaFixaId && (
                    <button
                      type='button'
                      onClick={() => acoes.aoApagarPista(faixa.id)}
                      title='Apagar a pista'
                      aria-label={`Apagar a pista ${faixa.name}`}
                      style={{
                        height: 20, width: 22, borderRadius: 4,
                        background: 'transparent', border: `1px solid ${DS.color.borderDefault}`,
                        color: DS.color.textTertiary, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <FiTrash2 size={10} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── LINHA DO TEMPO ── */}
        <div
          ref={pista}
          onMouseMove={aoMover}
          onMouseUp={aoLargar}
          onMouseLeave={aoLargar}
          onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
          onDragLeave={() => setSobre(false)}
          onDrop={(e) => {
            e.preventDefault();
            setSobre(false);
            const arquivos = Array.from(e.dataTransfer.files);
            // Largar um ficheiro no segundo 12 põe o clipe no segundo 12: é o gesto que quem vem
            // de uma DAW já faz sem pensar.
            if (arquivos.length && podeEditar) {
              acoes.aoAdicionarArquivos(arquivos, Math.round(segundoDoEvento(e) / ENCAIXE) * ENCAIXE);
            }
          }}
          style={{
            flex: 1, overflow: 'auto', position: 'relative',
            cursor: arrasto.current ? 'grabbing' : 'default',
            outline: sobre ? `2px dashed ${DS.color.primary}` : 'none',
            outlineOffset: -2,
          }}
        >
          {/* Régua */}
          <div
            onMouseDown={(evento) => { agulhaPresa.current = true; transporte.irPara(segundoDoEvento(evento)); }}
            style={{
              height: ALTURA_DA_REGUA, width: largura,
              background: DS.color.bgRaised,
              borderBottom: `2px solid ${DS.color.gridMajor}`,
              position: 'sticky', top: 0, zIndex: 10,
              display: 'flex', cursor: 'pointer', userSelect: 'none',
            }}
          >
            {Array.from({ length: duracao + 1 }, (_, i) => (
              <div
                key={i}
                style={{
                  width: escala, flexShrink: 0, position: 'relative',
                  borderLeft: `1px solid ${i % 5 === 0 ? '#444458' : DS.color.gridMinor}`,
                }}
              >
                {/* Com pouco zoom, um número por segundo vira um borrão: de cinco em cinco. */}
                {(escala >= 40 || i % 5 === 0) && (
                  <div style={{ position: 'absolute', top: 4, left: 4, fontSize: 10, color: DS.color.textTertiary }}>
                    {i}s
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Faixas */}
          <div style={{ position: 'relative', width: largura }}>
            {pistas.map((faixa, indice) => {
              const cor = corDaPista(faixa.color_index ?? indice);
              return (
                <div
                  key={faixa.id}
                  style={{
                    height: ALTURA_DA_PISTA,
                    background: indice % 2 === 0 ? DS.color.rowAlt1 : DS.color.rowAlt2,
                    borderBottom: `2px solid ${DS.color.borderSubtle}`,
                    position: 'relative',
                  }}
                >
                  {Array.from({ length: duracao + 1 }, (_, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute', left: i * escala, top: 0, bottom: 0, width: 1,
                        background: i % 5 === 0 ? DS.color.gridMajor : DS.color.gridMinor,
                      }}
                    />
                  ))}

                  {(faixa.clips ?? []).map((clipe, ordem) => (
                    <Clipe
                      key={clipe.id}
                      clipe={clipe}
                      indice={ordem}
                      cor={cor}
                      // Uma barra a cada três pixels: um número fixo faz a onda de um clipe de
                      // meio segundo ficar rendilhada e a de quatro minutos virar um bloco.
                      picos={picos(clipe.id, Math.max(40, Math.min(900, Math.round(((Number(clipe.duration_seconds) || 0) * escala) / 3))))}
                      escala={escala}
                      agulha={agulha}
                      selecionado={selecionado === clipe.id}
                      fixo={faixa.id === pistaFixaId}
                      aoSelecionar={() => setSelecionado((atual) => (atual === clipe.id ? null : clipe.id))}
                      aoArrastar={(evento) => {
                        if (!podeEditar || faixa.id === pistaFixaId) return;
                        const caixa = pista.current;
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
                alignItems: 'center', justifyContent: 'center', gap: 10, pointerEvents: 'none',
                paddingTop: 80,
              }}>
                <p style={{ fontSize: 13, color: DS.color.textTertiary, margin: 0 }}>
                  Arraste os stems desta gravação para aqui.
                </p>
                {!!aoMontar && (
                  <button
                    type='button'
                    onClick={aoMontar}
                    style={{
                      pointerEvents: 'auto',
                      height: 34, padding: '0 16px',
                      background: 'rgba(233, 82, 22, 0.08)',
                      border: '1px solid rgba(233, 82, 22, 0.31)',
                      borderRadius: DS.radius.sm, color: DS.color.primary,
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                      textTransform: 'uppercase', cursor: 'pointer',
                      fontFamily: DS.font.display,
                    }}
                  >
                    Montar esta gravação em pistas
                  </button>
                )}
                <p style={{ fontSize: 11, color: DS.color.textDisabled, margin: 0, maxWidth: 420, textAlign: 'center', lineHeight: 1.6 }}>
                  WAV para sincronia exata. Stems em MP3 só alinham entre si se saíram do mesmo
                  programa: cada codificador acrescenta um silêncio de alguns milissegundos no início.
                </p>
              </div>
            )}

            {/* A agulha. Fica por cima de tudo, e é ela que diz onde o corte cai. */}
            <div
              onMouseDown={() => { agulhaPresa.current = true; }}
              style={{
                position: 'absolute', left: agulha * escala, top: 0,
                height: Math.max(pistas.length, 1) * ALTURA_DA_PISTA,
                width: 2, background: DS.color.primary,
                cursor: 'grab', zIndex: 100,
              }}
            >
              <div style={{
                position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
                width: 12, height: 12, borderRadius: '50%',
                background: DS.color.primary,
                boxShadow: `0 0 8px ${DS.color.primary}`,
              }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
