import { StyleSheet, Text, View } from 'react-native';

import { COR, COR_DIAGNOSTICO, RAIO } from '@maestra/core/constants/design';
import {
  DIM_META, FREQ_LABELS, PAGANTE_LABELS, PREMIOS_LABELS_V3,
  dimStatusText, fmtBRL, fmtNum, fmtPct, type DimKey,
} from '@maestra/core/constants/realCopy';
import { dimNarrative } from '@maestra/core/constants/realNarrative';

// O cartão de UMA dimensão do boletim — o §9 do documento, e a maior peça da entrega.
//
// Traz, na ordem da web: a letra num disco, o nome e o subtítulo, o selo (Baixo/Alto/Top Tier),
// a nota sobre 100, a régua com as duas marcas (acende em 70, Top Tier em 100), a linha de
// status, as sub-métricas, e a narrativa "O que isso revela".
//
// A narrativa NÃO é escrita aqui nem por IA: vem de `dimNarrative`, no núcleo, que a escolhe a
// partir dos números do motor. É o mesmo texto do PDF e da web — três diagnósticos diferentes
// para os mesmos dados seria o pior defeito possível nesta tela.
//
// O † marca o AUTORRELATO: o que veio de API fica sem marca. Tela, PDF e app precisam contar a
// mesma história sobre a procedência de cada número.

const SRC_LABELS: Record<string, string> = {
  streaming: 'Streaming', direitos: 'Direitos autorais', sync: 'Sincronização',
  merch: 'Merchandising', patrocinio: 'Patrocínio', editais: 'Editais', outros: 'Outros',
};

const Rotulo = ({ children }: { children: React.ReactNode }) => (
  <Text style={estilos.rotuloDeBloco}>{children}</Text>
);

/** A composição da receita. A rosca da web vira barra empilhada: 104px de disco em 375 é pouco. */
const Receita = ({ revenue }: { revenue: Record<string, unknown> }) => {
  const partes: { rotulo: string; valor: number }[] = [];
  if (Number(revenue?.shows) > 0) partes.push({ rotulo: 'Shows', valor: Number(revenue.shows) });
  Object.entries((revenue?.sources as Record<string, unknown>) || {}).forEach(([k, v]) => {
    if (Number(v) > 0) partes.push({ rotulo: SRC_LABELS[k] || k, valor: Number(v) });
  });
  const total = partes.reduce((soma, x) => soma + x.valor, 0);

  if (!total) {
    return <Text style={estilos.vazio}>Composição da receita: sem dados informados.</Text>;
  }

  return (
    <View style={estilos.bloco}>
      <Rotulo>Composição da receita</Rotulo>
      <View style={estilos.barraEmpilhada}>
        {partes.map((parte, i) => (
          <View
            key={parte.rotulo}
            style={{
              flex: parte.valor,
              backgroundColor: COR_DIAGNOSTICO.fatiasDaReceita[i % COR_DIAGNOSTICO.fatiasDaReceita.length],
            }}
          />
        ))}
      </View>
      {partes.map((parte, i) => (
        <View key={parte.rotulo} style={estilos.linhaDaLegenda}>
          <View
            style={[estilos.bolinha, { backgroundColor: COR_DIAGNOSTICO.fatiasDaReceita[i % COR_DIAGNOSTICO.fatiasDaReceita.length] }]}
          />
          <Text style={estilos.legendaRotulo}>{parte.rotulo}</Text>
          <Text style={estilos.legendaValor}>{Math.round((parte.valor / total) * 100)}%</Text>
        </View>
      ))}
    </View>
  );
};

/** O engajamento por rede, com a leitura do corte. */
const Engajamento = ({ engagement }: { engagement: Record<string, { value: number; cut: number; above: boolean } | undefined> }) => (
  <View style={estilos.bloco}>
    <Rotulo>Engajamento por rede</Rotulo>
    {([['Instagram', 'instagram'], ['TikTok', 'tiktok'], ['YouTube', 'youtube']] as const).map(
      ([rotulo, chave]) => {
        const e = engagement?.[chave];
        return (
          <View key={chave} style={estilos.linhaDeRede}>
            <Text style={estilos.rede}>{rotulo}</Text>
            {e ? (
              // O "de" amarra o número ao corte: "0,4% abaixo do corte 2,8%" lia como se 0,4
              // fosse a DISTÂNCIA até o corte, e é a taxa da artista.
              <Text style={[estilos.taxa, e.above ? estilos.acima : estilos.abaixo]}>
                {fmtPct(e.value)} · {e.above ? 'acima' : 'abaixo'} do corte de {fmtPct(e.cut)}
              </Text>
            ) : (
              <Text style={estilos.taxa}>—</Text>
            )}
          </View>
        );
      },
    )}
  </View>
);

export const CartaoDaDimensao = ({ chave, real, chartmetric }: {
  chave: DimKey;
  real: Record<string, any>;
  chartmetric: Record<string, any> | null;
}) => {
  const meta = DIM_META.find((m) => m.key === chave)!;
  const alta = !!real.pattern?.[chave];
  const topo = !!real.dimTopIcon?.[chave];
  const nota = Math.max(0, Math.min(100, Math.round(Number(real.boletim?.[chave] ?? 0))));
  const entradas = real.inputs || {};
  const receita = real.revenue || {};

  const linhas: { rotulo: string; num?: number | null; valor?: string; declarado?: boolean }[] =
    chave === 'r' ? [
      { rotulo: 'Ouvintes Spotify', num: chartmetric?.monthly_listeners ?? entradas.spotifyListeners ?? null },
      { rotulo: 'Instagram', num: entradas.igFollowers ?? null },
      { rotulo: 'TikTok', num: entradas.tiktokFollowers ?? null },
      { rotulo: 'YouTube mensal', num: entradas.youtubeMonthlyViews ?? null },
    ] : chave === 'e' ? [
      { rotulo: 'Receita mensal', valor: fmtBRL(Number(receita.total ?? 0)), declarado: true },
      { rotulo: 'Shows / mês', valor: String(entradas.showsPerMonth ?? 0), declarado: true },
      { rotulo: 'Cachê médio', valor: fmtBRL(Number(entradas.cache ?? 0)), declarado: true },
    ] : chave === 'a' ? [
      { rotulo: 'Shows / mês', valor: String(entradas.showsPerMonth ?? 0), declarado: true },
      {
        rotulo: '% público pagante',
        valor: entradas.fazBilheteria
          ? (PAGANTE_LABELS[entradas.pagantePct] ?? '—')
          : 'Não faz bilheteria',
        declarado: true,
      },
      { rotulo: 'Seguidores Spotify', num: entradas.spotifyFollowers ?? null },
      { rotulo: 'Fãs Deezer', num: entradas.deezerFans ?? null },
    ] : [
      { rotulo: 'Prêmios', valor: PREMIOS_LABELS_V3[Number(entradas.premios ?? 0)] ?? '—', declarado: true },
      {
        rotulo: 'Imprensa',
        valor: entradas.imprensaRepercussao ? (FREQ_LABELS[entradas.imprensaFrequencia] ?? 'Sim') : 'Não',
        declarado: true,
      },
      {
        rotulo: 'Playlists editoriais',
        valor: String(entradas.editorialPlaylists ?? chartmetric?.playlists?.count ?? 0),
      },
      // Sem dado ≠ "não toca": o airplay pode não ter vindo da Chartmetric, e dizer "Não"
      // afirmaria algo que não se sabe.
      {
        rotulo: 'Execução em rádio',
        valor: entradas.radioAirplay == null
          ? 'Sem dado'
          : Number(entradas.radioAirplay) > 0
            ? `${fmtNum(Math.round(Number(entradas.radioAirplay)))} execuções`
            : 'Não',
      },
    ];

  const temDeclarado = linhas.some((l) => l.declarado);
  const narrativa = dimNarrative(chave, real);

  const faturamento = Math.round(Number(receita.total ?? 0) * 12);
  const investimento = Math.round(Number(entradas.investimento ?? 0));
  const saldo = faturamento - investimento;
  const dinheiro = (n: number) => `R$ ${fmtNum(Math.abs(n))}`;

  return (
    <View style={estilos.cartao}>
      <View style={estilos.topo}>
        <View style={estilos.disco}>
          <Text style={estilos.letra}>{meta.letter}</Text>
        </View>
        <View style={estilos.flex}>
          <Text style={estilos.nome}>{meta.full}</Text>
          <Text style={estilos.subnome}>{meta.sub}</Text>
        </View>
        <View style={estilos.notaBloco}>
          <View style={[
            estilos.selo,
            topo ? estilos.seloTopo : alta ? estilos.seloAlto : estilos.seloBaixo,
          ]}>
            <Text style={[
              estilos.seloTexto,
              topo ? estilos.seloTextoTopo : alta ? estilos.seloTextoAlto : estilos.seloTextoBaixo,
            ]}>
              {topo ? 'Top Tier' : alta ? 'Alto' : 'Baixo'}
            </Text>
          </View>
          <Text style={estilos.nota}>
            {nota}<Text style={estilos.maximo}>/100</Text>
          </Text>
        </View>
      </View>

      <View style={estilos.regua}>
        {/* Top Tier enche a régua em dourado: uma barra pela metade contradiria o selo. */}
        <View
          style={[
            estilos.preenchimento,
            topo
              ? { width: '100%', backgroundColor: COR_DIAGNOSTICO.topoAte }
              : { width: `${nota}%`, backgroundColor: alta ? COR.primaria : COR_DIAGNOSTICO.bolinhaApagada },
          ]}
        />
        {/* As duas marcas: 70 acende, 100 é Top Tier. Sem elas a nota não diz se passou. */}
        <View style={[estilos.marca, { left: '70%' }]} />
      </View>
      <Text style={estilos.status}>{dimStatusText(nota, alta, topo)}</Text>

      <View style={estilos.metricas}>
        {linhas.map((linha) => (
          <View key={linha.rotulo} style={estilos.linhaDeMetrica}>
            <Text style={estilos.metricaRotulo}>
              {linha.rotulo}{linha.declarado ? ' †' : ''}
            </Text>
            <Text style={estilos.metricaValor}>
              {linha.num != null ? fmtNum(Math.round(linha.num)) : (linha.valor ?? '—')}
            </Text>
          </View>
        ))}
      </View>
      {temDeclarado && (
        <Text style={estilos.fonte}>
          † Informado por quem preencheu o diagnóstico. A Maestra não verifica estes dados.
        </Text>
      )}

      {chave === 'e' && <Receita revenue={receita} />}
      {chave === 'e' && (!entradas.temCnpj || !entradas.temEmpresario) && (
        <View style={estilos.selos}>
          {!entradas.temCnpj && (
            <View style={estilos.seloAmbar}><Text style={estilos.seloAmbarTexto}>Sem CNPJ</Text></View>
          )}
          {!entradas.temEmpresario && (
            <View style={estilos.seloAmbar}><Text style={estilos.seloAmbarTexto}>Sem empresário</Text></View>
          )}
        </View>
      )}
      {chave === 'e' && (
        <View style={estilos.bloco}>
          <Rotulo>Saúde financeira · 12 meses</Rotulo>
          <View style={estilos.grade}>
            {([
              ['Faturamento', dinheiro(faturamento), false],
              ['Investimento', dinheiro(investimento), false],
              ['Saldo', `${saldo >= 0 ? '+' : '−'}${dinheiro(saldo)}`, true],
            ] as const).map(([rotulo, valor, ehSaldo]) => (
              <View key={rotulo} style={estilos.itemDaGrade}>
                <Text style={estilos.gradeRotulo}>{rotulo}</Text>
                <Text style={[
                  estilos.gradeValor,
                  ehSaldo && (saldo >= 0 ? estilos.acima : estilos.negativo),
                ]}>
                  {valor}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {chave === 'a' && <Engajamento engagement={real.engagement} />}

      <View style={estilos.revelacao}>
        <Rotulo>O que isso revela</Rotulo>
        <Text style={estilos.chamada}>{narrativa.headline}</Text>
        {narrativa.paras.map((paragrafo, i) => (
          <Text key={i} style={estilos.paragrafo}>
            <Text style={estilos.paragrafoForte}>{paragrafo.lead}</Text> {paragrafo.body}
          </Text>
        ))}
      </View>
    </View>
  );
};

const estilos = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  cartao: {
    padding: 22, paddingHorizontal: 20, borderRadius: 14,
    borderWidth: 1, borderColor: COR_DIAGNOSTICO.contorno, backgroundColor: COR.superficie,
    shadowColor: 'rgba(67, 86, 123, .07)', shadowOpacity: 1,
    shadowOffset: { width: 0, height: 10 }, shadowRadius: 24, elevation: 2,
  },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  disco: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COR_DIAGNOSTICO.titulo, backgroundColor: COR_DIAGNOSTICO.discoFundo,
  },
  letra: { fontSize: 20, fontWeight: '700', color: COR_DIAGNOSTICO.titulo },
  nome: { fontSize: 17, fontWeight: '800', color: COR_DIAGNOSTICO.titulo },
  subnome: { fontSize: 11.5, letterSpacing: 0.23, color: COR_DIAGNOSTICO.texto },
  notaBloco: { alignItems: 'flex-end', gap: 4 },
  selo: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RAIO.pilula },
  seloBaixo: { backgroundColor: COR.divisoria },
  seloAlto: { backgroundColor: COR_DIAGNOSTICO.discoFundo },
  seloTopo: { backgroundColor: COR_DIAGNOSTICO.topoDe },
  seloTexto: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.84, textTransform: 'uppercase' },
  seloTextoBaixo: { color: COR_DIAGNOSTICO.texto },
  seloTextoAlto: { color: COR.primaria },
  seloTextoTopo: { color: COR_DIAGNOSTICO.tintaDoTopo },
  nota: { fontSize: 22, fontWeight: '800', letterSpacing: -0.44, color: COR_DIAGNOSTICO.titulo },
  maximo: { fontSize: 12, fontWeight: '700', color: COR_DIAGNOSTICO.maximo },
  regua: {
    height: 8, borderRadius: RAIO.pilula, marginTop: 14,
    backgroundColor: COR_DIAGNOSTICO.regua, overflow: 'hidden', justifyContent: 'center',
  },
  preenchimento: { height: 8, borderRadius: RAIO.pilula },
  marca: { position: 'absolute', top: 0, width: 2, height: 8, backgroundColor: COR_DIAGNOSTICO.texto },
  status: { fontSize: 12, fontWeight: '700', color: COR_DIAGNOSTICO.texto, marginTop: 10 },
  metricas: { marginTop: 14 },
  linhaDeMetrica: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingBottom: 11,
  },
  metricaRotulo: { flex: 1, fontSize: 12.5, color: COR_DIAGNOSTICO.texto },
  metricaValor: { fontSize: 16, fontWeight: '800', letterSpacing: -0.16, color: COR_DIAGNOSTICO.titulo },
  fonte: { fontSize: 11, lineHeight: 16, color: COR_DIAGNOSTICO.fonte },

  bloco: { marginTop: 18, gap: 8 },
  rotuloDeBloco: {
    fontSize: 12, fontWeight: '800', letterSpacing: 0.48, textTransform: 'uppercase',
    color: COR_DIAGNOSTICO.secao,
  },
  vazio: { fontSize: 12.5, color: COR_DIAGNOSTICO.texto, marginTop: 18 },
  // A rosca da web vira barra empilhada: 104px de disco em 375 fica pequeno demais para ler.
  barraEmpilhada: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' },
  linhaDaLegenda: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bolinha: { width: 9, height: 9, borderRadius: 4.5 },
  legendaRotulo: { flex: 1, fontSize: 12.5, color: COR_DIAGNOSTICO.texto },
  legendaValor: { fontSize: 12.5, fontWeight: '800', color: COR_DIAGNOSTICO.titulo },

  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  seloAmbar: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: RAIO.pilula,
    borderWidth: 1, borderColor: COR_DIAGNOSTICO.seloContorno,
    backgroundColor: COR_DIAGNOSTICO.seloFundo,
  },
  seloAmbarTexto: { fontSize: 11, fontWeight: '700', color: COR_DIAGNOSTICO.selo },

  grade: { flexDirection: 'row', gap: 12 },
  itemDaGrade: { flex: 1, gap: 4 },
  gradeRotulo: { fontSize: 11, fontWeight: '600', color: COR_DIAGNOSTICO.texto },
  gradeValor: { fontSize: 15, fontWeight: '800', letterSpacing: -0.15, color: COR_DIAGNOSTICO.titulo },
  acima: { color: COR_DIAGNOSTICO.acima },
  abaixo: { color: COR_DIAGNOSTICO.abaixo },
  negativo: { color: COR.erro },

  linhaDeRede: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rede: { width: 70, fontSize: 12.5, fontWeight: '600', color: COR_DIAGNOSTICO.texto },
  taxa: { flex: 1, fontSize: 12.5, fontWeight: '700', color: COR_DIAGNOSTICO.abaixo },

  revelacao: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: COR.divisoria, gap: 8 },
  chamada: { fontSize: 15, fontWeight: '800', letterSpacing: -0.15, lineHeight: 22, color: COR_DIAGNOSTICO.titulo },
  paragrafo: { fontSize: 13, lineHeight: 20, color: COR_DIAGNOSTICO.titulo },
  paragrafoForte: { fontWeight: '800' },
});
