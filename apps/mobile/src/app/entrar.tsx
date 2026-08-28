import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CONTORNO_DE_ENTRADA, COR, RAIO } from '@maestra/core/constants/design';
import { appleDisponivel, entrarComApple, entrarComEmail, entrarComGoogle } from '@/nucleo/entrar';

type EmCurso = 'email' | 'apple' | 'google' | null;

export default function Entrar() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [emCurso, setEmCurso] = useState<EmCurso>(null);
  const [erro, setErro] = useState<string | null>(null);
  // A folha da Apple so existe em iOS 13+; em qualquer outro lugar o botao nao deve aparecer.
  const [temApple, setTemApple] = useState(false);

  useEffect(() => {
    appleDisponivel().then(setTemApple);
  }, []);

  const tentar = async (qual: Exclude<EmCurso, null>, acao: () => Promise<unknown>) => {
    setErro(null);
    setEmCurso(qual);
    try {
      await acao();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível entrar.');
    } finally {
      setEmCurso(null);
    }
  };

  const ocupado = emCurso !== null;

  return (
    <SafeAreaView style={estilos.tela}>
      <KeyboardAvoidingView style={estilos.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
          <Text style={estilos.marca}>Maestra</Text>
          <Text style={estilos.legenda}>Entre para continuar de onde parou.</Text>

          {temApple && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={RAIO.campoDeEntrada}
              style={estilos.botaoApple}
              onPress={() => tentar('apple', entrarComApple)}
            />
          )}

          <Pressable
            style={({ pressed }) => [estilos.botaoClaro, pressed && estilos.pressionado]}
            disabled={ocupado}
            onPress={() => tentar('google', entrarComGoogle)}
          >
            {emCurso === 'google'
              ? <ActivityIndicator color={COR.titulo} />
              : <Text style={estilos.textoClaro}>Continuar com Google</Text>}
          </Pressable>

          <View style={estilos.divisor}>
            <View style={estilos.fio} />
            <Text style={estilos.ou}>ou</Text>
            <View style={estilos.fio} />
          </View>

          <TextInput
            style={estilos.campo}
            placeholder="E-mail"
            placeholderTextColor={COR.espaçoReservado}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={!ocupado}
          />
          <TextInput
            style={estilos.campo}
            placeholder="Senha"
            placeholderTextColor={COR.espaçoReservado}
            secureTextEntry
            autoComplete="current-password"
            value={senha}
            onChangeText={setSenha}
            editable={!ocupado}
            onSubmitEditing={() => tentar('email', () => entrarComEmail(email, senha))}
          />

          <Pressable
            style={({ pressed }) => [estilos.botao, (pressed || ocupado) && estilos.pressionado]}
            disabled={ocupado || !email || !senha}
            onPress={() => tentar('email', () => entrarComEmail(email, senha))}
          >
            {emCurso === 'email'
              ? <ActivityIndicator color={COR.sobrePrimaria} />
              : <Text style={estilos.texto}>Entrar</Text>}
          </Pressable>

          {erro && <Text style={estilos.erro}>{erro}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.superficie },
  flex: { flex: 1 },
  conteudo: { padding: 28, gap: 12, flexGrow: 1, justifyContent: 'center' },
  marca: { fontSize: 36, fontWeight: '800', color: COR.titulo, letterSpacing: -0.6 },
  legenda: { fontSize: 15, color: COR.secundario, marginBottom: 16 },
  // Os raios e contornos abaixo sao os do `AuthShell.module.scss` da web, nao arredondamentos
  // escolhidos aqui: a entrada e a tela que a pessoa compara entre as duas superficies.
  botaoApple: { height: 52, borderRadius: RAIO.campoDeEntrada },
  botaoClaro: {
    height: 52, borderRadius: RAIO.campoDeEntrada,
    borderWidth: 1, borderColor: CONTORNO_DE_ENTRADA.botao,
    alignItems: 'center', justifyContent: 'center',
  },
  textoClaro: { fontSize: 15, fontWeight: '700', color: COR.titulo },
  divisor: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 },
  fio: { flex: 1, height: 1, backgroundColor: COR.divisoria },
  ou: { color: COR.apagado, fontSize: 13 },
  campo: {
    height: 52, borderRadius: RAIO.campoDeEntrada,
    borderWidth: 1, borderColor: CONTORNO_DE_ENTRADA.campo,
    paddingHorizontal: 16, fontSize: 16, color: COR.texto,
  },
  // Pilula, como na web: e a assinatura visual da acao primaria na entrada.
  botao: {
    height: 52, borderRadius: RAIO.pilula, backgroundColor: COR.primaria,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  texto: { fontSize: 16, fontWeight: '800', color: COR.sobrePrimaria },
  pressionado: { opacity: 0.75 },
  erro: { color: COR.erro, fontSize: 14, lineHeight: 20, marginTop: 4 },
});
