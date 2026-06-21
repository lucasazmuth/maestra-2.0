import React from 'react';

interface PlanProps {
  badge?: string;
  title: string;
  price1: string;
  price2?: string;
  features: string[];
  buttonText1: string;
  buttonColor1: string;
  buttonText2?: string;
  terms: string;
}

const PlanCard: React.FC<PlanProps> = ({ badge, title, price1, price2, features, buttonText1, buttonColor1, buttonText2, terms }) => {
  return (
    <div className="bg-[#242424] rounded-xl p-6 flex flex-col h-full">
      {badge && (
        <div className="mb-4">
          <span className="bg-[#FFD2D7] text-black text-sm font-bold px-3 py-1 rounded-sm inline-block">
            {badge}
          </span>
        </div>
      )}
      
      <div className="flex items-center gap-2 mb-2">
        <div className="w-4 h-4 bg-white rounded-full"></div>
        <span className="font-bold text-sm">Premium</span>
      </div>
      
      <h3 className="text-3xl font-bold mb-2">{title}</h3>
      <p className="font-medium mb-1">{price1}</p>
      {price2 && <p className="text-sm text-[#a7a7a7] mb-6">{price2}</p>}
      {!price2 && <div className="mb-6"></div>}
      
      <hr className="border-[#333] mb-6" />
      
      <ul className="space-y-3 mb-8 flex-grow">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3 text-[15px]">
            <div className="mt-1 shrink-0 w-1.5 h-1.5 bg-white rounded-full"></div>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      
      <div className="space-y-3 mt-auto">
        <button 
          className="w-full text-black font-bold py-3 px-6 rounded-full hover:scale-105 transition-transform"
          style={{ backgroundColor: buttonColor1 }}
        >
          {buttonText1}
        </button>
        {buttonText2 && (
          <button className="w-full bg-transparent border border-[#878787] text-white font-bold py-3 px-6 rounded-full hover:scale-105 transition-transform hover:border-white">
            {buttonText2}
          </button>
        )}
      </div>
      
      <p className="text-[11px] text-[#a7a7a7] mt-6 leading-relaxed">
        {terms}
      </p>
    </div>
  );
};

const Plans: React.FC = () => {
  return (
    <section id="plans" className="bg-[#121212] text-white py-10 px-4 md:px-8">
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <PlanCard 
          badge="R$ 0 por 3 meses"
          title="Individual"
          price1="R$ 0 por 3 meses"
          price2="Depois é só R$ 23,90/mês"
          features={[
            "1 conta Premium",
            "Cancele quando quiser",
            "Faça uma assinatura ou pague uma vez só"
          ]}
          buttonText1="Experimente 3 meses por R$ 0"
          buttonColor1="#FFD2D7"
          buttonText2="Pagamento único"
          terms="Somente Premium Individual. Spotify Free por 3 meses, depois R$ 23,90 por mês. Oferta disponível apenas para quem nunca teve o Premium. Sujeita a Termos. Oferta válida até 22 de junho de 2026."
        />

        <PlanCard 
          badge="R$ 0 por 1 mês"
          title="Universitário"
          price1="R$ 0 por 1 mês"
          price2="Depois é só R$ 12,90/mês"
          features={[
            "1 conta Premium verificada",
            "Desconto para estudantes (que atendam aos critérios de qualificação)",
            "Cancele quando quiser",
            "Faça uma assinatura ou pague uma vez só"
          ]}
          buttonText1="Experimente 1 mês por R$ 0"
          buttonColor1="#C4B1D4"
          buttonText2="Pagamento único"
          terms="R$ 0 por 1 mês, depois R$ 12,90 por mês. Oferta reservada para estudantes matriculados em instituições de ensino superior credenciadas e elegíveis. Oferta não disponível para usuários que já experimentaram o Premium. Sujeito aos Termos e Condições do desconto para universitários do Spotify."
        />

        <PlanCard 
          title="Duo"
          price1="R$ 31,90/mês"
          features={[
            "2 contas Premium",
            "Cancele quando quiser",
            "Faça uma assinatura ou pague uma vez só"
          ]}
          buttonText1="Assinar o Premium Duo"
          buttonColor1="#FFC862"
          buttonText2="Pagamento único"
          terms="Para casais que moram juntos. Sujeito a Termos."
        />

        <PlanCard 
          title="Família"
          price1="R$ 40,90/mês"
          features={[
            "Até 6 contas Premium",
            "Controles parentais para o administrador do plano",
            "Pode criar contas para ouvintes menores de 16",
            "Cancele quando quiser",
            "Faça uma assinatura ou pague uma vez só"
          ]}
          buttonText1="Assinar o Premium Família"
          buttonColor1="#A5BBD1"
          buttonText2="Pagamento único"
          terms="Para até 6 familiares que moram juntos. Sujeito a Termos."
        />

      </div>
    </section>
  );
};

export default Plans;