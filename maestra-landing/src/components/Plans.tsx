import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { signupUrl } from '../config';

// Preços (estáticos na landing). Se mudarem no app, atualize aqui.
const MONTHLY = 39.9;
const ANNUAL = 335.16; // ~30% off do mensal × 12
const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const discount = Math.round((1 - ANNUAL / (MONTHLY * 12)) * 100);

const FREE = ['Veja o diagnóstico e o plano de ação', 'Visualize catálogo, agenda e equipe', 'Apenas leitura, sem edição'];
const PRO = [
  'Gestão de tarefas do plano de ação',
  'Edição em todos os perfis que você acessa',
  'Nyta IA — chat ilimitado',
  'Catálogo de faixas ilimitado',
  'Acesso a todos os perfis da conta',
];

export const Plans: React.FC = () => {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="planos" className="bg-black text-white py-20 px-5 md:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <span className="block text-xs font-bold tracking-[0.16em] uppercase text-gray-400 mb-4">Planos</span>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-7">Comece grátis, evolua quando quiser</h2>

          {/* Toggle Mensal / Anual */}
          <div className="inline-flex items-center gap-1 p-1 rounded-full border border-white/12 bg-white/5">
            <button
              onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-full text-sm font-bold transition-colors ${!annual ? 'bg-[#af2896] text-white' : 'text-gray-300 hover:text-white'}`}
            >
              Mensal
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-full text-sm font-bold transition-colors inline-flex items-center gap-2 ${annual ? 'bg-[#af2896] text-white' : 'text-gray-300 hover:text-white'}`}
            >
              Anual
              <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${annual ? 'bg-white/20 text-white' : 'bg-[#af2896]/20 text-[#d264bb]'}`}>-{discount}%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Grátis */}
          <div className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-7 flex flex-col">
            <h3 className="text-2xl font-bold mb-1">Grátis</h3>
            <p className="text-sm text-gray-400 mb-6">O essencial para acompanhar o plano e a carreira.</p>
            <div className="text-4xl font-bold mb-7">R$ 0</div>
            <ul className="space-y-3.5 mb-8 flex-grow">
              {FREE.map((f) => (
                <li key={f} className="flex items-start gap-3 text-[15px] text-gray-200">
                  <Check size={18} className="shrink-0 mt-0.5 text-gray-500" /> <span>{f}</span>
                </li>
              ))}
            </ul>
            <a href={signupUrl} className="block text-center border border-white/20 text-white font-bold py-3 rounded-full hover:border-white hover:bg-white/5 transition-colors">
              Criar conta grátis
            </a>
          </div>

          {/* Maestra PRO */}
          <div className="rounded-2xl border border-[#af2896]/40 bg-[#0c0c0c] p-7 flex flex-col relative">
            <span className="absolute -top-3 left-7 bg-[#af2896] text-white text-[11px] font-extrabold tracking-wide px-3 py-1 rounded-full">PRO</span>
            <h3 className="text-2xl font-bold mb-1 text-[#d264bb]">Maestra PRO</h3>
            <p className="text-sm text-gray-400 mb-6">Ferramentas para executar o plano e crescer mais rápido.</p>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-4xl font-bold">{fmt(annual ? ANNUAL : MONTHLY)}</span>
              <span className="text-sm text-gray-400">{annual ? '/ano' : '/mês'}</span>
            </div>
            <p className="text-[13px] text-gray-500 mb-7 h-5">{annual ? `equivale a ${fmt(ANNUAL / 12)}/mês` : ''}</p>
            <ul className="space-y-3.5 mb-8 flex-grow">
              {PRO.map((f) => (
                <li key={f} className="flex items-start gap-3 text-[15px] text-gray-200">
                  <Check size={18} className="shrink-0 mt-0.5 text-[#af2896]" /> <span>{f}</span>
                </li>
              ))}
            </ul>
            <a href={signupUrl} className="block text-center bg-[#af2896] text-white font-bold py-3 rounded-full hover:bg-[#c13fa8] transition-colors">
              Começar grátis
            </a>
            <p className="text-[12px] text-gray-500 mt-4 text-center">Cancele quando quiser.</p>
          </div>
        </div>
      </div>
    </section>
  );
};
