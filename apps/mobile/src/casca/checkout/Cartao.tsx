import { StyleSheet, View } from 'react-native';

import {
  formatCardNumber, formatCep, formatCpfCnpj, formatExpiry, formatPhone,
} from '@maestra/core/utils/asaasForm';
import type { CheckoutForm } from '@maestra/core/hooks/useCheckoutForm';

import { Campo } from '@/casca/checkout/Campo';

// CPF/CNPJ é exigido no PIX e no cartão — por isso ele fica FORA do formulário do cartão, acima
// da escolha do meio de pagamento, como na web.
export const CampoDeCpf = ({ formulario }: { formulario: CheckoutForm }) => (
  <Campo
    rotulo="CPF ou CNPJ"
    icone="user"
    valor={formulario.cpf}
    aoMudar={(v) => formulario.setCpf(formatCpfCnpj(v))}
    espacoReservado="000.000.000-00"
    teclado="number-pad"
    erro={formulario.fieldErrors.cpfCnpj}
  />
);

// O formulário do cartão. As máscaras e as validações vêm do núcleo: são as mesmas da web, e a
// Asaas recusa o que fugir delas.
export const FormularioDoCartao = ({ formulario }: { formulario: CheckoutForm }) => {
  const e = formulario.fieldErrors;
  const endereco = formulario.resolvedAddress;
  return (
    <View style={estilos.pilha}>
      <Campo
        rotulo="Número do cartão"
        icone="credit-card"
        valor={formulario.cardNumber}
        aoMudar={(v) => formulario.setCardNumber(formatCardNumber(v))}
        espacoReservado="0000 0000 0000 0000"
        teclado="number-pad"
        erro={e.cardNumber}
      />
      <Campo
        rotulo="Nome impresso no cartão"
        icone="user"
        valor={formulario.cardName}
        aoMudar={(v) => formulario.setCardName(v.toUpperCase())}
        espacoReservado="Como aparece no cartão"
        maiusculas
        erro={e.cardName}
      />

      <View style={estilos.linha}>
        <View style={estilos.meio}>
          <Campo
            rotulo="Validade"
            icone="calendar"
            valor={formulario.cardExpiry}
            aoMudar={(v) => formulario.setCardExpiry(formatExpiry(v))}
            espacoReservado="MM/AA"
            teclado="number-pad"
            erro={e.cardExpiry}
          />
        </View>
        <View style={estilos.meio}>
          <Campo
            rotulo="CVV"
            icone="lock"
            valor={formulario.cardCvv}
            aoMudar={(v) => formulario.setCardCvv(v.replace(/\D/g, '').slice(0, 4))}
            espacoReservado="123"
            teclado="number-pad"
            maximo={4}
            erro={e.cardCvv}
          />
        </View>
      </View>

      <View style={estilos.linha}>
        <View style={estilos.meio}>
          <Campo
            rotulo="Celular"
            icone="smartphone"
            valor={formulario.phone}
            aoMudar={(v) => formulario.setPhone(formatPhone(v))}
            espacoReservado="(11) 99999-9999"
            teclado="phone-pad"
            erro={e.phone}
          />
        </View>
        <View style={estilos.meio}>
          <Campo
            rotulo="CEP"
            icone="map-pin"
            valor={formulario.cep}
            aoMudar={(v) => formulario.setCep(formatCep(v))}
            espacoReservado="00000-000"
            teclado="number-pad"
            carregando={formulario.cepLoading}
            erro={e.cep || formulario.cepLookupError || undefined}
            // O endereço que o ViaCEP devolveu: é a confirmação visual de que o CEP existe.
            dica={!formulario.cepLookupError && endereco?.localidade
              ? [endereco.bairro, `${endereco.localidade} – ${endereco.uf}`].filter(Boolean).join(', ')
              : undefined}
          />
        </View>
      </View>
    </View>
  );
};

const estilos = StyleSheet.create({
  pilha: { gap: 13 },
  linha: { flexDirection: 'row', gap: 12 },
  meio: { flex: 1, minWidth: 0 },
});
