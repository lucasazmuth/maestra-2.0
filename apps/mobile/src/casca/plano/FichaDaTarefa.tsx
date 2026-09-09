import { useEffect, useState } from 'react';
import {
  Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_PLANO, RAIO } from '@maestra/core/constants/design';

import { Bloco, Folha, Linha } from '@/casca/Folha';
import { TASK_TYPES } from '@maestra/core/constants/maestra';
import { ARTISTS_DEFAULT_IMAGE } from '@maestra/core/constants/spotify';
import type { ActionTask, TaskComment } from '@maestra/core/interfaces/maestra';

import { Escolha, type Opcao } from '@/casca/Escolha';

// A ficha da TAREFA — a mesma do "⋮" da web (`TaskDetailModal`).
//
// Duas abas: Geral (descrição, status, prazo, categoria, responsável) e Comentários. É o mesmo
// casco das fichas de música e de compromisso, pela mesma razão de lá: três fichas com três
// cascos diferentes fariam parecer três produtos.
//
// Aqui é onde "Em andamento" existe. Na lista a bolinha só distingue feito de não-feito, e o
// status textual saiu de propósito — quem quer marcar esse estado abre a ficha, como na web.

const ESTADOS: Opcao[] = [
  { valor: 'todo', rotulo: 'A fazer' },
  { valor: 'in_progress', rotulo: 'Em andamento' },
  { valor: 'done', rotulo: 'Concluída' },
];

const rotuloDoEstado = (v?: string) => ESTADOS.find((e) => e.valor === v)?.rotulo ?? 'A fazer';
const rotuloDaCategoria = (v?: string) =>
  TASK_TYPES.find((t) => t.v === (v || 'acoes'))?.label ?? 'Ações';

const dataLegivel = (iso?: string) => {
  if (!iso) return 'Sem prazo';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
};

/** Aceita DD/MM/AAAA e devolve ISO; recusa data que não existe (31/02 e afins). */
const paraISO = (texto: string): string | undefined => {
  const partes = texto.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!partes) return undefined;
  const [, dia, mes, ano] = partes.map(Number) as unknown as [string, number, number, number];
  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    return undefined;
  }
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
};

const quando = (valor?: string) => {
  if (!valor) return '';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';
  return data.toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

type Aba = 'geral' | 'comentarios';

// Declarados FORA do componente: dentro, cada render cria um tipo novo, o React desmonta o campo
// e o teclado fecha a cada letra. Já custou caro duas vezes nesta empreitada.
const Campo = ({ rotulo, children }: { rotulo: string; children: React.ReactNode }) => (
  <View style={estilos.campo}>
    <Text style={estilos.rotulo}>{rotulo}</Text>
    {children}
  </View>
);

const Seletor = ({ texto, aoTocar, rotulo }: {
  texto: string; aoTocar: () => void; rotulo: string;
}) => (
  <Pressable
    style={estilos.seletor}
    onPress={aoTocar}
    accessibilityRole="button"
    accessibilityLabel={rotulo}
  >
    <Text style={estilos.seletorTexto} numberOfLines={1}>{texto}</Text>
    <Feather name="chevron-down" size={16} color={COR_PLANO.rotulo} />
  </Pressable>
);

export const FichaDaTarefa = ({
  aberta, tarefa, responsaveis, autor,
  aoFechar, aoSalvar, aoExcluir, aoComentar, aoEditarComentario, aoExcluirComentario,
}: {
  aberta: boolean;
  tarefa: ActionTask | null;
  responsaveis: Opcao[];
  autor: { id?: string | null; nome: string };
  aoFechar: () => void;
  aoSalvar: (patch: Partial<ActionTask>) => void | Promise<void>;
  aoExcluir: () => void | Promise<void>;
  aoComentar: (texto: string) => void | Promise<void>;
  aoEditarComentario: (id: string, texto: string) => void | Promise<void>;
  aoExcluirComentario: (id: string) => void | Promise<void>;
}) => {
  const [aba, setAba] = useState<Aba>('geral');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState('acoes');
  const [prazo, setPrazo] = useState<string | undefined>();
  const [prazoDigitado, setPrazoDigitado] = useState('');
  const [responsavel, setResponsavel] = useState<string | undefined>();
  const [estado, setEstado] = useState<ActionTask['status']>('todo');
  const [rascunho, setRascunho] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [textoEditado, setTextoEditado] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [menu, setMenu] = useState<'estado' | 'categoria' | 'responsavel' | null>(null);

  const tarefaId = tarefa?.id;

  // Só ao ABRIR ou trocar de tarefa. Um comentário novo muda o objeto `tarefa`, e reiniciar aqui
  // apagaria a edição em andamento na aba Geral — é o mesmo cuidado que a web documenta.
  useEffect(() => {
    if (!aberta || !tarefa) return;
    setAba('geral');
    setDescricao(tarefa.description);
    setTipo(tarefa.type || 'acoes');
    setPrazo(tarefa.deadline);
    setPrazoDigitado(tarefa.deadline ? dataLegivel(tarefa.deadline) : '');
    setResponsavel(tarefa.owner);
    setEstado(tarefa.status);
    setRascunho('');
    setEditando(null);
    setErro(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, tarefaId]);

  const comentarios: TaskComment[] = tarefa?.comments ?? [];

  const salvar = async () => {
    const texto = descricao.trim();
    if (!texto) { setErro('A tarefa precisa de uma descrição.'); return; }
    setSalvando(true);
    try {
      await aoSalvar({ description: texto, type: tipo, deadline: prazo, owner: responsavel, status: estado });
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar a tarefa.');
    } finally {
      setSalvando(false);
    }
  };

  const excluir = () => {
    Alert.alert('Excluir esta tarefa?', 'Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => { void aoExcluir(); aoFechar(); } },
    ]);
  };

  const comentar = async () => {
    const texto = rascunho.trim();
    if (!texto) return;
    setRascunho('');
    await aoComentar(texto);
  };

  const removerComentario = (id: string) => {
    Alert.alert('Excluir este comentário?', '', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => void aoExcluirComentario(id) },
    ]);
  };

  return (
    <Folha
      aberta={aberta}
      titulo={tarefa?.description || 'Tarefa'}
      aoFechar={aoFechar}
      // Salvar só na aba Geral: na de comentários não há formulário para gravar.
      acao={aba === 'geral' ? { rotulo: 'Salvar alterações', aoTocar: salvar, carregando: salvando } : undefined}
      destrutiva={{ rotulo: 'Excluir', aoTocar: excluir }}
      semRolagem
    >
      <View style={estilos.miolo}>
        <View style={estilos.abas}>
          {([['geral', 'Geral'], ['comentarios', `Comentários${comentarios.length ? ` (${comentarios.length})` : ''}`]] as const)
            .map(([chave, rotulo]) => (
              <Pressable
                key={chave}
                style={[estilos.aba, aba === chave && estilos.abaAtiva]}
                onPress={() => setAba(chave)}
                accessibilityRole="tab"
                accessibilityState={{ selected: aba === chave }}
                accessibilityLabel={rotulo}
              >
                <Text style={[estilos.abaTexto, aba === chave && estilos.abaTextoAtivo]}>{rotulo}</Text>
              </Pressable>
            ))}
        </View>

        <ScrollView contentContainerStyle={estilos.corpo} keyboardShouldPersistTaps="handled">
          {aba === 'geral' ? (
            <>
              <Bloco>
                <Linha primeira>
              <Campo rotulo="Descrição">
                <TextInput
                  style={[estilos.entrada, estilos.entradaAlta]}
                  value={descricao}
                  onChangeText={setDescricao}
                  multiline
                  maxLength={500}
                  placeholder="Descreva a tarefa"
                  placeholderTextColor={COR_PLANO.rotulo}
                  accessibilityLabel="Descrição da tarefa"
                />
              </Campo>
                </Linha>

                <Linha>
              <Campo rotulo="Status">
                <Seletor
                  texto={rotuloDoEstado(estado)}
                  aoTocar={() => setMenu('estado')}
                  rotulo={`Status: ${rotuloDoEstado(estado)}`}
                />
              </Campo>
                </Linha>

                <Linha>
              <Campo rotulo="Prazo">
                <TextInput
                  style={estilos.entrada}
                  value={prazoDigitado}
                  onChangeText={(t) => {
                    setPrazoDigitado(t);
                    if (!t.trim()) { setPrazo(undefined); return; }
                    const iso = paraISO(t);
                    if (iso) setPrazo(iso);
                  }}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor={COR_PLANO.rotulo}
                  keyboardType="number-pad"
                  accessibilityLabel="Prazo"
                />
              </Campo>
                </Linha>
              </Bloco>

              <Bloco rotulo="Classificação">
                <Linha primeira>
              <Campo rotulo="Categoria">
                <Seletor
                  texto={rotuloDaCategoria(tipo)}
                  aoTocar={() => setMenu('categoria')}
                  rotulo={`Categoria: ${rotuloDaCategoria(tipo)}`}
                />
              </Campo>
                </Linha>

                <Linha>
              <Campo rotulo="Responsável">
                <Seletor
                  texto={responsaveis.find((r) => r.valor === responsavel)?.rotulo ?? 'Sem responsável'}
                  aoTocar={() => setMenu('responsavel')}
                  rotulo="Responsável"
                />
              </Campo>
                </Linha>
              </Bloco>

              {!!erro && <Text style={estilos.erro}>{erro}</Text>}
            </>
          ) : (
            <>
              {comentarios.length === 0 ? (
                <Text style={estilos.semComentarios}>
                  Nenhum comentário ainda. Use este espaço para combinar o que precisa acontecer
                  nesta tarefa.
                </Text>
              ) : comentarios.map((comentario) => {
                const meu = comentario.authorId === autor.id;
                const emEdicao = editando === comentario.id;
                return (
                  <View key={comentario.id} style={estilos.comentario}>
                    <Image
                      source={{ uri: comentario.authorAvatarUrl || ARTISTS_DEFAULT_IMAGE }}
                      style={estilos.avatar}
                    />
                    <View style={estilos.flex}>
                      <View style={estilos.linhaDoAutor}>
                        <Text style={estilos.autor}>{comentario.authorName}</Text>
                        {meu && !emEdicao && (
                          <View style={estilos.acoesDoComentario}>
                            <Pressable
                              onPress={() => { setEditando(comentario.id); setTextoEditado(comentario.body); }}
                              hitSlop={8}
                              accessibilityRole="button"
                              accessibilityLabel="Editar comentário"
                            >
                              <Feather name="edit-2" size={13} color={COR_PLANO.rotulo} />
                            </Pressable>
                            <Pressable
                              onPress={() => removerComentario(comentario.id)}
                              hitSlop={8}
                              accessibilityRole="button"
                              accessibilityLabel="Excluir comentário"
                            >
                              <Feather name="trash-2" size={13} color={COR_PLANO.rotulo} />
                            </Pressable>
                          </View>
                        )}
                      </View>
                      <Text style={estilos.data}>
                        {quando(comentario.createdAt)}
                        {comentario.updatedAt ? ' · editado' : ''}
                      </Text>

                      {emEdicao ? (
                        <View style={estilos.edicao}>
                          <TextInput
                            style={[estilos.entrada, estilos.entradaAlta]}
                            value={textoEditado}
                            onChangeText={setTextoEditado}
                            multiline
                            autoFocus
                            accessibilityLabel="Texto do comentário"
                          />
                          <View style={estilos.acoesDaEdicao}>
                            <Pressable
                              onPress={() => setEditando(null)}
                              accessibilityRole="button"
                              accessibilityLabel="Cancelar edição"
                            >
                              <Text style={estilos.cancelar}>Cancelar</Text>
                            </Pressable>
                            <Pressable
                              style={estilos.salvarPequeno}
                              onPress={() => {
                                const texto = textoEditado.trim();
                                if (!texto) return;
                                void aoEditarComentario(comentario.id, texto);
                                setEditando(null);
                              }}
                              accessibilityRole="button"
                              accessibilityLabel="Salvar comentário"
                            >
                              <Text style={estilos.salvarPequenoTexto}>Salvar</Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <Text style={estilos.fala}>{comentario.body}</Text>
                      )}
                    </View>
                  </View>
                );
              })}

              <View style={estilos.compositor}>
                <TextInput
                  style={estilos.entradaDoComentario}
                  value={rascunho}
                  onChangeText={setRascunho}
                  placeholder="Escreva um comentário…"
                  placeholderTextColor={COR_PLANO.rotulo}
                  multiline
                  accessibilityLabel="Novo comentário"
                />
                <Pressable
                  style={[estilos.enviar, !rascunho.trim() && estilos.enviarApagado]}
                  onPress={comentar}
                  disabled={!rascunho.trim()}
                  accessibilityRole="button"
                  accessibilityLabel="Enviar comentário"
                >
                  <Feather name="send" size={16} color={COR.superficie} />
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </View>

      <Escolha
        aberta={menu === 'estado'}
        titulo="Status"
        opcoes={ESTADOS}
        valor={estado}
        aoEscolher={(v) => setEstado((v as ActionTask['status']) ?? 'todo')}
        aoFechar={() => setMenu(null)}
      />
      <Escolha
        aberta={menu === 'categoria'}
        titulo="Categoria"
        opcoes={TASK_TYPES.map((t) => ({ valor: t.v, rotulo: t.label }))}
        valor={tipo}
        aoEscolher={(v) => setTipo(v ?? 'acoes')}
        aoFechar={() => setMenu(null)}
      />
      <Escolha
        aberta={menu === 'responsavel'}
        titulo="Responsável"
        opcoes={responsaveis}
        valor={responsavel}
        limpar="Remover responsável"
        aoEscolher={setResponsavel}
        aoFechar={() => setMenu(null)}
      />
    </Folha>
  );
};

// A casca mora na `Folha`. Aqui ficam as abas, a estratégia e os campos.
const estilos = StyleSheet.create({
  miolo: { flex: 1, minHeight: 0 },
  flex: { flex: 1, minWidth: 0 },
  abas: {
    flexDirection: 'row', gap: 22, paddingHorizontal: 22,
    borderBottomWidth: 1, borderBottomColor: COR_PLANO.fio,
  },
  aba: { paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  abaAtiva: { borderBottomColor: COR.primaria },
  abaTexto: { fontSize: 15, color: COR_PLANO.legenda },
  abaTextoAtivo: { fontWeight: '700', color: COR.primaria },
  // O recuo e o intervalo do corpo saem da `Folha`; aqui fica o espaço ENTRE os blocos.
  corpo: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 28, gap: 22 },
  // Os campos seguem a folha de compromisso da Agenda, que é a referência: rótulo miúdo em caixa
  // alta e o campo SEM moldura, porque o bloco branco já é o recipiente e a divisória já separa.
  campo: { gap: 6 },
  rotulo: { fontSize: 11, fontWeight: '800', color: COR_PLANO.rotulo, letterSpacing: 0.4 },
  entrada: { paddingVertical: 2, fontSize: 15, color: COR_PLANO.titulo },
  entradaAlta: { minHeight: 72, textAlignVertical: 'top' },
  seletor: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    paddingVertical: 2,
  },
  seletorTexto: { flex: 1, fontSize: 15, color: COR_PLANO.titulo },
  erro: { fontSize: 13, color: COR.erro, lineHeight: 19 },

  semComentarios: { fontSize: 13, lineHeight: 20, color: COR_PLANO.legenda },
  comentario: { flexDirection: 'row', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  linhaDoAutor: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  autor: { flex: 1, fontSize: 13, fontWeight: '700', color: COR_PLANO.titulo },
  acoesDoComentario: { flexDirection: 'row', gap: 14 },
  data: { fontSize: 11, color: COR_PLANO.rotulo, marginTop: 2 },
  fala: { fontSize: 14, lineHeight: 21, color: COR_PLANO.titulo, marginTop: 6 },
  edicao: { gap: 10, marginTop: 8 },
  acoesDaEdicao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 16 },
  cancelar: { fontSize: 14, color: COR_PLANO.legenda },
  salvarPequeno: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RAIO.campo,
    backgroundColor: COR.primaria,
  },
  salvarPequenoTexto: { fontSize: 13, fontWeight: '700', color: COR.superficie },
  compositor: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 8 },
  entradaDoComentario: {
    flex: 1, minHeight: 46, maxHeight: 120, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: RAIO.campoDeEntrada, borderWidth: 1, borderColor: COR_PLANO.contorno,
    backgroundColor: COR_PLANO.secaoFundo, fontSize: 15, color: COR_PLANO.titulo,
  },
  enviar: {
    width: 46, height: 46, borderRadius: RAIO.campoDeEntrada,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COR.primaria,
  },
  enviarApagado: { opacity: 0.45 },

});
