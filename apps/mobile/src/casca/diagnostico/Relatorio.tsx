import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';

import { COR, COR_DIAGNOSTICO, COR_PAINEL, RAIO } from '@maestra/core/constants/design';
import {
  altasForPattern, tierForAltas, tierForPattern,
} from '@maestra/core/constants/realBadge';
import {
  DIM_META, PROFILE_BITS, PROFILE_MAP, clean, fmtNum, type DimKey,
} from '@maestra/core/constants/realCopy';
import { CHAMADA_DO_PLANEJAMENTO, QUEM_ASSINA } from '@maestra/core/constants/realNarrative';
import { autoriaDoDocumento } from '@maestra/core/documentos/diagnostico';

import { CabecalhoDoModulo, FOLGA_APOS_O_CABECALHO } from '@/casca/CabecalhoDoModulo';
import { LEITURAS_CURTAS } from '@maestra/core/constants/realTextos';
import { retratoDoPerfil } from '@maestra/core/services/realEngine/comentarios';
import { avisosSemLugarProprio } from '@maestra/core/services/realEngine/relatorio';

/** O padrão de bits R E A L de um perfil, que é a chave dos textos (§5.2, §5.3). */
const chaveDoPerfil = (bits: Record<string, boolean>) =>
  `${bits.r ? 1 : 0}${bits.e ? 1 : 0}${bits.a ? 1 : 0}${bits.l ? 1 : 0}`;
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
    // O relatório é dono do PRÓPRIO ritmo, e não um punhado de irmãos soltos.
    //
    // Ele aparece em TRÊS telas (fim da criação, desbloqueio e o módulo dentro do perfil), e
    // enquanto devolvia um fragmento cada uma decidia o espaçamento por conta: uma tinha `gap`,
    // outra não, e o mesmo documento saía com os cartões grudados numa e respirando na outra.
    // Com a folga aqui dentro, as três não têm como divergir de novo.
    <View style={estilos.pilha}>
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
        {/*
          O "momento uau" da entrega.

          Antes ele era mais um cartão branco de canto arredondado, igual aos onze que vêm
          depois: a frase mais importante do produto pesava o mesmo que uma lista de playlists.
          Agora ele é a ÚNICA superfície escura da tela e sangra de ponta a ponta (por isso a
          margem negativa, que cancela o recuo lateral da rolagem). A profundidade vem do
          contraste com o corpo claro, não de mais uma sombra.

          Tudo aqui é material que a Maestra já tem: a placa da fase, o navy, o roxo da Nyta e a
          Georgia itálica do REAL. Nada de enfeite emprestado.
        */}
        <LinearGradient
          colors={[COR_PAINEL.heroDe, COR_PAINEL.heroAte]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={estilos.heroi}
          onLayout={(e) => {
            const { y, height } = e.nativeEvent.layout;
            aoMedirAncoras?.({ fimDoPerfil: y + height });
          }}
        >
          {/* O anel vazado cortado pela borda: é o recurso gráfico do herói do painel, e a única
              vez que o roxo institucional aparece — como LINHA, nunca como campo. */}
          <View style={estilos.anel} pointerEvents="none" />

          <View style={estilos.linhaDaPlaca}>
            <Placa tier={tierForPattern(padrao)} rotulo={String(altas)} tamanho={76} />
            <View style={estilos.flex}>
              <Text style={estilos.rotuloDoPerfil}>SEU PERFIL DE CARREIRA</Text>
              <Text style={estilos.nomeDoPerfil}>{perfil.name}</Text>
            </View>
          </View>
          {/*
            O RETRATO do perfil (§5.2), e não mais a descrição de uma linha.

            São textos definitivos da Anita, um por perfil, com o Beginner em três estágios que o
            artista não vê. O legado cai na descrição antiga: os retratos descrevem a leitura da
            v4, e colar um deles sobre um cálculo da v3 afirmaria o que ele não sustenta.
          */}
          <Text style={estilos.descricao}>
            {retratoDoPerfil(real)?.texto ?? semTravessao(perfil.description)}
          </Text>

          {/*
            O R·E·A·L vira a assinatura da tela: quatro letras em Georgia itálica, acesas ou
            apagadas. No claro a diferença entre aceso e apagado era um azul contra um cinza
            pálido; no escuro ela é branco puro contra branco a 55%, e as duas se leem.

            O rótulo "ÍNDICE REAL" saiu: eram três caixas-altas espaçadas no mesmo bloco, o
            cabeçalho dois dedos acima já diz "Diagnóstico REAL", e as palavras sob cada letra
            explicam o que elas são.
          */}
          <View style={estilos.assinatura}>
            {DIM_META.map((d) => {
              const alta = !!padrao?.[d.key];
              return (
                <View key={d.key} style={estilos.dimensaoDaAssinatura}>
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
        </LinearGradient>

        {/*
          Os avisos obrigatórios da entrega (§11.3), e o de versão anterior (§13.2).
          
          Sobrou o aviso de VERSÃO, que fala do documento inteiro. Os outros quatro vivem dentro
          da dimensão a que pertencem, onde dizem de qual fonte ou de qual campo se trata — aqui
          em cima eram a mesma frase sem a informação que a torna útil, e chegavam antes de o
          artista ter lido um número sequer. Ver `avisosSemLugarProprio`.
        */}
        {avisosSemLugarProprio(real).map((av) => (
          <View key={av.chave} style={[estilos.aviso, estilos.avisoDaEntrega]}>
            <Text style={estilos.avisoDaEntregaTexto}>{av.texto}</Text>
          </View>
        ))}

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
          <View style={[estilos.cartao, estilos.cartaoDeApoio]}>
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
          <View style={[estilos.cartao, estilos.cartaoDeApoio]}>
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
        <View style={[estilos.cartao, estilos.cartaoDeApoio]}>
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
                        {/* §5.3 — a leitura curta explica o perfil sem abrir nada. */}
                        {!!bits && !!LEITURAS_CURTAS[chaveDoPerfil(bits)] && (
                          <Text style={estilos.leituraCurta}>
                            {LEITURAS_CURTAS[chaveDoPerfil(bits)]}
                          </Text>
                        )}
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

        {/*
          O bloco "O que o seu diagnóstico revela" SAIU (§13.3): eram dois bullets por perfil, e o
          conteúdo deles agora está coberto pelo retrato acima e pelos comentários de cada
          dimensão. Mantê-lo seria dizer a mesma coisa três vezes.
        */}

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
        <View style={[estilos.cartao, estilos.cartaoDeApoio]}>
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

        <View style={[estilos.cartao, estilos.cartaoDeApoio]}>
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
    </View>
  );
};

const estilos = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },

  // O ritmo da pilha: a mesma folga entre o cabeçalho e o primeiro cartão e entre um cartão e o
  // seguinte. É a régua dos outros módulos (`FOLGA_APOS_O_CABECALHO`), para o diagnóstico não ter
  // um espaçamento só dele.
  pilha: { gap: FOLGA_APOS_O_CABECALHO },

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

  // Os textos obrigatórios do §11.3 reusam o cartão de aviso, tingidos de âmbar: eles precisam
  // ler como ressalva, e não como mais um bloco de conteúdo do relatório.
  avisoDaEntrega: {
    borderColor: COR_DIAGNOSTICO.seloContorno, backgroundColor: COR_DIAGNOSTICO.seloFundo,
  },
  avisoDaEntregaTexto: { fontSize: 13, lineHeight: 19, color: COR_DIAGNOSTICO.selo },

  // O herói do diagnóstico é o MESMO herói do painel: navy `heroDe → heroAte`, raio de cartão,
  // padding 26/30 e o anel vazado no canto. Não é um desenho novo.
  //
  // A primeira versão que fiz sangrava de ponta a ponta e ia do navy ao roxo. Ficou bonita e
  // ficou fora do sistema: o roxo `COR.marca` é institucional e entra como LINHA (o anel), nunca
  // como campo, e nenhuma superfície do app rompe o recuo lateral da rolagem.
  heroi: { overflow: 'hidden', padding: 26, paddingBottom: 30, borderRadius: RAIO.cartao },
  // No painel o anel fica embaixo à direita, onde o último elemento é um botão curto e sobra
  // canto. Aqui a última linha é a assinatura R·E·A·L, que ocupa a largura toda — o anel cortava
  // o L. Subiu para o alto, onde a folga é real: à direita do nome do perfil.
  anel: {
    position: 'absolute', right: -104, top: -128,
    width: 190, height: 190, borderRadius: 95,
    borderWidth: 2, borderColor: COR.marca, opacity: 0.72,
  },
  linhaDaPlaca: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  // A escala tipográfica é a do herói do painel: rótulo 10/800/1.1, título 34/37/800, apoio
  // 12/17. Eu tinha subido o nome para 46 — grande, e de um tamanho que não existe no app.
  rotuloDoPerfil: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase',
    color: COR_PAINEL.heroRotulo, marginBottom: 6,
  },
  nomeDoPerfil: {
    fontSize: 34, lineHeight: 37, fontWeight: '800', letterSpacing: -0.4,
    color: COR_PAINEL.sobreEscuro,
  },
  descricao: { fontSize: 13, lineHeight: 19, color: COR_PAINEL.heroTexto, marginTop: 14 },
  // As quatro dimensões em linha: lidas de uma vez, viram a assinatura da entrega. Em duas
  // colunas, como estavam antes, eram só uma lista.
  assinatura: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 22, paddingTop: 18,
    borderTopWidth: 1, borderTopColor: COR_PAINEL.pilulaContorno,
  },
  dimensaoDaAssinatura: { flex: 1, alignItems: 'center', gap: 5 },
  // As quatro letras são a MARCA do índice, não uma inicial qualquer: levam a mesma Georgia
  // itálica do "REAL" do cabeçalho e da placa. É o que as separa do resto da tipografia da tela,
  // toda em Inter — e o que faz o R·E·A·L ler como sigla, e não como quatro letras avulsas.
  indiceLetra: {
    fontFamily: 'Georgia', fontStyle: 'italic',
    fontSize: 30, fontWeight: '700', letterSpacing: 0.3,
  },
  acesa: { color: COR_PAINEL.sobreEscuro },
  apagada: { color: COR_DIAGNOSTICO.letraApagada },
  indicePalavra: {
    fontSize: 9, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase',
    color: COR_DIAGNOSTICO.palavraApagada,
  },
  palavraAcesa: { color: COR_PAINEL.heroRotulo },

  cartao: {
    padding: 20, borderRadius: RAIO.cartao, gap: 10,
    borderWidth: 1, borderColor: COR_DIAGNOSTICO.contorno, backgroundColor: COR.superficie,
    shadowColor: 'rgba(67, 86, 123, .07)', shadowOpacity: 1,
    shadowOffset: { width: 0, height: 10 }, shadowRadius: 24, elevation: 2,
  },
  /**
   * Todo cartão de seção é o MESMO cartão branco — este estilo existe só para não quebrar as
   * chamadas que já o aplicam.
   *
   * A entrega chegou a ter um terceiro nível de superfície: cidades, playlists, os 16 perfis e a
   * bio de quem assina viravam cartão de CONTORNO, sem preenchimento nem sombra, para não pedir
   * a mesma atenção que as quatro dimensões do índice. Antes disso, tentou-se tingi-los com
   * `COR.destaque` sobre o fundo — 2% de diferença, fraco demais para ler como decisão.
   *
   * As duas tentativas foram lidas do mesmo jeito por quem abriu a tela: "por que estes blocos
   * perderam o branco?". Uma hierarquia que precisa ser explicada não está funcionando, e a
   * distinção que importa aqui já é dada pelo herói escuro.
   */
  cartaoDeApoio: {},
  tituloDoCartao: {
    fontSize: 12, fontWeight: '800', letterSpacing: 0.52, textTransform: 'uppercase',
    color: COR_DIAGNOSTICO.secao,
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
  leituraCurta: { fontSize: 11, lineHeight: 15.5, color: COR_DIAGNOSTICO.texto, marginTop: 4 },
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
