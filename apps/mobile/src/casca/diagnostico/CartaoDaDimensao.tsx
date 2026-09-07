import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_DIAGNOSTICO, RAIO } from '@maestra/core/constants/design';
import {
  DIM_META, FREQ_LABELS, PAGANTE_LABELS, PREMIOS_LABELS_V3,
  fmtBRL, fmtNum, fmtPct, type DimKey,
} from '@maestra/core/constants/realCopy';
import { dimNarrative } from '@maestra/core/constants/realNarrative';
import {
  FIXOS, INTRO_DA_DIMENSAO, LEITURA_DA_DIMENSAO,
} from '@maestra/core/constants/realTextos';
import {
  comentariosDaDimensao, seloDaDimensao, statusDaBarra,
} from '@maestra/core/services/realEngine/comentarios';
import {
  AVISOS, ehLegado, linhasDaDimensao, resumoDoE, SIIC_MENSAL,
} from '@maestra/core/services/realEngine/relatorio';

// O cartão de UMA dimensão do boletim — o §9 do documento, e a maior peça da entrega.
//
// Traz, na ordem da web: a letra num disco, o nome e o subtítulo, o selo (Baixo/Alto/TOP ICON),
// a nota sobre 100, a régua com as duas marcas (acende em 70, TOP ICON em 100), a linha de
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
const Receita = ({ real }: { real: Record<string, any> }) => {
  const revenue = real.revenue || {};
  const resumo = resumoDoE(real);
  const partes: { rotulo: string; valor: number }[] = [];
  if (resumo) {
    if (resumo.receitaShows > 0) partes.push({ rotulo: 'Shows', valor: resumo.receitaShows });
    resumo.fontes.forEach((f) => { if (f.valor > 0) partes.push({ rotulo: f.rotulo, valor: f.valor }); });
  } else {
    if (Number(revenue?.shows) > 0) partes.push({ rotulo: 'Shows', valor: Number(revenue.shows) });
    Object.entries((revenue?.sources as Record<string, unknown>) || {}).forEach(([k, v]) => {
      if (Number(v) > 0) partes.push({ rotulo: SRC_LABELS[k] || k, valor: Number(v) });
    });
  }
  const naoSei = resumo?.fontes.filter((f) => f.naoSei) ?? [];
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
      {/*
        §11.3.4 — a fonte marcada "não sei" precisa aparecer. Sumir com ela no zero contaria uma
        receita menor sem dizer por quê, e é justamente aí que mora a recomendação de gestão.
      */}
      {naoSei.length > 0 && (
        <Text style={estilos.observacao}>
          <Text style={estilos.observacaoForte}>Não informado: </Text>
          {naoSei.map((f) => f.rotulo).join(', ')}. {AVISOS.naoSei}
        </Text>
      )}
    </View>
  );
};

/** O engajamento por rede, com a leitura do corte. */
const Engajamento = ({ engagement, informativo }: {
  engagement: Record<string, { value: number; cut: number; above: boolean } | undefined>;
  informativo?: boolean;
}) => (
  <View style={estilos.bloco}>
    <Rotulo>Engajamento por rede</Rotulo>
    {/*
      §8.2 e §11.3.5 — o engajamento está SUSPENSO do cálculo (a API entrega em 21% a 35% dos
      casos, e a taxa não é autodeclarável). Mostrar sem dizer isso faria o artista atribuir a
      nota dele a um número que não a moveu.
    */}
    {informativo && <Text style={estilos.observacao}>{AVISOS.informativo}</Text>}
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

  const legado = ehLegado(real);
  const resumo = resumoDoE(real);
  const [introAberta, setIntroAberta] = useState(false);
  const comentarios = comentariosDaDimensao(real, chave, { superficie: 'tela', chartmetric });

  const linhas: { rotulo: string; num?: number | null; valor?: string; declarado?: boolean }[] =
    // Na v4 as linhas vêm do núcleo, a mesma fonte da tela da web e do PDF. O legado (v2/v3)
    // mantém as suas: aquelas entradas são números crus, sem proveniência, e a base é mensal.
    !legado ? linhasDaDimensao(real, chave, chartmetric).map((l) => ({
      rotulo: l.rotulo, num: l.num, valor: l.valor, declarado: l.fonte === 'self',
    })) :
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

  // A v4 lê o SALDO ANUAL direto do motor; o legado ainda multiplica a base mensal por doze.
  const faturamento = resumo ? resumo.receitaAnual : Math.round(Number(receita.total ?? 0) * 12);
  const investimento = resumo ? resumo.investimentoAnual : Math.round(Number(entradas.investimento ?? 0));
  const saldo = resumo ? resumo.saldo : faturamento - investimento;
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
          {/*
            §3 — o selo do estado. "Top Tier" é o patamar de elite DESTA dimensão; "TOP ICON" é o
            perfil, e só aparece junto do nome dele. São coisas diferentes.
          */}
          <View style={[
            estilos.selo,
            topo ? estilos.seloTopo : alta ? estilos.seloAlto : estilos.seloBaixo,
          ]}>
            <Text style={[
              estilos.seloTexto,
              topo ? estilos.seloTextoTopo : alta ? estilos.seloTextoAlto : estilos.seloTextoBaixo,
            ]}>
              {seloDaDimensao(real, chave).rotulo}
            </Text>
          </View>
          <Text style={estilos.nota}>
            {nota}<Text style={estilos.maximo}>/100</Text>
          </Text>
        </View>
      </View>

      <View style={estilos.regua}>
        {/* TOP ICON enche a régua em dourado: uma barra pela metade contradiria o selo. */}
        <View
          style={[
            estilos.preenchimento,
            topo
              ? { width: '100%', backgroundColor: COR_DIAGNOSTICO.topoAte }
              : { width: `${nota}%`, backgroundColor: alta ? COR.primaria : COR_DIAGNOSTICO.bolinhaApagada },
          ]}
        />
        {/* As duas marcas: 70 acende, 100 é TOP ICON. Sem elas a nota não diz se passou. */}
        <View style={[estilos.marca, { left: '70%' }]} />
      </View>
      {/* F3, F4 ou F5, conforme o estado (§10). */}
      <Text style={estilos.status}>{statusDaBarra(real, chave)}</Text>

      {/*
        A intro da frente, recolhida na tela e aberta no PDF (§2).

        Ela explica o que a dimensão mede, e é longa de propósito: quem já entendeu não precisa
        reler a cada visita, e quem chegou agora precisa dela inteira. O acordeão resolve os dois
        sem obrigar ninguém.
      */}
      {!legado && (
        <View style={estilos.intro}>
          <Pressable
            style={estilos.introBotao}
            onPress={() => setIntroAberta((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: introAberta }}
            accessibilityLabel={FIXOS.F21}
          >
            <Text style={estilos.introRotulo}>{FIXOS.F21}</Text>
            <Feather
              name={introAberta ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={COR_DIAGNOSTICO.secao}
            />
          </Pressable>
          {introAberta && <Text style={estilos.introTexto}>{INTRO_DA_DIMENSAO[chave]}</Text>}
        </View>
      )}

      {/* A frase de leitura (§6.2 e irmãs): uma só, pelo estado, destacada. */}
      {!legado && (
        <View style={estilos.leitura}>
          <Text style={estilos.leituraTexto}>
            {LEITURA_DA_DIMENSAO[chave][alta ? 'alto' : 'baixo']}
          </Text>
        </View>
      )}

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

      {/* §11.3 — o que a interface é obrigada a dizer, junto do número a que se refere. */}
      {/* Os campos que aceitam autodeclaração são todos do R, então é aqui que o convite para
          conectar as redes faz sentido: ao lado das linhas marcadas com †. */}
      {chave === 'r' && !legado && !!real.flags?.autodeclarados?.length && (
        <Text style={estilos.aviso}>{AVISOS.autodeclarado}</Text>
      )}
      {chave === 'a' && !legado && !!real.flags?.aSemBilheteria && (
        <Text style={estilos.aviso}>{AVISOS.semBilheteria}</Text>
      )}
      {chave === 'l' && !legado && !!real.flags?.travaL && (
        <Text style={estilos.aviso}>{AVISOS.travaL}</Text>
      )}

      {chave === 'e' && <Receita real={real} />}
      {/* Cachê médio por tipo de contratante (§7.5): a receita de shows assume distribuição igual
          entre os tipos informados, e ver quais são deixa a aproximação à vista de quem lê. */}
      {chave === 'e' && !!resumo?.cache.length && (
        <View style={estilos.bloco}>
          <Rotulo>Cachê médio por tipo de contratante</Rotulo>
          {resumo.cache.map((c) => (
            <View key={c.tipo} style={estilos.linhaDaLegenda}>
              <Text style={estilos.legendaRotulo}>{c.rotulo}</Text>
              <Text style={estilos.legendaValor}>{fmtBRL(c.valor)}</Text>
            </View>
          ))}
        </View>
      )}
      {chave === 'e' && (() => {
        const semCnpj = resumo ? real.raw?.temCnpj === false : !entradas.temCnpj;
        const semEmpresario = resumo ? real.raw?.temEmpresario === false : !entradas.temEmpresario;
        if (!semCnpj && !semEmpresario) return null;
        return (
          <View style={estilos.selos}>
            {semCnpj && (
              <View style={estilos.seloAmbar}><Text style={estilos.seloAmbarTexto}>Sem CNPJ</Text></View>
            )}
            {semEmpresario && (
              <View style={estilos.seloAmbar}><Text style={estilos.seloAmbarTexto}>Sem empresário</Text></View>
            )}
          </View>
        );
      })()}
      {chave === 'e' && (
        <View style={estilos.bloco}>
          <Rotulo>Saúde financeira · 12 meses</Rotulo>
          <View style={estilos.grade}>
            {([
              [resumo ? 'Receita' : 'Faturamento', dinheiro(faturamento), false],
              [resumo ? 'Custos e investimento' : 'Investimento', dinheiro(investimento), false],
              ['Saldo', `${saldo >= 0 ? '+' : '−'}${dinheiro(saldo)}`, true],
              ...(resumo && resumo.bonus > 1 ? [[
                `Saldo ajustado (+${Math.round((resumo.bonus - 1) * 100)}%)`,
                `${resumo.saldoAjustado >= 0 ? '+' : '−'}${dinheiro(resumo.saldoAjustado)}`,
                true,
              ]] as const : []),
              ...(resumo?.receitaLiquidaEstimada != null ? [[
                `Líquida estimada (${resumo.aliquotaRotulo})`,
                dinheiro(resumo.receitaLiquidaEstimada),
                false,
              ]] as const : []),
            ] as readonly (readonly [string, string, boolean])[]).map(([rotulo, valor, ehSaldo]) => (
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
          {saldo < 0 && <Text style={estilos.aviso}>{AVISOS.saldoNegativo}</Text>}
          {/*
            Comparação com o setor cultural formal (SIIC/IBGE), §7.3. É exibição: a régua do E vem
            da PNAD (P95 da renda individual), e trocar uma pela outra mudaria o método.
          */}
          {!!resumo && (
            <Text style={estilos.observacao}>
              {`A média mensal do setor cultural formal é ${fmtBRL(SIIC_MENSAL)} (SIIC/IBGE). `}
              {`Sua receita anual equivale a ${resumo.vezesOSetor.toFixed(1).replace('.', ',')}× esse patamar.`}
            </Text>
          )}
          {!!resumo?.recomendarEmpresariamento && (
            <Text style={estilos.observacao}>
              Artistas com empresariamento faturam mais na Pesquisa Empresariamento 2025. É a
              estrutura que mais muda esta dimensão.
            </Text>
          )}
        </View>
      )}
      {chave === 'a' && <Engajamento engagement={real.engagement} informativo={!legado} />}

      {/*
        Os comentários da spec do relatório (§6 a §9), escolhidos por gatilho no núcleo.
        Na tela saem até três; o PDF traz todos.

        Cada um abre com a primeira frase em negrito, como na maquete. O corte é feito no núcleo
        para as três superfícies não inventarem regras diferentes.

        O legado (v2/v3) cai na narrativa antiga: os gatilhos novos leem estado que aquele
        cálculo não produzia, e comentar sobre dado que não existe seria inventar.
      */}
      <View style={estilos.revelacao}>
        <Rotulo>O que isso revela</Rotulo>
        {legado ? (
          <>
            <Text style={estilos.chamada}>{narrativa.headline}</Text>
            {narrativa.paras.map((paragrafo, i) => (
              <Text key={i} style={estilos.paragrafo}>
                <Text style={estilos.paragrafoForte}>{paragrafo.lead}</Text> {paragrafo.body}
              </Text>
            ))}
          </>
        ) : (
          comentarios.map((c) => (
            <Text key={c.id} style={estilos.paragrafo}>
              <Text style={estilos.paragrafoForte}>{c.lead}</Text>
              {c.corpo ? ` ${c.corpo}` : ''}
            </Text>
          ))
        )}
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
  // A mesma Georgia itálica do índice: é a mesma letra da sigla, no disco da dimensão.
  letra: {
    fontFamily: 'Georgia', fontStyle: 'italic',
    fontSize: 20, fontWeight: '700', color: COR_DIAGNOSTICO.titulo,
  },
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
  // Nota discreta: o que é informativo, o que não foi informado, a comparação com o setor.
  observacao: { fontSize: 11.5, lineHeight: 16.5, color: COR_DIAGNOSTICO.fonte, marginTop: 10 },
  observacaoForte: { fontWeight: '800' },
  // Os textos obrigatórios do §11.3 — precisam ler como aviso, não como legenda.
  aviso: {
    marginTop: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: RAIO.campo,
    backgroundColor: COR_DIAGNOSTICO.criarChipFundo,
    fontSize: 12.5, lineHeight: 18, color: COR_DIAGNOSTICO.texto,
  },
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

  // A grade nasceu com TRÊS colunas (receita, investimento, saldo) e a v4 acrescentou mais duas:
  // o saldo ajustado pelo bônus de estrutura e a receita líquida estimada. Em cinco colunas os
  // rótulos cortavam no meio da palavra ("Investime", "Líquida"). Agora ela quebra em duas linhas
  // com no mínimo 44% de largura por item, e cada rótulo cabe inteiro.
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  // `minWidth` em vez de `flexBasis` percentual: a base em porcentagem depende de o pai ter
  // largura resolvida, e aqui ela não estava quebrando a linha. Com 140pt de mínimo, cabem dois
  // itens por linha num cartão de ~350pt e o terceiro desce — sem depender de resolução de %.
  itemDaGrade: { flexGrow: 1, minWidth: 140, gap: 4 },
  gradeRotulo: { fontSize: 11, fontWeight: '600', color: COR_DIAGNOSTICO.texto },
  gradeValor: { fontSize: 15, fontWeight: '800', letterSpacing: -0.15, color: COR_DIAGNOSTICO.titulo },
  acima: { color: COR_DIAGNOSTICO.acima },
  abaixo: { color: COR_DIAGNOSTICO.abaixo },
  negativo: { color: COR.erro },

  linhaDeRede: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rede: { width: 70, fontSize: 12.5, fontWeight: '600', color: COR_DIAGNOSTICO.texto },
  taxa: { flex: 1, fontSize: 12.5, fontWeight: '700', color: COR_DIAGNOSTICO.abaixo },

  // A intro fica recolhida atrás de uma linha discreta: ela é longa, e quem já leu não precisa
  // reler a cada visita.
  intro: { marginTop: 12, borderTopWidth: 1, borderTopColor: COR.divisoria, paddingTop: 12 },
  introBotao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  introRotulo: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase',
    color: COR_DIAGNOSTICO.secao,
  },
  introTexto: { marginTop: 10, fontSize: 12.5, lineHeight: 19, color: COR_DIAGNOSTICO.texto },
  // A frase de leitura é a resposta curta da dimensão: leva barra à esquerda e fundo próprio,
  // como na maquete, para não se confundir com os comentários que vêm depois.
  leitura: {
    marginTop: 14, paddingVertical: 14, paddingHorizontal: 16,
    borderLeftWidth: 3, borderLeftColor: COR.primaria,
    borderTopRightRadius: RAIO.campo, borderBottomRightRadius: RAIO.campo,
    backgroundColor: COR_DIAGNOSTICO.discoFundo,
  },
  leituraTexto: { fontSize: 13.5, lineHeight: 20, color: COR_DIAGNOSTICO.titulo },
  revelacao: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: COR.divisoria, gap: 8 },
  chamada: { fontSize: 15, fontWeight: '800', letterSpacing: -0.15, lineHeight: 22, color: COR_DIAGNOSTICO.titulo },
  paragrafo: { fontSize: 13, lineHeight: 20, color: COR_DIAGNOSTICO.titulo },
  // O `lineHeight` REPETIDO no trecho aninhado não é redundância: no iOS, um <Text> dentro de
  // outro que só herda parte da métrica faz o pai medir a altura errado, e a última linha do
  // parágrafo aparece em branco — o espaço existe, os glifos somem. Foi o que cortou o "delas
  // oscila." do parágrafo da receita.
  paragrafoForte: { fontWeight: '800', fontSize: 13, lineHeight: 20 },
});
