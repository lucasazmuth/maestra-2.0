import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_CHECKOUT, RAIO } from '@maestra/core/constants/design';
import {
  BENEFICIOS_DO_PRO, CHAMADA_DO_PRO, CICLOS_DO_PRO, COMO_SE_PAGA, ONDE_SE_ASSINA,
  type ChaveDoBeneficio,
} from '@maestra/core/constants/planos';
import { fmtBRL } from '@maestra/core/hooks/usePlanPrices';
import { fetchPlanConfig } from '@maestra/core/store/slices/subscription';
import { useAppDispatch, useAppSelector } from '@maestra/core/store/store';

import { useTomDoSelo } from '@/nucleo/assinatura';
import { Dialogo } from '@/casca/Dialogo';
import { DiamanteAnimado } from '@/casca/marca/DiamanteAnimado';
import { useVoltar } from '@/nucleo/navegar';

// OS PLANOS, no app — a tela que MOSTRA e não vende.
//
// ⚠️ ELA NÃO TEM CAMINHO PARA PAGAR, e é esse o ponto inteiro. A App Store 3.1.3 (anti-steering)
// alcança botão e link para outro meio de pagamento; o desenho que o Spotify usa, e que esta tela
// copia, é mostrar o produto e dizer — EM TEXTO — onde se assina. Quem quiser assinar digita o
// endereço no navegador. É por isso que a rota da web deixou de ser `/assinatura` e passou a
// `/planos`: para caber numa frase que alguém consegue copiar de cabeça.
//
// Nada de `Linking`, nada de `WebBrowser`, nada de `irParaOCheckout`. Um `Pressable` no endereço
// desfaria a razão de a tela existir, e `portaDaCobranca.test.ts` apanha isso.
//
// ⚠️ O PAGAMENTO ÚNICO (desbloqueio de perfil) NÃO PASSA POR AQUI. Ele continua a ser cobrado
// dentro do app, em `desbloquear/[id].tsx`, por decisão do produto — com o risco da 3.1.1
// escrito em `nucleo/loja.ts`. Esta tela é só da assinatura.

const ICONE_DO_GRUPO: Record<ChaveDoBeneficio, keyof typeof Feather.glyphMap> = {
  executar: 'target',
  nyta: 'message-circle',
  gestao: 'grid',
  acompanhar: 'eye',
};

export default function Planos() {
  const dispatch = useAppDispatch();
  const voltar = useVoltar('/conta');
  const plano = useAppSelector((s) => s.subscription.plan);
  // ⚠️ QUEM JÁ ASSINA NÃO PODE CAIR NUMA LISTA DE PREÇOS. "Gerenciar assinatura", na conta, vem
  // dar aqui — e oferecer o PRO a quem já paga é a tela a dizer que não sabe quem está a lê-la.
  // A leitura dos três estados é a mesma do selo do cabeçalho, e mora no `nucleo/assinatura`.
  const tom = useTomDoSelo();
  const [avisando, setAvisando] = useState(false);

  // ⚠️ O PREÇO É O DO SERVIDOR, e esta busca é o que o garante.
  //
  // `usePlanPrices` tem um fallback embutido (R$ 39,90) para o instante em que a config ainda não
  // chegou — e o app NUNCA despachava esta busca, então o fallback era tudo o que ele teria. Não
  // é hipótese: o desbloqueio está hoje a R$ 197,90 no painel e o fallback do código diz 199,90.
  // Um número errado numa tela de preços é pior do que nenhum, porque ninguém desconfia dele.
  useEffect(() => { void dispatch(fetchPlanConfig()); }, [dispatch]);

  const mensal = plano?.monthlyValue ?? null;
  const anual = plano?.annualValue ?? null;
  const temAnual = !!(plano?.annualEnabled && anual && anual > 0);
  const desconto = mensal && anual ? Math.round((1 - anual / (mensal * 12)) * 100) : 0;

  /** O preço de um ciclo, ou `null` enquanto a config não chegou. */
  const precoDe = (chave: string) => {
    if (chave === 'annual') return temAnual ? { valor: anual as number, unidade: '/ano' } : null;
    return mensal ? { valor: mensal, unidade: '/mês' } : null;
  };

  const ciclos = CICLOS_DO_PRO.filter((c) => c.chave !== 'annual' || temAnual);

  const cabecalho = (
    <Pressable onPress={voltar} accessibilityRole="button" accessibilityLabel="Voltar">
      <Text style={estilos.voltar}>‹  Voltar</Text>
    </Pressable>
  );

  // ── Quem já é PRO, e quem está a meio de um pagamento ────────────────────────
  //
  // Os mesmos dois portões da web (`src/pages/Subscription`), pela mesma razão. O de pendente
  // evita a assinatura dobrada: quem tem uma cobrança à espera e assina outra paga duas vezes.
  if (tom === 'pro' || tom === 'pending') {
    const ehPro = tom === 'pro';
    return (
      <SafeAreaView style={estilos.tela}>
        <ScrollView contentContainerStyle={estilos.conteudo}>
          {cabecalho}
          <View style={estilos.estado}>
            <DiamanteAnimado tom={ehPro ? 'pro' : 'pending'} tamanho={72} />
            <Text style={estilos.estadoTitulo}>
              {ehPro ? 'Você já é Maestra PRO' : 'Você tem um pagamento em confirmação'}
            </Text>
            <Text style={estilos.estadoApoio}>
              {ehPro
                ? 'Edição completa, Nyta Assistente e todos os perfis da conta liberados.'
                : 'Já existe uma assinatura à espera do pagamento. Não comece outra: você pagaria duas vezes.'}
            </Text>
            <Text style={estilos.estadoOnde}>
              {`Para gerenciar a assinatura, acesse ${ONDE_SE_ASSINA.endereco}`}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={estilos.tela}>
      <ScrollView contentContainerStyle={estilos.conteudo}>
        {cabecalho}

        {/* ── O herói ── */}
        <View style={estilos.marca}>
          <DiamanteAnimado tom="pro" tamanho={22} />
          <Text style={estilos.marcaTexto}>Maestra PRO</Text>
        </View>
        <Text style={estilos.titulo}>{CHAMADA_DO_PRO.titulo}</Text>
        <Text style={estilos.apoio}>{CHAMADA_DO_PRO.apoio}</Text>

        <Pressable
          style={estilos.principal}
          onPress={() => setAvisando(true)}
          accessibilityRole="button"
          accessibilityLabel="Assinar o Maestra PRO"
        >
          <Text style={estilos.principalTexto}>Assinar o Maestra PRO</Text>
        </Pressable>
        <Text style={estilos.legal}>Sujeito aos Termos.</Text>

        {/* ── Os planos ── */}
        <Text style={estilos.secao}>Planos disponíveis</Text>

        {ciclos.map((ciclo) => {
          const preco = precoDe(ciclo.chave);
          const anualPorMes = ciclo.chave === 'annual' && anual ? anual / 12 : null;
          return (
            <View key={ciclo.chave} style={estilos.cartao}>
              <View style={estilos.marca}>
                <DiamanteAnimado tom="pro" tamanho={18} />
                <Text style={estilos.cartaoMarca}>Maestra PRO</Text>
              </View>

              <View style={estilos.linhaDoNome}>
                <Text style={estilos.cartaoNome}>{ciclo.nome}</Text>
                {ciclo.chave === 'annual' && desconto > 0 && (
                  <Text style={estilos.selo}>{`-${desconto}%`}</Text>
                )}
              </View>

              {/* ⚠️ SEM PREÇO ENQUANTO ELE NÃO CHEGA — e não o fallback. Ver a busca lá em cima. */}
              {preco ? (
                <Text style={estilos.preco}>
                  {fmtBRL(preco.valor)}
                  <Text style={estilos.unidade}>{preco.unidade}</Text>
                </Text>
              ) : (
                <View style={estilos.precoVazio} accessibilityLabel="Carregando o preço" />
              )}

              {!!anualPorMes && (
                <Text style={estilos.equivale}>{`equivale a ${fmtBRL(anualPorMes)}/mês`}</Text>
              )}

              <View style={estilos.fio} />

              {ciclo.itens.map((item) => (
                <View key={item} style={estilos.item}>
                  <Text style={estilos.ponto}>•</Text>
                  <Text style={estilos.itemTexto}>{item}</Text>
                </View>
              ))}

              <Pressable
                style={estilos.assinar}
                onPress={() => setAvisando(true)}
                accessibilityRole="button"
                accessibilityLabel={`Assinar o plano ${ciclo.nome}`}
              >
                <Text style={estilos.assinarTexto}>Assinar</Text>
              </Pressable>
              <Text style={estilos.legalDoCartao}>Sujeito aos Termos.</Text>
            </View>
          );
        })}

        <Text style={estilos.comoSePaga}>{COMO_SE_PAGA}</Text>

        {/* ── Por que assinar ── */}
        <View style={estilos.beneficios}>
          <Text style={estilos.secaoDoCartao}>Por que assinar o PRO?</Text>
          {BENEFICIOS_DO_PRO.map((grupo) => (
            <View key={grupo.chave} style={estilos.grupo}>
              <View style={estilos.disco}>
                <Feather name={ICONE_DO_GRUPO[grupo.chave]} size={14} color={COR.primaria} />
              </View>
              <View style={estilos.flex}>
                <Text style={estilos.grupoTitulo}>{grupo.titulo}</Text>
                {grupo.itens.map((item) => (
                  <Text key={item} style={estilos.grupoItem}>{item}</Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ⚠️ O ENDEREÇO É TEXTO, E SÓ TEXTO. Um botão só, que fecha e não navega. */}
      <Dialogo
        aberto={avisando}
        titulo={ONDE_SE_ASSINA.titulo}
        aoFechar={() => setAvisando(false)}
        acao={{ rotulo: ONDE_SE_ASSINA.entendi, aoTocar: () => setAvisando(false) }}
      >
        <Text style={estilos.corpoDoAviso}>{ONDE_SE_ASSINA.corpo}</Text>
      </Dialogo>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  conteudo: { padding: 20, paddingBottom: 40, gap: 10 },
  flex: { flex: 1 },

  voltar: { fontSize: 15, fontWeight: '700', color: COR.primaria, marginBottom: 6 },

  marca: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  marcaTexto: { fontSize: 13, fontWeight: '800', color: COR.titulo },
  titulo: { fontSize: 26, fontWeight: '800', color: COR.titulo, lineHeight: 32 },
  apoio: { fontSize: 14, color: COR.secundario, lineHeight: 20 },

  principal: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 15, paddingHorizontal: 32,
    borderRadius: RAIO.pilula, backgroundColor: COR.primaria, marginTop: 6,
  },
  principalTexto: {
    fontSize: 16, fontWeight: '800', letterSpacing: 0.16, color: COR.sobrePrimaria,
  },
  legal: { fontSize: 11, color: COR_CHECKOUT.seguro, textAlign: 'center' },

  secao: { fontSize: 20, fontWeight: '800', color: COR.titulo, marginTop: 18 },

  cartao: {
    padding: 18, gap: 8,
    borderRadius: RAIO.cartao, backgroundColor: COR.superficie,
    borderWidth: 1, borderColor: COR_CHECKOUT.contorno,
  },
  cartaoMarca: { fontSize: 12, fontWeight: '800', color: COR_CHECKOUT.titulo },
  linhaDoNome: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cartaoNome: { fontSize: 22, fontWeight: '800', color: COR.primaria },
  selo: {
    fontSize: 11, fontWeight: '800', color: COR.sobrePrimaria,
    backgroundColor: COR.primaria, borderRadius: RAIO.pilula,
    paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden',
  },
  preco: { fontSize: 22, fontWeight: '800', color: COR.titulo },
  unidade: { fontSize: 14, fontWeight: '700', color: COR.secundario },
  /** O lugar do preço enquanto a config não chegou. Um vazio honesto, e não um número errado. */
  precoVazio: {
    height: 26, width: 132, borderRadius: RAIO.campo, backgroundColor: COR_CHECKOUT.cupomApagado,
  },
  equivale: { fontSize: 12, color: COR_CHECKOUT.apoio },

  fio: { height: 1, backgroundColor: COR_CHECKOUT.fio, marginVertical: 4 },
  item: { flexDirection: 'row', gap: 8 },
  ponto: { fontSize: 14, color: COR_CHECKOUT.apoio, lineHeight: 20 },
  itemTexto: { flex: 1, fontSize: 14, color: COR_CHECKOUT.texto, lineHeight: 20 },

  assinar: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: RAIO.pilula, backgroundColor: COR.primaria, marginTop: 6,
  },
  assinarTexto: { fontSize: 15, fontWeight: '800', color: COR.sobrePrimaria },
  legalDoCartao: { fontSize: 11, color: COR_CHECKOUT.seguro, textAlign: 'center' },

  comoSePaga: { fontSize: 12.5, color: COR_CHECKOUT.apoio, textAlign: 'center', marginTop: 4 },

  beneficios: {
    marginTop: 14, padding: 18, gap: 14,
    borderRadius: RAIO.cartao, backgroundColor: COR.superficie,
    borderWidth: 1, borderColor: COR_CHECKOUT.contorno,
  },
  secaoDoCartao: { fontSize: 17, fontWeight: '800', color: COR.titulo },
  grupo: { flexDirection: 'row', gap: 12 },
  disco: {
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_CHECKOUT.disco,
  },
  grupoTitulo: { fontSize: 14, fontWeight: '800', color: COR.titulo, marginBottom: 3 },
  grupoItem: { fontSize: 13, color: COR_CHECKOUT.texto, lineHeight: 19 },

  corpoDoAviso: { fontSize: 14, color: COR.secundario, lineHeight: 20 },

  // Os dois portões: quem já paga, e quem está a meio de um pagamento.
  estado: { alignItems: 'center', gap: 12, paddingTop: 40, paddingHorizontal: 8 },
  estadoTitulo: {
    fontSize: 24, fontWeight: '800', color: COR.titulo, textAlign: 'center', lineHeight: 30,
  },
  estadoApoio: { fontSize: 14.5, color: COR.secundario, textAlign: 'center', lineHeight: 21 },
  estadoOnde: {
    fontSize: 13, color: COR_CHECKOUT.apoio, textAlign: 'center', lineHeight: 19, marginTop: 6,
  },
});
