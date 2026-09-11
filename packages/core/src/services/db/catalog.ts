import { supabase } from '../../lib/supabase';
import { BALDE_DO_CATALOGO, caminhoNoBalde, removerArquivo } from '../armazenamento';
import type {
  CatalogItem,
  CatalogProject,
  CatalogProjectMessage,
  CatalogVersion,
  CatalogVersionComment,
  CatalogTrack,
  CatalogClip,
  CatalogVersionFile,
} from '../../interfaces/maestra';

const TABLE = 'catalog_items';

// O embed precisa dizer QUAL chave estrangeira usar: existem duas entre projeto e versão —
// catalog_versions.project_id (as versões do projeto) e catalog_projects.primary_version_id (a
// versão principal). Sem o `!catalog_versions_project_id_fkey`, o PostgREST considera o vínculo
// ambíguo, recusa a query inteira e a lista de músicas volta vazia.
const PROJECT_SELECT = `*, versions:catalog_versions!catalog_versions_project_id_fkey(*, files:catalog_version_files(*), comments:catalog_version_comments(*))`;

/**
 * O mesmo, mais a MONTAGEM: as pistas da linha do tempo e os clipes dentro delas.
 *
 * Separado do `PROJECT_SELECT` de propósito: a LISTA de músicas não desenha linha do tempo
 * nenhuma, e trazer todos os clipes de todas as gravações de todas as músicas seria pagar por
 * um editor em cada abertura do catálogo.
 */
const PROJECT_SELECT_COM_MONTAGEM = `*, versions:catalog_versions!catalog_versions_project_id_fkey(*, files:catalog_version_files(*), tracks:catalog_tracks(*, clips:catalog_clips(*)), comments:catalog_version_comments(*))`;

const isMissingTable = (error: any) =>
  error?.code === '42P01' || error?.code === 'PGRST205' || /does not exist|relation .* not found/i.test(error?.message || '');

const legacyItemToProject = (item: CatalogItem): CatalogProject => ({
  id: item.id,
  artist_id: item.artist_id,
  title: item.title,
  status: item.status,
  genre: item.genre,
  bpm: item.bpm,
  key: item.key,
  cover_image: item.cover_image,
  cover_image_name: item.cover_image_name,
  assignee: item.assignee,
  upc: item.upc,
  details: item.details,
  release_date: item.release_date,
  created_at: item.created_at,
  updated_at: item.updated_at,
  primary_version_id: item.id,
  versions: [{
    id: item.id,
    project_id: item.id,
    version_number: 1,
    stage: 'guia',
    status: item.status,
    audio_file: item.audio_file,
    audio_file_name: item.audio_file_name,
    duration: item.duration,
    bpm: item.bpm,
    key: item.key,
    isrc: item.isrc,
    genre: item.genre,
    lyrics: item.lyrics,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }],
});

export const catalogProjectToItem = (project: CatalogProject, version?: CatalogVersion | null): CatalogItem => ({
  id: version?.id || project.id,
  artist_id: project.artist_id,
  title: project.title,
  status: project.status,
  assignee: project.assignee,
  genre: version?.genre ?? project.genre,
  release_date: project.release_date,
  details: project.details,
  last_edited_by: project.last_edited_by,
  bpm: version?.bpm ?? project.bpm,
  key: version?.key ?? project.key,
  // O ISRC é da gravação, o UPC é do lançamento. Ver a migration `isrc_e_upc`.
  isrc: version?.isrc,
  upc: project.upc,
  duration: version?.duration,
  lyrics: version?.lyrics,
  cover_image: project.cover_image,
  cover_image_name: project.cover_image_name,
  audio_file: version?.audio_file,
  audio_file_name: version?.audio_file_name,
  project_id: project.id,
  version_id: version?.id,
  version_number: version?.version_number || 1,
  version_stage: version?.stage,
  version_status: version?.status,
  version_author_id: version?.author_id,
  version_author_name: version?.author_name,
  version_created_at: version?.created_at,
  created_at: project.created_at,
  updated_at: project.updated_at,
});

export const listCatalogItems = async (artistId: string): Promise<CatalogItem[]> => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('artist_id', artistId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as CatalogItem[];
};

export const createCatalogItem = async (
  input: Omit<CatalogItem, 'id' | 'created_at' | 'updated_at'>
): Promise<CatalogItem> => {
  const { data, error } = await supabase.from(TABLE).insert(input).select('*').single();
  if (error) throw error;
  return data as CatalogItem;
};

export const updateCatalogItem = async (
  id: string,
  patch: Partial<CatalogItem>
): Promise<CatalogItem> => {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as CatalogItem;
};

export const deleteCatalogItem = async (id: string): Promise<void> => {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
};

/**
 * Salva a MÚSICA a partir do formulário: o projeto é a música, e a V1 é a primeira faixa dela.
 *
 * O modal antes gravava em `catalog_items` (tabela legada) e um passo separado tentava espelhar
 * o resultado em projeto+versão. Esse espelho falhava sempre ao criar: montava o projeto já com
 * `primary_version_id` apontando pra uma versão que só nasceria na linha seguinte, e a FK
 * recusava. Como a falha era engolida por um `.catch()` vazio, a música aparecia na tela e
 * sumia no reload — nunca tinha existido como projeto.
 *
 * Aqui a ordem é a correta: grava o projeto, cria/atualiza a versão, e só então aponta a versão
 * principal. É esta função que o modal usa, tanto pra criar quanto pra editar.
 */
/**
 * Os campos da GRAVAÇÃO que uma gravação da ficha escreve.
 *
 * ⚠️ O ÁUDIO SÓ ENTRA SE O CHAMADOR FALAR DELE, e esta distinção não é preciosismo: é a
 * diferença entre "não mexi nisso" e "quero isto vazio".
 *
 * Era `audio_file: input.audio_file ?? null` como todo o resto — e então QUALQUER gravação que
 * não repetisse o campo apagava a guia da música. Enquanto a ficha só salvava por botão isso
 * quase não aparecia; com a ficha a salvar sozinha, cada tecla numa observação destruía em
 * silêncio o áudio que a lista de Músicas toca.
 *
 * Os outros campos ficam com `?? null` porque são todos editáveis no MESMO formulário: quem
 * grava a ficha viu todos eles, e um vazio ali é uma decisão. O áudio não está lá — nasce do
 * editor, e a ficha não tem como ter opinião sobre ele.
 */
export const payloadDaGravacao = (
  input: Partial<CatalogItem>,
  now: string,
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    status: input.status || 'composition',
    duration: input.duration ?? null,
    bpm: input.bpm ?? null,
    key: input.key ?? null,
    isrc: input.isrc ?? null,
    genre: input.genre ?? null,
    lyrics: input.lyrics ?? null,
    updated_at: now,
  };
  if ('audio_file' in input) payload.audio_file = input.audio_file ?? null;
  if ('audio_file_name' in input) payload.audio_file_name = input.audio_file_name ?? null;
  return payload;
};

export const saveCatalogProjectFromForm = async (
  input: {
    id?: string;              // projeto existente (edição)
    versionId?: string;       // versão a atualizar (edição)
    artist_id: string;
  } & Partial<CatalogItem>,
  author?: { id?: string | null; name?: string | null; avatar?: string | null }
): Promise<CatalogItem> => {
  const now = new Date().toISOString();
  // Campos da MÚSICA (o projeto): identidade, capa, responsável, data de lançamento.
  //
  // ⚠️ BPM E TOM NÃO ENTRAM AQUI. Eles são da GRAVAÇÃO, e vão no `versionPayload` abaixo: um
  // acústico não anda no mesmo andamento do original, e um remix quase nunca fica no mesmo tom.
  // As colunas `catalog_projects.bpm/key` continuam no banco como legado — o
  // `catalogProjectToItem` ainda as lê como último recurso para músicas antigas cuja versão
  // nunca teve o valor —, mas ninguém escreve nelas.
  const projectPayload = {
    artist_id: input.artist_id,
    title: input.title || 'Sem título',
    status: input.status || 'composition',
    genre: input.genre ?? null,
    cover_image: input.cover_image ?? null,
    cover_image_name: input.cover_image_name ?? null,
    assignee: input.assignee ?? null,
    upc: input.upc ?? null,
    details: input.details ?? null,
    // Quem está a gravar AGORA é quem mexeu por último. Sai do mesmo `author` que já assina as
    // gravações — nenhum chamador precisa de saber deste campo.
    ...(author?.name ? { last_edited_by: author.name } : {}),
    release_date: input.release_date || null,
    updated_at: now,
  };

  let project: CatalogProject;
  if (input.id) {
    const { data, error } = await supabase
      .from('catalog_projects').update(projectPayload).eq('id', input.id).select('*').single();
    if (error) throw error;
    project = data as CatalogProject;
  } else {
    const { data, error } = await supabase
      .from('catalog_projects').insert(projectPayload).select('*').single();
    if (error) throw error;
    project = data as CatalogProject;
  }

  // Campos da FAIXA (a versão): áudio, duração e letra pertencem à gravação, não à música.
  const versionPayload = payloadDaGravacao(input, now);

  let version: CatalogVersion;
  const targetVersionId = input.versionId || project.primary_version_id;
  if (targetVersionId) {
    const { data, error } = await supabase
      .from('catalog_versions').update(versionPayload).eq('id', targetVersionId).select('*').single();
    if (error) throw error;
    version = data as CatalogVersion;
  } else {
    const { data, error } = await supabase
      .from('catalog_versions')
      .insert({
        ...versionPayload,
        project_id: project.id,
        version_number: 1,
        stage: 'guia',
        author_id: author?.id || null,
        author_name: author?.name || null,
        author_avatar: author?.avatar || null,
      })
      .select('*').single();
    if (error) throw error;
    version = data as CatalogVersion;
  }

  // Só agora a versão existe e pode ser apontada como principal.
  if (project.primary_version_id !== version.id) {
    const { data, error } = await supabase
      .from('catalog_projects')
      .update({ primary_version_id: version.id, updated_at: now })
      .eq('id', project.id).select('*').single();
    if (error) throw error;
    project = data as CatalogProject;
  }

  return catalogProjectToItem(project, version);
};

export const listCatalogProjects = async (artistId: string): Promise<CatalogProject[]> => {
  const { data, error } = await supabase
    .from('catalog_projects')
    .select(PROJECT_SELECT)
    .eq('artist_id', artistId)
    .order('updated_at', { ascending: false });
  if (!error) return (data || []) as CatalogProject[];
  if (!isMissingTable(error)) throw error;

  // Compatibilidade durante o rollout: antes da migration, o catálogo continua abrindo.
  const legacy = await listCatalogItems(artistId);
  return legacy.map(legacyItemToProject);
};

export const listCatalogProjectItems = async (artistId: string): Promise<CatalogItem[]> => {
  const projects = await listCatalogProjects(artistId);
  return projects.map((project) => {
    const primary = project.versions?.find((v) => v.id === project.primary_version_id) || project.versions?.[project.versions.length - 1];
    return catalogProjectToItem(project, primary);
  });
};

/**
 * O projeto com a montagem inteira.
 *
 * ⚠️ OS MARCADOS PARA APAGAR SÃO FILTRADOS NO SERVIDOR, e não aqui. Filtrar depois de receber
 * seria mais fácil de escrever e mandaria pela rede exatamente aquilo que se ia deitar fora —
 * numa sessão longa de edição, o lixo viajaria em cada leitura. O filtro vai no `is` embutido,
 * que o PostgREST aplica ao recurso encaixado sem transformar a junção em obrigatória: uma
 * gravação sem pistas continua a voltar.
 */
/**
 * Carimba em cada clipe o NOME do ficheiro que ele toca.
 *
 * `catalog_clips` guarda só o `file_id`; o nome vive em `catalog_version_files`. As duas
 * tabelas voltam na mesma leitura, mas em ramos diferentes da resposta — e sem esta costura o
 * `file_name` do tipo era um campo que nunca ninguém preenchia, e a linha do tempo escrevia
 * "Take 1" por cima de uma onda que se chama "voz dobra".
 *
 * Pura de propósito: a junção é a regra, e regra que se testa não vive dentro de uma chamada
 * de rede.
 */
export const comNomesDosClipes = (projeto: CatalogProject): CatalogProject => ({
  ...projeto,
  versions: (projeto.versions ?? []).map((versao) => {
    const porId = new Map((versao.files ?? []).map((f) => [f.id, f]));
    return {
      ...versao,
      tracks: (versao.tracks ?? []).map((pista) => ({
        ...pista,
        clips: (pista.clips ?? []).map((clipe) => ({
          ...clipe,
          // O que já vier com nome fica: quem acabou de criar o clipe sabe o nome melhor do
          // que esta junção, e reescrevê-lo com um `undefined` seria apagar informação boa.
          file_name: clipe.file_name ?? porId.get(clipe.file_id)?.name ?? undefined,
        })),
      })),
    };
  }),
});

export const getCatalogProject = async (projectId: string): Promise<CatalogProject> => {
  const { data, error } = await supabase.from('catalog_projects')
    .select(PROJECT_SELECT_COM_MONTAGEM)
    .is('versions.tracks.deleted_at', null)
    .is('versions.tracks.clips.deleted_at', null)
    .eq('id', projectId).single();
  if (!error) return comNomesDosClipes(data as CatalogProject);
  if (!isMissingTable(error) && error.code !== 'PGRST116') throw error;
  const { data: legacy, error: legacyError } = await supabase.from(TABLE).select('*').eq('id', projectId).single();
  if (legacyError) throw legacyError;
  return legacyItemToProject(legacy as CatalogItem);
};

export const createCatalogProject = async (
  input: Omit<CatalogProject, 'id' | 'versions' | 'created_at' | 'updated_at'>
): Promise<CatalogProject> => {
  const { data, error } = await supabase.from('catalog_projects').insert(input).select('*').single();
  if (error) throw error;
  return data as CatalogProject;
};

export const updateCatalogProject = async (id: string, patch: Partial<CatalogProject>): Promise<CatalogProject> => {
  const { versions: _versions, ...safePatch } = patch;
  const { data, error } = await supabase.from('catalog_projects').update({ ...safePatch, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
  if (error) throw error;
  return data as CatalogProject;
};

export const deleteCatalogProject = async (id: string): Promise<void> => {
  const { error } = await supabase.from('catalog_projects').delete().eq('id', id);
  if (error) throw error;
};

/**
 * Apaga uma MÚSICA da lista, seja ela nova ou legada.
 *
 * ⚠️ A lista chamava `deleteCatalogItem`, que apaga de `catalog_items` — a tabela LEGADA. Como
 * as músicas passaram a viver em `catalog_projects`, o delete não encontrava nada e não
 * apagava nada; a linha sumia da tela porque a tela a tirava da sua própria lista, e voltava
 * inteira no recarregamento seguinte. Nunca deu erro: apagar zero linhas não é um erro para o
 * Postgres.
 *
 * Recebe o id da MÚSICA na lista (que é o da versão principal) e o do projeto, e limpa os dois
 * lados — as músicas antigas ainda vivem na tabela velha, e as novas na nova.
 */
export const excluirMusica = async (
  { itemId, projectId }: { itemId: string; projectId?: string | null },
): Promise<void> => {
  if (projectId) await deleteCatalogProject(projectId);
  // O legado sai também: um id que não existe lá apaga zero linhas e não se queixa.
  await supabase.from(TABLE).delete().eq('id', itemId);
};

export const createCatalogVersion = async (
  input: Omit<CatalogVersion, 'id' | 'files' | 'comments' | 'created_at' | 'updated_at'>
): Promise<CatalogVersion> => {
  const { data, error } = await supabase.from('catalog_versions').insert(input).select('*').single();
  if (error) throw error;
  // A versão com áudio é principal automaticamente, conforme a regra do produto.
  if (input.audio_file) {
    const { error: primaryError } = await supabase.from('catalog_projects').update({ primary_version_id: data.id, updated_at: new Date().toISOString() }).eq('id', input.project_id);
    if (primaryError) throw primaryError;
  }
  return data as CatalogVersion;
};

export const updateCatalogVersion = async (id: string, patch: Partial<CatalogVersion>): Promise<CatalogVersion> => {
  const { files: _files, comments: _comments, ...safePatch } = patch;
  const { data, error } = await supabase.from('catalog_versions').update({ ...safePatch, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
  if (error) throw error;
  if (patch.audio_file) {
    const { error: primaryError } = await supabase.from('catalog_projects').update({ primary_version_id: id, updated_at: new Date().toISOString() }).eq('id', data.project_id);
    if (primaryError) throw primaryError;
  }
  return data as CatalogVersion;
};

/** Marca qual gravação é a principal — a que toca por padrão e representa a música. */
// `versionId: null` desmarca a principal — a música fica sem gravação de referência (é o que
// acontece, por exemplo, quando a única versão boa foi descartada e nenhuma outra a substitui).
export const setPrimaryVersion = async (projectId: string, versionId: string | null): Promise<void> => {
  const { error } = await supabase
    .from('catalog_projects')
    .update({ primary_version_id: versionId, updated_at: new Date().toISOString() })
    .eq('id', projectId);
  if (error) throw error;
};

export const deleteCatalogVersion = async (id: string): Promise<void> => {
  const { error } = await supabase.from('catalog_versions').delete().eq('id', id);
  if (error) throw error;
};

export const listVersionComments = async (versionId: string): Promise<CatalogVersionComment[]> => {
  const { data, error } = await supabase.from('catalog_version_comments').select('*').eq('version_id', versionId).order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as CatalogVersionComment[];
};

export const createVersionComment = async (input: Omit<CatalogVersionComment, 'id' | 'created_at' | 'updated_at'>): Promise<CatalogVersionComment> => {
  const { data, error } = await supabase.from('catalog_version_comments').insert(input).select('*').single();
  if (error) throw error;
  return data as CatalogVersionComment;
};

export const deleteVersionComment = async (id: string): Promise<void> => {
  const { error } = await supabase.from('catalog_version_comments').delete().eq('id', id);
  if (error) throw error;
};

// ---- Conversa geral do Espaço JAM ---------------------------------------------------------

// ─── O chat do projeto ────────────────────────────────────────────────────────
//
// As duas funções abaixo (e a tabela `catalog_project_messages`) ficaram SEM CHAMADORES em
// 09/09/2026: o chat saiu das duas telas do Espaço JAM por decisão do dono do produto, e ficam
// os comentários da versão. Não foram apagadas porque a decisão foi "por enquanto". Para o chat
// voltar: a tabela e a RLS continuam no ar, e o realtime dela continua na publicação.
export const listCatalogProjectMessages = async (projectId: string): Promise<CatalogProjectMessage[]> => {
  const { data, error } = await supabase
    .from('catalog_project_messages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as CatalogProjectMessage[];
};

export const createCatalogProjectMessage = async (
  input: Omit<CatalogProjectMessage, 'id' | 'created_at' | 'updated_at'>
): Promise<CatalogProjectMessage> => {
  const { data, error } = await supabase.from('catalog_project_messages').insert(input).select('*').single();
  if (error) throw error;
  return data as CatalogProjectMessage;
};

export const addVersionFile = async (input: Omit<CatalogVersionFile, 'id' | 'created_at'>): Promise<CatalogVersionFile> => {
  const { data, error } = await supabase.from('catalog_version_files').insert(input).select('*').single();
  if (error) throw error;
  return data as CatalogVersionFile;
};

/** Renomear, mover de lugar ou mudar o volume de uma pista. */
export const updateVersionFile = async (
  id: string,
  patch: Partial<Pick<CatalogVersionFile, 'name' | 'position' | 'gain'>>,
): Promise<CatalogVersionFile> => {
  const { data, error } = await supabase
    .from('catalog_version_files')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as CatalogVersionFile;
};

/**
 * A nova ordem das pistas, na ordem em que os ids vêm.
 *
 * N updates em paralelo, e não uma RPC: são no máximo oito linhas (`MAXIMO_DE_PISTAS`), e uma
 * função no banco para isto seria mais uma coisa a manter em troca de nada. Se uma falhar, as
 * outras ficam — a tela recarrega e mostra a ordem real, que é a do banco.
 */
export const reorderVersionFiles = async (ids: string[]): Promise<void> => {
  const agora = new Date().toISOString();
  const erros = await Promise.all(ids.map(async (id, position) => {
    const { error } = await supabase
      .from('catalog_version_files')
      .update({ position, updated_at: agora })
      .eq('id', id);
    return error;
  }));
  const primeiro = erros.find(Boolean);
  if (primeiro) throw primeiro;
};

export const deleteVersionFile = async (id: string): Promise<void> => {
  const { error } = await supabase.from('catalog_version_files').delete().eq('id', id);
  if (error) throw error;
};

// ─── A LINHA DO TEMPO: pistas e clipes ──────────────────────────────────────
//
// A pista é a faixa; o clipe é o pedaço de áudio que mora nela. Cortar um clipe ao meio não
// toca no ficheiro: nascem dois clipes que apontam para o mesmo áudio com recortes diferentes.
// É por isso que a edição é instantânea e não destrói nada.

export const createTrack = async (
  input: Omit<CatalogTrack, 'id' | 'clips' | 'created_at' | 'updated_at'>,
): Promise<CatalogTrack> => {
  const { data, error } = await supabase.from('catalog_tracks').insert(input).select('*').single();
  if (error) throw error;
  return data as CatalogTrack;
};

/** Pelo mesmo motivo do `updateClip`: uma pista apagada com uma escrita adiada a caminho. */
export const updateTrack = async (
  id: string,
  patch: Partial<Pick<CatalogTrack, 'name' | 'position' | 'gain' | 'muted' | 'color_index' | 'pan' | 'kind'>>,
): Promise<CatalogTrack | null> => {
  const { data, error } = await supabase
    .from('catalog_tracks')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id).select('*').maybeSingle();
  if (error) throw error;
  return (data as CatalogTrack) ?? null;
};

/** Apagar a pista leva os clipes junto (o banco cascateia). O FICHEIRO fica na biblioteca. */
export const deleteTrack = async (id: string): Promise<void> => {
  const { error } = await supabase.from('catalog_tracks').delete().eq('id', id);
  if (error) throw error;
};

/**
 * A nova ordem das pistas, na ordem em que os ids vêm.
 *
 * N updates em paralelo, e não uma RPC: são poucas linhas, e uma função no banco para isto
 * seria mais uma coisa a manter em troca de nada. Se uma falhar, as outras ficam — a tela
 * recarrega e mostra a ordem real, que é a do banco.
 */
export const reorderTracks = async (ids: string[]): Promise<void> => {
  const agora = new Date().toISOString();
  const erros = await Promise.all(ids.map(async (id, position) => {
    const { error } = await supabase
      .from('catalog_tracks').update({ position, updated_at: agora }).eq('id', id);
    return error;
  }));
  const primeiro = erros.find(Boolean);
  if (primeiro) throw primeiro;
};

export const createClip = async (
  input: Omit<CatalogClip, 'id' | 'created_at' | 'updated_at' | 'file_url' | 'file_name'>,
): Promise<CatalogClip> => {
  const { data, error } = await supabase.from('catalog_clips').insert(input).select('*').single();
  if (error) throw error;
  return data as CatalogClip;
};

/**
 * ⚠️ `maybeSingle`, E NÃO `single`: a linha pode já não existir, e isso não é uma falha.
 *
 * As escritas da montagem são adiadas — arrastar um clipe grava meio segundo depois de a mão
 * parar. Nessa janela ele pode ser removido, aqui ou por outra pessoa na mesma gravação, e
 * `single` trata "zero linhas" como erro: o pedido rebentava com PGRST116 e a tela dizia
 * "Falha ao salvar" logo a seguir a apagar com sucesso — um erro vermelho para uma operação
 * que tinha corrido bem.
 *
 * Quem chama não distingue os dois casos porque não precisa: `null` quer dizer "já não há o
 * que atualizar", e é o mesmo desfecho que se queria.
 */
export const updateClip = async (
  id: string,
  patch: Partial<Pick<CatalogClip, 'start_seconds' | 'offset_seconds' | 'duration_seconds' | 'track_id'>>,
): Promise<CatalogClip | null> => {
  const { data, error } = await supabase
    .from('catalog_clips')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id).select('*').maybeSingle();
  if (error) throw error;
  return (data as CatalogClip) ?? null;
};

// ─── APAGAR É EM DOIS TEMPOS ────────────────────────────────────────────────
//
// Marcar agora, apagar de verdade ao fechar. É o que dá às duas setas alguma coisa para onde
// voltar — e o que impede a linha do tempo de ser um sítio onde ninguém experimenta.
//
// ⚠️ A MARCA VAI PARA O BANCO, e não para a memória da tela. Guardada só em memória, a linha
// continuaria a existir no banco e a próxima abertura do projeto traria de volta um clipe que
// alguém tinha apagado. Marcada, ela some de todas as leituras e volta se o desfazer a chamar.

/** Marca um clipe para apagar. Some da montagem na hora; ainda dá para o trazer de volta. */
export const marcarClipeApagado = async (id: string): Promise<void> => {
  const { error } = await supabase.from('catalog_clips')
    .update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
};

/** O desfazer: tira a marca e o clipe volta ao sítio onde estava. */
export const restaurarClipe = async (id: string): Promise<void> => {
  const { error } = await supabase.from('catalog_clips')
    .update({ deleted_at: null }).eq('id', id);
  if (error) throw error;
};

/** Marca uma pista para apagar. Os clipes dela vão juntos, pela leitura. */
export const marcarPistaApagada = async (id: string): Promise<void> => {
  const { error } = await supabase.from('catalog_tracks')
    .update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
};

export const restaurarPista = async (id: string): Promise<void> => {
  const { error } = await supabase.from('catalog_tracks')
    .update({ deleted_at: null }).eq('id', id);
  if (error) throw error;
};

export const deleteClip = async (id: string): Promise<void> => {
  const { error } = await supabase.from('catalog_clips').delete().eq('id', id);
  if (error) throw error;
};

export interface Varridos {
  pistas: number;
  clipes: number;
  /** Ficheiros que já não tinham clipe nenhum a apontar para eles. */
  arquivos: number;
}

/**
 * Apaga de verdade o que foi marcado, e leva o que ficou sem uso.
 *
 * Corre em dois momentos, e é a mesma função nos dois: ao FECHAR o editor, sem `antesDe`,
 * levando tudo o que esta sessão marcou; e ao ABRIR, com `antesDe`, para varrer o que sobrou de
 * uma sessão que morreu sem fechar (a aba fechada à bruta, o portátil que adormeceu).
 *
 * ⚠️ O `antesDe` NÃO É ENFEITE. Duas abas no mesmo projeto acontecem, e sem ele a que abre
 * depois apagaria de vez aquilo que a outra ainda pode desfazer — o desfazer da primeira
 * passaria a mentir. Com ele, a limpeza de abertura só toca no que está marcado há tempo
 * demais para pertencer a alguém vivo.
 *
 * ⚠️ E LEVA OS FICHEIROS ÓRFÃOS. Até aqui, apagar uma pista guardava o áudio "na biblioteca da
 * gravação" — só que biblioteca nenhuma existe na tela: o ficheiro ficava no balde para sempre,
 * invisível, sem forma de o remover. Um ficheiro sem clipe nenhum a apontar para ele não é uma
 * reserva, é resíduo. Sai daqui, do banco e do balde.
 */
export const purgarMontagem = async (
  versionId: string,
  opcoes: { antesDe?: string; apenas?: string[] } = {},
): Promise<Varridos> => {
  // ⚠️ SAIR LEVA O QUE É MEU, E MAIS NADA. Sem `apenas`, quem fechasse a tela apagava de vez
  // tudo o que estivesse marcado nesta gravação — incluindo o que a OUTRA pessoa acabou de
  // remover e ainda pode trazer de volta com a seta. O desfazer dela passava a mentir por causa
  // de um gesto meu noutra máquina.
  //
  // A sessão sabe exatamente o que marcou, e é essa lista que chega aqui. O que ficar de outra
  // pessoa é problema dela enquanto ela estiver viva, e da varredura por tempo (`antesDe`) na
  // abertura seguinte quando não estiver.
  //
  // Lista VAZIA é uma resposta legítima — "não marquei nada" — e nesse caso não há o que varrer.
  if (opcoes.apenas && !opcoes.apenas.length) return { pistas: 0, clipes: 0, arquivos: 0 };
  const minhas = opcoes.apenas;
  // As pistas primeiro: os clipes delas descem em cascata pela chave estrangeira, e assim a
  // varredura dos clipes a seguir já não os vê.
  const todasAsPistas = supabase.from('catalog_tracks').select('id')
    .eq('version_id', versionId).not('deleted_at', 'is', null);
  const dePistas = minhas ? todasAsPistas.in('id', minhas) : todasAsPistas;
  const { data: pistasMortas, error: erroPistas } = await (
    opcoes.antesDe ? dePistas.lte('deleted_at', opcoes.antesDe) : dePistas
  );
  if (erroPistas) throw erroPistas;
  const idsMortos = (pistasMortas || []).map((p) => (p as { id: string }).id);
  if (idsMortos.length) {
    const { error } = await supabase.from('catalog_tracks').delete().in('id', idsMortos);
    if (error) throw error;
  }

  // As pistas que ficam. São no máximo `MAXIMO_DE_PISTAS`, por isso uma lista de ids serve
  // melhor do que uma subconsulta: uma ida ao servidor a menos e nenhum SQL a manter.
  const { data: pistasVivas, error: erroVivas } = await supabase
    .from('catalog_tracks').select('id').eq('version_id', versionId).is('deleted_at', null);
  if (erroVivas) throw erroVivas;
  const idsVivos = (pistasVivas || []).map((p) => (p as { id: string }).id);

  let clipes = 0;
  if (idsVivos.length) {
    const todosOsClipes = supabase.from('catalog_clips').select('id')
      .in('track_id', idsVivos).not('deleted_at', 'is', null);
    const deClipes = minhas ? todosOsClipes.in('id', minhas) : todosOsClipes;
    const { data: mortos, error } = await (
      opcoes.antesDe ? deClipes.lte('deleted_at', opcoes.antesDe) : deClipes
    );
    if (error) throw error;
    const idsClipes = (mortos || []).map((c) => (c as { id: string }).id);
    if (idsClipes.length) {
      const { error: erroApagar } = await supabase.from('catalog_clips').delete().in('id', idsClipes);
      if (erroApagar) throw erroApagar;
      clipes = idsClipes.length;
    }
  }

  const arquivos = await purgarArquivosOrfaos(versionId);
  return { pistas: idsMortos.length, clipes, arquivos };
};

/**
 * Os ficheiros da gravação que já não têm clipe nenhum a apontar para eles.
 *
 * ⚠️ A ORDEM É BANCO DEPOIS BALDE, e não o contrário. Apagar o objeto primeiro e falhar a linha
 * deixaria um clipe a apontar para um endereço vazio — a montagem abriria com uma pista muda e
 * sem explicação. Ao contrário, o pior caso é um objeto esquecido no balde, que não estraga
 * nada e a varredura seguinte não repete (a linha já não existe para o denunciar).
 */
const purgarArquivosOrfaos = async (versionId: string): Promise<number> => {
  const { data: arquivos, error } = await supabase
    .from('catalog_version_files').select('id, file_url').eq('version_id', versionId);
  if (error) throw error;
  if (!arquivos?.length) return 0;

  // ⚠️ CONTA TODO CLIPE QUE AINDA EXISTE, marcado ou não — e é aqui que estava o perigo. Um
  // clipe apagado há pouco continua no banco à espera do desfazer; se ele não contasse, o
  // ficheiro dele parecia órfão e saía do balde, e a seta traria de volta um clipe a apontar
  // para um endereço vazio: uma pista muda, sem explicação e sem volta.
  //
  // As linhas marcadas que iam mesmo embora já foram apagadas acima. O que sobrou aqui, sobrou
  // porque ainda pode voltar.
  const { data: pistas, error: erroPistas } = await supabase
    .from('catalog_tracks').select('id').eq('version_id', versionId);
  if (erroPistas) throw erroPistas;
  const idsDePistas = (pistas || []).map((p) => (p as { id: string }).id);

  const usados = new Set<string>();
  if (idsDePistas.length) {
    const { data: clipes, error: erroClipes } = await supabase
      .from('catalog_clips').select('file_id').in('track_id', idsDePistas);
    if (erroClipes) throw erroClipes;
    (clipes || []).forEach((c) => usados.add((c as { file_id: string }).file_id));
  }

  const orfaos = (arquivos as { id: string; file_url: string }[]).filter((a) => !usados.has(a.id));
  if (!orfaos.length) return 0;

  const { error: erroApagar } = await supabase
    .from('catalog_version_files').delete().in('id', orfaos.map((a) => a.id));
  if (erroApagar) throw erroApagar;

  await Promise.all(orfaos.map(async (a) => {
    const caminho = caminhoNoBalde(a.file_url, BALDE_DO_CATALOGO);
    // Um ficheiro que não está no nosso balde (importado de fora, num projeto antigo) não é
    // nosso para apagar: a linha sai, o objeto de outra pessoa fica.
    if (caminho) await removerArquivo(BALDE_DO_CATALOGO, caminho).catch(() => undefined);
  }));
  return orfaos.length;
};

/**
 * Um ficheiro enviado vira uma pista com um clipe, do princípio ao fim.
 *
 * As três escritas numa função só porque é sempre assim que um áudio entra num editor: ele não
 * é "um ficheiro solto na biblioteca", é uma faixa com som dentro. Fazer isto na tela, em três
 * chamadas soltas, deixaria ficheiros órfãos sempre que a segunda falhasse.
 */
export const criarPistaComArquivo = async (p: {
  versionId: string;
  arquivo: CatalogVersionFile;
  nome: string;
  position: number;
  colorIndex: number;
  duracao: number;
  /** Em que segundo da linha do tempo o clipe entra. Zero, salvo se largado noutro ponto. */
  inicio?: number;
}): Promise<CatalogTrack> => {
  const pista = await createTrack({
    version_id: p.versionId,
    name: p.nome,
    position: p.position,
    gain: 1,
    muted: false,
    color_index: p.colorIndex,
  });
  const clipe = await createClip({
    track_id: pista.id,
    file_id: p.arquivo.id,
    start_seconds: p.inicio ?? 0,
    offset_seconds: 0,
    duration_seconds: p.duracao,
  });
  return { ...pista, clips: [{ ...clipe, file_url: p.arquivo.file_url, file_name: p.arquivo.name }] };
};
