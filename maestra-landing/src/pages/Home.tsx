import React from 'react';
import { Activity, Target, MessageCircle, LayoutGrid } from 'lucide-react';

import { Header } from '../components/Header';
import { Hero } from '../components/Hero';
import { FeaturesIntro } from '../components/FeaturesIntro';
import { FeatureSection } from '../components/FeatureSection';
import { Plans } from '../components/Plans';
import { Faq } from '../components/Faq';
import { CTASection } from '../components/CTASection';
import { Footer } from '../components/Footer';

const Home: React.FC = () => (
  <div className="min-h-screen bg-black">
    <Header />
    <main>
      <Hero />
      <FeaturesIntro />

      <FeatureSection
        badge="Diagnóstico REAL"
        title="Saiba exatamente onde sua carreira está"
        description="Um raio-X da sua carreira em quatro dimensões — alcance, receita, audiência e legitimação — combinando dados reais do Spotify e das suas redes com o que só você sabe."
        items={[
          'Índice REAL calculado a partir de dados reais, não achismo',
          'Descubra qual dos 16 perfis de carreira é o seu',
          'Onde seus ouvintes estão, playlists e referências',
        ]}
        icon={<Activity size={88} />}
      />

      <FeatureSection
        reverse
        badge="Plano de ação"
        title="Um plano construído com método, não com sorte"
        description="A metodologia da Anita Carvalho, destilada de mais de 30 anos de carreira e 313 planejamentos reais, transforma o diagnóstico em um plano de ação executável."
        items={[
          'Estratégias priorizadas pro seu momento',
          'Cronograma e modelagem financeira',
          'Construído por você, guiado pela metodologia',
        ]}
        icon={<Target size={88} />}
      />

      <FeatureSection
        badge="Nyta IA"
        title="Uma consultora de IA ao seu lado"
        description="A Nyta IA acompanha sua carreira em todos os módulos: tira dúvidas, sugere caminhos e ajuda a executar o plano — sempre no contexto dos seus dados."
        items={[
          'Chat de IA ilimitado',
          'Recomendações sob o contexto da sua carreira',
          'Presente no diagnóstico, no plano e na gestão',
        ]}
        icon={<MessageCircle size={88} />}
      />

      <FeatureSection
        reverse
        badge="Gestão completa"
        title="Catálogo, agenda e equipe num lugar só"
        description="Centralize a operação da sua carreira: organize suas faixas, acompanhe shows e lançamentos e traga sua equipe pra dentro."
        items={[
          'Catálogo de faixas ilimitado',
          'Agenda de shows e lançamentos',
          'Acesso a todos os perfis da conta',
        ]}
        icon={<LayoutGrid size={88} />}
      />

      <Plans />
      <Faq />
      <CTASection />
    </main>
    <Footer />
  </div>
);

export default Home;
