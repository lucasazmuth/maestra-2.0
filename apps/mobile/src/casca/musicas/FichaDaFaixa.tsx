import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_CATALOGO, RAIO } from '@maestra/core/constants/design';
import { CATALOG_STATUS_OPTIONS } from '@maestra/core/constants/maestra';
import type { CatalogItem } from '@maestra/core/interfaces/maestra';
import { deleteCatalogProject, saveCatalogProjectFromForm } from '@maestra/core/services/db/catalog';

// A ficha da música — a porta do `TrackModal` da web.
//
// Grava pelo MESMO `saveCatalogProjectFromForm` do núcleo, que cuida de projeto e versão de uma
// vez. Não há caminho de escrita próprio do app: se a regra mudar, muda nos dois.
//
// O que esta ficha ainda NÃO tem, e a da web tem: capa, arquivo de áudio, as versões e os
// créditos (autorais e de fonograma). Os dois primeiros pedem seletor de arquivo nativo; os
// dois últimos são listas próprias, cada uma do tamanho desta tela.

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

export const FichaDaFaixa = ({
  aberta, artistaId, faixa, generos, aoFechar, aoSalvar, aoExcluir,
}: {
  aberta: boolean;
  artistaId: string;
  faixa: CatalogItem | null;
  generos: string[];
  aoFechar: () => void;
  aoSalvar: (f: CatalogItem) => void;
  aoExcluir: (id: string) => void;
}) => {
  const [rascunho, setRascunho] = useState<Partial<CatalogItem>>({});
  const [dataEscrita, setDataEscrita] = useState('');
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberta) return;
    const base: Partial<CatalogItem> = faixa ?? { title: '', status: 'composition' };
    setRascunho(base);
    setDataEscrita(paraBR(base.release_date));
    setErro(null);
  }, [aberta, faixa]);

  const mudar = (parte: Partial<CatalogItem>) => setRascunho((r) => ({ ...r, ...parte }));

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
        <View style={estilos.topo}>
          <Pressable onPress={aoFechar} hitSlop={10} accessibilityRole="button">
            <Text style={estilos.cancelar}>Cancelar</Text>
          </Pressable>
          <View>
            <Text style={estilos.sobretitulo}>MÚSICAS</Text>
            <Text style={estilos.titulo}>{faixa ? 'Editar música' : 'Nova música'}</Text>
          </View>
          <Pressable onPress={salvar} disabled={gravando} hitSlop={10} accessibilityRole="button">
            {gravando
              ? <ActivityIndicator size="small" color={COR.primaria} />
              : <Text style={estilos.salvar}>Salvar</Text>}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
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
            {/* Os gêneros que o artista já usou, como atalho: a web oferece a mesma lista num
                seletor com opção de escrever. */}
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
              <Campo rotulo="BPM">
                <TextInput
                  style={estilos.entrada}
                  value={rascunho.bpm ?? ''}
                  onChangeText={(t) => mudar({ bpm: t })}
                  placeholder="120"
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
                  placeholder="Am"
                  placeholderTextColor={COR.espaçoReservado}
                  accessibilityLabel="Tom"
                />
              </Campo>
            </View>
          </View>

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

          <Campo rotulo="Letra">
            <TextInput
              style={[estilos.entrada, estilos.entradaAlta]}
              value={rascunho.lyrics ?? ''}
              onChangeText={(t) => mudar({ lyrics: t })}
              placeholder="Letra da música…"
              placeholderTextColor={COR.espaçoReservado}
              multiline
              accessibilityLabel="Letra"
            />
          </Campo>

          {!!erro && <Text style={estilos.erro}>{erro}</Text>}

          {!!faixa && (
            <Pressable
              style={estilos.excluir}
              onPress={confirmarExclusao}
              accessibilityRole="button"
              accessibilityLabel="Excluir música"
            >
              <Feather name="trash-2" size={15} color={COR.erro} />
              <Text style={estilos.excluirTexto}>Excluir</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const estilos = StyleSheet.create({
  folha: { flex: 1, backgroundColor: COR.superficie },
  flex: { flex: 1 },
  topo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: 18, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COR.divisoria,
  },
  sobretitulo: {
    fontSize: 9, fontWeight: '800', color: COR_CATALOGO.rotulo, letterSpacing: 1, textAlign: 'center',
  },
  titulo: { fontSize: 15, fontWeight: '800', color: COR_CATALOGO.titulo, marginTop: 2 },
  cancelar: { fontSize: 15, color: COR.secundario },
  salvar: { fontSize: 15, fontWeight: '800', color: COR.primaria },
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
  sugestoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sugestao: {
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: RAIO.pilula, backgroundColor: COR_CATALOGO.tocarFundo,
  },
  sugestaoTexto: { fontSize: 11, fontWeight: '700', color: COR_CATALOGO.tocarIcone },
  erro: { fontSize: 13, color: COR.erro, lineHeight: 19 },
  excluir: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 8, paddingVertical: 14,
    borderRadius: RAIO.campoDeEntrada, borderWidth: 1, borderColor: COR.erro,
  },
  excluirTexto: { fontSize: 14, fontWeight: '800', color: COR.erro },
});
