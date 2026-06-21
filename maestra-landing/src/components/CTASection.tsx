import React from 'react';
import { ArrowRight } from 'lucide-react';
import { signupUrl } from '../config';

export const CTASection: React.FC = () => (
  <section className="bg-black text-white py-24 px-5 md:px-8 border-t border-white/10">
    <div className="max-w-2xl mx-auto text-center">
      <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-5">Comece com o diagnóstico grátis</h2>
      <p className="text-lg text-gray-300 leading-relaxed mb-9">
        Leva poucos minutos pra ver onde sua carreira está — e o primeiro passo pra onde ela pode ir.
      </p>
      <a
        href={signupUrl}
        className="inline-flex items-center justify-center gap-2 bg-[#af2896] text-white font-bold py-3.5 px-9 rounded-full hover:bg-[#c13fa8] transition-colors"
      >
        Começar grátis <ArrowRight size={18} />
      </a>
    </div>
  </section>
);
