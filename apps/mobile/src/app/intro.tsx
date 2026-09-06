import { useRouter } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COR, COR_CABECALHO_DE_MODULO, RAIO } from '@maestra/core/constants/design';

import { AgendaIcon, DiagnosticoIcon, MaestraMarca, PlanoAcaoIcon } from '@/icones';

/** O cadastro acontece na web: aqui o app só leva a pessoa até lá. */
const SITE = 'https://www.maestramanager.com';

// A APRESENTAÇÃO — a primeira tela de quem abre o app sem conta.
//
// Antes dela, quem instalava caía direto num formulário de login: campos de e-mail e senha,
// sem uma linha dizendo do que se trata. Quem chegou por indicação e ainda não tem conta não
// tinha por que preencher nada.
//
// Ela diz o que o app faz em três linhas e oferece os DOIS caminhos, que é a diferença entre
// uma porta e um portão: criar conta e entrar numa que já existe. O primeiro sai para o
// navegador porque é lá que o cadastro vive.
//
// Ela aparece SEMPRE que o app abre sem sessão, e não uma vez por instalação: abrir o app do
// zero é o momento em que se pergunta "o que é isto", e a resposta tem que estar lá toda vez.
// Quem acabou de SAIR da conta não passa por aqui — o portão da sessão manda direto ao login.

const O_QUE_O_APP_FAZ = [
  { Icone: DiagnosticoIcon, texto: 'O diagnóstico REAL da sua carreira, com os seus números.' },
  { Icone: PlanoAcaoIcon, texto: 'Um plano de ação construído com a Nyta, em tarefas do dia a dia.' },
  { Icone: AgendaIcon, texto: 'Músicas, agenda e equipe no mesmo lugar.' },
] as const;

export default function Intro() {
  const router = useRouter();

  return (
    <SafeAreaView style={estilos.tela}>
      <View style={estilos.conteudo}>
        <MaestraMarca size={28} color={COR_CABECALHO_DE_MODULO.titulo} />

        <Text style={estilos.titulo}>A carreira inteira, no seu bolso.</Text>
        <Text style={estilos.apoio}>
          A Maestra reúne o que uma carreira precisa para sair do improviso.
        </Text>

        <View style={estilos.lista}>
          {O_QUE_O_APP_FAZ.map(({ Icone, texto }) => (
            <View key={texto} style={estilos.linha}>
              <View style={estilos.disco}>
                <Icone size={18} color={COR.primaria} />
              </View>
              <Text style={estilos.linhaTexto}>{texto}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={estilos.acoes}>
        <Pressable
          style={estilos.principal}
          onPress={() => { void Linking.openURL(`${SITE}/cadastro`); }}
          accessibilityRole="button"
          accessibilityLabel="Criar minha conta"
        >
          <Text style={estilos.principalTexto}>Criar minha conta</Text>
        </Pressable>

        <Pressable
          onPress={() => router.replace('/entrar')}
          accessibilityRole="button"
          accessibilityLabel="Já tenho conta"
        >
          <Text style={estilos.secundario}>Já tenho conta</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo, paddingHorizontal: 26 },
  // O conteúdo empurrado para o meio e as ações no rodapé: o polegar já está embaixo.
  conteudo: { flex: 1, justifyContent: 'center', gap: 18 },
  titulo: {
    fontSize: 34, fontWeight: '800', letterSpacing: -0.9, lineHeight: 40,
    color: COR_CABECALHO_DE_MODULO.titulo, marginTop: 10,
  },
  apoio: { fontSize: 14, lineHeight: 21, color: COR_CABECALHO_DE_MODULO.apoio },
  lista: { gap: 16, marginTop: 12 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  disco: {
    width: 38, height: 38, borderRadius: RAIO.pilula,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR.destaque,
  },
  linhaTexto: { flex: 1, fontSize: 13, lineHeight: 19, color: COR_CABECALHO_DE_MODULO.titulo },

  acoes: { gap: 18, paddingBottom: 12 },
  // O CTA da marca: pílula, 15/32, texto 16/800.
  principal: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 15, paddingHorizontal: 32, borderRadius: RAIO.pilula,
    backgroundColor: COR.primaria,
  },
  principalTexto: {
    fontSize: 16, fontWeight: '800', letterSpacing: 0.16, color: COR.sobrePrimaria,
  },
  secundario: {
    fontSize: 14, fontWeight: '800', textAlign: 'center', color: COR_CABECALHO_DE_MODULO.titulo,
  },
});
