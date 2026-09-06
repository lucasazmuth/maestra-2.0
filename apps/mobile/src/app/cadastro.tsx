import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import * as AppleAuthentication from 'expo-apple-authentication';
import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';

import { COR, COR_ENTRADA, RAIO } from '@maestra/core/constants/design';
import { guardarConsentimentoPendente } from '@maestra/core/hooks/useConsent';
import { authActions } from '@maestra/core/store/slices/auth';
import { useAppDispatch } from '@maestra/core/store/store';
import { IDADE_MINIMA, ehMaiorDeIdade, idadeEmAnos } from '@maestra/core/utils/age';

import { CaixaDeAceite } from '@/casca/CaixaDeAceite';
import { GoogleIcon, MaestraMarca } from '@/icones';
import { appleDisponivel, entrarComApple, entrarComGoogle } from '@/nucleo/entrar';
import { useSessao } from '@/nucleo/sessao';

/** Os documentos legais vivem na web. */
const SITE = 'https://www.maestramanager.com';

// O CADASTRO, DENTRO DO APP.
//
// Ele ficava na web: o botão abria o navegador, e quem baixou o app para conhecer a Maestra
// tinha de terminar em outro lugar. Agora a conta nasce aqui, e a pessoa segue direto para o
// diagnóstico gratuito sem trocar de aplicativo.
//
// A LÓGICA É A MESMA DA WEB, e vem do núcleo: `signUp`, `verifySignupOtp` e `resendSignupOtp`
// são os thunks que `src/pages/Signup` usa, e as regras de idade e consentimento saem de
// `utils/age` e `hooks/useConsent`. O que existe aqui é o desenho.
//
// DUAS ETAPAS, porque o e-mail é confirmado por código: o formulário e o código de seis
// dígitos. Entre uma e outra o app SAI da meia-sessão que o Supabase devolve — sem isso, quem
// fechasse o app no meio do cadastro voltaria "logado" com o e-mail nunca confirmado.
//
// GOOGLE E APPLE criam a conta sem passar por aqui: quem nunca entrou vira usuário novo no
// primeiro toque. Eles estão nesta tela porque é onde quem quer se cadastrar chega — e não
// achar o caminho que já existe faz a pessoa preencher um formulário à toa. Não confirmam
// e-mail (o provedor já o confirmou) e por isso não passam pela etapa do código.

/** Segundos entre reenvios do código, como na web: menos que isso bate no limite do Supabase. */
const ESPERA_DO_REENVIO = 45;

const DIGITOS_DO_CODIGO = 6;

/** `DD/MM/AAAA` conforme se digita. A data ISO é montada só na hora de validar. */
const mascaraDeData = (cru: string) => {
  const d = cru.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

const paraISO = (visivel: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(visivel);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};


export default function Cadastro() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { sessao } = useSessao();

  const [etapa, setEtapa] = useState<'formulario' | 'codigo'>('formulario');
  // A folha da Apple só existe em iOS 13+; em qualquer outro lugar o botão não deve aparecer.
  const [temApple, setTemApple] = useState(false);
  const [social, setSocial] = useState<'google' | 'apple' | null>(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [nascimento, setNascimento] = useState('');
  const [aceite, setAceite] = useState(false);
  const [comunicacoes, setComunicacoes] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [espera, setEspera] = useState(0);

  useEffect(() => { appleDisponivel().then(setTemApple); }, []);

  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (espera <= 0) return undefined;
    relogio.current = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => { if (relogio.current) clearTimeout(relogio.current); };
  }, [espera]);

  // Quem já tem sessão não se cadastra. O `Redirect` fica DEPOIS dos hooks: sair antes deles
  // muda a ordem entre renderizações, e o React quebra.
  if (sessao && etapa === 'formulario') return <Redirect href="/perfis" />;

  const entrarPor = async (qual: 'google' | 'apple', acao: () => Promise<unknown>) => {
    setErro(null);
    setSocial(qual);
    try {
      await acao();
      // Não há navegação aqui: o portão da sessão vê a sessão nova e leva a pessoa adiante,
      // como na tela de entrar. O do Google ainda volta de outra tela, e um `replace` daqui se
      // perderia no caminho.
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível criar a conta.');
    } finally {
      setSocial(null);
    }
  };

  const criar = async () => {
    setErro(null);
    const nascimentoISO = paraISO(nascimento);

    if (!nome.trim()) { setErro('Informe seu nome.'); return; }
    if (!email.trim()) { setErro('Informe seu e-mail.'); return; }
    if (senha.length < 6) { setErro('A senha precisa ter ao menos 6 caracteres.'); return; }
    if (!nascimentoISO) { setErro('Informe sua data de nascimento.'); return; }
    if (idadeEmAnos(nascimentoISO) === null) { setErro('Essa data de nascimento não existe.'); return; }
    if (!ehMaiorDeIdade(nascimentoISO)) {
      setErro(`A Maestra é destinada a maiores de ${IDADE_MINIMA} anos.`);
      return;
    }
    if (!aceite) {
      setErro('É preciso aceitar os Termos de Uso e a Política de Privacidade.');
      return;
    }

    // O consentimento é guardado ANTES de criar a conta, e registrado pelo provedor assim que
    // houver sessão. É o mesmo caminho da web, pela mesma razão: enviar daqui falharia calado,
    // porque a chamada sai junto com a navegação que desmonta a tela.
    guardarConsentimentoPendente({
      email: email.trim(), birthDate: nascimentoISO, aceita: aceite, comunicacoes,
    });

    setEnviando(true);
    try {
      const r = await dispatch(authActions.signUp({
        email: email.trim(), password: senha, name: nome.trim(),
      })).unwrap();

      // Anti-enumeração do Supabase: com e-mail já cadastrado o `signUp` "passa", devolve um
      // usuário SEM identidades e não manda código nenhum. Sem esta conferência, a tela pediria
      // um código que nunca chegaria.
      if (r.user && Array.isArray(r.user.identities) && r.user.identities.length === 0) {
        setErro('Esse e-mail já tem uma conta. Entre por ela ou use "Esqueci minha senha".');
        return;
      }

      if (r.user?.email_confirmed_at) { router.replace('/criar-artista'); return; }

      await dispatch(authActions.signOut()).unwrap();
      setEtapa('codigo');
      setEspera(ESPERA_DO_REENVIO);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível criar a conta.');
    } finally {
      setEnviando(false);
    }
  };

  const confirmar = async (token = codigo) => {
    if (token.length < DIGITOS_DO_CODIGO || enviando) return;
    setErro(null);
    setEnviando(true);
    try {
      await dispatch(authActions.verifySignupOtp({ email: email.trim(), token })).unwrap();
      // Conta nova não tem perfil: o próximo passo é criar o primeiro, que é onde o
      // diagnóstico gratuito acontece. É a mesma decisão que a `/welcome` da web toma.
      router.replace('/criar-artista');
    } catch {
      setErro('Código inválido ou expirado.');
      setCodigo('');
    } finally {
      setEnviando(false);
    }
  };

  const reenviar = async () => {
    if (espera > 0 || enviando) return;
    setErro(null);
    setAviso(null);
    try {
      await dispatch(authActions.resendSignupOtp({ email: email.trim() })).unwrap();
      setAviso('Enviamos um código novo.');
      setEspera(ESPERA_DO_REENVIO);
    } catch {
      setErro('Não foi possível reenviar agora. Tente de novo em instantes.');
      setEspera(ESPERA_DO_REENVIO);
    }
  };

  return (
    <LinearGradient colors={[COR_ENTRADA.fundoDe, COR_ENTRADA.fundoAte]} style={estilos.tela}>
      <SafeAreaView style={estilos.flex}>
        <KeyboardAvoidingView
          style={estilos.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
            <View style={estilos.cartao}>
              {/* A MARCA, e não o símbolo mais a palavra escrita: escrever numa fonte do app
                  dá outra logo. É a mesma da tela de entrar, ao lado. */}
              <View style={estilos.marcaLinha}>
                <MaestraMarca size={26} color={COR_ENTRADA.marca} />
              </View>

              {etapa === 'formulario' ? (
                <>
                  <Text style={estilos.titulo}>Criar sua conta</Text>

                  {/* Lado a lado, e não empilhados: a diretriz 4.8 da App Store pede que o
                      Sign in with Apple tenha a MESMA proeminência dos outros logins sociais, e
                      empilhado o de cima vira o principal aos olhos de quem lê. */}
                  <View style={estilos.sociais}>
                    <Pressable
                      style={({ pressed }) => [estilos.social, pressed && estilos.pressionado]}
                      disabled={social !== null}
                      onPress={() => void entrarPor('google', entrarComGoogle)}
                      accessibilityRole="button"
                      accessibilityLabel="Continuar com Google"
                    >
                      {social === 'google'
                        ? <ActivityIndicator color={COR_ENTRADA.socialTexto} />
                        : <GoogleIcon size={18} />}
                    </Pressable>

                    {/* O botão da Apple é o OFICIAL, e não um `Pressable` com o texto "Apple":
                        as Human Interface Guidelines exigem o do sistema, e um próprio é motivo
                        de rejeição. `SIGN_UP` porque aqui a ação é criar conta. */}
                    {temApple && (
                      <View style={estilos.social__apple}>
                        <AppleAuthentication.AppleAuthenticationButton
                          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
                          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
                          cornerRadius={RAIO.campoDeEntrada}
                          style={estilos.botaoDaApple}
                          onPress={() => void entrarPor('apple', entrarComApple)}
                        />
                      </View>
                    )}
                  </View>

                  <View style={estilos.divisor}>
                    <View style={estilos.fio} />
                    <Text style={estilos.ou}>ou</Text>
                    <View style={estilos.fio} />
                  </View>

                  <View style={estilos.campo}>
                    <Feather name="user" size={18} color={COR_ENTRADA.campoIcone} />
                    <TextInput
                      style={estilos.entrada}
                      placeholder="Nome"
                      placeholderTextColor={COR_ENTRADA.espacoReservado}
                      value={nome}
                      onChangeText={setNome}
                      autoCapitalize="words"
                      accessibilityLabel="Nome"
                    />
                  </View>

                  <View style={estilos.campo}>
                    <Feather name="mail" size={18} color={COR_ENTRADA.campoIcone} />
                    <TextInput
                      style={estilos.entrada}
                      placeholder="E-mail"
                      placeholderTextColor={COR_ENTRADA.espacoReservado}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      accessibilityLabel="E-mail"
                    />
                  </View>

                  <View style={estilos.campo}>
                    <Feather name="lock" size={18} color={COR_ENTRADA.campoIcone} />
                    <TextInput
                      style={estilos.entrada}
                      placeholder="Senha"
                      placeholderTextColor={COR_ENTRADA.espacoReservado}
                      value={senha}
                      onChangeText={setSenha}
                      secureTextEntry={!senhaVisivel}
                      autoCapitalize="none"
                      accessibilityLabel="Senha"
                    />
                    <Pressable
                      onPress={() => setSenhaVisivel((v) => !v)}
                      accessibilityRole="button"
                      accessibilityLabel={senhaVisivel ? 'Ocultar a senha' : 'Mostrar a senha'}
                    >
                      <Feather
                        name={senhaVisivel ? 'eye-off' : 'eye'}
                        size={18}
                        color={COR_ENTRADA.campoIcone}
                      />
                    </Pressable>
                  </View>

                  <View style={estilos.campo}>
                    <Feather name="calendar" size={18} color={COR_ENTRADA.campoIcone} />
                    <TextInput
                      style={estilos.entrada}
                      placeholder="Data de nascimento"
                      placeholderTextColor={COR_ENTRADA.espacoReservado}
                      value={nascimento}
                      onChangeText={(t) => setNascimento(mascaraDeData(t))}
                      keyboardType="number-pad"
                      accessibilityLabel="Data de nascimento"
                    />
                  </View>

                  {/* A trava dos 18 anos não é enfeite de formulário: ela existe porque a
                      plataforma trata dados de carreira, e o servidor a repete. */}
                  <CaixaDeAceite
                    marcada={aceite}
                    aoTocar={() => setAceite((v) => !v)}
                    texto={(
                      <>
                        Li e aceito os{' '}
                        <Text
                          style={estilos.link}
                          onPress={() => { void Linking.openURL(`${SITE}/legal/termos`); }}
                        >
                          Termos de uso
                        </Text>
                        {' '}e a{' '}
                        <Text
                          style={estilos.link}
                          onPress={() => { void Linking.openURL(`${SITE}/legal/privacidade`); }}
                        >
                          Política de privacidade
                        </Text>.
                      </>
                    )}
                  />

                  <CaixaDeAceite
                    marcada={comunicacoes}
                    aoTocar={() => setComunicacoes((v) => !v)}
                    texto="Quero receber novidades e conteúdos da Maestra."
                  />

                  <Pressable
                    style={({ pressed }) => [estilos.botao, pressed && estilos.pressionado]}
                    onPress={criar}
                    disabled={enviando}
                    accessibilityRole="button"
                    accessibilityLabel="Criar conta"
                  >
                    {enviando
                      ? <ActivityIndicator color={COR.sobrePrimaria} />
                      : <Text style={estilos.texto}>Criar conta</Text>}
                  </Pressable>

                  {!!erro && <Text style={estilos.erro}>{erro}</Text>}

                  <Text style={estilos.rodape}>
                    Já possui cadastro?{' '}
                    <Text
                      style={estilos.link}
                      onPress={() => router.replace('/entrar')}
                      accessibilityRole="link"
                    >
                      Entrar
                    </Text>
                  </Text>
                </>
              ) : (
                <>
                  <Text style={estilos.titulo}>Confirme seu e-mail</Text>
                  <Text style={estilos.apoio}>
                    Enviamos um código de {DIGITOS_DO_CODIGO} dígitos para {email.trim()}.
                  </Text>

                  <TextInput
                    style={estilos.codigo}
                    value={codigo}
                    onChangeText={(t) => {
                      const so = t.replace(/\D/g, '').slice(0, DIGITOS_DO_CODIGO);
                      setCodigo(so);
                      if (so.length === DIGITOS_DO_CODIGO) void confirmar(so);
                    }}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoFocus
                    accessibilityLabel="Código de confirmação"
                  />

                  <Pressable
                    style={({ pressed }) => [estilos.botao, pressed && estilos.pressionado]}
                    onPress={() => void confirmar()}
                    disabled={enviando || codigo.length < DIGITOS_DO_CODIGO}
                    accessibilityRole="button"
                    accessibilityLabel="Confirmar"
                  >
                    {enviando
                      ? <ActivityIndicator color={COR.sobrePrimaria} />
                      : <Text style={estilos.texto}>Confirmar</Text>}
                  </Pressable>

                  {!!erro && <Text style={estilos.erro}>{erro}</Text>}
                  {!!aviso && <Text style={estilos.aviso}>{aviso}</Text>}

                  <Pressable
                    onPress={() => void reenviar()}
                    disabled={espera > 0}
                    accessibilityRole="button"
                    accessibilityLabel="Reenviar o código"
                  >
                    <Text style={[estilos.linkSecundario, espera > 0 && estilos.apagado]}>
                      {espera > 0 ? `Reenviar em ${espera}s` : 'Reenviar o código'}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const estilos = StyleSheet.create({
  // Os mesmos valores da tela de entrar: as duas são a mesma porta, vista de dois lados.
  tela: { flex: 1 },
  flex: { flex: 1 },
  conteudo: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 28 },
  cartao: {
    width: '100%', maxWidth: 420, alignSelf: 'center',
    paddingTop: 38, paddingHorizontal: 34, paddingBottom: 34,
    borderRadius: 18, borderWidth: 1, borderColor: COR_ENTRADA.contornoDoCartao,
    backgroundColor: COR.superficie,
    shadowColor: 'rgb(74, 99, 145)', shadowOpacity: 0.12, shadowRadius: 50,
    shadowOffset: { width: 0, height: 20 }, elevation: 8,
  },
  marcaLinha: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 26,
  },
  titulo: {
    fontSize: 20, fontWeight: '800', color: COR_ENTRADA.marca, marginBottom: 16,
  },
  apoio: { fontSize: 14, lineHeight: 20, color: COR_ENTRADA.apoio, marginBottom: 18 },
  sociais: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  social: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: 12, minHeight: 46,
    borderRadius: RAIO.campoDeEntrada, borderWidth: 1, borderColor: COR_ENTRADA.socialContorno,
    backgroundColor: COR_ENTRADA.socialFundo,
  },
  socialTexto: { fontSize: 14, fontWeight: '700', color: COR_ENTRADA.socialTexto },
  /** A coluna da Apple não leva contorno nem fundo próprios: o botão do sistema traz os dele. */
  social__apple: { flex: 1, minHeight: 46 },
  botaoDaApple: { flex: 1, minHeight: 46 },
  divisor: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 },
  fio: { flex: 1, height: 1, backgroundColor: COR_ENTRADA.divisoria },
  ou: { color: COR_ENTRADA.divisoriaTexto, fontSize: 12 },
  campo: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 13, marginBottom: 12,
    borderRadius: RAIO.campoDeEntrada, borderWidth: 1, borderColor: COR_ENTRADA.campoContorno,
    backgroundColor: COR_ENTRADA.campoFundo,
  },
  entrada: { flex: 1, minWidth: 0, paddingVertical: 13, fontSize: 15, color: COR_ENTRADA.texto },
  // Um campo só, e não seis caixinhas: no celular o teclado numérico e o preenchimento
  // automático do código do e-mail resolvem, e seis alvos de toque só dão o que errar.
  codigo: {
    paddingVertical: 14, marginBottom: 6,
    borderRadius: RAIO.campoDeEntrada, borderWidth: 1, borderColor: COR_ENTRADA.campoContorno,
    backgroundColor: COR_ENTRADA.campoFundo,
    fontSize: 26, fontWeight: '800', letterSpacing: 10, textAlign: 'center',
    color: COR_ENTRADA.texto,
  },
  botao: {
    marginTop: 18, paddingVertical: 14, paddingHorizontal: 24,
    borderRadius: RAIO.pilula, backgroundColor: COR.primaria,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: 'rgb(51, 97, 255)', shadowOpacity: 0.24, shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 }, elevation: 6,
  },
  texto: { fontSize: 15, fontWeight: '800', color: COR.sobrePrimaria },
  pressionado: { opacity: 0.75 },
  apagado: { opacity: 0.5 },
  erro: { color: COR_ENTRADA.erro, fontSize: 13, lineHeight: 19, marginTop: 12 },
  aviso: { color: COR_ENTRADA.apoio, fontSize: 13, lineHeight: 19, marginTop: 12 },
  linkSecundario: {
    marginTop: 16, textAlign: 'center',
    color: COR_ENTRADA.linkSecundario, fontSize: 14, fontWeight: '700',
  },
  rodape: { marginTop: 26, textAlign: 'center', color: COR_ENTRADA.apoio, fontSize: 14 },
  link: { color: COR.primaria, fontWeight: '800' },
});
