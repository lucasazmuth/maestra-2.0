import { CSSProperties, FC } from 'react';

// Wordmark "Maestra Manager" — substitui a antiga marca gráfica "M" em todo o sistema.
// "Maestra" herda o peso do contexto (bold); "Manager" fica em peso regular pra diferenciar.
// Herda fonte, tamanho e cor do elemento pai — cada contexto controla isso via className/style.

// Selo "Beta" prateado (gradiente), bem pequeno e sobrescrito ao lado do wordmark.
// Escala com o tamanho do wordmark (em). Sinaliza que o produto está em versão beta.
const betaStyle: CSSProperties = {
  marginLeft: '0.4em',
  fontSize: '0.42em',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  verticalAlign: 'super',
  background: 'linear-gradient(105deg, #efeff4 0%, #b8b8c2 45%, #8f8f9a 60%, #e6e6ee 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  color: 'transparent',
  whiteSpace: 'nowrap',
};

export const Wordmark: FC<{
  className?: string;
  style?: CSSProperties;
  // Peso do "Manager" (400 = regular). Cor opcional só do "Manager" (ex.: acento).
  managerWeight?: number;
  managerColor?: string;
  // Mostra o selo "Beta" prateado ao lado (fora do PDF/share).
  beta?: boolean;
}> = ({ className, style, managerWeight = 400, managerColor, beta = false }) => (
  <span className={className} style={style}>
    Maestra <span style={{ fontWeight: managerWeight, ...(managerColor ? { color: managerColor } : null) }}>Manager</span>
    {beta && <span style={betaStyle}>Beta</span>}
  </span>
);

export default Wordmark;
