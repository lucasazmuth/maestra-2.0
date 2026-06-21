import React from 'react';
import { ArrowRight } from 'lucide-react';
import { signupUrl } from '../config';

export const Hero: React.FC = () => {
  return (
    <section id="top" className="bg-black text-white pt-40 pb-20 px-5 md:px-8">
      <div className="max-w-4xl mx-auto text-center">
        <span className="inline-block text-xs font-bold tracking-[0.2em] uppercase text-gray-400 mb-6">
          A carreira musical com método
        </span>
        <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight mb-6">
          O retrato da sua carreira e o plano pra ela crescer
        </h1>
        <p className="text-lg md:text-xl text-gray-300 leading-relaxed max-w-2xl mx-auto mb-10">
          Diagnóstico real, plano de ação estratégico e a Nyta IA como consultora — tudo num só lugar,
          guiado pela metodologia que já ajudou centenas de artistas.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href={signupUrl}
            className="inline-flex items-center justify-center gap-2 bg-[#af2896] text-white font-bold py-3.5 px-8 rounded-full hover:bg-[#c13fa8] transition-colors"
          >
            Começar grátis <ArrowRight size={18} />
          </a>
          <a
            href="#planos"
            className="inline-flex items-center justify-center gap-2 border border-white/25 text-white font-bold py-3.5 px-8 rounded-full hover:border-white hover:bg-white/5 transition-colors"
          >
            Ver planos
          </a>
        </div>
        <p className="text-sm text-gray-500 mt-5">Diagnóstico grátis · sem cartão pra começar</p>
      </div>

      {/* Espaço pro print do produto. Troque o conteúdo por um <img src="..."> real depois. */}
      <div className="max-w-5xl mx-auto mt-16 rounded-xl border border-white/10 overflow-hidden aspect-[16/9] bg-[#0c0c0c] flex items-center justify-center">
        <span className="text-gray-600 text-sm">Print do produto (diagnóstico / plano)</span>
      </div>
    </section>
  );
};
