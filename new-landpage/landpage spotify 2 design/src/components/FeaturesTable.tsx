import React from 'react';
import { CheckCircle2, Minus } from 'lucide-react';

const FeaturesTable: React.FC = () => {
  const features = [
    { name: 'Ouça música sem anúncios', free: false, premium: true },
    { name: 'Baixe pra ouvir no modo offline', free: false, premium: true },
    { name: 'Ouça músicas na ordem que quiser', free: false, premium: true },
    { name: 'Áudio de qualidade alta', free: false, premium: true },
    { name: 'Crie uma playlist com quem você quiser para ouvir ao mesmo tempo', free: false, premium: true },
    { name: 'Ouça as músicas na ordem que você quiser', free: false, premium: true },
    { name: 'Insights de stream (Sua Cápsula sonora)', free: false, premium: true },
  ];

  return (
    <section className="bg-black text-white py-20 px-4 md:px-8">
      <div className="max-w-[1000px] mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tighter">Experimente a diferença</h2>
          <h3 className="text-lg md:text-xl font-medium">Seja Premium e tenha controle total da sua conta. Cancele quando quiser.</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#333]">
                <th className="py-4 px-2 font-normal text-[#a7a7a7]">Benefícios</th>
                <th className="py-4 px-2 font-bold text-center w-[120px]">Plano Free<br/>do Spotify</th>
                <th className="py-4 px-2 font-bold text-center w-[150px]">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-4 h-4 bg-white rounded-full"></div>
                    Planos Premium<br/>do Spotify
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature, index) => (
                <tr key={index} className="border-b border-[#333] hover:bg-[#1a1a1a] transition-colors">
                  <td className="py-4 px-2 text-[15px]">{feature.name}</td>
                  <td className="py-4 px-2 text-center">
                    <div className="flex justify-center text-[#a7a7a7]">
                      <Minus size={24} strokeWidth={1.5} />
                    </div>
                  </td>
                  <td className="py-4 px-2 text-center">
                    <div className="flex justify-center text-white">
                      <CheckCircle2 size={24} className="fill-white text-black" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default FeaturesTable;