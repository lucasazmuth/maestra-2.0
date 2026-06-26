import { FC } from 'react';
import { FiRotateCcw, FiRefreshCw, FiLock } from 'react-icons/fi';

// Banner do loop de crescimento: "Executou o plano e cresceu? Refaça o REAL pra ver sua fase subir."
// Reusado no Diagnóstico REAL e no Planejamento. `locked` mostra o cadeado (recurso PRO).
export const RedoRealBanner: FC<{ onRedo: () => void; locked?: boolean; marginTop?: number; marginBottom?: number }> = ({ onRedo, locked, marginTop = 16, marginBottom = 0 }) => (
  <div
    data-noexport="1"
    style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      marginTop, marginBottom, padding: '14px 18px', borderRadius: 12,
      background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.12)',
    }}
  >
    <FiRotateCcw size={18} style={{ color: '#8a8a92', flexShrink: 0 }} />
    <span style={{ color: '#cfcfd4', fontSize: 13.5 }}>
      Executou o plano e cresceu? <b style={{ color: '#fff' }}>Refaça o REAL</b> pra ver sua fase subir.
    </span>
    <button
      onClick={onRedo}
      title={locked ? 'Recurso PRO — assine para refazer' : 'Refaça o quiz e atualize seu perfil REAL'}
      style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '7px 14px', borderRadius: 9999, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
    >
      {locked ? <FiLock size={14} /> : <FiRefreshCw size={14} />} Refazer diagnóstico
    </button>
  </div>
);

export default RedoRealBanner;
