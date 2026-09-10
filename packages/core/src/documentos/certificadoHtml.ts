import { TINTA_DO_DOCUMENTO as T, URL_DA_MAESTRA } from './diagnostico';
import { AVISO_DO_CERTIFICADO, hashLegivel } from '../services/db/certificados';

// O CERTIFICADO DE AUTORIA em HTML — uma folha só, impressa nas duas superfícies.
//
// Mesmo caminho do deck do diagnóstico: o núcleo monta o texto, e quem imprime é o
// `expo-print` no app e o navegador na web. PDF com texto de verdade, e não uma foto da tela.
//
// A folha é A4 desenhada em 793×1120px, a MESMA medida do deck — o comentário em
// `diagnosticoHtml.ts` explica por que não são os 794×1123 que o A4 tem a 96dpi (a fração de
// ponto que sobra faz cada página vazar para uma segunda, em branco).
//
// ─── O que este documento tem de dizer ───────────────────────────────────────
//
// O aviso de que isto NÃO é registro de direito autoral não é rodapé miúdo: fica no corpo, em
// caixa própria, porque é a informação que impede alguém de confiar nele para a coisa errada.
// A palavra "certificado" num produto de música puxa ECAD e Biblioteca Nacional sozinha.

const escapar = (v: unknown): string => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export interface DadosDoCertificado {
  /** O nome da música, que é o que a pessoa reconhece. */
  musica: string;
  /** O nome da versão certificada ("guia vocal", "mix v2"). */
  versao: string;
  artista: string;
  autorNome: string;
  sha256: string;
  algoritmo: string;
  arquivoNome?: string | null;
  arquivoBytes?: number | null;
  /** O instante do carimbo, em ISO. */
  certificadoEm: string;
}

/** `1536000` → `1,5 MB`. Em MB porque é a unidade em que se fala de um arquivo de música. */
export const tamanhoLegivel = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) return '—';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb < 10 ? 1 : 0).replace('.', ',')} MB`;
};

/**
 * A data e a hora por extenso, no fuso de Brasília.
 *
 * O fuso é FIXO, e não o do aparelho: a data é a única coisa que este documento afirma, e ela
 * não pode mudar conforme quem abre o PDF esteja em Lisboa ou em São Paulo.
 */
export const carimboLegivel = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const data = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const hora = d.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
  });
  return `${data} às ${hora} (horário de Brasília)`;
};

const ESTILO = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; }
  .pg {
    width: 793px; height: 1120px; background: #fff; color: ${T.body};
    padding: 60px 64px; display: flex; flex-direction: column; overflow: hidden;
  }
  .cab { display: flex; align-items: center; justify-content: space-between;
    padding-bottom: 22px; border-bottom: 1px solid ${T.line}; }
  .marca { font-weight: 800; font-size: 17px; color: ${T.ink}; letter-spacing: -0.01em; }
  .chapeu { font-size: 11px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase;
    color: ${T.real}; }
  .corpo { flex: 1; display: flex; flex-direction: column; padding-top: 52px; }

  .titulo { font-weight: 800; font-size: 44px; line-height: 1.08; letter-spacing: -0.02em;
    color: ${T.ink}; margin: 0 0 14px; }
  .linhaFina { font-size: 17px; line-height: 1.55; color: ${T.dim}; margin: 0 0 40px; max-width: 560px; }

  .obra { padding: 26px 0; border-top: 1px solid ${T.line}; border-bottom: 1px solid ${T.line};
    margin-bottom: 34px; }
  .obraNome { font-weight: 800; font-size: 30px; line-height: 1.15; color: ${T.ink};
    margin-bottom: 8px; }
  .obraApoio { font-size: 15px; color: ${T.dim}; }

  .grade { display: flex; flex-wrap: wrap; gap: 26px 56px; margin-bottom: 34px; }
  .item { min-width: 190px; }
  .rotulo { font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase;
    color: ${T.mute}; margin-bottom: 7px; }
  .valor { font-size: 17px; line-height: 1.4; color: ${T.ink}; font-weight: 700; }

  .impressao { background: ${T.soft}; border: 1px solid ${T.line}; border-radius: 10px;
    padding: 22px 24px; margin-bottom: 30px; }
  /* Monoespaçada: um hash lê-se caractere a caractere, e é preciso poder alinhar duas cópias. */
  .hash { font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 15px; line-height: 1.9;
    color: ${T.ink}; word-break: break-all; }

  .aviso { border-left: 3px solid ${T.line}; padding: 4px 0 4px 18px; margin-top: auto;
    font-size: 13px; line-height: 1.65; color: ${T.mute}; max-width: 620px; }
  .rodape { display: flex; justify-content: space-between; align-items: baseline; gap: 16px;
    font-size: 12px; color: ${T.mute}; letter-spacing: 0.04em; padding-top: 18px;
    margin-top: 26px; border-top: 1px solid ${T.line}; }
`;

const item = (rotulo: string, valor: string) => `
  <div class="item">
    <div class="rotulo">${escapar(rotulo)}</div>
    <div class="valor">${escapar(valor)}</div>
  </div>`;

export const montarCertificadoDeAutoria = (dados: DadosDoCertificado): string => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" /><style>${ESTILO}</style></head><body>
  <div class="pg">
    <div class="cab">
      <div class="marca">Maestra</div>
      <div class="chapeu">Certificado de autoria</div>
    </div>

    <div class="corpo">
      <h1 class="titulo">Certificado de autoria</h1>
      <p class="linhaFina">
        Este documento registra que o arquivo de áudio identificado abaixo existia na data
        indicada, com exatamente este conteúdo.
      </p>

      <div class="obra">
        <div class="obraNome">${escapar(dados.musica)}</div>
        <div class="obraApoio">${escapar(dados.versao)} · ${escapar(dados.artista)}</div>
      </div>

      <div class="grade">
        ${item('Autoria declarada por', dados.autorNome)}
        ${item('Data do registro', carimboLegivel(dados.certificadoEm))}
        ${item('Arquivo', dados.arquivoNome || '—')}
        ${item('Tamanho', tamanhoLegivel(dados.arquivoBytes))}
      </div>

      <div class="impressao">
        <div class="rotulo">Impressão digital do arquivo (${escapar(dados.algoritmo)})</div>
        <div class="hash">${escapar(hashLegivel(dados.sha256))}</div>
      </div>

      <p class="aviso">${escapar(AVISO_DO_CERTIFICADO)}</p>

      <div class="rodape">
        <span>${escapar(dados.artista)}</span>
        <span>${escapar(URL_DA_MAESTRA.replace(/^https?:\/\//, ''))}</span>
      </div>
    </div>
  </div>
</body></html>`;
