import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COR, COR_CABECALHO_DE_MODULO, RAIO } from '@maestra/core/constants/design';
import {
  LANDING_HERO, MODULOS_DA_PLATAFORMA, tituloDaLanding,
} from '@maestra/core/constants/landing';

import { EmblemaNyta } from '@/casca/EmblemaNyta';
import {
  AgendaIcon, DiagnosticoIcon, MaestraMarca, PlanejamentoIcon, PlanoAcaoIcon,
} from '@/icones';


// A APRESENTAÇÃO — a primeira tela de quem abre o app sem conta.
//
// Antes dela, quem instalava caía direto num formulário de login: campos de e-mail e senha,
// sem uma linha dizendo do que se trata. Quem chegou por indicação e ainda não tem conta não
// tinha por que preencher nada.
//
// Ela diz o que o app faz e oferece os DOIS caminhos, que é a diferença entre uma porta e um
// portão: começar e entrar numa conta que já existe. Os dois ficam AQUI DENTRO: o cadastro é
// nativo, e de lá a pessoa segue direto para a criação do primeiro perfil, que é onde o
// diagnóstico gratuito acontece.
//
// Ela aparece SEMPRE que o app abre sem sessão, e não uma vez por instalação: abrir o app do
// zero é o momento em que se pergunta "o que é isto", e a resposta tem que estar lá toda vez.
// Quem acabou de SAIR da conta não passa por aqui — o portão da sessão manda direto ao login.

/**
 * O emblema da Nyta não aceita cor: ele tem gradiente próprio, e é assim em todo o app. A
 * assinatura aqui recebe `color` só para caber ao lado dos outros ícones, e a ignora.
 */
const NytaIcone = ({ size }: { size?: number; color?: string }) => <EmblemaNyta size={size} />;

// Os cinco módulos que o app entrega, com o título e o resumo que a landing usa. De fora fica
// só "E ela só cresce": promessa de roteiro pesa mais do que entrega numa primeira tela.
const ICONES: Record<string, typeof DiagnosticoIcon> = {
  'Diagnóstico REAL': DiagnosticoIcon,
  'Planejamento estratégico': PlanejamentoIcon,
  'Plano de ação': PlanoAcaoIcon,
  'Gestão: músicas e agenda': AgendaIcon,
  'Nyta IA': NytaIcone,
};

const FRENTES = MODULOS_DA_PLATAFORMA.filter((m) => m.title in ICONES);

export default function Intro() {
  const router = useRouter();

  return (
    <SafeAreaView style={estilos.tela}>
      <View style={estilos.conteudo}>
        <MaestraMarca size={28} color={COR_CABECALHO_DE_MODULO.titulo} />

        <Text style={estilos.sobretitulo}>{LANDING_HERO.sobretitulo.toUpperCase()}</Text>
        <Text style={estilos.titulo}>{tituloDaLanding()}</Text>

        <View style={estilos.lista}>
          {FRENTES.map(({ title, sub }) => {
            const Icone = ICONES[title];
            return (
              <View key={title} style={estilos.linha}>
                <View style={estilos.disco}>
                  <Icone size={18} color={COR.primaria} />
                </View>
                <Text style={estilos.linhaTexto}>
                  {title}
                  <Text style={estilos.linhaApoio}>{`, ${sub}`}</Text>
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={estilos.acoes}>
        <Pressable
          style={estilos.principal}
          onPress={() => router.push('/cadastro')}
          accessibilityRole="button"
          accessibilityLabel={LANDING_HERO.acao}
        >
          <Text style={estilos.principalTexto}>{LANDING_HERO.acao}</Text>
        </Pressable>

        <Text style={estilos.nota}>{LANDING_HERO.nota}</Text>

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
  sobretitulo: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginTop: 14,
    color: COR_CABECALHO_DE_MODULO.rotulo,
  },
  // 28, e não 34: o título da landing tem três linhas de texto, e no maior ele ocupava metade
  // da tela sem sobrar espaço para dizer o que o produto faz.
  titulo: {
    fontSize: 28, fontWeight: '800', letterSpacing: -0.7, lineHeight: 34,
    color: COR_CABECALHO_DE_MODULO.titulo, marginTop: 6,
  },
  lista: { gap: 16, marginTop: 20 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  disco: {
    width: 38, height: 38, borderRadius: RAIO.pilula,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR.destaque,
  },
  linhaTexto: {
    flex: 1, fontSize: 14, fontWeight: '700', lineHeight: 20,
    color: COR_CABECALHO_DE_MODULO.titulo,
  },
  linhaApoio: { fontWeight: '400', color: COR_CABECALHO_DE_MODULO.apoio },

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
  nota: {
    fontSize: 12, textAlign: 'center', color: COR_CABECALHO_DE_MODULO.apoio, marginTop: -6,
  },
  secundario: {
    fontSize: 14, fontWeight: '800', textAlign: 'center', color: COR_CABECALHO_DE_MODULO.titulo,
  },
});
