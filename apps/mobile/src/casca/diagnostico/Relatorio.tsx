import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';

import { COR, COR_DIAGNOSTICO, RAIO } from '@maestra/core/constants/design';
import {
  altasForPattern, tierForAltas, tierForPattern,
} from '@maestra/core/constants/realBadge';
import {
  DIM_META, PROFILE_BITS, PROFILE_MAP, clean, fmtNum, type DimKey,
} from '@maestra/core/constants/realCopy';
import { CHAMADA_DO_PLANEJAMENTO, QUEM_ASSINA } from '@maestra/core/constants/realNarrative';
import { autoriaDoDocumento } from '@maestra/core/documentos/diagnostico';

import { CabecalhoDoModulo } from '@/casca/CabecalhoDoModulo';
import { CartaoDaDimensao } from '@/casca/diagnostico/CartaoDaDimensao';
import { Placa } from '@/casca/diagnostico/Placa';
import { baixarDiagnostico } from '@/nucleo/documentos';
import { useSessao } from '@/nucleo/sessao';

// O diagnóstico R·E·A·L, em leitura.
//
// Nada é calculado aqui: o `realIndex` já veio gravado no perfil, produzido pelo mesmo motor que
// a web usa, e os TEXTOS vêm do núcleo (`realCopy`, `realNarrative`). Esta tela só os desenha —
// e por isso ela é o teste de paridade mais honesto que existe, com dado real.
//
// Antes ela tinha quatro barras e uma lista de frases. A web entrega 6.200px: a placa da fase, o
// Índice REAL, quatro cartões completos com sub-métricas e narrativa, o mapa dos 16 perfis, os
// insights, o compartilhamento e quem assina. Faltava quase tudo.

const semTravessao = (texto: string) => clean(texto);

/** A folga que impede a barra de piscar no instante exato em que o convite assoma na tela. */
const FOLGA_DA_CHAMADA = 60;

/**
 * Se a barra fixa do rodapé, com o convite para o planejamento, deve estar na tela.
 *
 * Duas condições, e as duas vieram dos `IntersectionObserver` da web:
 *
 * · o cartão do perfil já saiu por cima. Quem acabou de ver a própria fase ainda está no "uau",
 *   e pedir a decisão ali atropela a leitura;
 * · o convite de verdade AINDA não entrou em cena. Dois botões dizendo a mesma coisa ao mesmo
 *   tempo transformam uma chamada em ruído.
 *
 * Sem as medidas ainda, a resposta é não: uma barra que aparece no topo da tela, antes de a
 * pessoa ler qualquer coisa, é exatamente o que esta regra existe para evitar.
 */
export const mostrarBarraDoConvite = (m: {
  fimDoPerfil?: number;
  inicioDaChamada?: number;
  rolagemY: number;
  alturaVisivel: number;
}): boolean => {
  if (m.fimDoPerfil == null) return false;
  if (m.rolagemY <= m.fimDoPerfil) return false;

  const chamadaEmCena = m.inicioDaChamada != null
    && m.rolagemY + m.alturaVisivel > m.inicioDaChamada + FOLGA_DA_CHAMADA;

  return !chamadaEmCena;
};

type Props = {
  real?: Record<string, any> | null;
  chartmetric?: Record<string, any> | null;
  /** O que o PDF precisa saber além dos números: de quem é o diagnóstico e quem o gerou. */
  artista?: { id?: string; nome?: string; foto?: string | null; vinculo?: string | null };
  /**
   * O convite para o planejamento, no fim do relatório.
   *
   * Opcional porque o relatório aparece em DOIS lugares, e só um deles vende: no fluxo de
   * criação ele termina no desbloqueio; na tela de diagnóstico de um perfil já liberado não há
   * o que oferecer, e um botão de compra ali seria cobrar de novo por algo já pago. É o mesmo
   * `showPlanningCta` da web.
   */
  aoContinuar?: () => void;
  /**
   * Onde estão as duas âncoras que a barra fixa do rodapé precisa: o fim do cartão do perfil e
   * o início do convite.
   *
   * A barra é da ROTA, não daqui: dentro de um ScrollView, `position: absolute` rola junto com
   * o conteúdo e não gruda em lugar nenhum. Então o relatório mede e quem desenha decide.
   *
   * É o equivalente dos dois `IntersectionObserver` da web, que aqui não existem.
   */
  aoMedirAncoras?: (ancoras: { fimDoPerfil?: number; inicioDaChamada?: number }) => void;
};

/**
 * O corpo do relatório, separado da rota porque ele aparece em DOIS lugares — como na web:
 * na página do diagnóstico de um perfil, e no fim do fluxo de criação, antes do desbloqueio.
 * Duas cópias seriam duas telas para manter em pé.
 */
export const Relatorio = ({
  real, chartmetric = null, artista, aoContinuar, aoMedirAncoras,
}: Props) => {
  const { sessao } = useSessao();
  const [gerando, setGerando] = useState(false);
  const perfil = real?.profile;
  const padrao = real?.pattern;
  const altas = altasForPattern(padrao);

  const cidades = (chartmetric?.top_cities ?? []) as { name: string; country: string; listeners: number }[];
  const paises = (chartmetric?.audience?.top_countries ?? []) as { name: string; listeners?: number | null }[];
  const playlists = (chartmetric?.playlists?.top ?? []) as { name: string; followers?: number; editorial?: boolean }[];

  const baixarOPdf = async () => {
    if (!real || gerando) return;
    setGerando(true);
    try {
      const usuario = sessao?.user;
      const meta = (usuario?.user_metadata ?? {}) as { full_name?: string; name?: string };
      await baixarDiagnostico({
        realIndex: real as never,
        chartmetric,
        artistName: artista?.nome || 'artista',
        avatarSrc: artista?.foto || undefined,
        // A autoria sai do NÚCLEO: o `docId` precisa ser o mesmo que a web imprime para o mesmo
        // diagnóstico, senão ele deixa de servir de referência no suporte.
        autoria: autoriaDoDocumento({
          email: usuario?.email,
          nome: meta.full_name || meta.name,
          artistId: artista?.id,
          calculadoEm: (real as Record<string, any>).computedAt,
          vinculo: artista?.vinculo,
        }),
      });
    } catch (e: any) {
      Alert.alert('Não consegui gerar o PDF', e?.message || 'Tente de novo em instantes.');
    } finally {
      setGerando(false);
    }
  };

  const compartilhar = () => {
    if (!perfil) return;
    void Share.share({
      message:
        `Meu Diagnóstico REAL na Maestra: ${perfil.name} — ${altas} de 4 dimensões altas.\n\n`
        + `${semTravessao(perfil.description)}`,
    });
  };

  return (
    <>
    <CabecalhoDoModulo
      titulo="Diagnóstico REAL"
      descricao="Sua fase de carreira atual, com base nos seus dados reais."
    />

    {!perfil ? (
      <View style={estilos.aviso}>
        <Text style={estilos.avisoTitulo}>Diagnóstico indisponível</Text>
        <Text style={estilos.avisoTexto}>
          Este perfil ainda não tem um diagnóstico REAL salvo. Ele é feito na web.
        </Text>
      </View>
    ) : (
      <>
        {/* O "momento uau": a placa da fase, o nome do perfil e o Índice REAL. */}
        <LinearGradient
          colors={[COR_DIAGNOSTICO.cartaoDe, COR_DIAGNOSTICO.cartaoAte]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={estilos.cartaoDoPerfil}
          onLayout={(e) => {
            const { y, height } = e.nativeEvent.layout;
            aoMedirAncoras?.({ fimDoPerfil: y + height });
          }}
        >
          <View style={estilos.linhaDaPlaca}>
            <Placa tier={tierForPattern(padrao)} rotulo={String(altas)} tamanho={72} />
            <View style={estilos.flex}>
              <Text style={estilos.rotuloDoPerfil}>SEU PERFIL DE CARREIRA</Text>
              <Text style={estilos.nomeDoPerfil}>{perfil.name}</Text>
            </View>
          </View>
          <Text style={estilos.descricao}>{semTravessao(perfil.description)}</Text>

          <View style={estilos.indice}>
            <Text style={estilos.indiceRotulo}>ÍNDICE REAL</Text>
            <View style={estilos.indiceLinha}>
              {DIM_META.map((d) => {
                const alta = !!padrao?.[d.key];
                return (
                  <View key={d.key} style={estilos.indiceItem}>
                    <Text style={[estilos.indiceLetra, alta ? estilos.acesa : estilos.apagada]}>
                      {d.letter}
                    </Text>
                    <Text style={[estilos.indicePalavra, alta && estilos.palavraAcesa]}>
                      {d.full}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </LinearGradient>

        {/* As quatro dimensões em detalhe — o §9 do boletim. */}
        {DIM_META.map((d) => (
          <CartaoDaDimensao
            key={d.key}
            chave={d.key as DimKey}
            real={real as Record<string, any>}
            chartmetric={chartmetric}
          />
        ))}

        {cidades.length > 0 && (
          <View style={estilos.cartao}>
            <Text style={estilos.tituloDoCartao}>ONDE SEUS OUVINTES ESTÃO</Text>
            {cidades.slice(0, 5).map((cidade) => {
              const maior = cidades[0].listeners || 1;
              return (
                <View key={`${cidade.name}-${cidade.country}`} style={estilos.linhaDeBarra}>
                  <Text style={estilos.nomeDaBarra} numberOfLines={1}>{cidade.name}</Text>
                  <View style={estilos.trilhoDaBarra}>
                    <View style={[
                      estilos.barra,
                      { width: `${Math.max(6, Math.round((cidade.listeners / maior) * 100))}%` },
                    ]} />
                  </View>
                  <Text style={estilos.valorDaBarra}>{fmtNum(cidade.listeners)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {(playlists.length > 0 || paises.length > 0) && (
          <View style={estilos.cartao}>
            <Text style={estilos.tituloDoCartao}>SUA PRESENÇA NAS PLATAFORMAS</Text>

            {playlists.length > 0 && (
              <View style={estilos.secaoDaPlataforma}>
                <Text style={estilos.subtituloDaPlataforma}>
                  Playlists onde sua música está
                  {chartmetric?.playlists?.count ? ` · ${chartmetric.playlists.count} no total` : ''}
                </Text>
                {playlists.slice(0, 10).map((playlist, i) => (
                  <View key={`${playlist.name}-${i}`} style={estilos.linhaDePlaylist}>
                    <Text style={estilos.posicao}>{i + 1}</Text>
                    <Text style={estilos.nomeDaPlaylist} numberOfLines={1}>{playlist.name}</Text>
                    {playlist.editorial && (
                      <View style={estilos.editorial}>
                        <Text style={estilos.editorialTexto}>Editorial</Text>
                      </View>
                    )}
                    {playlist.followers != null && (
                      <Text style={estilos.seguidores}>{fmtNum(playlist.followers)}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {paises.length > 0 && (
              <View style={estilos.secaoDaPlataforma}>
                <Text style={estilos.subtituloDaPlataforma}>Principais países</Text>
                {paises.slice(0, 6).map((pais) => {
                  const maior = paises[0].listeners || 1;
                  return (
                    <View key={pais.name} style={estilos.linhaDeBarra}>
                      <Text style={estilos.nomeDaBarra} numberOfLines={1}>{pais.name}</Text>
                      <View style={estilos.trilhoDaBarra}>
                        <View style={[
                          estilos.barra,
                          { width: `${Math.max(6, Math.round(((pais.listeners || 0) / maior) * 100))}%` },
                        ]} />
                      </View>
                      <Text style={estilos.valorDaBarra}>
                        {pais.listeners != null ? fmtNum(pais.listeners) : '–'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* O mapa dos 16: onde a pessoa está, e o que existe acima dela. */}
        <View style={estilos.cartao}>
          <Text style={estilos.tituloDoCartao}>SUA POSIÇÃO ENTRE OS 16 PERFIS</Text>
          {PROFILE_MAP.map((andar, indice) => {
            const altasDoAndar = 4 - indice;
            return (
              <View key={andar.tier} style={estilos.andar}>
                <View style={estilos.cabecaDoAndar}>
                  <Placa tier={tierForAltas(altasDoAndar)} rotulo={String(altasDoAndar)} tamanho={38} />
                  <Text style={estilos.nivel}>{andar.tier}</Text>
                </View>
                <View style={estilos.etiquetas}>
                  {andar.names.map((nome) => {
                    const bits = PROFILE_BITS[nome];
                    const ehVoce = nome === perfil.name;
                    return (
                      <View
                        key={nome}
                        style={[estilos.etiqueta, ehVoce && estilos.etiquetaAtiva]}
                      >
                        <Text style={[estilos.nomeDaEtiqueta, ehVoce && estilos.nomeAtivo]}>
                          {nome}
                        </Text>
                        {!!bits && (
                          <View style={estilos.bolinhas}>
                            {(['r', 'e', 'a', 'l'] as const).map((k) => (
                              <View
                                key={k}
                                style={[estilos.bolinha, bits[k] && estilos.bolinhaAcesa]}
                              >
                                <Text style={estilos.bolinhaTexto}>{k.toUpperCase()}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>

        {!!perfil.insights?.length && (
          <View style={estilos.cartao}>
            <Text style={estilos.tituloDoCartao}>O QUE O SEU DIAGNÓSTICO REVELA</Text>
            {perfil.insights.map((texto: string, i: number) => (
              <View key={i} style={estilos.insight}>
                <Text style={estilos.marcador}>▸</Text>
                <Text style={estilos.insightTexto}>{semTravessao(texto)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* SEÇÃO 5 — o convite para o planejamento.
            Vem ANTES de "leve seu diagnóstico", como na web: lá os dois vivem no mesmo bloco,
            com o convite em cima e os botões de levar embaixo. A ordem importa — quem acabou
            de ler o retrato da carreira decide o próximo passo primeiro, e só depois pensa em
            guardar o documento. Ler na ordem inversa é despedir-se antes de convidar.
            E vem antes de "quem assina": a assinatura da metodologia sustenta a oferta, então
            fecha a leitura. */}
        {!!aoContinuar && (
          <View
            style={estilos.cartao}
            onLayout={(e) => aoMedirAncoras?.({ inicioDaChamada: e.nativeEvent.layout.y })}
          >
            <Text style={estilos.chamadaTitulo}>{CHAMADA_DO_PLANEJAMENTO.titulo}</Text>
            <Text style={estilos.chamadaApoio}>{CHAMADA_DO_PLANEJAMENTO.apoio}</Text>
            <Pressable
              style={estilos.chamadaBotao}
              onPress={aoContinuar}
              accessibilityRole="button"
              accessibilityLabel={CHAMADA_DO_PLANEJAMENTO.botao}
            >
              <Text style={estilos.chamadaBotaoTexto}>{CHAMADA_DO_PLANEJAMENTO.botao}</Text>
              <Feather name="arrow-right" size={16} color={COR.sobrePrimaria} />
            </Pressable>
            {/* Tira o medo de clicar: seguir adiante não perde o diagnóstico. */}
            <Text style={estilos.chamadaNota}>{CHAMADA_DO_PLANEJAMENTO.nota}</Text>
          </View>
        )}

        {/* O PDF é o MESMO deck da web, impresso a partir do HTML do núcleo — aqui ele sai com
            texto de verdade, e não como foto de tela. */}
        <View style={estilos.cartao}>
          <Text style={estilos.chamada}>Leve seu diagnóstico</Text>
          <Pressable
            style={[estilos.baixar, gerando && estilos.baixarApagado]}
            onPress={baixarOPdf}
            accessibilityRole="button"
            accessibilityState={{ disabled: gerando }}
            accessibilityLabel="Baixar o diagnóstico em PDF"
          >
            {gerando
              ? <ActivityIndicator size="small" color={COR.primaria} />
              : <Feather name="download" size={15} color={COR.primaria} />}
            <Text style={estilos.baixarTexto}>
              {gerando ? 'Gerando…' : 'Baixar diagnóstico (PDF)'}
            </Text>
          </Pressable>
          <Pressable
            style={estilos.compartilhar}
            onPress={compartilhar}
            accessibilityRole="button"
            accessibilityLabel="Compartilhar diagnóstico"
          >
            <Feather name="share-2" size={15} color={COR.primaria} />
            <Text style={estilos.compartilharTexto}>Compartilhar em texto</Text>
          </Pressable>
        </View>

        <View style={estilos.cartao}>
          <Text style={estilos.tituloDoCartao}>QUEM ASSINA</Text>
          <Text style={estilos.assinaNome}>{QUEM_ASSINA.name}</Text>
          <Text style={estilos.assinaPapel}>{QUEM_ASSINA.role}</Text>
          {QUEM_ASSINA.paras.map((paragrafo, i) => (
            <Text key={i} style={estilos.assinaTexto}>{paragrafo}</Text>
          ))}
          <Text style={estilos.assinaDestaque}>{QUEM_ASSINA.highlight}</Text>
        </View>
      </>
    )}
    </>
  );
};

const estilos = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },

  // O convite do fim do relatório. O botão segue o CTA da marca: pílula, 15/32, texto 16/800.
  chamadaTitulo: {
    fontSize: 20, fontWeight: '800', lineHeight: 26, color: COR_DIAGNOSTICO.titulo,
    marginBottom: 10,
  },
  chamadaApoio: {
    fontSize: 14, lineHeight: 21, color: COR_DIAGNOSTICO.texto, marginBottom: 18,
  },
  chamadaBotao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, paddingHorizontal: 32, borderRadius: RAIO.pilula,
    backgroundColor: COR.primaria,
  },
  chamadaBotaoTexto: {
    fontSize: 16, fontWeight: '800', letterSpacing: 0.16, color: COR.sobrePrimaria,
    flexShrink: 1,
  },
  chamadaNota: {
    fontSize: 12, lineHeight: 17, textAlign: 'center', color: COR_DIAGNOSTICO.rotulo,
    marginTop: 12,
  },

  aviso: {
    borderWidth: 1, borderColor: COR_DIAGNOSTICO.contorno, borderRadius: 14,
    padding: 18, gap: 6, backgroundColor: COR.superficie,
  },
  avisoTitulo: { fontSize: 16, fontWeight: '700', color: COR_DIAGNOSTICO.titulo },
  avisoTexto: { fontSize: 14, lineHeight: 20, color: COR_DIAGNOSTICO.texto },

  cartaoDoPerfil: {
    padding: 26, paddingHorizontal: 24, borderRadius: 20,
    borderWidth: 1, borderColor: COR_DIAGNOSTICO.contorno,
    shadowColor: 'rgba(67, 86, 123, .07)', shadowOpacity: 1,
    shadowOffset: { width: 0, height: 10 }, shadowRadius: 24, elevation: 2,
  },
  linhaDaPlaca: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 14 },
  rotuloDoPerfil: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.54, textTransform: 'uppercase',
    color: COR_DIAGNOSTICO.rotulo,
  },
  nomeDoPerfil: {
    fontSize: 34, fontWeight: '800', letterSpacing: -0.38, color: COR_DIAGNOSTICO.titulo,
    marginTop: 2,
  },
  descricao: { fontSize: 15, lineHeight: 22, color: COR_DIAGNOSTICO.titulo },
  indice: { marginTop: 20 },
  indiceRotulo: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.32, textTransform: 'uppercase',
    color: COR_DIAGNOSTICO.rotulo, marginBottom: 12,
  },
  indiceLinha: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  indiceItem: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 11 },
  indiceLetra: { fontSize: 30, fontWeight: '700', letterSpacing: 0.3 },
  acesa: { color: COR.primaria },
  apagada: { color: COR_DIAGNOSTICO.letraApagada },
  indicePalavra: {
    fontSize: 12, fontWeight: '700', letterSpacing: 0.96, textTransform: 'uppercase',
    color: COR_DIAGNOSTICO.palavra,
  },
  palavraAcesa: { color: COR_DIAGNOSTICO.titulo },

  cartao: {
    padding: 20, borderRadius: 14, gap: 10,
    borderWidth: 1, borderColor: COR_DIAGNOSTICO.contorno, backgroundColor: COR.superficie,
    shadowColor: 'rgba(67, 86, 123, .07)', shadowOpacity: 1,
    shadowOffset: { width: 0, height: 10 }, shadowRadius: 24, elevation: 2,
  },
  tituloDoCartao: {
    fontSize: 12, fontWeight: '800', letterSpacing: 0.52, textTransform: 'uppercase',
    color: COR_DIAGNOSTICO.titulo,
  },

  linhaDeBarra: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nomeDaBarra: { width: 104, fontSize: 13, color: COR_DIAGNOSTICO.texto },
  trilhoDaBarra: {
    flex: 1, height: 8, borderRadius: RAIO.pilula,
    backgroundColor: COR_DIAGNOSTICO.regua, overflow: 'hidden',
  },
  barra: { height: 8, borderRadius: RAIO.pilula, backgroundColor: COR.primaria },
  valorDaBarra: { width: 56, fontSize: 13, textAlign: 'right', color: COR_DIAGNOSTICO.texto },

  secaoDaPlataforma: { gap: 8, marginTop: 6 },
  subtituloDaPlataforma: { fontSize: 13, fontWeight: '700', color: COR_DIAGNOSTICO.secao },
  linhaDePlaylist: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  posicao: { width: 18, fontSize: 11, fontWeight: '800', color: COR_DIAGNOSTICO.rotulo },
  nomeDaPlaylist: { flex: 1, fontSize: 13, color: COR_DIAGNOSTICO.titulo },
  editorial: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: RAIO.pilula,
    backgroundColor: COR_DIAGNOSTICO.discoFundo,
  },
  editorialTexto: { fontSize: 9.5, fontWeight: '800', color: COR.primaria },
  seguidores: { fontSize: 12, color: COR_DIAGNOSTICO.texto },

  andar: { gap: 8, paddingVertical: 7 },
  cabecaDoAndar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nivel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.44, textTransform: 'uppercase',
    color: COR_DIAGNOSTICO.texto,
  },
  // Etiquetas quebrando em linhas, e não numa faixa rolável: em 375px seis nomes numa linha só
  // esconderiam metade dos perfis, e o mapa existe justamente para mostrar o que há acima.
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  etiqueta: {
    gap: 5, paddingVertical: 7, paddingHorizontal: 11, borderRadius: 11,
    borderWidth: 1, borderColor: COR_DIAGNOSTICO.etiquetaContorno,
    backgroundColor: COR_DIAGNOSTICO.etiquetaFundo,
  },
  etiquetaAtiva: {
    borderColor: COR_DIAGNOSTICO.etiquetaAtivaContorno,
    backgroundColor: COR_DIAGNOSTICO.etiquetaAtivaFundo,
  },
  nomeDaEtiqueta: { fontSize: 12, fontWeight: '600', color: COR_DIAGNOSTICO.titulo },
  nomeAtivo: { fontWeight: '800' },
  bolinhas: { flexDirection: 'row', gap: 3 },
  bolinha: {
    width: 15, height: 15, borderRadius: 7.5, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COR_DIAGNOSTICO.bolinhaApagada,
    backgroundColor: COR_DIAGNOSTICO.bolinhaApagada,
  },
  bolinhaAcesa: { borderColor: COR_DIAGNOSTICO.titulo, backgroundColor: COR_DIAGNOSTICO.titulo },
  bolinhaTexto: { fontSize: 8, fontWeight: '800', color: COR.superficie },

  insight: { flexDirection: 'row', gap: 11, marginTop: 6 },
  marcador: { fontSize: 14.5, fontWeight: '800', color: COR_DIAGNOSTICO.bolinhaApagada },
  insightTexto: { flex: 1, fontSize: 14.5, lineHeight: 22, color: COR_DIAGNOSTICO.texto },

  chamada: { fontSize: 18, fontWeight: '800', letterSpacing: -0.24, color: COR_DIAGNOSTICO.titulo },
  compartilhar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 45, borderRadius: RAIO.pilula, marginTop: 4,
    borderWidth: 1, borderColor: COR_DIAGNOSTICO.compartilharContorno,
    backgroundColor: COR.superficie,
  },
  compartilharTexto: { fontSize: 13.5, fontWeight: '700', color: COR.primaria },
  // Baixar o PDF é SECUNDÁRIO, igual a compartilhar. Ele era azul sólido, do mesmo peso do
  // convite para o planejamento, e duas chamadas primárias na mesma tela disputam a decisão em
  // vez de conduzi-la. Na web os dois botões de "levar o diagnóstico" são secundários; só o
  // convite é primário.
  baixar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 45, borderRadius: RAIO.pilula, marginBottom: 10,
    borderWidth: 1, borderColor: COR_DIAGNOSTICO.compartilharContorno,
    backgroundColor: COR.superficie,
  },
  baixarApagado: { opacity: 0.6 },
  baixarTexto: { fontSize: 13.5, fontWeight: '700', color: COR.primaria },
  notaDoPdf: { fontSize: 11.5, lineHeight: 17, color: COR_DIAGNOSTICO.fonte },

  assinaNome: { fontSize: 22, fontWeight: '800', letterSpacing: -0.22, color: COR_DIAGNOSTICO.titulo },
  assinaPapel: { fontSize: 12, fontWeight: '700', color: COR_DIAGNOSTICO.secao },
  assinaTexto: { fontSize: 13, lineHeight: 20, color: COR_DIAGNOSTICO.texto, marginTop: 6 },
  assinaDestaque: {
    fontSize: 13, lineHeight: 20, fontWeight: '700', color: COR_DIAGNOSTICO.titulo, marginTop: 10,
  },
});
