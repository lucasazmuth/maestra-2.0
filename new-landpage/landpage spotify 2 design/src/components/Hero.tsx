import React from 'react';
import { Clock } from 'lucide-react';

const Hero: React.FC = () => {
  return (
    <section className="relative bg-[#121212] text-white overflow-hidden pt-16 pb-24 px-4 md:px-8">
      {/* Background Gradient matching screenshot */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#121212] via-[#121212] to-[#2a5a5a] opacity-80"></div>
      
      <div className="max-w-[1000px] mx-auto relative z-10">
        <h1 className="text-4xl md:text-[4rem] font-bold leading-tight mb-6 max-w-[800px] tracking-tighter">
          Tá acabando: 3 meses de Premium Individual por R$ 0
        </h1>
        <h2 className="text-xl md:text-2xl font-medium mb-8 max-w-[600px]">
          Curta músicas sem anúncios, modo offline e muito mais. Cancele quando quiser.
        </h2>
        
        <div className="flex items-center gap-2 mb-8 text-sm font-medium">
          <Clock size={20} />
          <p>A oferta termina em 4 dias</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-10">
          <a href="#" className="bg-[#7BC5C1] text-black font-bold py-3 px-8 rounded-full hover:scale-105 transition-transform text-center">
            Experimente 3 meses por R$ 0
          </a>
          <a href="#plans" className="bg-transparent border border-white text-white font-bold py-3 px-8 rounded-full hover:scale-105 transition-transform text-center">
            Ver todos os planos
          </a>
        </div>

        <p className="text-[11px] text-[#a7a7a7] max-w-[700px] leading-relaxed">
          Somente Premium Individual. Spotify Free por 3 meses, depois R$ 23,90 por mês. Oferta disponível apenas para quem nunca teve o Premium. <a href="#" className="underline">Sujeita a Termos</a>. Oferta válida até 22 de junho de 2026.
        </p>
      </div>
    </section>
  );
};

export default Hero;