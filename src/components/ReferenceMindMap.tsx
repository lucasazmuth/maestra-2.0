import { FC } from 'react';

import type { ArtistReferences } from '../interfaces/maestra';

// Mapa mental de referências — componente ÚNICO usado em todo o sistema (wizard/Nyta chat e
// Plano de Ação avançado). Hub central + um círculo por categoria (Posicionamento/Artísticas no
// topo, Comunicação com o público/Carreira no rodapé) + um satélite por item, ligados por linhas
// pontilhadas. Nós e linhas dividem o MESMO espaço lógico 0–100 (viewBox idêntico), então nunca
// desalinham nem sobrepõem texto.
//
// Responsivo: o wrapper é um CSS container (inline-size) e as fontes usam cqw com clamp —
// no mobile o texto encolhe junto com os círculos em vez de estourar as bordas.

const splitRefItems = (s?: string): string[] =>
  (s || '').split(/[,;\n·]+/).map((x) => x.trim()).filter(Boolean);

// `color` pinta o círculo da categoria e o contorno dos satélites. `ink` é a MESMA cor
// escurecida, usada só no texto dos satélites (fundo branco): as cores cheias não têm contraste
// suficiente sobre claro — o amarelo #eab308 em texto branco fica praticamente invisível.
const REF_QUADRANTS: {
  key: 'posicionamento' | 'artisticas' | 'comunicacao' | 'gestao';
  label: string;
  color: string;
  ink: string;
  x: number;
  y: number;
}[] = [
  { key: 'posicionamento', label: 'Posicionamento', color: '#3b82f6', ink: '#1d4ed8', x: 30, y: 30 },
  { key: 'artisticas', label: 'Artísticas', color: '#eab308', ink: '#a16207', x: 70, y: 30 },
  { key: 'comunicacao', label: 'Comunicação com o público', color: '#f97316', ink: '#c2410c', x: 30, y: 70 },
  { key: 'gestao', label: 'Carreira', color: '#ef4444', ink: '#b91c1c', x: 70, y: 70 },
];

const HUB = { x: 50, y: 50 };
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const ReferenceMindMap: FC<{ references?: ArtistReferences }> = ({ references }) => {
  const refs = references || {};
  const pos = refs.posicionamento || {};
  const itemsFor = (key: (typeof REF_QUADRANTS)[number]['key']): string[] => {
    if (key === 'posicionamento') return [pos.curto, pos.medio, pos.longo].flatMap(splitRefItems);
    return splitRefItems(refs[key as 'artisticas' | 'comunicacao' | 'gestao']);
  };

  type MapNode = { x: number; y: number; label: string; color: string; ink?: string; kind: 'hub' | 'cat' | 'item' };
  const nodes: MapNode[] = [{ ...HUB, label: 'Referências', color: '#16a34a', kind: 'hub' }];
  const lines: { x1: number; y1: number; x2: number; y2: number; color: string }[] = [];

  REF_QUADRANTS.forEach((q) => {
    nodes.push({ x: q.x, y: q.y, label: q.label, color: q.color, kind: 'cat' });
    lines.push({ x1: HUB.x, y1: HUB.y, x2: q.x, y2: q.y, color: '#3a3a3a' });

    // Satélites: um por item, num "trilho" PERPENDICULAR ao eixo hub→categoria, ancorado logo
    // depois da categoria — assim não se acumulam no canto nem colam na categoria.
    const items = itemsFor(q.key).slice(0, 4);
    if (!items.length) return;
    const dx = q.x - HUB.x;
    const dy = q.y - HUB.y;
    const dist = Math.hypot(dx, dy);
    const baseAngle = Math.atan2(dy, dx);
    const perpAngle = baseAngle + Math.PI / 2;
    const anchorR = dist + 22;
    const ax = HUB.x + Math.cos(baseAngle) * anchorR;
    const ay = HUB.y + Math.sin(baseAngle) * anchorR;
    const spacing = 17;
    items.forEach((it, i) => {
      const t = items.length > 1 ? i - (items.length - 1) / 2 : 0;
      const ix = clamp(ax + Math.cos(perpAngle) * t * spacing, 8, 92);
      const iy = clamp(ay + Math.sin(perpAngle) * t * spacing, 8, 92);
      nodes.push({ x: ix, y: iy, label: it, color: q.color, ink: q.ink, kind: 'item' });
      lines.push({ x1: q.x, y1: q.y, x2: ix, y2: iy, color: `${q.color}80` });
    });
  });

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 480,
        margin: '0 auto',
        aspectRatio: '1 / 1',
        // Container query: as fontes dos nós escalam com a largura real do mapa (cqw).
        ['containerType' as string]: 'inline-size',
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        {lines.map((l, i) => (
          <line
            key={i}
            x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke={l.color}
            strokeWidth={1}
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {nodes.map((n, i) => {
        const isHub = n.kind === 'hub';
        const isCat = n.kind === 'cat';
        // Categorias pouco maiores que os itens (não dominam o mapa); itens com fôlego pra ler.
        const size = isHub ? '18%' : isCat ? '20%' : '16%';
        // Fonte proporcional ao container (1cqw = 1% da largura do mapa). O piso é baixo pra que,
        // no mapa pequeno do mobile (~270px), os rótulos longos ("Comunicação com o público")
        // caibam no círculo em vez de estourar. No desktop o cqw atinge o teto (não muda nada).
        const fontSize = isHub
          ? 'clamp(5.5px, 1.9cqw, 9px)'
          : isCat
            ? 'clamp(5px, 1.7cqw, 8px)'
            : 'clamp(5.5px, 1.8cqw, 8.5px)';
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${n.x}%`,
              top: `${n.y}%`,
              transform: 'translate(-50%, -50%)',
              width: size,
              aspectRatio: '1 / 1',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '4%',
              // Satélite branco com contorno da categoria: o preenchimento preto (#0e0e0e) vinha
              // do tema escuro e, no cartão claro, virava um disco opaco no meio do mapa.
              background: isHub || isCat ? n.color : '#fff',
              border: isHub || isCat ? 'none' : `1.5px solid ${n.color}`,
              // No satélite o texto usa a versão escurecida (ink) — a cor cheia da categoria não
              // tem contraste sobre branco (o amarelo some por completo).
              color: isHub ? '#fff' : isCat ? '#0b0b0b' : n.ink || n.color,
              fontWeight: isHub || isCat ? 800 : 700,
              fontSize,
              letterSpacing: isHub || isCat ? 0.3 : 0,
              textTransform: isHub || isCat ? 'uppercase' : 'none',
              lineHeight: 1.15,
              zIndex: isHub ? 3 : isCat ? 2 : 1,
              boxSizing: 'border-box',
            }}
          >
            {n.label}
          </div>
        );
      })}
    </div>
  );
};

export default ReferenceMindMap;
