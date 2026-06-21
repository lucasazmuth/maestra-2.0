import React from 'react';
import { ChevronDown } from 'lucide-react';

const FAQ: React.FC = () => {
  const faqs = [
    {
      q: "Como funciona o teste grátis do Spotify Premium?",
      a: "Caso nunca tenha assinado o Premium, você pode se qualificar para um teste grátis (ou com taxa reduzida).\n\nPara ter direito a testes, você precisa inserir uma forma de pagamento válida na inscrição. Vamos usar essa informação para confirmar seu país ou região e processar pagamentos caso você queira manter o Premium após o fim do teste.\n\nVamos lembrar você 7 dias antes do fim do teste. Sujeito a Termos e restrições por país."
    },
    {
      q: "Como faço pra cancelar meu plano Premium?",
      a: "Você pode cancelar o Premium quando quiser de forma online na página da sua conta.\n\nQuando você cancela uma assinatura Premium já paga, ela é válida até a próxima data de cobrança. Depois, sua conta muda para nosso serviço gratuito.\n\nSe o cancelamento for feito no período de teste grátis, você perde os benefícios do Premium na hora. Sua conta também muda para o serviço gratuito. Os testes grátis não podem ser reativados.\n\nSuas playlists e músicas salvas vão continuar na conta e você pode continuar curtindo com anúncios."
    },
    {
      q: "Como funciona o Premium Duo?",
      a: "O Premium Duo é um plano com desconto para pessoas que moram juntas. Comparado ao preço de duas contas do Premium Individual, também é mais barato. Vamos pedir seu endereço para garantir que vocês moram no mesmo lugar. Você pode convidar alguém para o plano logo após o pagamento. Cada participante tem sua própria conta do Premium e todos podem ouvir ao mesmo tempo de forma individual. E as playlists e músicas salvas não se misturam. Outros titulares da conta não podem ver o que você está ouvindo.\n\nLeia mais sobre o Duo."
    },
    {
      q: "Como funciona o Premium Família?",
      a: "O Premium Família é um plano para até 6 pessoas que moram juntas. Comparado ao preço total que cada um pagaria no Premium Individual, também é mais barato. Vamos pedir seu endereço para garantir que vocês moram no mesmo lugar. Você pode convidar pessoas para o plano logo após o pagamento. Cada participante tem sua própria conta do Premium e todos podem ouvir ao mesmo tempo de forma individual. E as playlists e músicas salvas não se misturam. Outros titulares da conta não podem ver o que você está ouvindo.\n\nMembros da família menores de 13 anos (ou idade equivalente no seu país) podem ser convidados para participar do seu plano com contas monitoradas. Nas contas monitoradas, jovens ouvintes têm uma conta só para eles, mas é você quem decide o que eles podem ouvir. Você pode gerenciar a reprodução de vídeos, conteúdos marcados como explícito e até remover artistas e músicas específicos.\n\nLeia mais sobre o Premium Família."
    },
    {
      q: "Como funciona o plano Premium Universitário?",
      a: "Se você tiver matrícula em uma instituição de ensino superior credenciada e qualificada para a oferta e tiver mais de 18 anos. Você pode aproveitar o Premium Universitário por até quatro anos.\n\nLeia mais sobre o Premium Universitário."
    },
    {
      q: "Quanto custa o Spotify Premium em Brasil?",
      a: "Os preços do Spotify Premium em Brasil são diferentes, dependendo do plano que você escolher: o plano Premium Individual tem o preço de R$ 23,90 por mês, o Premium Duo custa R$ 31,90 por mês, o Premium Família custa R$ 40,90 por mês, o Premium Universitário tem o valor de R$ 12,90 por mês. Caso nunca tenha assinado o Premium, você pode se qualificar para um teste grátis (ou com taxa reduzida). Sujeito a Termos e restrições por país."
    }
  ];

  return (
    <section className="bg-[#121212] text-white py-20 px-4 md:px-8">
      <div className="max-w-[800px] mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tighter">Alguma dúvida?</h2>
          <p className="text-base">Temos respostas que podem ajudar.</p>
          <p className="text-base">Encontre mais respostas no nosso <a href="#" className="underline">site de suporte.</a></p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <details key={index} className="group border-b border-[#333] pb-4">
              <summary className="flex justify-between items-center font-bold text-lg cursor-pointer list-none py-4 hover:text-[#1ed760] transition-colors">
                {faq.q}
                <ChevronDown className="transition-transform group-open:rotate-180" />
              </summary>
              <div className="text-[#a7a7a7] text-base leading-relaxed whitespace-pre-line pb-4">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQ;