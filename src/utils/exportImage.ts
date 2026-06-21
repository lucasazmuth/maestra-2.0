import { toPng, toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';

// Converte uma URL de imagem (ex.: foto do Spotify) em dataURL para embutir no
// cartão sem "sujar" o canvas por CORS. Em falha, retorna null (cai no placeholder).
export async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Ignora nós marcados com data-noexport (botões de ação, cartão off-screen).
const exportFilter = (node: HTMLElement) =>
  !(node instanceof HTMLElement && node.dataset?.noexport === '1');

// skipFonts: não embutir @font-face. Evita o crash do html-to-image ao tentar ler as regras da
// folha cross-origin do font-awesome (maxcdn) — SecurityError em cssRules + insertRule inválido,
// que fazia o toPng rejeitar e o PDF não baixar. O navegador já tem as fontes carregadas.
const OPTS = { pixelRatio: 2, cacheBust: true, backgroundColor: '#0a0a0e', filter: exportFilter, skipFonts: true } as const;
const PX_TO_MM = 0.2645833;

// Gera o PNG do nó e dispara o download.
export async function downloadNodePng(node: HTMLElement, fileName: string): Promise<void> {
  const dataUrl = await toPng(node, OPTS);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Gera um PDF do nó inteiro (entrega completa, mesmo design da tela) em uma
// página contínua do tamanho do conteúdo, e dispara o download.
export async function downloadNodePdf(node: HTMLElement, fileName: string): Promise<void> {
  const wMm = node.offsetWidth * PX_TO_MM;
  const hMm = node.scrollHeight * PX_TO_MM;
  const dataUrl = await toPng(node, { ...OPTS, width: node.offsetWidth, height: node.scrollHeight });
  const pdf = new jsPDF({ orientation: hMm > wMm ? 'p' : 'l', unit: 'mm', format: [wMm, hMm] });
  pdf.addImage(dataUrl, 'PNG', 0, 0, wMm, hMm);
  pdf.save(fileName);
}

// Remove temporariamente as folhas de estilo CROSS-ORIGIN (font-awesome/CDN) do documento.
// O html-to-image quebra ao tentar buscar/parsear o @font-face do font-awesome (SecurityError em
// cssRules + insertRule inválido). Sem elas, ele embute só as fontes locais (SpotifyMix) — mantendo
// a tipografia da marca no PDF. Retorna uma função que restaura tudo.
function suspendCrossOriginStylesheets(): () => void {
  const removed: { el: Element; parent: Node; next: Node | null }[] = [];
  document.querySelectorAll('link[rel="stylesheet"]').forEach((el) => {
    const href = (el as HTMLLinkElement).href || '';
    try {
      if (href && new URL(href, window.location.href).origin !== window.location.origin && el.parentNode) {
        removed.push({ el, parent: el.parentNode, next: el.nextSibling });
        el.parentNode.removeChild(el);
      }
    } catch { /* href inválido — ignora */ }
  });
  return () => removed.forEach(({ el, parent, next }) => parent.insertBefore(el, next));
}

// Gera um PDF A4 multipágina: cada nó vira uma página (deck de apresentação).
// O deck vive num container off-screen 0×0 (.shareStage); durante a captura sequencial alguma
// página pode reportar 0×0 num reflow e o toJpeg devolver vazio (jsPDF: "wrong PNG signature").
// Por isso pré-medimos (força layout) e passamos width/height/style explícitos — o clone do
// html-to-image renderiza no tamanho forçado mesmo se o nó vivo estiver 0×0.
export async function downloadPagesPdf(pages: HTMLElement[], fileName: string): Promise<void> {
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const W = 210;
  const H = 297;
  const dims = pages.map((p) => ({ w: p.offsetWidth || 794, h: p.offsetHeight || 1123 }));
  const restore = suspendCrossOriginStylesheets();
  try {
    let added = 0;
    for (let i = 0; i < pages.length; i++) {
      const { w, h } = dims[i];
      // JPEG (não PNG): o deck é escuro com gradientes; PNG sem compressão gerava ~85MB. JPEG q0.92
      // mantém a qualidade e derruba o arquivo para poucos MB. Fontes locais embutidas (sem skipFonts).
      const dataUrl = await toJpeg(pages[i], {
        pixelRatio: 2, cacheBust: true, backgroundColor: '#0a0a0e', quality: 0.92,
        width: w, height: h, style: { width: `${w}px`, height: `${h}px` },
      });
      if (!dataUrl || !dataUrl.startsWith('data:image/jpeg') || dataUrl.length < 100) continue;
      if (added > 0) pdf.addPage();
      pdf.addImage(dataUrl, 'JPEG', 0, 0, W, H);
      added += 1;
    }
    if (added === 0) throw new Error('PDF export: nenhuma página capturada');
    pdf.save(fileName);
  } finally {
    restore();
  }
}

// Gera um File PNG do nó (para o Web Share API). null se a captura falhar.
export async function nodeToPngFile(node: HTMLElement, fileName: string): Promise<File | null> {
  try {
    const dataUrl = await toPng(node, OPTS);
    const blob = await (await fetch(dataUrl)).blob();
    return new File([blob], fileName, { type: 'image/png' });
  } catch {
    return null;
  }
}
