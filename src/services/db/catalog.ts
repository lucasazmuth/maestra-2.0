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

const PROJECT_SELECT = `*, versions:catalog_versions(*, files:catalog_version_files(*), comments:catalog_version_comments(*))`;

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

/** Garante que uma faixa criada pelo modal legado também apareça no novo catálogo de projetos. */
export const syncCatalogItemToProject = async (
  item: CatalogItem,
  author?: { id?: string | null; name?: string | null; avatar?: string | null }
): Promise<void> => {
  const { error: projectError } = await supabase.from('catalog_projects').upsert({
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
    primary_version_id: item.id,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }, { onConflict: 'id' });
  if (projectError) throw projectError;
  const { error: versionError } = await supabase.from('catalog_versions').upsert({
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
    author_id: author?.id || null,
    author_name: author?.name || null,
    author_avatar: author?.avatar || null,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }, { onConflict: 'id' });
  if (versionError) throw versionError;
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
