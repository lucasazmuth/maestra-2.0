import React from 'react';
import { Check } from 'lucide-react';

const PaymentFeatures: React.FC = () => {
  const featuresList = [
    "Ouça música sem anúncios",
    "Baixe pra ouvir no modo offline",
    "Ouça músicas na ordem que quiser",
    "Áudio de qualidade alta",
    "Crie uma playlist com quem você quiser para ouvir ao mesmo tempo",
    "Ouça as músicas na ordem que você quiser",
    "Insights de stream (Sua Cápsula sonora)"
  ];

  return (
    <section className="bg-[#121212] text-white py-20 px-4 md:px-8">
      <div className="max-w-[1000px] mx-auto flex flex-col md:flex-row gap-12 justify-between items-start">
        
        <div className="flex-1">
          <h2 className="text-3xl font-bold mb-4 tracking-tighter">Planos acessíveis para qualquer situação</h2>
          <h3 className="text-base font-normal mb-8 text-[#a7a7a7]">
            Escolha um plano Premium e ouça música sem anúncios de forma ilimitada no seu celular, alto-falantes e em outros dispositivos. Vários métodos de pagamento. Cancele quando quiser.
          </h3>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Placeholder for payment icons */}
            <div className="bg-white text-black text-xs font-bold px-2 py-1 rounded">VISA</div>
            <div className="bg-white text-black text-xs font-bold px-2 py-1 rounded">MASTERCARD</div>
            <div className="bg-white text-black text-xs font-bold px-2 py-1 rounded">AMEX</div>
            <div className="bg-white text-black text-xs font-bold px-2 py-1 rounded">DINERS</div>
            <span className="text-sm text-[#a7a7a7] underline cursor-pointer ml-2">e + 14 outros</span>
          </div>
        </div>

        <div className="flex-1 w-full">
          <h3 className="text-xl font-bold mb-6">Recursos dos planos Premium</h3>
          <ul className="space-y-3">
            {featuresList.map((feature, index) => (
              <li key={index} className="flex items-start gap-3 text-[15px]">
                <Check size={20} className="shrink-0 mt-0.5" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </section>
  );
};

export default PaymentFeatures;