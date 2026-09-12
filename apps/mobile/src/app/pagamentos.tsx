import { useMemo } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import { Redirect } from 'expo-router';

import { COR, COR_CONTA, RAIO } from '@maestra/core/constants/design';
import {
  billingLabel, fmtBRL, fmtDate, STATUS_META, usePaymentHistory,
} from '@maestra/core/hooks/usePaymentHistory';

import { useVoltar } from '@/nucleo/navegar';
import { useSessao } from '@/nucleo/sessao';
import { Carregando } from '@/casca/Carregando';

// O histórico de pagamentos: assinatura e perfis avulsos, na mesma lista, do mais recente ao
// mais antigo.
//
// A busca é a MESMA da web (`usePaymentHistory`, no núcleo): as duas leem as duas tabelas e
// normalizam os status igual. Dois normalizadores dariam dois "Pendente" com significados
// diferentes para a mesma linha do banco.
//
// A tabela da web vira lista aqui: quatro colunas em 375px espremem o valor até ele caber sem
// os centavos, e o valor é a coluna que importa.

// `STATUS_META`, no núcleo, diz o TOM de cada status; aqui ele vira cor. É a mesma tradução
// que a folha da web faz — sem ela, "Pago", "Pendente" e "Vencido" caem todos no mesmo cinza.
const TOM: Record<string, { texto: string; fundo: string }> = {
  ok: { texto: COR_CONTA.pagoTom, fundo: COR_CONTA.pagoFundo },
  warn: { texto: COR_CONTA.atencaoTom, fundo: COR_CONTA.atencaoFundo },
  danger: { texto: COR_CONTA.perigoTom, fundo: COR_CONTA.perigoFundo },
  mute: { texto: COR_CONTA.neutroTom, fundo: COR_CONTA.neutroFundo },
};

export default function Pagamentos() {
  const { sessao, carregando: carregandoSessao } = useSessao();
  const voltar = useVoltar('/conta');
  const { items, loading } = usePaymentHistory(sessao?.user?.id);

  const total = useMemo(
    () => items.filter((i) => i.status === 'paid').reduce((soma, i) => soma + i.amount, 0),
    [items],
  );

  if (!carregandoSessao && !sessao) return <Redirect href="/entrar" />;

  return (
    <SafeAreaView style={estilos.tela}>
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <Pressable onPress={voltar} accessibilityRole="button" accessibilityLabel="Voltar para a conta">
          <Text style={estilos.voltar}>‹  Conta</Text>
        </Pressable>

        <Text style={estilos.sobretitulo}>SUA CONTA</Text>
        <Text style={estilos.titulo}>Histórico de pagamentos</Text>
        <Text style={estilos.apoio}>
          Tudo o que você já pagou na Maestra: a assinatura e os perfis avulsos.
        </Text>

        {loading ? (
          <Carregando estilo={estilos.espera} />
        ) : items.length === 0 ? (
          <View style={estilos.vazio}>
            <Text style={estilos.vazioTitulo}>Nenhum pagamento ainda</Text>
            <Text style={estilos.vazioTexto}>
              Quando você assinar o Pro ou liberar um perfil, o comprovante aparece aqui.
            </Text>
          </View>
        ) : (
          <>
            <View style={estilos.resumo}>
              <View style={estilos.flex}>
                <Text style={estilos.resumoRotulo}>TOTAL PAGO</Text>
                <Text style={estilos.resumoValor}>{fmtBRL(total)}</Text>
              </View>
              <View style={estilos.contagem}>
                <Text style={estilos.contagemTexto}>
                  {items.length} {items.length === 1 ? 'cobrança' : 'cobranças'}
                </Text>
              </View>
            </View>

            <View style={estilos.lista}>
              {items.map((item, indice) => {
                const meta = STATUS_META[item.status];
                return (
                  <View
                    key={item.id}
                    style={[estilos.linha, indice === items.length - 1 && estilos.ultima]}
                  >
                    <View style={estilos.icone}>
                      <Feather
                        name={item.kind === 'subscription' ? 'refresh-cw' : 'user'}
                        size={15}
                        color={COR_CONTA.rotulo}
                      />
                    </View>
                    <View style={estilos.flex}>
                      <Text style={estilos.nome} numberOfLines={1}>{item.title}</Text>
                      <Text style={estilos.detalhe} numberOfLines={1}>
                        {[fmtDate(item.date), billingLabel(item.billing)].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <View style={estilos.direita}>
                      <Text style={estilos.valor}>{fmtBRL(item.amount)}</Text>
                      <View style={[estilos.estado, { backgroundColor: TOM[meta.tone].fundo }]}>
                        <Text style={[estilos.estadoTexto, { color: TOM[meta.tone].texto }]}>
                          {meta.label}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 40 },
  voltar: { fontSize: 15, color: COR.primaria, paddingVertical: 10, marginBottom: 8 },
  sobretitulo: { fontSize: 9, fontWeight: '800', color: COR_CONTA.rotulo, marginBottom: 8 },
  titulo: { fontSize: 27, fontWeight: '800', color: COR_CONTA.titulo },
  apoio: { fontSize: 13, lineHeight: 20, color: COR_CONTA.apoio, marginTop: 9 },
  espera: { marginTop: 48 },
  resumo: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 24, padding: 18, borderRadius: RAIO.campoDeEntrada,
    borderWidth: 1, borderColor: COR_CONTA.contorno, backgroundColor: COR.superficie,
  },
  resumoRotulo: { fontSize: 9, fontWeight: '800', color: COR_CONTA.rotulo },
  resumoValor: { fontSize: 24, fontWeight: '800', color: COR_CONTA.titulo, marginTop: 6 },
  contagem: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: RAIO.pilula,
    backgroundColor: COR_CONTA.disco,
  },
  contagemTexto: { fontSize: 10, fontWeight: '900', color: COR.primaria },
  lista: {
    marginTop: 14, borderWidth: 1, borderColor: COR_CONTA.contorno, borderRadius: RAIO.campoDeEntrada,
    overflow: 'hidden', backgroundColor: COR.superficie,
  },
  linha: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: COR_CONTA.contorno,
  },
  ultima: { borderBottomWidth: 0 },
  icone: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_CONTA.disco,
  },
  nome: { fontSize: 14, fontWeight: '700', color: COR_CONTA.titulo },
  detalhe: { fontSize: 12, color: COR_CONTA.texto, marginTop: 3 },
  direita: { alignItems: 'flex-end' },
  valor: { fontSize: 14, fontWeight: '800', color: COR_CONTA.titulo },
  // Pílula, e não texto solto: é assim que a web pinta o status, e o fundo é o que faz "Pago" e
  // "Vencido" se distinguirem de relance numa lista.
  estado: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: 4 },
  estadoTexto: { fontSize: 10.5, fontWeight: '800' },
  vazio: {
    marginTop: 24, padding: 22, gap: 6, borderRadius: RAIO.campoDeEntrada,
    borderWidth: 1, borderStyle: 'dashed', borderColor: COR_CONTA.contorno,
  },
  vazioTitulo: { fontSize: 16, fontWeight: '700', color: COR_CONTA.titulo },
  vazioTexto: { fontSize: 13, lineHeight: 20, color: COR_CONTA.apoio },
});
