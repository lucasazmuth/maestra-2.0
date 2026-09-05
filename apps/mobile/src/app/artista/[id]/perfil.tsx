import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import {
  COR, COR_MAPA, COR_PLANEJAMENTO, CORES_SWOT, RAIO,
} from '@maestra/core/constants/design';
import type { SwotAnalysis } from '@maestra/core/interfaces/maestra';
import { mapaDeReferencias } from '@maestra/core/nucleo/mapaDeReferencias';

import { useArtistaDaRota } from '@/nucleo/artista';

// Plano estratégico — a porta de `src/pages/Profile/index.tsx`.
//
// A assinatura da tela é o contrário da home: aqui os cartões são do MESMO cinza do fundo, com
// um contorno fino e sem sombra. O que separa um bloco do outro é o fio, não a elevação. Só dois
// fogem disso, de propósito: o foco do ciclo (azul) e a introdução da identidade (azul-noite).
//
// O cabeçalho da página não vem: no celular a web esconde o `.module-page-heading` de todos os
// módulos (o chip do artista no topo já diz onde a pessoa está).
//
// A geometria do mapa vem do núcleo — as duas superfícies desenham o MESMO diagrama, e cada
// número dele foi medido na tela.

const CAMPOS_DO_MAPA = [
  { chave: 'centro', rotulo: 'REFERÊNCIAS', cor: COR_MAPA.centro, x: 0, y: 0, tamanho: 112 },
  { chave: 'posicionamento', rotulo: 'POSICIONAMENTO', cor: COR_MAPA.posicionamento, x: -92, y: -88, tamanho: 116 },
  { chave: 'artistica', rotulo: 'ARTÍSTICAS', cor: COR_MAPA.artistica, x: 92, y: -88, tamanho: 116 },
  { chave: 'comunicacao', rotulo: 'COMUNICAÇÃO\nCOM O PÚBLICO', cor: COR_MAPA.comunicacao, x: -92, y: 88, tamanho: 116 },
  { chave: 'gestao', rotulo: 'CARREIRA', cor: COR_MAPA.gestao, x: 92, y: 88, tamanho: 116 },
] as const;

// O mapa é maior que a tela do celular: a web o coloca num rolamento horizontal, e aqui também.
//
// A altura é a do desktop (680), e não os 430 que a web usa abaixo de 700px. Com 430 os nós
// continuam ancorados no centro e a órbita externa (ry 310) sai por cima e por baixo do
// contêiner — na web isso passa porque nada corta, mas o diagrama fica com bolhas soltas fora
// do quadro. Aqui a altura preserva o desenho, e quem rola vê o mapa inteiro.
const LARGURA_DO_MAPA = 740;
const ALTURA_DO_MAPA = 680;

// A rolagem começa no MEIO. Sem isso o mapa abre no canto superior esquerdo, que é justamente o
// quadrante vazio (não há campo de referência para posicionamento) — a primeira impressão seria
// de um cartão em branco. Na web isso não aparece porque a tela é larga o bastante.
const INICIO_DO_MAPA = { x: Math.max(0, (LARGURA_DO_MAPA - Dimensions.get('window').width) / 2), y: 0 };

const Secao = ({ rotulo, titulo, legenda }: { rotulo: string; titulo: string; legenda?: string }) => (
  <View style={estilos.secao}>
    <Text style={estilos.secaoRotulo}>{rotulo}</Text>
    <Text style={estilos.secaoTitulo}>{titulo}</Text>
    {!!legenda && <Text style={estilos.secaoLegenda}>{legenda}</Text>}
  </View>
);

export default function Planejamento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const artista = useArtistaDaRota(id);

  const conteudo = artista?.content;
  const identidade = conteudo?.identity;
  const objetivos = conteudo?.objectives ?? [];
  const estrategias = useMemo(
    () => [...(conteudo?.strategies ?? [])].sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0)),
    [conteudo?.strategies],
  );
  const bolhas = useMemo(() => mapaDeReferencias(identidade), [identidade]);

  const swot: [string, string[]][] = useMemo(() => {
    const a: SwotAnalysis = conteudo?.swotAnalysis
      ?? { strengths: [], weaknesses: [], opportunities: [], threats: [] };
    return [
      ['Forças', a.strengths ?? []],
      ['Fraquezas', a.weaknesses ?? []],
      ['Oportunidades', a.opportunities ?? []],
      ['Ameaças', a.threats ?? []],
    ];
  }, [conteudo?.swotAnalysis]);

  const totalDeTarefas = estrategias.reduce((n, e) => n + (e.tasks?.length ?? 0), 0);
  const feitas = estrategias.reduce(
    (n, e) => n + (e.tasks ?? []).filter((t) => t.status === 'done').length, 0,
  );
  const capacidade = totalDeTarefas ? Math.round((feitas / totalDeTarefas) * 100) : 0;
  const proximosPassos = estrategias.slice(0, 3).map((e) => e.title);

  return (
    <View style={estilos.tela}>
      <ScrollView contentContainerStyle={estilos.conteudo}>
        {/* Foco do ciclo */}
        <LinearGradient
          colors={[COR_PLANEJAMENTO.focoDe, COR_PLANEJAMENTO.focoAte]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={estilos.foco}
        >
          <Text style={estilos.focoRotulo}>FOCO DO CICLO</Text>
          <Text style={estilos.focoTitulo}>Próximos marcos</Text>
          <Text style={estilos.focoTexto}>
            {/* O resumo vem do LLM em markdown. Sem renderizador aqui, os `**` viram ruído no
                meio da frase — então saem, e o texto continua o mesmo. */}
            {(conteudo?.executiveSummary ?? 'Organize as prioridades da carreira para os próximos lançamentos.')
              .replace(/\*\*/g, '')}
          </Text>
          <View style={estilos.trilho}>
            <View style={[estilos.trilhoCheio, { width: `${capacidade}%` }]} />
          </View>
          <Text style={estilos.focoNota}>Atualizado com os dados do planejamento</Text>
        </LinearGradient>

        {/* Próximos passos */}
        <View style={estilos.cartao}>
          <View style={estilos.cabecalhoDoCartao}>
            <Text style={estilos.passoRotulo}>PRÓXIMOS PASSOS</Text>
            <Feather
              name="arrow-right"
              size={18}
              color={COR.primaria}
              onPress={() => router.push(`/artista/${id}/plano` as never)}
              accessibilityRole="button"
              accessibilityLabel="Ir para o plano de ação"
            />
          </View>
          {(proximosPassos.length ? proximosPassos : [
            'Definir próximos objetivos', 'Organizar as estratégias', 'Acompanhar as entregas',
          ]).map((item, i) => (
            <View key={item} style={estilos.passo}>
              <Text style={estilos.passoNumero}>{String(i + 1).padStart(2, '0')}</Text>
              <Text style={estilos.passoTexto}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Os três números do ciclo */}
        {([
          [String(estrategias.length).padStart(2, '0'), 'Frentes estratégicas'],
          [String(totalDeTarefas).padStart(2, '0'), 'Entregas no ciclo'],
          [`${capacidade}%`, 'Capacidade planejada'],
        ] as const).map(([valor, rotulo]) => (
          <View key={rotulo} style={[estilos.cartao, estilos.cartaoDeNumero]}>
            <Text style={estilos.numero}>{valor}</Text>
            <Text style={estilos.numeroApoio}>{rotulo}</Text>
          </View>
        ))}

        {/* Identidade artística */}
        <LinearGradient
          colors={[COR_PLANEJAMENTO.identidadeDe, COR_PLANEJAMENTO.identidadeAte]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={estilos.identidade}
        >
          <Text style={estilos.focoRotulo}>IDENTIDADE ARTÍSTICA</Text>
          <Text style={estilos.identidadeTitulo}>Fundamentos que orientam cada decisão.</Text>
          <Text style={estilos.identidadeTexto}>
            Um retrato claro do que o artista representa, para quem cria e onde quer chegar.
          </Text>
        </LinearGradient>

        {([
          ['GÊNERO', identidade?.genre || 'Não informado'],
          ['VISÃO', identidade?.vision || 'Ainda não definida.'],
          ['MISSÃO', identidade?.mission || 'Ainda não definida.'],
          ['VALORES', identidade?.values?.join(', ') || 'Ainda não definidos.'],
        ] as const).map(([campo, valor]) => (
          <View key={campo} style={estilos.cartao}>
            <Text style={estilos.campoRotulo}>{campo}</Text>
            <Text style={estilos.campoValor}>{valor}</Text>
          </View>
        ))}

        {/* Mapa de referências */}
        <Secao
          rotulo="INSPIRAÇÕES QUE GUIAM A CARREIRA"
          titulo="Mapa de referências"
          legenda="Conecte influências artísticas, posicionamento e caminhos de comunicação."
        />
        <View style={[estilos.cartao, estilos.semRecheio]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentOffset={INICIO_DO_MAPA}>
            <View style={estilos.mapa}>
              {/* Os fios primeiro: eles passam POR BAIXO dos círculos. */}
              {bolhas.map(({ nome, chave, linha }) => (
                <View
                  key={`fio-${chave}-${nome}`}
                  style={[estilos.fio, {
                    backgroundColor: COR_MAPA.bolha[chave].contorno,
                    left: LARGURA_DO_MAPA / 2 + linha.x,
                    top: ALTURA_DO_MAPA / 2 + linha.y,
                    width: linha.comprimento,
                    transform: [{ rotate: `${linha.ang}deg` }],
                  }]}
                />
              ))}

              {CAMPOS_DO_MAPA.map(({ chave, rotulo, cor, x, y, tamanho }) => (
                <View
                  key={chave}
                  style={[estilos.no, {
                    backgroundColor: cor,
                    width: tamanho,
                    height: tamanho,
                    borderRadius: tamanho / 2,
                    left: LARGURA_DO_MAPA / 2 + x - tamanho / 2,
                    top: ALTURA_DO_MAPA / 2 + y - tamanho / 2,
                  }]}
                >
                  <Text style={estilos.noTexto}>{rotulo}</Text>
                </View>
              ))}

              {bolhas.map(({ nome, chave, x, y }) => (
                <View
                  key={`${chave}-${nome}`}
                  style={[estilos.bolha, {
                    borderColor: COR_MAPA.bolha[chave].contorno,
                    left: LARGURA_DO_MAPA / 2 + x - 27,
                    top: ALTURA_DO_MAPA / 2 + y - 27,
                  }]}
                >
                  <Text
                    style={[estilos.bolhaTexto, { color: COR_MAPA.bolha[chave].texto }]}
                    numberOfLines={3}
                  >
                    {nome}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Objetivos */}
        <Secao
          rotulo="METAS DO CICLO"
          titulo="Objetivos"
          legenda="Objetivos claros para orientar prioridades, entregas e resultados esperados."
        />
        <View style={[estilos.cartao, estilos.semRecheio]}>
          {(objetivos.length ? objetivos : ['Objetivos ainda não definidos.']).map((objetivo, i, todos) => (
            <View key={objetivo} style={[estilos.objetivo, i < todos.length - 1 && estilos.comFio]}>
              <Text style={estilos.objetivoNumero}>{String(i + 1).padStart(2, '0')}</Text>
              <Text style={estilos.objetivoTexto}>{objetivo}</Text>
            </View>
          ))}
        </View>
        <Text style={estilos.nota}>
          Os objetivos são definidos durante o planejamento estratégico e orientam a priorização
          das estratégias.
        </Text>

        {/* SWOT */}
        <Secao
          rotulo="LEITURA DO CENÁRIO"
          titulo="Análise SWOT"
          legenda="Forças, fragilidades e oportunidades que orientam o posicionamento da carreira."
        />
        {swot.map(([titulo, itens], i) => (
          <View key={titulo} style={[estilos.cartao, estilos.swot, { borderLeftColor: CORES_SWOT[i] }]}>
            <Text style={estilos.swotTitulo}>{titulo.toUpperCase()}</Text>
            {(itens.length ? itens : ['Nenhum item informado.']).map((item) => (
              <View key={item} style={estilos.swotItem}>
                <Text style={[estilos.marcador, { color: CORES_SWOT[i] }]}>•</Text>
                <Text style={estilos.swotTexto}>{item}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* Estratégias priorizadas */}
        <Secao
          rotulo="PLANO PRIORIZADO"
          titulo="Estratégias"
          legenda="Prioridades organizadas por impacto para o crescimento sustentável da carreira."
        />
        <View style={[estilos.cartao, estilos.semRecheio]}>
          {estrategias.map((estrategia, i) => {
            // 40 é a nota máxima da priorização; o percentual é dela, não do progresso das tarefas.
            const pct = Math.max(0, Math.min(100,
              estrategia.finalScore ? Math.round((estrategia.finalScore / 40) * 100) : 0));
            return (
              <View
                key={estrategia.id}
                style={[estilos.estrategia, i < estrategias.length - 1 && estilos.comFio]}
              >
                <Text style={estilos.objetivoNumero}>{String(i + 1).padStart(2, '0')}</Text>
                <View style={estilos.flex}>
                  <Text style={estilos.estrategiaTitulo}>{estrategia.title}</Text>
                  <View style={estilos.trilhoClaro}>
                    <View style={[estilos.trilhoCheioAzul, { width: `${pct}%` }]} />
                  </View>
                </View>
                <Text style={estilos.estrategiaPct}>{pct}%</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  conteudo: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 122, gap: 22 },
  flex: { flex: 1, minWidth: 0 },

  // O cartão: BRANCO com contorno fino e sem sombra.
  //
  // A folha declara `background: var(--canvas)` (o cinza do fundo) e logo depois uma regra mais
  // específica — `.planning-page .planning-next`, `.planning-page .planning-swot article` e as
  // irmãs — troca por `#fff`. Ler só a primeira dá um cartão que some no fundo.
  cartao: {
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COR_PLANEJAMENTO.contorno,
    backgroundColor: COR.superficie,
  },
  semRecheio: { padding: 0, overflow: 'hidden' },

  secao: { marginTop: 8 },
  secaoRotulo: { marginBottom: 8, color: COR_PLANEJAMENTO.rotulo, fontSize: 9, fontWeight: '800' },
  secaoTitulo: { color: COR_PLANEJAMENTO.titulo, fontSize: 26, fontWeight: '800' },
  secaoLegenda: { marginTop: 10, color: COR_PLANEJAMENTO.legenda, fontSize: 13, lineHeight: 20 },

  foco: { padding: 21, borderRadius: 8, minHeight: 230 },
  focoRotulo: { marginBottom: 8, color: COR.sobrePrimaria, fontSize: 9, fontWeight: '800', opacity: 0.75 },
  focoTitulo: { marginBottom: 9, color: COR.sobrePrimaria, fontSize: 26, fontWeight: '800' },
  focoTexto: { color: COR_PLANEJAMENTO.focoTexto, fontSize: 14, lineHeight: 21 },
  // O alpha vai na COR do trilho, não em `opacity`: a opacidade do contêiner desbotaria junto o
  // preenchimento que ele contém, e a barra ficaria sempre pálida.
  trilho: { height: 6, marginTop: 18, borderRadius: RAIO.pilula, backgroundColor: 'rgba(255, 255, 255, 0.3)' },
  trilhoCheio: { height: 6, borderRadius: RAIO.pilula, backgroundColor: COR.sobrePrimaria },
  focoNota: { marginTop: 8, color: COR_PLANEJAMENTO.focoTexto, fontSize: 10, opacity: 0.85 },

  cabecalhoDoCartao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4,
  },
  passoRotulo: { color: COR_PLANEJAMENTO.passoRotulo, fontSize: 10, fontWeight: '800' },
  passo: {
    flexDirection: 'row', alignItems: 'center', gap: 15, minHeight: 52, paddingVertical: 12,
  },
  passoNumero: { width: 26, color: COR_PLANEJAMENTO.objetivoNumero, fontSize: 14, fontWeight: '800' },
  passoTexto: { flex: 1, color: COR_PLANEJAMENTO.objetivoTexto, fontSize: 13, fontWeight: '700' },

  cartaoDeNumero: { minHeight: 92, justifyContent: 'center', paddingVertical: 19, paddingHorizontal: 22 },
  numero: { color: COR.primaria, fontSize: 28, fontWeight: '800', lineHeight: 30 },
  numeroApoio: { marginTop: 9, color: COR_PLANEJAMENTO.numeroApoio, fontSize: 10, fontWeight: '600' },

  identidade: { padding: 21, borderRadius: 8, gap: 24 },
  identidadeTitulo: { color: COR.sobrePrimaria, fontSize: 25, lineHeight: 29, fontWeight: '800' },
  identidadeTexto: { marginTop: 12, color: COR_PLANEJAMENTO.focoTexto, fontSize: 12, lineHeight: 18 },

  campoRotulo: { color: COR_PLANEJAMENTO.campoRotulo, fontSize: 9, fontWeight: '800' },
  campoValor: { marginTop: 10, color: COR_PLANEJAMENTO.titulo, fontSize: 12, lineHeight: 17, fontWeight: '600' },

  mapa: { width: LARGURA_DO_MAPA, height: ALTURA_DO_MAPA },
  no: { position: 'absolute', alignItems: 'center', justifyContent: 'center', padding: 8 },
  noTexto: { color: COR.sobrePrimaria, fontSize: 10, fontWeight: '800', textAlign: 'center', lineHeight: 13 },
  bolha: {
    position: 'absolute',
    width: 54,
    height: 54,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 27,
    borderWidth: 2,
    backgroundColor: COR.superficie,
  },
  bolhaTexto: { fontSize: 9, lineHeight: 10, textAlign: 'center' },
  // O fio nasce na borda do nó e aponta para a bolha: gira em torno da PONTA esquerda, não do
  // meio — por isso a origem do `rotate` precisa ser deslocada meio comprimento pra esquerda.
  fio: { position: 'absolute', height: 2, opacity: 0.45, transformOrigin: 'left center' },

  objetivo: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 64, paddingHorizontal: 24 },
  comFio: { borderBottomWidth: 1, borderBottomColor: COR_PLANEJAMENTO.fio },
  objetivoNumero: { width: 26, color: COR_PLANEJAMENTO.objetivoNumero, fontSize: 14, fontWeight: '800' },
  objetivoTexto: { flex: 1, paddingVertical: 14, color: COR_PLANEJAMENTO.objetivoTexto, fontSize: 14, fontWeight: '800', lineHeight: 20 },
  nota: { color: COR_PLANEJAMENTO.nota, fontSize: 11, lineHeight: 16 },

  // O SWOT: a cor da dimensao entra pela ESQUERDA, com 4px — nao por cima.
  swot: {
    borderLeftWidth: 4, gap: 12, minHeight: 180, paddingVertical: 22, paddingHorizontal: 24,
  },
  swotTitulo: { color: COR_PLANEJAMENTO.swotTitulo, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  swotItem: { flexDirection: 'row', gap: 8 },
  marcador: { fontSize: 13, lineHeight: 18 },
  swotTexto: { flex: 1, color: COR_PLANEJAMENTO.swotItem, fontSize: 13, lineHeight: 18 },

  estrategia: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 22, paddingVertical: 14 },
  estrategiaTitulo: { color: COR_PLANEJAMENTO.titulo, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  trilhoClaro: { height: 7, marginTop: 8, borderRadius: RAIO.pilula, backgroundColor: COR_PLANEJAMENTO.fio },
  trilhoCheioAzul: { height: 7, borderRadius: RAIO.pilula, backgroundColor: COR.primaria },
  estrategiaPct: { color: COR_PLANEJAMENTO.numeroApoio, fontSize: 11, fontWeight: '800' },
});
