import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BRAND, BRAND_ONYX } from '@maestra/core/constants/brand';
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
      setErro(e instanceof Error ? e.message : 'Nao foi possivel entrar.');
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
              cornerRadius={12}
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
              ? <ActivityIndicator color={BRAND_ONYX} />
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
            placeholderTextColor="#a3b2ca"
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
            placeholderTextColor="#a3b2ca"
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
              ? <ActivityIndicator color="#fff" />
              : <Text style={estilos.texto}>Entrar</Text>}
          </Pressable>

          {erro && <Text style={estilos.erro}>{erro}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  conteudo: { padding: 28, gap: 12, flexGrow: 1, justifyContent: 'center' },
  marca: { fontSize: 36, fontWeight: '800', color: BRAND_ONYX, letterSpacing: -0.6 },
  legenda: { fontSize: 15, color: '#6b7280', marginBottom: 16 },
  botaoApple: { height: 52 },
  botaoClaro: {
    height: 52, borderRadius: 12, borderWidth: 1, borderColor: '#dde5f1',
    alignItems: 'center', justifyContent: 'center',
  },
  textoClaro: { fontSize: 16, fontWeight: '600', color: BRAND_ONYX },
  divisor: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 },
  fio: { flex: 1, height: 1, backgroundColor: '#e8eef8' },
  ou: { color: '#9ca3af', fontSize: 13 },
  campo: {
    height: 52, borderRadius: 12, borderWidth: 1, borderColor: '#dde5f1',
    paddingHorizontal: 16, fontSize: 16, color: '#405985',
  },
  botao: {
    height: 52, borderRadius: 12, backgroundColor: BRAND,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  texto: { fontSize: 16, fontWeight: '700', color: '#fff' },
  pressionado: { opacity: 0.75 },
  erro: { color: '#b32d45', fontSize: 14, lineHeight: 20, marginTop: 4 },
});
