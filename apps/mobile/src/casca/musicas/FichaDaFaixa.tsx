import dayjs from 'dayjs';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { RAIO } from '@maestra/core/constants/design';
import { CATALOG_STATUS_OPTIONS, CLASSES_DA_OBRA, CLASSES_DO_FONOGRAMA } from '@maestra/core/constants/maestra';
import type { CatalogItem, Split } from '@maestra/core/interfaces/maestra';
import { deleteCatalogProject, saveCatalogProjectFromForm } from '@maestra/core/services/db/catalog';
import { listMembers } from '@maestra/core/services/db/members';

import { Bloco, Folha, Linha } from '@/casca/Folha';
import { usePaleta, type PaletaDaFolha } from '@/casca/paleta';
import { SugestaoDaAnalise } from '@/casca/jam/SugestaoDaAnalise';
import { enviarParaOCatalogo, escolherImagem } from '@/nucleo/arquivos';
import { useSessao } from '@/nucleo/sessao';

// A ficha da música — a porta do `TrackModal` da web.
//
// Grava pelo MESMO `saveCatalogProjectFromForm` do núcleo, que cuida de projeto e versão de uma
// vez. Não há caminho de escrita próprio do app: se a regra mudar, muda nos dois.
//
// A estrutura é a da web, e ela é DIFERENTE nas duas casas — porque na web também é:
//
//  • na lista de Músicas (a folha), três abas — Informações, Letras e Splits —, como o
//    `TrackModal`; a letra tem uma aba só para ela porque ali se escreve a letra inteira;
//  • na aba Ficha do editor (`emLinha`), UMA ROLAGEM CONTÍNUA com os campos e, a seguir, os
//    créditos — como o `ProjectSpace` monta `CamposDaFicha` + `CamposDosSplits` empilhados.
//    Sem letra: no editor ela vive no balão da letra, ao lado da montagem, onde se canta.
//
// A ordem dos campos é a mesma nas duas: título, status, gênero, responsável, lançamento, os
// códigos, o que a máquina ouviu, capa e detalhes.
//
// ⚠️ NÃO HÁ BLOCO DE VERSÕES. Ele saiu da ficha da web quando o modelo mudou — uma música
// deixou de ser "várias gravações alternativas, uma delas a boa" e passou a ser uma montagem de
// pistas que soam juntas. Anexar gravações é gesto do Espaço JAM, não da ficha.
//
// A capa vem da galeria e sobe pelo MESMO caminho da web (`enviarArquivo`, no núcleo), para o
// arquivo cair no mesmo lugar e com o mesmo nome, venha de onde vier.

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
const Campo = ({ rotulo, children }: { rotulo: string; children: React.ReactNode }) => {
  const paleta = usePaleta();
  const estilos = useMemo(() => criarEstilos(paleta), [paleta]);
  return (
    <View style={estilos.campo}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      {children}
    </View>
  );
};

type Aba = 'informacoes' | 'letras' | 'splits';

/** O mesmo meio segundo largo de todo autosave do Espaço JAM. */
const ESPERA_DA_FICHA = 650;

/**
 * O que, nesta ficha, conta como MUDANÇA.
 *
 * Só os campos que se gravam — e a data como ela está ESCRITA, e não como fica depois de
 * convertida: é no que a pessoa digita que se percebe se ela mexeu.
 */
const assinaturaDaFicha = (r: Partial<CatalogItem>, dataEscrita: string) => JSON.stringify({
  title: r.title?.trim() || '',
  status: r.status || 'composition',
  genre: r.genre || null,
  assignee: r.assignee?.id || null,
  data: dataEscrita,
  isrc: r.isrc || null,
  upc: r.upc || null,
  bpm: r.bpm || null,
  key: r.key || null,
  lyrics: r.lyrics || null,
  details: r.details || null,
  composition_splits: r.composition_splits || [],
  recording_splits: r.recording_splits || [],
});

/**
 * Um titular dos créditos: quem é, em que classe entra e quanto leva.
 *
 * "Titular", "classe" e "% partic." são as palavras da UBC e do ECAD. Quem preenche isto aqui
 * vai preencher o mesmo cadastro lá, e reencontrar as mesmas palavras poupa uma tradução
 * mental — e os enganos que ela produz.
 */
const LinhaDeSplit = ({ split, classes, aoMudar, aoRemover }: {
  split: Split;
  /** As classes que este corpo aceita — as da obra ou as do fonograma. */
  classes: readonly string[];
  aoMudar: (parte: Partial<Split>) => void;
  aoRemover: () => void;
}) => {
  const paleta = usePaleta();
  const estilos = useMemo(() => criarEstilos(paleta), [paleta]);
  return (
  <Linha>
    <View style={estilos.split}>
      <View style={estilos.splitTopo}>
        <TextInput
          style={[estilos.entrada, estilos.flex]}
          value={split.name}
          onChangeText={(t) => aoMudar({ name: t })}
          placeholder="Nome do titular"
          placeholderTextColor={paleta.espacoReservado}
          accessibilityLabel="Nome do titular"
        />
        <Pressable
          onPress={aoRemover}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Remover ${split.name || 'titular'}`}
        >
          <Feather name="x" size={18} color={paleta.legenda} />
        </Pressable>
      </View>

      <View style={estilos.papeis}>
        {classes.map((papel) => {
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
          placeholderTextColor={paleta.espacoReservado}
          keyboardType="number-pad"
          accessibilityLabel="Participação"
        />
        <Text style={estilos.porcento}>%</Text>
      </View>
    </View>
  </Linha>
  );
};

export const FichaDaFaixa = ({
  aberta, artistaId, faixa, generos, aoFechar, aoSalvar, aoExcluir, emLinha, aoEstado,
}: {
  aberta: boolean;
  /**
   * Montada DENTRO de outra tela, e não como folha que sobe de baixo.
   *
   * É o que a aba Ficha do editor usa: os mesmos campos, sem o casco da folha, com um rodapé
   * próprio de Salvar. Na web é a mesma decisão — a aba mostra `fichaCompleta`, que são os
   * mesmos campos do modal.
   *
   * ⚠️ `aberta` CONTINUA A VALER aqui: é ela que enche o rascunho com o que veio do banco. Quem
   * monta em linha passa as duas, e a ficha nasce preenchida.
   */
  emLinha?: boolean;
  /**
   * Como vai o salvamento automático — para quem mostra o selo.
   *
   * ⚠️ A WEB NÃO AVISA, e isso é um defeito dela que não vale copiar: numa aba sem botão de
   * Salvar, uma gravação silenciosa deixa quem escreveu sem saber se pegou. O selo já existe no
   * editor; é só dizer-lhe o que está a acontecer.
   */
  aoEstado?: (estado: 'salvando' | 'salvo' | 'erro') => void;
  artistaId: string;
  faixa: CatalogItem | null;
  generos: string[];
  aoFechar: () => void;
  aoSalvar: (f: CatalogItem) => void;
  aoExcluir: (id: string) => void;
}) => {
  const paleta = usePaleta();
  const estilos = useMemo(() => criarEstilos(paleta), [paleta]);
  const [rascunho, setRascunho] = useState<Partial<CatalogItem>>({});
  const [dataEscrita, setDataEscrita] = useState('');
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>('informacoes');
  const [enviandoCapa, setEnviandoCapa] = useState(false);
  const [membros, setMembros] = useState<{ id: string; nome: string }[]>([]);

  // Quem pode ficar responsável: a equipe ATIVA do artista. Um convite pendente ainda não é
  // ninguém — atribuir a música a quem nunca entrou é perder o rastro dela.
  //
  // ⚠️ A BUSCA É DAQUI, e não de quem monta a ficha. Na web a lista vem de fora porque as duas
  // telas que a hospedam já tinham os membros carregados por outro motivo; aqui nenhuma tem, e
  // passar a lista por duas telas só para a ficha a usar seria espalhar a mesma consulta.
  useEffect(() => {
    if (!aberta) return undefined;
    let vivo = true;
    listMembers(artistaId)
      .then((lista) => {
        if (!vivo) return;
        setMembros(lista
          .filter((m) => m.status === 'active')
          .map((m) => ({ id: (m.user_id || m.id), nome: m.name || m.email })));
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, [aberta, artistaId]);

  // ⚠️ E QUEM ESTÁ A OLHAR ENTRA PRIMEIRO, como na web. O dono do artista não é membro da
  // própria equipe: sem esta linha, a pessoa mais provável de ficar responsável pela música era
  // a única que não aparecia na lista. Sem repetir, para quem é as duas coisas.
  const { sessao } = useSessao();
  const eu = sessao?.user;
  const equipe = useMemo(() => {
    const dados = (eu?.user_metadata ?? {}) as Record<string, unknown>;
    const meuNome = (dados.full_name || dados.name || eu?.email || 'Você') as string;
    return [
      ...(eu ? [{ id: eu.id, nome: `${meuNome} (você)` }] : []),
      ...membros.filter((m) => m.id !== eu?.id),
    ];
  }, [eu, membros]);

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

  /**
   * O que vai para o banco, montado do rascunho — uma verdade só.
   *
   * `null` quando o formulário ainda não está gravável: sem título, ou com uma data que não é
   * data. É o mesmo portão para o botão e para o salvamento automático.
   */
  const paraGravar = () => {
    if (!rascunho.title?.trim()) return null;
    const lancamento = paraISO(dataEscrita);
    if (lancamento === undefined) return null;
    return {
      // `project_id` e não `id`: o `id` do item é o da VERSÃO, e mandar ele como projeto
      // criaria uma faixa nova a cada edição.
      id: faixa?.project_id ?? undefined,
      versionId: faixa?.id,
      artist_id: artistaId,
      title: rascunho.title.trim(),
      status: rascunho.status || 'composition',
      genre: rascunho.genre || null,
      assignee: rascunho.assignee ?? null,
      release_date: lancamento,
      isrc: rascunho.isrc || null,
      upc: rascunho.upc || null,
      bpm: rascunho.bpm || null,
      key: rascunho.key || null,
      lyrics: rascunho.lyrics || null,
      details: rascunho.details || null,
      composition_splits: autorais,
      recording_splits: fonograma,
    };
  };

  const salvar = async () => {
    if (!rascunho.title?.trim()) {
      setErro('Informe o título.');
      return;
    }
    const campos = paraGravar();
    if (!campos) {
      setErro('A data de lançamento precisa estar no formato 28/08/2026.');
      return;
    }

    setErro(null);
    setGravando(true);
    try {
      const salva = await saveCatalogProjectFromForm(campos);
      aoSalvar(salva);
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar.');
    } finally {
      setGravando(false);
    }
  };

  // ─── Salvamento automático (só montada em linha) ───────────────────────────
  //
  // ⚠️ NA ABA NÃO HÁ BOTÃO DE SALVAR, e é assim na web: a ficha do editor grava sozinha, como
  // tudo o mais naquela tela — o nome da música, o andamento, o volume de uma faixa. Um botão
  // de Salvar no meio de uma tela onde nada mais precisa dele ensina que o resto talvez não
  // esteja salvo.
  //
  // ⚠️ A ASSINATURA COMPARA COM O QUE JÁ ESTÁ GRAVADO, e é ela que impede o pior caso: gravar,
  // no primeiro render, exatamente o que acabou de chegar do servidor — e, com isso, carimbar
  // como edição de agora uma ficha em que ninguém tocou.
  const gravado = useRef('');
  const contaDaFicha = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // A marca é posta quando a ficha CHEGA, e não num efeito à parte: separados, a ordem decidia
    // — o autosave corria primeiro, via a assinatura da anterior, e agendava uma escrita.
    gravado.current = assinaturaDaFicha(faixa ?? {}, paraBR(faixa?.release_date));
  }, [faixa]);

  useEffect(() => {
    if (!emLinha) return undefined;
    const campos = paraGravar();
    if (!campos) return undefined;
    const assinatura = assinaturaDaFicha(rascunho, dataEscrita);
    if (assinatura === gravado.current) return undefined;

    if (contaDaFicha.current) clearTimeout(contaDaFicha.current);
    contaDaFicha.current = setTimeout(() => {
      aoEstado?.('salvando');
      saveCatalogProjectFromForm(campos)
        .then((salva) => {
          gravado.current = assinatura;
          aoEstado?.('salvo');
          aoSalvar(salva);
        })
        .catch(() => aoEstado?.('erro'));
    }, ESPERA_DA_FICHA);
    return () => { if (contaDaFicha.current) clearTimeout(contaDaFicha.current); };
    // `paraGravar` e `aoSalvar` mudam a cada render; o que decide é a assinatura, lá dentro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rascunho, dataEscrita, emLinha]);

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

  // ─── Os campos, na ordem da web ─────────────────────────────────────────────
  //
  // Título · Status · Gênero · Responsável, o lançamento com os códigos, e a capa com os
  // detalhes. É a ordem do `CamposDaFicha`, campo a campo.
  const informacoes = (
    <>
      <Bloco>
        <Linha primeira>
          <Campo rotulo="Título">
            <TextInput
              style={estilos.entrada}
              value={rascunho.title ?? ''}
              onChangeText={(t) => mudar({ title: t })}
              placeholder="Título da música"
              placeholderTextColor={paleta.espacoReservado}
              autoFocus={!faixa}
              accessibilityLabel="Título"
            />
          </Campo>
        </Linha>

        <Linha>
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
        </Linha>

        <Linha>
          <Campo rotulo="Gênero">
            <TextInput
              style={estilos.entrada}
              value={rascunho.genre ?? ''}
              onChangeText={(t) => mudar({ genre: t })}
              placeholder="Gênero"
              placeholderTextColor={paleta.espacoReservado}
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
        </Linha>

        {/* Responsável: quem toca a música para a frente.
            Na web é um `Select`; aqui são pílulas, como o status e o gênero logo acima — e
            pela mesma razão que o status virou pílula: a lista é curta, e uma folha que sobe
            de baixo para escolher entre três nomes é um gesto a mais do que a resposta vale.
            Tocar na pílula acesa desmarca — é o `allowClear` de lá. */}
        <Linha>
          <Campo rotulo="Responsável">
            {equipe.length === 0 ? (
              <Text style={estilos.semParticipante}>
                Convide a equipe para poder atribuir a música a alguém.
              </Text>
            ) : (
              <View style={estilos.opcoes}>
                {equipe.map((pessoa) => {
                  const escolhido = rascunho.assignee?.id === pessoa.id;
                  return (
                    <Pressable
                      key={pessoa.id}
                      style={[estilos.opcao, escolhido && estilos.opcaoEscolhida]}
                      onPress={() => mudar({
                        assignee: escolhido ? null : { id: pessoa.id, name: pessoa.nome },
                      })}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: escolhido }}
                      accessibilityLabel={escolhido
                        ? `Remover ${pessoa.nome} como responsável`
                        : `Responsável: ${pessoa.nome}`}
                    >
                      <Text style={[estilos.opcaoTexto, escolhido && estilos.opcaoTextoEscolhido]}>
                        {pessoa.nome}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Campo>
        </Linha>
      </Bloco>

      <Bloco rotulo="Lançamento">
        <Linha primeira>
          <Campo rotulo="Data de lançamento">
            <TextInput
              style={estilos.entrada}
              value={dataEscrita}
              onChangeText={setDataEscrita}
              placeholder="28/08/2026"
              placeholderTextColor={paleta.espacoReservado}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Data de lançamento"
            />
          </Campo>
        </Linha>

        {/* Dois a dois na mesma linha. Na web são QUATRO numa grade (`fieldGridFour`), que numa
            tela de 390 pt daria campos de oitenta pixels: a mesma fila, dobrada. */}
        <Linha>
          <View style={estilos.lado}>
            <View style={estilos.flex}>
              <Campo rotulo="ISRC">
                <TextInput
                  style={estilos.entrada}
                  value={rascunho.isrc ?? ''}
                  onChangeText={(t) => mudar({ isrc: t })}
                  placeholder="ISRC"
                  placeholderTextColor={paleta.espacoReservado}
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
                  placeholderTextColor={paleta.espacoReservado}
                  keyboardType="number-pad"
                  accessibilityLabel="UPC"
                />
              </Campo>
            </View>
          </View>
        </Linha>

        <Linha>
          <View style={estilos.lado}>
            <View style={estilos.flex}>
              <Campo rotulo="BPM">
                <TextInput
                  style={estilos.entrada}
                  value={rascunho.bpm ?? ''}
                  onChangeText={(t) => mudar({ bpm: t })}
                  placeholder="BPM"
                  placeholderTextColor={paleta.espacoReservado}
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
                  placeholderTextColor={paleta.espacoReservado}
                  accessibilityLabel="Tom"
                />
              </Campo>
            </View>
          </View>
        </Linha>

        {/* O que a máquina ouviu, ao lado dos campos que ela preenche — e nunca por cima
            deles: "usar" escreve no rascunho, e é a pessoa quem salva. Vivia na tela do
            Espaço JAM; saiu de lá porque é uma ação ocasional e a tela principal tinha coisas
            demais. Só existe quando a faixa tem uma versão com áudio para ouvir. */}
        {!!faixa?.version_id && (
          <Linha>
            <SugestaoDaAnalise
              versaoId={faixa.version_id}
              aoUsar={({ bpm, tom }) => mudar({ bpm, key: tom })}
            />
          </Linha>
        )}
      </Bloco>

      <Bloco rotulo="Capa e detalhes">
        <Linha primeira>
          <Campo rotulo="Capa">
            <Pressable
              style={estilos.capa}
              onPress={trocarCapa}
              disabled={enviandoCapa}
              accessibilityRole="button"
              accessibilityLabel={rascunho.cover_image ? 'Trocar a capa' : 'Escolher a capa'}
            >
              {enviandoCapa ? (
                <ActivityIndicator color={paleta.primaria} />
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
                    <Feather name="x" size={18} color={paleta.legenda} />
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={estilos.capaVazia}>
                    <Feather name="image" size={18} color={paleta.legenda} />
                  </View>
                  <View style={estilos.flex}>
                    <Text style={estilos.capaNome}>Escolher a capa</Text>
                    <Text style={estilos.capaApoio}>PNG ou JPG</Text>
                  </View>
                </>
              )}
            </Pressable>
          </Campo>
        </Linha>

        {/* Detalhes: o único campo da ficha que não tem forma. Todo o resto pergunta uma coisa
            e aceita uma resposta; o que sobra ("a segunda estrofe ainda vai mudar", "a editora
            confirma o split por e-mail") não cabia em campo nenhum e acabava no título da
            música ou numa conversa que ninguém reencontra. */}
        <Linha>
          <Campo rotulo="Detalhes">
            <TextInput
              style={[estilos.entrada, estilos.entradaMedia]}
              value={rascunho.details ?? ''}
              onChangeText={(t) => mudar({ details: t })}
              placeholder="Combinados, pendências, o que ainda vai mudar"
              placeholderTextColor={paleta.espacoReservado}
              multiline
              accessibilityLabel="Detalhes"
            />
          </Campo>
        </Linha>
      </Bloco>
    </>
  );

  const letras = (
    <Bloco>
      <Linha primeira>
        <TextInput
          style={[estilos.entrada, estilos.entradaAlta]}
          value={rascunho.lyrics ?? ''}
          onChangeText={(t) => mudar({ lyrics: t })}
          placeholder="Letra da música…"
          placeholderTextColor={paleta.espacoReservado}
          multiline
          accessibilityLabel="Letra"
        />
      </Linha>
    </Bloco>
  );

  const creditos = (
    <>
      {/* ⚠️ DOIS corpos, e não um: a OBRA é o que foi composto, o FONOGRAMA é a gravação dela.
          São direitos diferentes, com titulares e percentagens que raramente coincidem — e cada
          um aceita as suas classes: não há "Intérprete" na obra nem "Compositor" no fonograma.
          É assim que a UBC e o ECAD pedem. */}
      {([
        ['Obra', 'composition_splits', autorais, CLASSES_DA_OBRA,
          'Quem escreveu e quem edita — o direito autoral da composição'],
        ['Fonograma', 'recording_splits', fonograma, CLASSES_DO_FONOGRAMA,
          'Quem gravou, tocou e produziu — os direitos conexos desta gravação'],
      ] as const).map(([nome, chave, lista, classes, apoio]) => (
        <Bloco key={chave} rotulo={nome}>
          <Linha primeira>
            <Text style={estilos.apoioDoBloco}>{apoio}</Text>
          </Linha>

          {lista.length === 0
            ? (
              <Linha>
                <Text style={estilos.semParticipante}>Nenhum titular adicionado.</Text>
              </Linha>
            )
            : lista.map((split, i) => (
              <LinhaDeSplit
                key={split.id}
                split={split}
                classes={classes}
                aoMudar={(parte) => mudarSplits(
                  chave,
                  lista.map((s, j) => (i === j ? { ...s, ...parte } : s)),
                )}
                aoRemover={() => mudarSplits(chave, lista.filter((_, j) => j !== i))}
              />
            ))}

          <Linha>
            <Pressable
              style={estilos.adicionar}
              onPress={() => mudarSplits(chave, [
                ...lista,
                // O id é só para a lista se manter estável enquanto se edita; quem grava
                // é o `saveCatalogProjectFromForm`, com o array inteiro.
                { id: `s-${Date.now()}`, name: '', role: classes[0], percentage: 0 },
              ])}
              accessibilityRole="button"
              accessibilityLabel={`Adicionar titular em ${nome}`}
            >
              <Feather name="plus" size={14} color={paleta.primaria} />
              <Text style={estilos.adicionarTexto}>Adicionar titular</Text>
            </Pressable>
          </Linha>

          {/* O total precisa fechar em 100%: passar disso divide direito que não existe. */}
          <Linha>
            <View style={estilos.total}>
              <Text style={estilos.totalRotulo}>Total</Text>
              <Text style={[estilos.totalValor, somar(lista) > 100 && estilos.totalExcedido]}>
                {somar(lista)}%
              </Text>
            </View>
          </Linha>
        </Bloco>
      ))}
    </>
  );

  const aviso = !!erro && <Text style={estilos.erro}>{erro}</Text>;

  // ⚠️ DUAS MONTAGENS, porque a web tem duas.
  //
  // Na aba do editor é UMA ROLAGEM SÓ: os campos e, logo abaixo, os créditos — é o que o
  // `ProjectSpace` desenha. Abas dentro de uma aba esconderiam metade da ficha atrás de um
  // toque que ninguém dá, e quem preenche uma ficha preenche-a de cima a baixo.
  //
  // Na folha do catálogo são as três abas do `TrackModal`. A letra só existe aqui: no editor
  // ela vive no balão da letra, encostada à montagem, que é onde se canta.
  const miolo = emLinha ? (
    <View style={estilos.miolo}>
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        {informacoes}
        {creditos}
        {aviso}
      </ScrollView>
    </View>
  ) : (
    <View style={estilos.miolo}>
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
        {aba === 'informacoes' && informacoes}
        {aba === 'letras' && letras}
        {aba === 'splits' && creditos}
        {aviso}
      </ScrollView>
    </View>
  );

  // Montada na aba, o casco da folha não existe — e nem o rodapé.
  //
  // ⚠️ SEM SALVAR E SEM EXCLUIR. O salvamento é automático ali, como é na web e como é em todo o
  // resto daquela tela; um botão de Salvar no meio dela ensinaria que o resto talvez não esteja
  // salvo. E excluir a música não é um gesto de EDITAR a ficha dela: ele vive na lista de
  // Músicas, que é de onde se gere o catálogo — é o mesmo sítio da web.
  if (emLinha) return <View style={estilos.emLinha}>{miolo}</View>;

  return (
    <Folha
      aberta={aberta}
      titulo={rascunho.title?.trim() || (faixa ? 'Editar música' : 'Nova música')}
      aoFechar={aoFechar}
      acao={{ rotulo: 'Salvar', aoTocar: salvar, carregando: gravando }}
      // Só editando: uma música que ainda não nasceu não tem o que excluir.
      destrutiva={faixa ? { rotulo: 'Excluir', aoTocar: confirmarExclusao } : undefined}
      // Esta ficha tem abas e rolagem por aba, então a `Folha` não põe a dela por cima.
      semRolagem
    >
      {miolo}
    </Folha>
  );
};

// A casca (fundo, cabeçalho, teclado e rodapé) mora na `Folha`. Aqui ficam as abas e os campos.
/**
 * A folha, tingida pela paleta em vigor.
 *
 * ⚠️ UMA FUNÇÃO, e não um objeto: este formulário é o MESMO na lista de Músicas (clara) e na aba
 * Ficha do editor (escura). Duas cópias do formulário seriam duas verdades sobre a mesma música;
 * duas folhas de estilo são a mesma verdade, pintada de dois modos. Ver `casca/paleta.ts`.
 */
const criarEstilos = (p: PaletaDaFolha) => StyleSheet.create({
  emLinha: { flex: 1, minHeight: 0, backgroundColor: p.fundo },
  rodapeEmLinha: {
    flexDirection: 'row', gap: 10, alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: p.divisoria,
  },
  salvarEmLinha: {
    flex: 1, height: 42, alignItems: 'center', justifyContent: 'center',
    borderRadius: 6, backgroundColor: p.primaria,
  },
  salvarTexto: { fontSize: 14, fontWeight: '700', color: p.sobrePrimaria },
  inerte: { opacity: 0.55 },
  excluirEmLinha: {
    height: 42, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center',
    borderRadius: 6, borderWidth: 1, borderColor: p.contorno,
  },
  excluirTexto: { fontSize: 14, fontWeight: '700', color: p.erro },

  miolo: { flex: 1, minHeight: 0 },
  flex: { flex: 1 },

  // As tres abas com o sublinhado azul na ativa, como na web.
  abas: {
    flexDirection: 'row', gap: 22, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: p.divisoria,
  },
  aba: { paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  abaAcesa: { borderBottomColor: p.primaria },
  abaTexto: { fontSize: 14, fontWeight: '700', color: p.legenda },
  abaTextoAceso: { color: p.primaria },

  // Splits: um bloco por grupo, com os participantes e o total embaixo. Cada participante é uma
  // LINHA do bloco, então a moldura que separava um do outro saiu: quem separa é a divisória.
  semParticipante: { fontSize: 13, color: p.legenda, lineHeight: 19 },
  // A frase que diz o que cada corpo de créditos é — a mesma da web, debaixo de "Obra" e de
  // "Fonograma". Sem ela, "obra" e "fonograma" são duas caixas iguais com nomes de cartório.
  apoioDoBloco: { fontSize: 12, color: p.legenda, lineHeight: 18 },
  split: { gap: 8 },
  splitTopo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  splitBaixo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entradaCurta: { width: 88 },
  porcento: { fontSize: 14, fontWeight: '700', color: p.legenda },
  papeis: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  papel: {
    paddingVertical: 7, paddingHorizontal: 10,
    borderRadius: RAIO.pilula, borderWidth: 1, borderColor: p.contorno,
  },
  papelEscolhido: { borderColor: p.primaria, backgroundColor: p.destaque },
  papelTexto: { fontSize: 11, fontWeight: '700', color: p.texto },
  papelTextoEscolhido: { color: p.primaria },
  adicionar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  adicionarTexto: { fontSize: 13, fontWeight: '800', color: p.primaria },
  total: { flexDirection: 'row', justifyContent: 'space-between' },
  totalRotulo: { fontSize: 12, fontWeight: '700', color: p.legenda },
  totalValor: { fontSize: 12, fontWeight: '800', color: p.titulo },
  // Passar de 100% divide direito que nao existe.
  totalExcedido: { color: p.erro },
  // Daqui para baixo é o molde da folha de compromisso da Agenda, que é a referência do app:
  // rótulo miúdo em cima, campo sem moldura embaixo. A moldura de cada campo virou a do bloco.
  conteudo: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, gap: 22 },
  campo: { gap: 6 },
  rotulo: { fontSize: 11, fontWeight: '800', color: p.rotulo, letterSpacing: 0.4 },
  entrada: { paddingVertical: 2, fontSize: 15, color: p.titulo },
  entradaAlta: { minHeight: 220, textAlignVertical: 'top' },
  entradaMedia: { minHeight: 96, textAlignVertical: 'top' },
  lado: { flexDirection: 'row', gap: 12 },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcao: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 9, paddingHorizontal: 12,
    borderRadius: RAIO.pilula, borderWidth: 1, borderColor: p.contorno,
  },
  opcaoEscolhida: { borderColor: p.primaria, backgroundColor: p.destaque },
  opcaoTexto: { fontSize: 13, fontWeight: '700', color: p.texto },
  opcaoTextoEscolhido: { color: p.primaria },
  pontoDoStatus: { width: 7, height: 7, borderRadius: 4 },
  capa: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62, padding: 10,
    borderRadius: RAIO.campoDeEntrada, borderWidth: 1, borderColor: p.contorno,
    borderStyle: 'dashed',
  },
  capaImagem: { width: 42, height: 42, borderRadius: 8 },
  capaVazia: {
    width: 42, height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: p.realce,
  },
  capaNome: { fontSize: 13, fontWeight: '700', color: p.titulo },
  capaApoio: { fontSize: 11, color: p.legenda, marginTop: 2 },
  sugestoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sugestao: {
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: RAIO.pilula, backgroundColor: p.realce,
  },
  sugestaoTexto: { fontSize: 11, fontWeight: '700', color: p.realceTinta },
  erro: { fontSize: 13, color: p.erro, lineHeight: 19 },
});
