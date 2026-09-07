import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import * as AppleAuthentication from 'expo-apple-authentication';

import { COR_ENTRADA, RAIO } from '@maestra/core/constants/design';

import { GoogleIcon } from '@/icones';

// OS DOIS BOTÕES SOCIAIS, lado a lado.
//
// Lado a lado, e não empilhados: a diretriz 4.8 da App Store pede que o Sign in with Apple
// tenha a MESMA proeminência dos outros logins sociais, e empilhado o de cima vira o principal
// aos olhos de quem lê.
//
// O DA APPLE É O DO SISTEMA. As Human Interface Guidelines exigem o botão dela (ou um que siga
// as regras de marca ao pé da letra), e um próprio é motivo de rejeição. Ele só aceita três
// estilos e um raio de canto — não dá para pintar a borda nem o fundo. Por isso quem se ajusta
// é o do Google: mesmo fundo branco, mesmo contorno, mesmo raio, mesma altura.
//
// Os dois vivem aqui e não em cada tela porque já divergiram uma vez: entrar e cadastrar
// tinham cópias das mesmas medidas, e bastava alguém acertar uma para o par desencontrar.

/** A altura dos dois. O logotipo da Apple, dentro dela, sai com ~18 — daí o tamanho do "G". */
const ALTURA = 46;

export const BotoesSociais = ({ tipo, temApple, emCurso, aoEntrar }: {
  /** `cadastrar` troca o rótulo do botão da Apple, que o sistema desenha. */
  tipo: 'entrar' | 'cadastrar';
  temApple: boolean;
  emCurso: 'google' | 'apple' | null;
  aoEntrar: (qual: 'google' | 'apple') => void;
}) => (
  <View style={estilos.linha}>
    <Pressable
      style={({ pressed }) => [estilos.botao, pressed && estilos.pressionado]}
      disabled={emCurso !== null}
      onPress={() => aoEntrar('google')}
      accessibilityRole="button"
      accessibilityLabel="Continuar com Google"
    >
      {emCurso === 'google'
        ? <ActivityIndicator color={COR_ENTRADA.socialTexto} />
        : <GoogleIcon size={18} />}
    </Pressable>

    {temApple && (
      <View style={estilos.colunaDaApple}>
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={tipo === 'cadastrar'
            ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
            : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
          cornerRadius={RAIO.campoDeEntrada}
          style={estilos.botaoDaApple}
          onPress={() => aoEntrar('apple')}
        />
      </View>
    )}
  </View>
);

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', gap: 10 },
  botao: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    height: ALTURA,
    borderRadius: RAIO.campoDeEntrada, borderWidth: 1, borderColor: COR_ENTRADA.socialContorno,
    backgroundColor: COR_ENTRADA.socialFundo,
  },
  /** A coluna da Apple não leva contorno nem fundo próprios: o botão do sistema traz os dele. */
  colunaDaApple: { flex: 1, height: ALTURA },
  botaoDaApple: { flex: 1, height: ALTURA },
  pressionado: { opacity: 0.75 },
});
