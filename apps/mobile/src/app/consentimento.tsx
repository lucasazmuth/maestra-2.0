import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';

import { COR, COR_ENTRADA, RAIO } from '@maestra/core/constants/design';
import { useEstadoDoConsentimento, type ConsentState } from '@maestra/core/hooks/useConsent';
import { supabase } from '@maestra/core/lib/supabase';
import { IDADE_MINIMA, idadeEmAnos } from '@maestra/core/utils/age';

import { CaixaDeAceite } from '@/casca/CaixaDeAceite';
import { MaestraMarca } from '@/icones';
import { sair } from '@/nucleo/entrar';
import { useSessao } from '@/nucleo/sessao';
import { Carregando } from '@/casca/Carregando';

/** Os documentos legais vivem na web. */
const SITE = 'https://www.maestramanager.com';

// O CONSENTIMENTO (LGPD) — a coleta de maioridade e o aceite dos documentos.
//
// Quem entra por Google ou por Apple nunca declarou idade nem aceitou nada: o provedor devolve
// uma sessão e pronto. Esta tela é onde isso é perguntado, e o `PortaoDoConsentimento` traz
// para cá quem ainda não respondeu.
//
// Quem se cadastrou por e-mail respondeu tudo no formulário, e o núcleo envia por conta própria
// assim que há sessão: essa pessoa nunca vê esta tela.
//
// A REGRA NÃO MORA AQUI. Quem decide é a edge `account-consent`, no servidor — a tela não pode
// ser a guardiã de uma trava que existe por lei. O `IDADE_MINIMA` daqui só evita mandar ao
// servidor um cadastro que ele vai recusar, e dizer por quê antes da viagem.

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

export default function Consentimento() {
  const router = useRouter();
  const { sessao } = useSessao();
  const usuario = sessao?.user;
  const { state, loading, apply } = useEstadoDoConsentimento(
    usuario ? { id: usuario.id, email: usuario.email } : null,
  );

  const [nascimento, setNascimento] = useState('');
  const [maioridade, setMaioridade] = useState(false);
  const [termos, setTermos] = useState(false);
  const [politica, setPolitica] = useState(false);
  const [comunicacoes, setComunicacoes] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const nascimentoISO = useMemo(() => paraISO(nascimento), [nascimento]);
  const idade = nascimentoISO ? idadeEmAnos(nascimentoISO) : null;

  const precisaData = state?.needsBirthDate ?? true;
  const podeEnviar = !enviando && maioridade && termos && politica
    && (!precisaData || (idade !== null && idade >= IDADE_MINIMA));

  const enviar = async () => {
    setErro(null);
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke('account-consent', {
        body: {
          action: 'submit',
          ...(precisaData ? { birthDate: nascimentoISO } : {}),
          aceitaTermos: termos,
          aceitaPolitica: politica,
          aceitaComunicacoes: comunicacoes,
        },
      });
      if (error) throw error;
      if (data?.error && !data?.blocked) throw new Error(data.error as string);

      apply(data as ConsentState);
      // Bloqueado fica NESTA tela, com a mensagem: o portão não tem para onde levar, e mandar a
      // pessoa ao app para expulsá-la de volta seria um pisca-pisca.
      //
      // Quem passa por aqui entrou por Google ou Apple, e para essa pessoa este é o primeiro
      // instante dentro do app: quem cria conta por e-mail responde tudo no cadastro e não vê
      // esta tela. Então o destino é o mesmo do cadastro — as boas-vindas, que saúdam e DECIDEM
      // para onde ir: criar o primeiro perfil, ou ver o convite de equipe que está esperando.
      if (!data?.blocked) router.replace('/bem-vindo');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível registrar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  // Sem sessão não há o que consentir; o portão da sessão cuida do resto.
  if (!sessao) return <Redirect href="/entrar" />;

  const bloqueada = state?.blocked;

  return (
    <LinearGradient colors={[COR_ENTRADA.fundoDe, COR_ENTRADA.fundoAte]} style={estilos.tela}>
      <SafeAreaView style={estilos.flex}>
        <KeyboardAvoidingView
          style={estilos.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
            <View style={estilos.cartao}>
              <View style={estilos.marcaLinha}>
                <MaestraMarca size={26} color={COR_ENTRADA.marca} />
              </View>

              {loading && !state ? (
                <Carregando estilo={estilos.espera} />
              ) : bloqueada ? (
                <>
                  <Text style={estilos.titulo}>Conta em análise</Text>
                  <Text style={estilos.apoio}>
                    A Maestra é destinada a maiores de {IDADE_MINIMA} anos. Registramos sua
                    resposta e nossa equipe vai analisar. Se houver engano na data informada,
                    fale com o suporte.
                  </Text>
                  <Pressable
                    style={({ pressed }) => [estilos.botao, pressed && estilos.pressionado]}
                    onPress={() => { void Linking.openURL(`${SITE}/suporte`); }}
                    accessibilityRole="button"
                    accessibilityLabel="Falar com o suporte"
                  >
                    <Text style={estilos.texto}>Falar com o suporte</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={estilos.titulo}>
                    {precisaData ? 'Confirme sua idade' : 'Confirme o aceite dos termos'}
                  </Text>
                  <Text style={estilos.apoio}>
                    Precisamos disto uma vez, para cumprir a lei e liberar sua conta.
                  </Text>

                  {precisaData && (
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
                  )}

                  {/* A data informada não é conferida contra documento nenhum, aqui nem na web:
                      o que existe é uma DECLARAÇÃO, e é ela que fica registrada. */}
                  <CaixaDeAceite
                    marcada={maioridade}
                    aoTocar={() => setMaioridade((v) => !v)}
                    texto={`Declaro ter ${IDADE_MINIMA} anos ou mais.`}
                  />

                  <CaixaDeAceite
                    marcada={termos}
                    aoTocar={() => setTermos((v) => !v)}
                    texto={(
                      <>
                        Li e aceito os{' '}
                        <Text
                          style={estilos.link}
                          onPress={() => { void Linking.openURL(`${SITE}/legal/termos`); }}
                        >
                          Termos de uso
                        </Text>.
                      </>
                    )}
                  />

                  <CaixaDeAceite
                    marcada={politica}
                    aoTocar={() => setPolitica((v) => !v)}
                    texto={(
                      <>
                        Li e aceito a{' '}
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
                    style={({ pressed }) => [
                      estilos.botao, !podeEnviar && estilos.apagado, pressed && estilos.pressionado,
                    ]}
                    onPress={() => { if (podeEnviar) void enviar(); }}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !podeEnviar }}
                    accessibilityLabel="Continuar"
                  >
                    {enviando
                      ? <ActivityIndicator color={COR.sobrePrimaria} />
                      : <Text style={estilos.texto}>Continuar</Text>}
                  </Pressable>

                  {!!erro && <Text style={estilos.erro}>{erro}</Text>}
                </>
              )}

              <Pressable
                onPress={() => { void sair(); }}
                accessibilityRole="button"
                accessibilityLabel="Sair da conta"
              >
                <Text style={estilos.linkSecundario}>Sair da conta</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const estilos = StyleSheet.create({
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
  titulo: { fontSize: 20, fontWeight: '800', color: COR_ENTRADA.marca, marginBottom: 10 },
  apoio: { fontSize: 14, lineHeight: 20, color: COR_ENTRADA.apoio, marginBottom: 18 },
  espera: { marginVertical: 30 },
  campo: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 13, marginBottom: 6,
    borderRadius: RAIO.campoDeEntrada, borderWidth: 1, borderColor: COR_ENTRADA.campoContorno,
    backgroundColor: COR_ENTRADA.campoFundo,
  },
  entrada: { flex: 1, minWidth: 0, paddingVertical: 13, fontSize: 15, color: COR_ENTRADA.texto },
  botao: {
    marginTop: 22, paddingVertical: 14, paddingHorizontal: 24,
    borderRadius: RAIO.pilula, backgroundColor: COR.primaria,
    alignItems: 'center', justifyContent: 'center',
  },
  texto: { fontSize: 15, fontWeight: '800', color: COR.sobrePrimaria },
  pressionado: { opacity: 0.75 },
  apagado: { opacity: 0.45 },
  erro: { color: COR_ENTRADA.erro, fontSize: 13, lineHeight: 19, marginTop: 12 },
  linkSecundario: {
    marginTop: 20, textAlign: 'center',
    color: COR_ENTRADA.linkSecundario, fontSize: 14, fontWeight: '700',
  },
  link: { color: COR.primaria, fontWeight: '800' },
});
