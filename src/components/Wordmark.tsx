import { CSSProperties, FC } from 'react';

// Wordmark "Maestra Manager" — substitui a antiga marca gráfica "M" em todo o sistema.
// "Maestra" herda o peso do contexto (bold); "Manager" fica em peso regular pra diferenciar.
// Herda fonte, tamanho e cor do elemento pai — cada contexto controla isso via className/style.
export const Wordmark: FC<{
  className?: string;
  style?: CSSProperties;
  // Peso do "Manager" (400 = regular). Cor opcional só do "Manager" (ex.: acento).
  managerWeight?: number;
  managerColor?: string;
}> = ({ className, style, managerWeight = 400, managerColor }) => (
  <span className={className} style={style}>
    Maestra <span style={{ fontWeight: managerWeight, ...(managerColor ? { color: managerColor } : null) }}>Manager</span>
  </span>
);

export default Wordmark;
