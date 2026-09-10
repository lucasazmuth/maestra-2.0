import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_PLANO, RAIO } from '@maestra/core/constants/design';
import { TASK_OWNER_SELF, TASK_TYPES } from '@maestra/core/constants/maestra';
import { ARTISTS_DEFAULT_IMAGE } from '@maestra/core/constants/spotify';
import type { ActionTask, ArtistMember, Strategy } from '@maestra/core/interfaces/maestra';
import * as eventsDb from '@maestra/core/services/db/events';
import { listMembers } from '@maestra/core/services/db/members';
import { buildActionPlan } from '@maestra/core/services/planoDeAcao';
import { artistsActions } from '@maestra/core/store/slices/artists';
import { useAppDispatch } from '@maestra/core/store/store';

import { CabecalhoDoModulo, FOLGA_APOS_O_CABECALHO } from '@/casca/CabecalhoDoModulo';
import { Arquivadas } from '@/casca/plano/Arquivadas';
import { Escolha, type Opcao } from '@/casca/Escolha';
import { Chip } from '@/casca/plano/Escolha';
import { FichaDaTarefa } from '@/casca/plano/FichaDaTarefa';
import { useArtistaDaRota } from '@/nucleo/artista';
import { useSessao } from '@/nucleo/sessao';

// O Plano de Acao.
//
// E a superficie de uso DIARIO: no celular, o que a pessoa quer e ver o que falta e riscar o que
// fez. Por isso a tarefa e tocavel aqui, e nao so lida — um plano que nao se marca no aparelho
// obriga a voltar ao computador para uma acao de dois segundos.
//
// Quem grava e o mesmo `updateArtistContent` da web, com o content inteiro. Nao ha endpoint
// proprio do app: a regra de escrita e uma so.
//
// ACORDEAO, como na web, e nao lista plana. Um perfil real chegou aqui com 31 estrategias e 107
// tarefas: aberto tudo de uma vez, isso e uma parede de texto que nao se navega no celular, e
// ainda monta as 107 linhas de uma so vez. Uma estrategia aberta por vez, com o cabecalho
// dizendo o progresso, e o que a web faz — e o que torna a tela usavel.
//
// So aparecem as estrategias COM tarefa (as priorizadas); as demais ficam ARQUIVADAS, e voltam
// pelo botao "Arquivadas (N)" — trazer uma de volta e semear nela as tarefas do banco, regra que
// mora no nucleo (`buildActionPlan`) justamente para nao ter duas versoes.

const feita = (t: ActionTask) => t.status === 'done';
const ativa = (t: ActionTask) => t.status !== 'archived';

const hoje = () => new Date().toISOString().split('T')[0];

const identificador = () => Math.random().toString(36).slice(2, 10);

const dataCurta = (iso?: string) => {
  if (!iso) return 'Sem prazo';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
};

/** Fechada de propósito — diferente de "ninguém escolheu nada ainda". */
const FECHADA = '__nenhuma__' as const;

export default function Plano() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const artista = useArtistaDaRota(id);
  // So a tarefa tocada mostra progresso; travar a tela inteira numa lista longa e desagradavel.
  const [gravando, setGravando] = useState<string | null>(null);

  const { sessao } = useSessao();
  const usuario = sessao?.user;
  const dadosDoUsuario = (usuario?.user_metadata ?? {}) as Record<string, string | undefined>;
  const meuNome = dadosDoUsuario.full_name || dadosDoUsuario.name || usuario?.email || 'Usuário';
  const minhaFoto = dadosDoUsuario.avatar_url || dadosDoUsuario.picture;

  const [equipe, setEquipe] = useState<ArtistMember[]>([]);
  const [naFicha, setNaFicha] = useState<{ estrategia: string; tarefa: string } | null>(null);
  const [arquivadasAbertas, setArquivadasAbertas] = useState(false);
  const [menu, setMenu] = useState<
    { tipo: 'categoria' | 'responsavel'; estrategia: string; tarefa: string } | null
  >(null);

  useEffect(() => {
    if (!artista?.id) return undefined;
    let vivo = true;
    listMembers(artista.id).then((d) => { if (vivo) setEquipe(d); }).catch(() => {});
    return () => { vivo = false; };
  }, [artista?.id]);

  // Os responsaveis atribuiveis: o DONO do perfil (sentinela) mais cada membro ativo, pelo
  // e-mail. So a foto de quem esta logado existe — `artist_members` nao tem coluna de avatar.
  const responsaveis = useMemo<Opcao[]>(() => {
    const souODono = !!artista?.user_id && !!usuario?.id && artista.user_id === usuario.id;
    const lista: Opcao[] = [{
      valor: TASK_OWNER_SELF,
      rotulo: souODono ? meuNome : 'Dono do perfil',
      foto: souODono ? minhaFoto : null,
    }];
    equipe.filter((m) => m.status === 'active').forEach((m) => lista.push({
      valor: m.email,
      rotulo: m.name || m.email,
      foto: usuario?.email && m.email.toLowerCase() === usuario.email.toLowerCase()
        ? minhaFoto : null,
    }));
    return lista;
  }, [artista?.user_id, usuario, equipe, meuNome, minhaFoto]);

  // Em ORDEM DE PRIORIDADE (`finalScore` decrescente), como a web — não na ordem em que foram
  // salvas. A lista já se chamou "Ranking de execução" por causa disto, e o rótulo saiu, mas a
  // ordem continua sendo o ponto: sem ela, o app numerava "ESTRATÉGIA #01" numa estratégia que
  // na web é a quinta, e as duas telas discordavam sobre qual é a primeira coisa a fazer.
  const todas: Strategy[] = useMemo(
    () => [...(artista?.content?.strategies ?? [])].sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0)),
    [artista?.content?.strategies],
  );
  // A web mostra so as priorizadas (as que geraram tarefa); sem nenhuma, mostra tudo.
  const comTarefa = todas.filter((e) => (e.tasks?.length ?? 0) > 0);
  const estrategias = comTarefa.length ? comTarefa : todas;
  // As demais ficam no arquivo — so existe arquivo se ALGUMA foi priorizada.
  const arquivadas = comTarefa.length ? todas.filter((e) => !(e.tasks?.length ?? 0)) : [];


  const progresso = (e: Strategy) => {
    const lista = e.tasks ?? [];
    const prontas = lista.filter(feita).length;
    return { prontas, total: lista.length, completa: lista.length > 0 && prontas === lista.length };
  };

  // `undefined` (ninguem escolheu ainda) e FECHADA nao sao a mesma coisa. Tratando os dois igual,
  // fechar a propria estrategia em foco cai de volta no auto-foco e ela reabre sozinha — parece
  // que o toque de fechar nao funciona, e so naquela estrategia. E um bug que a web ja teve.
  const [aberta, setAberta] = useState<string | undefined | typeof FECHADA>(undefined);
  const emFoco = estrategias.find((e) => !progresso(e).completa) ?? estrategias[0];
  const abertaAgora =
    aberta === undefined ? emFoco?.id : aberta === FECHADA ? undefined : aberta;

  // Uma gravacao so, como na web: muda a lista de estrategias inteira e manda o content.
  const gravar = useCallback(async (muda: (lista: Strategy[]) => Strategy[]) => {
    if (!artista) return;
    const proximo = { ...artista.content, strategies: muda(artista.content?.strategies ?? []) };
    await dispatch(artistsActions.updateArtistContent({ id: artista.id, content: proximo })).unwrap();
  }, [artista, dispatch]);

  // A Agenda espelha a tarefa: prazo, descricao e conclusao viram compromisso la. Sem isto, o
  // que se muda aqui deixa de bater com o que a Agenda mostra — e ninguem descobre pelo app.
  const espelharNaAgenda = useCallback((
    estrategia: Strategy, tarefa: ActionTask, patch: Partial<ActionTask>,
  ) => {
    const mexeu = ['deadline', 'description', 'status']
      .some((campo) => Object.prototype.hasOwnProperty.call(patch, campo));
    if (!artista || !mexeu) return;
    const depois = { ...tarefa, ...patch };
    void eventsDb.syncActionPlanTaskEvent({
      artistId: artista.id,
      taskId: tarefa.id,
      title: depois.description,
      strategyTitle: estrategia.title,
      deadline: depois.deadline,
      completed: depois.status === 'done',
    }).catch(() => {});
  }, [artista]);

  const mexerNaTarefa = useCallback(async (
    estrategiaId: string, tarefaId: string, patch: Partial<ActionTask>,
  ) => {
    const estrategia = (artista?.content?.strategies ?? []).find((e) => e.id === estrategiaId);
    const tarefa = estrategia?.tasks?.find((t) => t.id === tarefaId);
    setGravando(tarefaId);
    try {
      await gravar((lista) => lista.map((e) => (e.id !== estrategiaId ? e : {
        ...e,
        tasks: (e.tasks ?? []).map((t) => (t.id === tarefaId ? { ...t, ...patch } : t)),
      })));
      if (estrategia && tarefa) espelharNaAgenda(estrategia, tarefa, patch);
    } finally {
      setGravando(null);
    }
  }, [artista, gravar, espelharNaAgenda]);

  const alternar = (estrategiaId: string, tarefa: ActionTask) =>
    mexerNaTarefa(estrategiaId, tarefa.id, { status: feita(tarefa) ? 'todo' : 'done' });

  const excluirTarefa = (estrategiaId: string, tarefaId: string) => gravar((lista) =>
    lista.map((e) => (e.id !== estrategiaId ? e : {
      ...e, tasks: (e.tasks ?? []).filter((t) => t.id !== tarefaId),
    })));

  const comentar = (estrategiaId: string, tarefa: ActionTask, texto: string) =>
    mexerNaTarefa(estrategiaId, tarefa.id, {
      comments: [...(tarefa.comments ?? []), {
        id: identificador(),
        body: texto,
        authorId: usuario?.id,
        authorName: meuNome,
        authorAvatarUrl: minhaFoto,
        createdAt: new Date().toISOString(),
      }],
    });

  const editarComentario = (estrategiaId: string, tarefa: ActionTask, id: string, texto: string) =>
    mexerNaTarefa(estrategiaId, tarefa.id, {
      comments: (tarefa.comments ?? []).map((c) => (
        c.id === id ? { ...c, body: texto, updatedAt: new Date().toISOString() } : c
      )),
    });

  const excluirComentario = (estrategiaId: string, tarefa: ActionTask, id: string) =>
    mexerNaTarefa(estrategiaId, tarefa.id, {
      comments: (tarefa.comments ?? []).filter((c) => c.id !== id),
    });

  // Trazer do arquivo: a estrategia ganha as tarefas do banco e, por passar a ter tarefa, entra
  // na lista principal — na prioridade que ja estava salva.
  const trazerDoArquivo = (ids: string[]) => gravar((lista) =>
    lista.map((e) => (ids.includes(e.id) ? { ...e, tasks: buildActionPlan(e) } : e)));

  // "Adicionar tarefa" e a Nyta, como na web: la o botao abre o modal dela com a pergunta ja
  // enviada. Aqui a Nyta e uma aba, entao o mesmo pedido viaja pela rota.
  const pedirTarefa = (estrategia: Strategy) => router.push({
    pathname: '/artista/[id]/nyta',
    params: {
      id: String(id),
      pergunta: `Quero criar uma tarefa para a estratégia "${estrategia.title}"`,
    },
  });

  const naFichaEstrategia = estrategias.find((e) => e.id === naFicha?.estrategia);
  const naFichaTarefa = naFichaEstrategia?.tasks?.find((t) => t.id === naFicha?.tarefa);
  const noMenuTarefa = estrategias
    .find((e) => e.id === menu?.estrategia)?.tasks?.find((t) => t.id === menu?.tarefa);

  return (
    <View style={estilos.tela}>
      <ScrollView contentContainerStyle={estilos.conteudo}>

        {/* O cabecalho de pagina, com as MESMAS palavras da web. Ele aparece no celular: a
            regra que parece esconde-lo e de filho direto de `.board-content`, e o heading dos
            modulos e filho da PAGINA. */}
        <View style={estilos.cabecalhoDaPagina}>
          <CabecalhoDoModulo
            titulo="Plano de Ação"
            descricao="Execute suas estratégias em tarefas e acompanhe o progresso até subir de fase."
          />
        </View>

        {estrategias.length === 0 ? (
          <View style={estilos.aviso}>
            <Text style={estilos.avisoTitulo}>Nenhum plano ainda</Text>
            <Text style={estilos.avisoTexto}>
              O planejamento estratégico é feito na web. Depois de concluído, as tarefas aparecem
              aqui para acompanhar no dia a dia.
            </Text>
          </View>
        ) : (
          <>
            {/* A lista das estratégias, sem cabeçalho.
                Ela tinha uma faixa em cima escrita "Ranking de execução" — um rótulo que
                repetia o que a lista já mostra, ocupando uma tela estreita onde cada linha
                conta. A web esconde no celular, pela mesma razão, o kicker "ESTRATÉGIAS DO
                PLANO" e a contagem "N estratégias".

                O que aquela faixa também guardava era o acesso às arquivadas — e isso NÃO pode
                sair junto, ou elas viram um dado sem porta. Ele desce para logo acima da lista,
                e só aparece quando existe alguma. */}
            {arquivadas.length > 0 && (
              <View style={estilos.linhaDasArquivadas}>
                <Pressable
                  style={estilos.arquivadas}
                  onPress={() => setArquivadasAbertas(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Estratégias arquivadas: ${arquivadas.length}`}
                >
                  <Feather name="archive" size={13} color={COR_PLANO.contagemTexto} />
                  <Text style={estilos.arquivadasTexto}>Arquivadas ({arquivadas.length})</Text>
                </Pressable>
              </View>
            )}

            <View style={estilos.moldura}>
              <View style={estilos.listaDeEstrategias}>
            {estrategias.map((estrategia, indice) => {
              const { prontas, total, completa } = progresso(estrategia);
              const estaAberta = abertaAgora === estrategia.id;
              return (
              <View
                key={estrategia.id}
                style={[estilos.bloco, indice < estrategias.length - 1 && estilos.comFio]}
              >
                <Pressable
                  style={[estilos.cabecalho, estaAberta && estilos.cabecalhoAberto]}
                  onPress={() => setAberta(estaAberta ? FECHADA : estrategia.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: estaAberta }}
                  accessibilityLabel={`Estratégia ${indice + 1}: ${estrategia.title}`}
                >
                  <Feather
                    name="chevron-down"
                    size={16}
                    color={estaAberta ? COR.primaria : COR_PLANO.chevron}
                    style={[estilos.chevron, estaAberta && estilos.chevronAberto]}
                  />
                  <View style={estilos.flex}>
                    <Text style={estilos.numero}>
                      ESTRATÉGIA #{String(indice + 1).padStart(2, '0')}
                    </Text>
                    <Text style={estilos.estrategia}>{estrategia.title}</Text>
                  </View>
                  <Text style={[estilos.progresso, completa && estilos.progressoFeito]}>
                    {completa ? 'Concluída' : `${prontas}/${total}`}
                  </Text>
                </Pressable>

                {estaAberta && !!estrategia.why && (
                  <Text style={estilos.porque}>{estrategia.why}</Text>
                )}

                {estaAberta && (estrategia.tasks ?? []).filter(ativa).map((tarefa) => {
                  const responsavel = responsaveis.find((r) => r.valor === tarefa.owner);
                  const comentarios = tarefa.comments?.length ?? 0;
                  return (
                  <View key={tarefa.id} style={estilos.tarefa}>
                    {/* O círculo é o ALVO de concluir — não a linha inteira. Na linha há três
                        outras intenções (categoria, responsável, prazo) e o "⋮"; um toque que
                        marcasse a tarefa a partir de qualquer ponto atropelaria todas elas. */}
                    <Pressable
                      onPress={() => alternar(estrategia.id, tarefa)}
                      disabled={gravando !== null}
                      hitSlop={6}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: feita(tarefa) }}
                      accessibilityLabel={
                        feita(tarefa) ? `Reabrir: ${tarefa.description}` : `Concluir: ${tarefa.description}`
                      }
                    >
                      {gravando === tarefa.id ? (
                        <ActivityIndicator size="small" color={COR.primaria} style={estilos.circulo} />
                      ) : (
                        <Feather
                          name={feita(tarefa) ? 'check-circle' : 'circle'}
                          size={25}
                          color={feita(tarefa) ? COR.primaria : COR_PLANO.marcar}
                          style={estilos.circulo}
                        />
                      )}
                    </Pressable>

                    <View style={estilos.flex}>
                      <Text style={estilos.descricao}>{tarefa.description}</Text>
                      {comentarios > 0 && (
                        <Text style={estilos.comentarios}>
                          {comentarios} {comentarios === 1 ? 'comentário' : 'comentários'}
                        </Text>
                      )}

                      {/* Os três controles da web, na mesma ordem: categoria, responsável, prazo.
                          Eles EDITAM — o dropdown de lá vira folha aqui, que é a forma nativa da
                          mesma decisão e onde cabe o dedo. */}
                      <View style={estilos.chips}>
                        <Chip
                          texto={TASK_TYPES.find((t) => t.v === (tarefa.type || 'acoes'))?.label ?? 'Ações'}
                          tom="categoria"
                          rotulo="Mudar categoria"
                          aoTocar={() => setMenu({ tipo: 'categoria', estrategia: estrategia.id, tarefa: tarefa.id })}
                        />
                        <Pressable
                          style={estilos.responsavel}
                          onPress={() => setMenu({ tipo: 'responsavel', estrategia: estrategia.id, tarefa: tarefa.id })}
                          accessibilityRole="button"
                          accessibilityLabel={
                            responsavel ? `Responsável: ${responsavel.rotulo}` : 'Atribuir responsável'
                          }
                        >
                          {responsavel ? (
                            <Image
                              source={{ uri: responsavel.foto || ARTISTS_DEFAULT_IMAGE }}
                              style={estilos.fotoDoResponsavel}
                            />
                          ) : (
                            <Feather name="plus" size={13} color={COR_PLANO.responsavelIcone} />
                          )}
                        </Pressable>
                        <Chip
                          texto={dataCurta(tarefa.deadline)}
                          tom="prazo"
                          rotulo="Definir prazo"
                          aoTocar={() => setNaFicha({ estrategia: estrategia.id, tarefa: tarefa.id })}
                        />
                      </View>
                    </View>

                    <Pressable
                      style={estilos.mais}
                      onPress={() => setNaFicha({ estrategia: estrategia.id, tarefa: tarefa.id })}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir detalhes de: ${tarefa.description}`}
                    >
                      <Feather name="more-vertical" size={17} color={COR_PLANO.mais} />
                    </Pressable>
                  </View>
                  );
                })}

                {estaAberta && (
                  <View style={estilos.linhaDeAdicionar}>
                    <Pressable
                      style={estilos.adicionar}
                      onPress={() => pedirTarefa(estrategia)}
                      accessibilityRole="button"
                      accessibilityLabel={`Adicionar tarefa em ${estrategia.title}`}
                    >
                      <Feather name="plus" size={14} color={COR.primaria} />
                      <Text style={estilos.adicionarTexto}>Adicionar tarefa</Text>
                    </Pressable>
                  </View>
                )}
              </View>
              );
            })}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <FichaDaTarefa
        aberta={!!naFichaTarefa}
        tarefa={naFichaTarefa ?? null}
        responsaveis={responsaveis}
        autor={{ id: usuario?.id, nome: meuNome }}
        aoFechar={() => setNaFicha(null)}
        aoSalvar={async (patch) => {
          if (naFicha) await mexerNaTarefa(naFicha.estrategia, naFicha.tarefa, patch);
        }}
        aoExcluir={async () => {
          if (naFicha) await excluirTarefa(naFicha.estrategia, naFicha.tarefa);
        }}
        aoComentar={async (texto) => {
          if (naFicha && naFichaTarefa) await comentar(naFicha.estrategia, naFichaTarefa, texto);
        }}
        aoEditarComentario={async (idDoComentario, texto) => {
          if (naFicha && naFichaTarefa) {
            await editarComentario(naFicha.estrategia, naFichaTarefa, idDoComentario, texto);
          }
        }}
        aoExcluirComentario={async (idDoComentario) => {
          if (naFicha && naFichaTarefa) {
            await excluirComentario(naFicha.estrategia, naFichaTarefa, idDoComentario);
          }
        }}
      />

      {/* Os dois menus da linha. Prazo não entra aqui: uma data pede calendário, e ele mora na
          ficha — é para lá que o chip do prazo leva. */}
      <Escolha
        aberta={menu?.tipo === 'categoria'}
        titulo="Categoria"
        opcoes={TASK_TYPES.map((t) => ({ valor: t.v, rotulo: t.label }))}
        valor={noMenuTarefa?.type || 'acoes'}
        aoEscolher={(v) => { if (menu) void mexerNaTarefa(menu.estrategia, menu.tarefa, { type: v ?? 'acoes' }); }}
        aoFechar={() => setMenu(null)}
      />
      <Escolha
        aberta={menu?.tipo === 'responsavel'}
        titulo="Responsável"
        opcoes={responsaveis}
        valor={noMenuTarefa?.owner}
        limpar="Remover responsável"
        aoEscolher={(v) => { if (menu) void mexerNaTarefa(menu.estrategia, menu.tarefa, { owner: v }); }}
        aoFechar={() => setMenu(null)}
      />

      <Arquivadas
        aberta={arquivadasAbertas}
        estrategias={arquivadas}
        aoTrazer={trazerDoArquivo}
        aoFechar={() => setArquivadasAbertas(false)}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  // Os valores sao os do `actionPlan.scss` da web (ver `COR_PLANO` e o teste de cromo). A tela
  // e uma lista de linhas de acordeao com contorno proprio, dentro de um respiro de 14.
  tela: { flex: 1, backgroundColor: COR.fundo },
  flex: { flex: 1, minWidth: 0 },
  conteudo: {
    // Sem recuo de cima: ele é todo do `CabecalhoDoModulo`, para o título nascer à mesma
    // altura em todos os módulos.
    paddingHorizontal: 18, paddingBottom: 122,
  },
  /** Só a folga até a lista: o resto do cabeçalho é do `CabecalhoDoModulo`. */
  cabecalhoDaPagina: { marginBottom: FOLGA_APOS_O_CABECALHO },

  /**
   * A lista é uma FAIXA CONTÍNUA branca, com um contorno só em volta de tudo — o mesmo desenho
   * do catálogo de músicas.
   *
   * Era uma pilha de caixas: cada estratégia com seu próprio contorno, canto e folga, dentro de
   * outra caixa. Numa tela estreita isso vira uma sucessão de molduras aninhadas, e o olho
   * gasta atenção em bordas em vez de gastar no conteúdo. Lista e pilha de caixas não são a
   * mesma coisa, e no celular a web troca uma pela outra.
   */
  moldura: {
    borderWidth: 1, borderColor: COR_PLANO.molduraContorno, borderRadius: 8, overflow: 'hidden',
    backgroundColor: COR.superficie,
  },
  /** A linha das arquivadas, acima da lista: alinhada à direita e só quando há alguma. */
  linhaDasArquivadas: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 },
  arquivadas: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: RAIO.pilula, paddingVertical: 7, paddingHorizontal: 10,
    backgroundColor: COR_PLANO.contagemFundo,
  },
  arquivadasTexto: { fontSize: 10, fontWeight: '900', color: COR_PLANO.contagemTexto },
  /** Sem recuo e sem folga: as faixas se encostam, e o fio entre elas é a separação. */
  listaDeEstrategias: {},
  aviso: {
    borderWidth: 1, borderColor: COR_PLANO.contorno, borderRadius: 8, padding: 18, gap: 6, marginTop: 10,
  },
  avisoTitulo: { fontSize: 16, fontWeight: '700', color: COR_PLANO.titulo },
  avisoTexto: { fontSize: 14, color: COR.secundario, lineHeight: 20 },

  // A faixa do acordeão. Sem contorno próprio: o que separa uma da seguinte é o fio de baixo,
  // e a última não tem nenhum — senão ele desenharia uma linha solta encostada no contorno.
  bloco: {},
  comFio: { borderBottomWidth: 1, borderBottomColor: COR_PLANO.fio },
  cabecalho: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16 },
  // Aberta, o cabecalho ganha um azul levissimo — o bastante pra dizer qual e, sem virar bloco.
  cabecalhoAberto: { backgroundColor: COR_PLANO.cabecalhoAberta },
  // Alinhado ao TOPO, e nao ao centro: titulos reais tem cinco linhas, e centralizado o chevron
  // flutuava solto no meio de um cabecalho alto, sem relacao visivel com nada.
  chevron: { marginTop: 2 },
  chevronAberto: { transform: [{ rotate: '180deg' }] },
  numero: {
    fontSize: 9, fontWeight: '900', color: COR_PLANO.rotulo, letterSpacing: 0.2, marginBottom: 4,
  },
  estrategia: { fontSize: 14, fontWeight: '700', color: COR_PLANO.titulo, lineHeight: 19 },
  // `flexShrink: 0` nao e detalhe: com os titulos de cinco linhas, sem o piso o progresso era
  // espremido ate sumir — o cabecalho perdia justamente o numero que diz se vale a pena abrir.
  progresso: {
    fontSize: 10, fontWeight: '800', color: COR_PLANO.progresso,
    marginTop: 2, flexShrink: 0, minWidth: 52, textAlign: 'right',
  },
  progressoFeito: { color: COR.primaria },
  porque: {
    fontSize: 12, color: COR.secundario, lineHeight: 19,
    paddingHorizontal: 18, paddingBottom: 4,
  },

  // O corpo da linha aberta: separado por um fio, com recuo menor a esquerda pro circulo da
  // tarefa nao encostar na borda.
  tarefa: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 12, paddingRight: 18, paddingLeft: 12.5,
    borderTopWidth: 1, borderTopColor: COR_PLANO.fio,
  },
  pressionada: { opacity: 0.55 },
  circulo: { width: 25, height: 25, marginTop: 3 },
  descricao: { fontSize: 13, fontWeight: '700', color: COR_PLANO.titulo, lineHeight: 18 },
  comentarios: { fontSize: 11, color: COR_PLANO.legenda, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 },
  // O responsável é um círculo de 26, e não uma pílula: é uma PESSOA, e o lugar dela é a foto.
  responsavel: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COR_PLANO.responsavelContorno,
  },
  fotoDoResponsavel: { width: 24, height: 24, borderRadius: 12 },
  mais: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  linhaDeAdicionar: {
    flexDirection: 'row', paddingHorizontal: 12.5, paddingBottom: 14, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: COR_PLANO.fio,
  },
  // Contorno tracejado e sem fundo: é um convite a acrescentar, não uma ação primária.
  adicionar: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    minHeight: 36, paddingHorizontal: 14, borderRadius: RAIO.campo,
    borderWidth: 1, borderStyle: 'dashed', borderColor: COR_PLANO.adicionarContorno,
  },
  adicionarTexto: { fontSize: 12, fontWeight: '800', color: COR.primaria },
});
