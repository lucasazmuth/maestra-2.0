import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LinearGradient } from 'expo-linear-gradient';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_ENTRADA, RAIO } from '@maestra/core/constants/design';
import { BotoesSociais } from '@/casca/BotoesSociais';
import { MaestraMarca } from '@/icones';
import { appleDisponivel, entrarComApple, entrarComEmail, entrarComGoogle } from '@/nucleo/entrar';

/** Recuperar senha e criar conta ainda so existem na web. */
const SITE = 'https://www.maestramanager.com';

type EmCurso = 'email' | 'apple' | 'google' | null;

export default function Entrar() {
  // A saída da tela é REATIVA à sessão, e não uma navegação no fim de cada handler — mas quem
  // reage não é esta tela, e sim o `PortaoDaSessao`.
  //
  // Esta tela já ficou sem nenhuma navegação: o login dava certo, a sessão era criada, e a tela
  // simplesmente não saía do lugar — sem erro, sem carregando, sem nada. Só entrava quem
  // reiniciava o app, porque aí a porta em `/` levava aos perfis.
  //
  // Reagir à sessão cobre os três caminhos de uma vez: e-mail, Apple (que troca o token por
  // sessão) e Google (que volta do navegador e chama `setSession`). Um `router.replace` no fim
  // de cada um deles precisaria ser lembrado três vezes, e o do Google voltaria de outra tela.
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [emCurso, setEmCurso] = useState<EmCurso>(null);
  const [erro, setErro] = useState<string | null>(null);
  // A folha da Apple so existe em iOS 13+; em qualquer outro lugar o botao nao deve aparecer.
  const [temApple, setTemApple] = useState(false);
  const [senhaVisivel, setSenhaVisivel] = useState(false);

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

  // ⚠️ ESTA TELA NÃO DECIDE MAIS PARA ONDE SE VAI DEPOIS DO LOGIN, e a ausência é a correção.
  //
  // Ela tinha `<Redirect href="/perfis" />` assim que houvesse sessão, e duas coisas estavam
  // erradas nisso:
  //
  // · o destino ignorava o consentimento, então discutia a rota com o `PortaoDoConsentimento`;
  // · e um `<Redirect>` VALE OUTRA VEZ A CADA RENDER da tela que o contém, enquanto ela não é
  //   desmontada. Apontado para a rota em que já se está, é um laço fechado.
  //
  // Quem manda agora é o `PortaoDaSessao`, num efeito — que corre uma vez por mudança.

  return (
    // O formulario vive num CARTAO branco no meio de um fundo com degrade — nao solto sobre
    // branco, como estava. As duas manchas radiais (azul e roxa) sao a assinatura da entrada.
    <LinearGradient colors={[COR_ENTRADA.fundoDe, COR_ENTRADA.fundoAte]} style={estilos.tela}>
      <SafeAreaView style={estilos.flex}>
        <KeyboardAvoidingView style={estilos.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
            <View style={estilos.cartao}>
              {/* A MARCA, e não o símbolo mais a palavra escrita: a web desenha "Maestra" com o
                  vetor do lettering, e escrever numa fonte do app dá outra logo — outro peso,
                  outro desenho das letras, e o símbolo preto ao lado de uma palavra azul. */}
              <View style={estilos.marcaLinha}>
                <MaestraMarca size={26} color={COR_ENTRADA.marca} />
              </View>

              <Text style={estilos.rotulo}>Acesse com:</Text>

              <View style={estilos.sociais}>
                <BotoesSociais
                  tipo="entrar"
                  temApple={temApple}
                  emCurso={emCurso === 'email' ? null : emCurso}
                  aoEntrar={(qual) => tentar(qual, qual === 'google' ? entrarComGoogle : entrarComApple)}
                />
              </View>

              <View style={estilos.divisor}>
                <View style={estilos.fio} />
                <Text style={estilos.ou}>ou</Text>
                <View style={estilos.fio} />
              </View>

              {/* Os campos levam um icone dentro, como na web — e o da senha, o olho pra revelar. */}
              <View style={estilos.campo}>
                <Feather name="mail" size={18} color={COR_ENTRADA.campoIcone} />
                <TextInput
                  style={estilos.entrada}
                  placeholder="E-mail"
                  placeholderTextColor={COR_ENTRADA.espacoReservado}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  editable={!ocupado}
                />
              </View>

              <View style={estilos.campo}>
                <Feather name="lock" size={18} color={COR_ENTRADA.campoIcone} />
                <TextInput
                  style={estilos.entrada}
                  placeholder="Senha"
                  placeholderTextColor={COR_ENTRADA.espacoReservado}
                  secureTextEntry={!senhaVisivel}
                  autoComplete="current-password"
                  value={senha}
                  onChangeText={setSenha}
                  editable={!ocupado}
                  onSubmitEditing={() => tentar('email', () => entrarComEmail(email, senha))}
                />
                <Pressable
                  onPress={() => setSenhaVisivel((v) => !v)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  <Feather
                    name={senhaVisivel ? 'eye-off' : 'eye'}
                    size={18}
                    color={COR_ENTRADA.campoIcone}
                  />
                </Pressable>
              </View>

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

              {/* Os dois apoios que a web tem embaixo do formulario. Eles abrem a WEB, e nao
                  telas do app: recuperar senha e criar conta ainda nao existem aqui, e um link
                  que nao leva a lugar nenhum e pior do que um que sai do app. */}
              <Pressable
                onPress={() => Linking.openURL(`${SITE}/esqueci-senha`)}
                accessibilityRole="link"
              >
                <Text style={estilos.linkSecundario}>Esqueceu sua senha?</Text>
              </Pressable>

              <Text style={estilos.rodape}>
                Você não possui cadastro?{' '}
                <Text
                  style={estilos.link}
                  onPress={() => router.push('/cadastro')}
                  accessibilityRole="link"
                >
                  Cadastre-se!
                </Text>
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const estilos = StyleSheet.create({
  // Os valores sao os do `AuthShell.module.scss` da web (ver `COR_ENTRADA`): e a tela que a
  // pessoa mais compara entre as duas superficies, porque e a primeira das duas.
  tela: { flex: 1 },
  flex: { flex: 1 },
  conteudo: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 28 },
  cartao: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingTop: 38,
    paddingHorizontal: 34,
    paddingBottom: 34,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COR_ENTRADA.contornoDoCartao,
    backgroundColor: COR.superficie,
    shadowColor: 'rgb(74, 99, 145)', shadowOpacity: 0.12, shadowRadius: 50,
    shadowOffset: { width: 0, height: 20 }, elevation: 8,
  },
  marcaLinha: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 30,
  },
  rotulo: { color: COR_ENTRADA.rotulo, fontSize: 12, fontWeight: '700', marginBottom: 12 },
  /** Só a folga até o divisor: a linha dos botões é do `BotoesSociais`. */
  sociais: { marginBottom: 20 },
  divisor: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  fio: { flex: 1, height: 1, backgroundColor: COR_ENTRADA.divisoria },
  ou: { color: COR_ENTRADA.divisoriaTexto, fontSize: 12 },
  campo: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 13, marginBottom: 12,
    borderRadius: RAIO.campoDeEntrada, borderWidth: 1, borderColor: COR_ENTRADA.campoContorno,
    backgroundColor: COR_ENTRADA.campoFundo,
  },
  entrada: { flex: 1, minWidth: 0, paddingVertical: 13, fontSize: 15, color: COR_ENTRADA.texto },
  // Pilula, como na web: e a assinatura visual da acao primaria na entrada.
  botao: {
    marginTop: 8, paddingVertical: 14, paddingHorizontal: 24,
    borderRadius: RAIO.pilula, backgroundColor: COR.primaria,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: 'rgb(51, 97, 255)', shadowOpacity: 0.24, shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 }, elevation: 6,
  },
  texto: { fontSize: 15, fontWeight: '800', color: COR.sobrePrimaria },
  pressionado: { opacity: 0.75 },
  erro: { color: COR_ENTRADA.erro, fontSize: 13, lineHeight: 19, marginTop: 12 },
  linkSecundario: {
    marginTop: 16, textAlign: 'center',
    color: COR_ENTRADA.linkSecundario, fontSize: 14, fontWeight: '700',
  },
  rodape: { marginTop: 26, textAlign: 'center', color: COR_ENTRADA.apoio, fontSize: 14 },
  link: { color: COR.primaria, fontWeight: '800' },
});
