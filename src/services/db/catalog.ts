import { supabase } from '../../lib/supabase';
import type {
  CatalogItem,
  CatalogProject,
  CatalogProjectMessage,
  CatalogVersion,
  CatalogVersionComment,
  CatalogVersionFile,
} from '../../interfaces/maestra';

const TABLE = 'catalog_items';

// O embed precisa dizer QUAL chave estrangeira usar: existem duas entre projeto e versão —
// catalog_versions.project_id (as versões do projeto) e catalog_projects.primary_version_id (a
// versão principal). Sem o `!catalog_versions_project_id_fkey`, o PostgREST considera o vínculo
// ambíguo, recusa a query inteira e a lista de músicas volta vazia.
const PROJECT_SELECT = `*, versions:catalog_versions!catalog_versions_project_id_fkey(*, files:catalog_version_files(*), comments:catalog_version_comments(*))`;

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
  bpm: version?.bpm ?? project.bpm,
  key: version?.key ?? project.key,
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
  const projectPayload = {
    artist_id: input.artist_id,
    title: input.title || 'Sem título',
    status: input.status || 'composition',
    genre: input.genre ?? null,
    bpm: input.bpm ?? null,
    key: input.key ?? null,
    cover_image: input.cover_image ?? null,
    cover_image_name: input.cover_image_name ?? null,
    assignee: input.assignee ?? null,
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
  const versionPayload = {
    status: input.status || 'composition',
    audio_file: input.audio_file ?? null,
    audio_file_name: input.audio_file_name ?? null,
    duration: input.duration ?? null,
    bpm: input.bpm ?? null,
    key: input.key ?? null,
    genre: input.genre ?? null,
    lyrics: input.lyrics ?? null,
    updated_at: now,
  };

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

export const getCatalogProject = async (projectId: string): Promise<CatalogProject> => {
  const { data, error } = await supabase.from('catalog_projects').select(PROJECT_SELECT).eq('id', projectId).single();
  if (!error) return data as CatalogProject;
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
export const setPrimaryVersion = async (projectId: string, versionId: string): Promise<void> => {
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

export const deleteVersionFile = async (id: string): Promise<void> => {
  const { error } = await supabase.from('catalog_version_files').delete().eq('id', id);
  if (error) throw error;
};
