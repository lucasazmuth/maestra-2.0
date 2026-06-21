import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const ITEMS: { q: string; a: string }[] = [
  { q: 'O que é o diagnóstico REAL?', a: 'É uma análise da sua carreira em 4 dimensões (alcance, receita, audiência e legitimação), combinando dados reais do Spotify e das suas redes com o que você nos conta. O resultado é um dos 16 perfis de carreira e um retrato claro de onde você está.' },
  { q: 'Preciso pagar para ver o diagnóstico?', a: 'Não. O diagnóstico é grátis. O Maestra PRO é que libera o plano de ação completo, a Nyta IA e a gestão (catálogo, agenda e equipe).' },
  { q: 'O que está incluído no Maestra PRO?', a: 'Edição em todos os perfis que você acessa, gestão de tarefas do plano de ação, Nyta IA ilimitada, catálogo de faixas ilimitado e acesso a todos os perfis da conta.' },
  { q: 'Quanto custa?', a: 'R$ 39,90 por mês, ou R$ 335,16 no plano anual (cerca de 30% de desconto). Cancele quando quiser.' },
  { q: 'Como faço o pagamento?', a: 'Cartão de crédito (com renovação automática) ou PIX. Tudo processado com segurança via Asaas.' },
  { q: 'Posso cancelar quando quiser?', a: 'Sim. Você cancela a qualquer momento pela sua conta, sem burocracia.' },
];

export const Faq: React.FC = () => {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-black text-white py-20 px-5 md:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <span className="block text-xs font-bold tracking-[0.16em] uppercase text-gray-400 mb-4">Dúvidas</span>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Perguntas frequentes</h2>
        </div>

        <div className="divide-y divide-white/10 border-t border-b border-white/10">
          {ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="font-semibold text-[16px]">{item.q}</span>
                  <ChevronDown size={20} className={`shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && <p className="text-gray-300 leading-relaxed pb-5 -mt-1">{item.a}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
