import { ReactNode } from 'react';

import { ProvedorDoConsentimento } from '@maestra/core/hooks/useConsent';

import { useSessao } from '@/nucleo/sessao';

// O ESTADO DO CONSENTIMENTO, CONSULTADO UMA VEZ, NA RAIZ.
//
// O portão e a tela de coleta liam cada um a sua cópia, e a cópia do portão era a que mandava na
// rota. Quem entrava por Google ou Apple preenchia a data, marcava os aceites e tocava em
// Continuar; o servidor registrava tudo e devolvia `satisfied: true`; a tela seguia para as boas
// vindas — e o portão, ainda a dizer `satisfied: false`, devolvia a pessoa ao consentimento na
// primeira mudança de rota. A segunda tela vinha SEM o campo de data, porque o servidor já a
// tinha guardado, e com as caixas outra vez vazias. Parecia que o aceite não fora registrado, e
// tinha sido.
//
// Com um provider só, o `apply` da tela é o mesmo estado que o portão lê: ele fica sabendo no
// instante do envio, e não na próxima ida ao servidor. É exatamente o que a web faz desde o
// início (`ConsentProvider` em `App.tsx`) — e o comentário do núcleo já dizia porquê.
//
// De lambuja, a consulta deixa de sair em dobro: eram duas por entrada de tela, e as edge logs
// mostravam-nas aos pares.
//
// A sessão vem do Supabase, e não do slice de auth: o login social nunca passa por ele. Sem
// sessão o usuário é nulo, o núcleo não consulta nada e o estado fica nulo — que é o que o
// portão lê como "não há o que cobrar".
export const ConsentimentoDaConta = ({ children }: { children: ReactNode }) => {
  const { sessao } = useSessao();
  const usuario = sessao?.user;

  return (
    <ProvedorDoConsentimento usuario={usuario ? { id: usuario.id, email: usuario.email } : null}>
      {children}
    </ProvedorDoConsentimento>
  );
};
