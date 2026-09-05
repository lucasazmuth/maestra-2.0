import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_CATALOGO, RAIO } from '@maestra/core/constants/design';
import { CATALOG_STATUS, CATALOG_STATUS_OPTIONS, SPLIT_ROLES } from '@maestra/core/constants/maestra';
import type { CatalogItem, Split } from '@maestra/core/interfaces/maestra';
import { deleteCatalogProject, saveCatalogProjectFromForm } from '@maestra/core/services/db/catalog';

import { Versoes } from '@/casca/musicas/Versoes';
import { enviarParaOCatalogo, escolherImagem } from '@/nucleo/arquivos';

// A ficha da música — a porta do `TrackModal` da web.
//
// Grava pelo MESMO `saveCatalogProjectFromForm` do núcleo, que cuida de projeto e versão de uma
// vez. Não há caminho de escrita próprio do app: se a regra mudar, muda nos dois.
//
// A estrutura é a da web: três abas — Informações, Letras e Splits —, o cabeçalho com o ponto do
// status ao lado do título da faixa, e o rodapé fixo com "Excluir música" e "Salvar".
//
// A capa vem da galeria e as versões do seletor de arquivos do sistema; as duas sobem pelo MESMO
// caminho da web (`enviarArquivo`, no núcleo), para o arquivo cair no mesmo lugar e com o mesmo
// nome, venha de onde vier.

/** `2026-08-29` → `29/08/2026`. */
const paraBR = (iso?: string | null) => (iso ? dayjs(iso).format('DD/MM/YYYY') : '');

/**
 * `29/08/2026` → `2026-08-29`, ou `null`.
 *
 * À mão: ler um formato com o dayjs exige o plugin `customParseFormat`, que o app não carrega —
 * sem ele toda data digitada vira `Invalid Date`. Vazio é válido (a data é opcional).
 */
const paraISO = (br: string): string | null | undefined => {
  if (!br.trim()) return null;
  const partes = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(br.trim());
  if (!partes) return undefined;
  const [, dia, mes, ano] = partes.map(Number) as unknown as [string, number, number, number];
  const d = dayjs(new Date(ano, mes - 1, dia));
  if (!d.isValid() || d.date() !== dia || d.month() !== mes - 1) return undefined;
  return d.format('YYYY-MM-DD');
};

/**
 * Um campo da ficha.
 *
 * No escopo do MÓDULO, e não dentro do formulário: componente declarado dentro de outro é uma
 * referência nova a cada render, o React remonta a subárvore e o teclado fecha a cada tecla.
 */
const Campo = ({ rotulo, children }: { rotulo: string; children: React.ReactNode }) => (
  <View style={estilos.campo}>
    <Text style={estilos.rotulo}>{rotulo}</Text>
    {children}
  </View>
);

type Aba = 'informacoes' | 'letras' | 'splits';

/** Um participante dos créditos: quem é, o que fez e quanto leva. */
const LinhaDeSplit = ({ split, aoMudar, aoRemover }: {
  split: Split;
  aoMudar: (parte: Partial<Split>) => void;
  aoRemover: () => void;
}) => (
  <View style={estilos.split}>
    <View style={estilos.splitTopo}>
      <TextInput
        style={[estilos.entrada, estilos.flex]}
        value={split.name}
        onChangeText={(t) => aoMudar({ name: t })}
        placeholder="Nome do participante"
        placeholderTextColor={COR.espaçoReservado}
        accessibilityLabel="Nome do participante"
      />
      <Pressable
        onPress={aoRemover}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Remover ${split.name || 'participante'}`}
      >
        <Feather name="x" size={18} color={COR_CATALOGO.legenda} />
      </Pressable>
    </View>

    <View style={estilos.papeis}>
      {SPLIT_ROLES.map((papel) => {
        const escolhido = split.role === papel;
        return (
          <Pressable
            key={papel}
            style={[estilos.papel, escolhido && estilos.papelEscolhido]}
            onPress={() => aoMudar({ role: papel })}
            accessibilityRole="radio"
            accessibilityState={{ selected: escolhido }}
          >
            <Text style={[estilos.papelTexto, escolhido && estilos.papelTextoEscolhido]}>
              {papel}
            </Text>
          </Pressable>
        );
      })}
    </View>

    <View style={estilos.splitBaixo}>
      <TextInput
        style={[estilos.entrada, estilos.entradaCurta]}
        value={String(split.percentage ?? '')}
        onChangeText={(t) => aoMudar({ percentage: Number(t.replace(/[^\d]/g, '')) || 0 })}
        placeholder="0"
        placeholderTextColor={COR.espaçoReservado}
        keyboardType="number-pad"
        accessibilityLabel="Percentual"
      />
      <Text style={estilos.porcento}>%</Text>
    </View>
  </View>
);

export const FichaDaFaixa = ({
  aberta, artistaId, faixa, generos, autor, aoFechar, aoSalvar, aoExcluir, aoMudarVersoes,
}: {
  aberta: boolean;
  artistaId: string;
  faixa: CatalogItem | null;
  generos: string[];
  autor: { id?: string | null; nome?: string | null };
  aoFechar: () => void;
  aoSalvar: (f: CatalogItem) => void;
  aoExcluir: (id: string) => void;
  aoMudarVersoes: () => void;
}) => {
  const [rascunho, setRascunho] = useState<Partial<CatalogItem>>({});
  const [dataEscrita, setDataEscrita] = useState('');
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>('informacoes');
  const [enviandoCapa, setEnviandoCapa] = useState(false);

  useEffect(() => {
    if (!aberta) return;
    const base: Partial<CatalogItem> = faixa ?? { title: '', status: 'composition' };
    setRascunho(base);
    setDataEscrita(paraBR(base.release_date));
    setErro(null);
    setAba('informacoes');
  }, [aberta, faixa]);

  const mudar = (parte: Partial<CatalogItem>) => setRascunho((r) => ({ ...r, ...parte }));

  const autorais = rascunho.composition_splits ?? [];
  const fonograma = rascunho.recording_splits ?? [];

  const mudarSplits = (qual: 'composition_splits' | 'recording_splits', lista: Split[]) =>
    mudar({ [qual]: lista } as Partial<CatalogItem>);

  const somar = (lista: Split[]) => lista.reduce((n, s) => n + (Number(s.percentage) || 0), 0);

  const trocarCapa = async () => {
    setErro(null);
    try {
      const escolhida = await escolherImagem();
      if (!escolhida) return;
      setEnviandoCapa(true);
      const enviada = await enviarParaOCatalogo(`${artistaId}/covers`, escolhida);
      mudar({ cover_image: enviada.url, cover_image_name: enviada.name });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui enviar a capa.');
    } finally {
      setEnviandoCapa(false);
    }
  };

  const salvar = async () => {
    if (!rascunho.title?.trim()) {
      setErro('Informe o título.');
      return;
    }
    const lancamento = paraISO(dataEscrita);
    if (lancamento === undefined) {
      setErro('A data de lançamento precisa estar no formato 28/08/2026.');
      return;
    }

    setErro(null);
    setGravando(true);
    try {
      const salva = await saveCatalogProjectFromForm({
        // `project_id` e não `id`: o `id` do item é o da VERSÃO, e mandar ele como projeto
        // criaria uma faixa nova a cada edição.
        id: faixa?.project_id ?? undefined,
        versionId: faixa?.id,
        artist_id: artistaId,
        title: rascunho.title.trim(),
        status: rascunho.status || 'composition',
        genre: rascunho.genre || null,
        release_date: lancamento,
        isrc: rascunho.isrc || null,
        upc: rascunho.upc || null,
        bpm: rascunho.bpm || null,
        key: rascunho.key || null,
        lyrics: rascunho.lyrics || null,
        composition_splits: autorais,
        recording_splits: fonograma,
      });
      aoSalvar(salva);
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar.');
    } finally {
      setGravando(false);
    }
  };

  const confirmarExclusao = () => {
    if (!faixa?.project_id) return;
    Alert.alert(
      'Excluir música?',
      'A música e todas as versões dela serão apagadas. Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCatalogProject(faixa.project_id!);
              aoExcluir(faixa.id);
              aoFechar();
            } catch (e) {
              setErro(e instanceof Error ? e.message : 'Não consegui excluir.');
            }
          },
        },
      ],
    );
  };

  return (
    <Modal visible={aberta} animationType="slide" presentationStyle="pageSheet" onRequestClose={aoFechar}>
      <KeyboardAvoidingView style={estilos.folha} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* O cabecalho da web: o sobretitulo, o ponto do status ao lado do titulo da faixa, o
            subtitulo que explica o que e esta ficha, e o "x" a direita. */}
        <View style={estilos.topo}>
          <View style={estilos.flex}>
            <Text style={estilos.sobretitulo}>MÚSICA</Text>
            <View style={estilos.tituloLinha}>
              <View
                style={[
                  estilos.pontoDoTitulo,
                  { backgroundColor: CATALOG_STATUS[(rascunho.status ?? 'composition') as keyof typeof CATALOG_STATUS]?.color ?? COR.apagado },
                ]}
              />
              <Text style={estilos.titulo} numberOfLines={2}>
                {rascunho.title?.trim() || (faixa ? 'Editar música' : 'Nova música')}
              </Text>
            </View>
            <Text style={estilos.subtitulo}>
              A ficha da obra: identidade, créditos e letra. As gravações ficam nas versões.
            </Text>
          </View>
          <Pressable onPress={aoFechar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar">
            <Feather name="x" size={22} color={COR_CATALOGO.legenda} />
          </Pressable>
        </View>

        <View style={estilos.abas}>
          {([['informacoes', 'Informações'], ['letras', 'Letras'], ['splits', 'Splits']] as const)
            .map(([chave, texto]) => {
              const acesa = aba === chave;
              return (
                <Pressable
                  key={chave}
                  style={[estilos.aba, acesa && estilos.abaAcesa]}
                  onPress={() => setAba(chave)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: acesa }}
                >
                  <Text style={[estilos.abaTexto, acesa && estilos.abaTextoAceso]}>{texto}</Text>
                </Pressable>
              );
            })}
        </View>

        <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
          {aba === 'informacoes' && (
            <>
              <Campo rotulo="Título">
                <TextInput
                  style={estilos.entrada}
                  value={rascunho.title ?? ''}
                  onChangeText={(t) => mudar({ title: t })}
                  placeholder="Título da música"
                  placeholderTextColor={COR.espaçoReservado}
                  autoFocus={!faixa}
                  accessibilityLabel="Título"
                />
              </Campo>

              <Campo rotulo="Status">
                <View style={estilos.opcoes}>
                  {CATALOG_STATUS_OPTIONS.map((opcao) => {
                    const escolhido = (rascunho.status ?? 'composition') === opcao.id;
                    return (
                      <Pressable
                        key={opcao.id}
                        style={[estilos.opcao, escolhido && estilos.opcaoEscolhida]}
                        onPress={() => mudar({ status: opcao.id })}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: escolhido }}
                      >
                        <View style={[estilos.pontoDoStatus, { backgroundColor: opcao.color }]} />
                        <Text style={[estilos.opcaoTexto, escolhido && estilos.opcaoTextoEscolhido]}>
                          {opcao.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Campo>

              <Campo rotulo="Gênero">
                <TextInput
                  style={estilos.entrada}
                  value={rascunho.genre ?? ''}
                  onChangeText={(t) => mudar({ genre: t })}
                  placeholder="Gênero"
                  placeholderTextColor={COR.espaçoReservado}
                  accessibilityLabel="Gênero"
                />
                {generos.length > 0 && (
                  <View style={estilos.sugestoes}>
                    {generos.slice(0, 6).map((genero) => (
                      <Pressable
                        key={genero}
                        style={estilos.sugestao}
                        onPress={() => mudar({ genre: genero })}
                        accessibilityRole="button"
                      >
                        <Text style={estilos.sugestaoTexto}>{genero}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </Campo>

              <Campo rotulo="Data de lançamento">
                <TextInput
                  style={estilos.entrada}
                  value={dataEscrita}
                  onChangeText={setDataEscrita}
                  placeholder="28/08/2026"
                  placeholderTextColor={COR.espaçoReservado}
                  keyboardType="numbers-and-punctuation"
                  accessibilityLabel="Data de lançamento"
                />
              </Campo>

              <View style={estilos.lado}>
                <View style={estilos.flex}>
                  <Campo rotulo="ISRC">
                    <TextInput
                      style={estilos.entrada}
                      value={rascunho.isrc ?? ''}
                      onChangeText={(t) => mudar({ isrc: t })}
                      placeholder="ISRC"
                      placeholderTextColor={COR.espaçoReservado}
                      autoCapitalize="characters"
                      accessibilityLabel="ISRC"
                    />
                  </Campo>
                </View>
                <View style={estilos.flex}>
                  <Campo rotulo="UPC">
                    <TextInput
                      style={estilos.entrada}
                      value={rascunho.upc ?? ''}
                      onChangeText={(t) => mudar({ upc: t })}
                      placeholder="UPC"
                      placeholderTextColor={COR.espaçoReservado}
                      keyboardType="number-pad"
                      accessibilityLabel="UPC"
                    />
                  </Campo>
                </View>
              </View>

              <View style={estilos.lado}>
                <View style={estilos.flex}>
                  <Campo rotulo="BPM">
                    <TextInput
                      style={estilos.entrada}
                      value={rascunho.bpm ?? ''}
                      onChangeText={(t) => mudar({ bpm: t })}
                      placeholder="BPM"
                      placeholderTextColor={COR.espaçoReservado}
                      keyboardType="number-pad"
                      accessibilityLabel="BPM"
                    />
                  </Campo>
                </View>
                <View style={estilos.flex}>
                  <Campo rotulo="Tom">
                    <TextInput
                      style={estilos.entrada}
                      value={rascunho.key ?? ''}
                      onChangeText={(t) => mudar({ key: t })}
                      placeholder="Tom"
                      placeholderTextColor={COR.espaçoReservado}
                      accessibilityLabel="Tom"
                    />
                  </Campo>
                </View>
              </View>

              <Campo rotulo="Capa">
                <Pressable
                  style={estilos.capa}
                  onPress={trocarCapa}
                  disabled={enviandoCapa}
                  accessibilityRole="button"
                  accessibilityLabel={rascunho.cover_image ? 'Trocar a capa' : 'Escolher a capa'}
                >
                  {enviandoCapa ? (
                    <ActivityIndicator color={COR.primaria} />
                  ) : rascunho.cover_image ? (
                    <>
                      <Image source={{ uri: rascunho.cover_image }} style={estilos.capaImagem} />
                      <View style={estilos.flex}>
                        <Text style={estilos.capaNome} numberOfLines={1}>
                          {rascunho.cover_image_name || 'Capa da música'}
                        </Text>
                        <Text style={estilos.capaApoio}>Toque para trocar</Text>
                      </View>
                      <Pressable
                        onPress={() => mudar({ cover_image: null, cover_image_name: null })}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Remover a capa"
                      >
                        <Feather name="x" size={18} color={COR_CATALOGO.legenda} />
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <View style={estilos.capaVazia}>
                        <Feather name="image" size={18} color={COR_CATALOGO.legenda} />
                      </View>
                      <View style={estilos.flex}>
                        <Text style={estilos.capaNome}>Escolher a capa</Text>
                        <Text style={estilos.capaApoio}>PNG ou JPG</Text>
                      </View>
                    </>
                  )}
                </Pressable>
              </Campo>

              <Campo rotulo="Versões">
                <Versoes
                  artistaId={artistaId}
                  projetoId={faixa?.project_id}
                  autor={autor}
                  aoMudar={aoMudarVersoes}
                />
              </Campo>
            </>
          )}

          {aba === 'letras' && (
            <TextInput
              style={[estilos.entrada, estilos.entradaAlta]}
              value={rascunho.lyrics ?? ''}
              onChangeText={(t) => mudar({ lyrics: t })}
              placeholder="Letra da música…"
              placeholderTextColor={COR.espaçoReservado}
              multiline
              accessibilityLabel="Letra"
            />
          )}

          {aba === 'splits' && (
            <>
              {([
                ['Composição', 'Créditos autorais da obra', 'composition_splits', autorais],
                ['Gravação', 'Créditos do fonograma', 'recording_splits', fonograma],
              ] as const).map(([nome, apoio, chave, lista]) => (
                <View key={chave} style={estilos.grupoDeSplit}>
                  <Text style={estilos.grupoNome}>{nome}</Text>
                  <Text style={estilos.grupoApoio}>{apoio}</Text>

                  {lista.length === 0
                    ? <Text style={estilos.semParticipante}>Nenhum participante adicionado.</Text>
                    : lista.map((split, i) => (
                      <LinhaDeSplit
                        key={split.id}
                        split={split}
                        aoMudar={(parte) => mudarSplits(
                          chave,
                          lista.map((s, j) => (i === j ? { ...s, ...parte } : s)),
                        )}
                        aoRemover={() => mudarSplits(chave, lista.filter((_, j) => j !== i))}
                      />
                    ))}

                  <Pressable
                    style={estilos.adicionar}
                    onPress={() => mudarSplits(chave, [
                      ...lista,
                      // O id é só para a lista se manter estável enquanto se edita; quem grava
                      // é o `saveCatalogProjectFromForm`, com o array inteiro.
                      { id: `s-${Date.now()}`, name: '', role: SPLIT_ROLES[0], percentage: 0 },
                    ])}
                    accessibilityRole="button"
                    accessibilityLabel={`Adicionar participante em ${nome}`}
                  >
                    <Feather name="plus" size={14} color={COR.primaria} />
                    <Text style={estilos.adicionarTexto}>Adicionar participante</Text>
                  </Pressable>

                  {/* O total precisa fechar em 100%: passar disso divide direito que não existe. */}
                  <View style={estilos.total}>
                    <Text style={estilos.totalRotulo}>Total</Text>
                    <Text style={[estilos.totalValor, somar(lista) > 100 && estilos.totalExcedido]}>
                      {somar(lista)}%
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {!!erro && <Text style={estilos.erro}>{erro}</Text>}
        </ScrollView>

        {/* O rodape e FIXO, como na web: excluir a esquerda, salvar a direita. Ele nao rola com
            o conteudo — numa ficha de tres abas, um "Salvar" no fim da rolagem se esconde. */}
        <View style={estilos.rodape}>
          {faixa ? (
            <Pressable
              style={estilos.excluir}
              onPress={confirmarExclusao}
              accessibilityRole="button"
              accessibilityLabel="Excluir música"
            >
              <Feather name="trash-2" size={15} color={COR.erro} />
              <Text style={estilos.excluirTexto}>Excluir música</Text>
            </Pressable>
          ) : <View />}

          <Pressable
            style={estilos.salvar}
            onPress={salvar}
            disabled={gravando}
            accessibilityRole="button"
          >
            {gravando
              ? <ActivityIndicator size="small" color={COR.sobrePrimaria} />
              : <Text style={estilos.salvarTexto}>Salvar</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const estilos = StyleSheet.create({
  folha: { flex: 1, backgroundColor: COR.superficie },
  flex: { flex: 1 },
  topo: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 18, paddingTop: 20, paddingBottom: 16,
  },
  sobretitulo: { fontSize: 9, fontWeight: '800', color: COR_CATALOGO.rotulo, letterSpacing: 1 },
  titulo: { flex: 1, fontSize: 17, fontWeight: '800', color: COR_CATALOGO.titulo, lineHeight: 22 },
  tituloLinha: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 2 },
  pontoDoTitulo: { width: 8, height: 8, borderRadius: 4 },
  subtitulo: { fontSize: 12, color: COR_CATALOGO.legenda, lineHeight: 17, marginTop: 6 },

  // As tres abas com o sublinhado azul na ativa, como na web.
  abas: {
    flexDirection: 'row', gap: 22, paddingHorizontal: 18,
    borderBottomWidth: 1, borderBottomColor: COR.divisoria,
  },
  aba: { paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  abaAcesa: { borderBottomColor: COR.primaria },
  abaTexto: { fontSize: 14, fontWeight: '700', color: COR_CATALOGO.legenda },
  abaTextoAceso: { color: COR.primaria },

  // O rodape e fixo: numa ficha de tres abas, um "Salvar" no fim da rolagem se esconde.
  rodape: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: 18, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: COR.divisoria, backgroundColor: COR.superficie,
  },
  salvar: {
    minWidth: 108, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, paddingHorizontal: 22,
    borderRadius: RAIO.campo, backgroundColor: COR.primaria,
  },
  salvarTexto: { fontSize: 14, fontWeight: '800', color: COR.sobrePrimaria },

  // Splits: um bloco por grupo, com os participantes e o total embaixo.
  grupoDeSplit: { gap: 8 },
  grupoNome: { fontSize: 15, fontWeight: '800', color: COR_CATALOGO.titulo },
  grupoApoio: { fontSize: 12, color: COR_CATALOGO.legenda, marginTop: -4 },
  semParticipante: { fontSize: 13, color: COR_CATALOGO.legenda, paddingVertical: 10 },
  split: {
    gap: 8, padding: 12, marginTop: 4,
    borderRadius: RAIO.campoDeEntrada, borderWidth: 1, borderColor: COR.contorno,
  },
  splitTopo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  splitBaixo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entradaCurta: { width: 88 },
  porcento: { fontSize: 14, fontWeight: '700', color: COR_CATALOGO.legenda },
  papeis: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  papel: {
    paddingVertical: 7, paddingHorizontal: 10,
    borderRadius: RAIO.pilula, borderWidth: 1, borderColor: COR.contorno,
  },
  papelEscolhido: { borderColor: COR.primaria, backgroundColor: COR.destaque },
  papelTexto: { fontSize: 11, fontWeight: '700', color: COR.secundario },
  papelTextoEscolhido: { color: COR.primaria },
  adicionar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  adicionarTexto: { fontSize: 13, fontWeight: '800', color: COR.primaria },
  total: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: 10, borderTopWidth: 1, borderTopColor: COR.divisoria,
  },
  totalRotulo: { fontSize: 12, fontWeight: '700', color: COR_CATALOGO.legenda },
  totalValor: { fontSize: 12, fontWeight: '800', color: COR_CATALOGO.titulo },
  // Passar de 100% divide direito que nao existe.
  totalExcedido: { color: COR.erro },
  conteudo: { padding: 18, paddingBottom: 48, gap: 16 },
  campo: { gap: 8 },
  rotulo: { fontSize: 11, fontWeight: '800', color: COR_CATALOGO.rotulo, letterSpacing: 0.4 },
  entrada: {
    borderWidth: 1, borderColor: COR.contorno, borderRadius: RAIO.campoDeEntrada,
    paddingHorizontal: 13, paddingVertical: 12,
    fontSize: 15, color: COR_CATALOGO.titulo, backgroundColor: COR.fundo,
  },
  entradaAlta: { minHeight: 130, textAlignVertical: 'top' },
  lado: { flexDirection: 'row', gap: 12 },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcao: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 9, paddingHorizontal: 12,
    borderRadius: RAIO.pilula, borderWidth: 1, borderColor: COR.contorno,
  },
  opcaoEscolhida: { borderColor: COR.primaria, backgroundColor: COR.destaque },
  opcaoTexto: { fontSize: 13, fontWeight: '700', color: COR.secundario },
  opcaoTextoEscolhido: { color: COR.primaria },
  pontoDoStatus: { width: 7, height: 7, borderRadius: 4 },
  capa: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62, padding: 10,
    borderRadius: RAIO.campoDeEntrada, borderWidth: 1, borderColor: COR.contorno,
    borderStyle: 'dashed',
  },
  capaImagem: { width: 42, height: 42, borderRadius: 8 },
  capaVazia: {
    width: 42, height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_CATALOGO.tocarFundo,
  },
  capaNome: { fontSize: 13, fontWeight: '700', color: COR_CATALOGO.titulo },
  capaApoio: { fontSize: 11, color: COR_CATALOGO.legenda, marginTop: 2 },
  sugestoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sugestao: {
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: RAIO.pilula, backgroundColor: COR_CATALOGO.tocarFundo,
  },
  sugestaoTexto: { fontSize: 11, fontWeight: '700', color: COR_CATALOGO.tocarIcone },
  erro: { fontSize: 13, color: COR.erro, lineHeight: 19 },
  excluir: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  excluirTexto: { fontSize: 13, fontWeight: '800', color: COR.erro },
});
