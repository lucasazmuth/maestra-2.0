import { FC } from 'react';
import { useNavigate } from 'react-router-dom';

import { PaymentSuccessScreen } from '../../components/PaymentSuccessScreen';

// Sucesso da assinatura (Maestra Pro) — rota standalone, tela cheia centralizada.
const SubscriptionSuccess: FC = () => {
  const navigate = useNavigate();

  return (
    <PaymentSuccessScreen
      title='Bem-vindo ao Maestra Pro!'
      subtitle='Seu pagamento foi confirmado com sucesso.'
      description='Todos os recursos da plataforma estão desbloqueados: planejamento estratégico, catálogo ilimitado, equipe, IA e muito mais.'
      ctaLabel='Começar a usar'
      onCta={() => navigate('/artists', { replace: true })}
    />
  );
};

export default SubscriptionSuccess;
