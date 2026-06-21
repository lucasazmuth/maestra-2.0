import { supabase } from './supabase';

// Upload simples para buckets públicos do Supabase Storage. Para arquivos grandes (>50MB) o
// ideal seria TUS/resumable, mas para o MVP o upload direto cobre capas e áudios curtos.

export interface UploadResult {
  url: string;
  path: string;
  name: string;
}

const sanitize = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');

export const uploadFile = async (
  bucket: string,
  folder: string,
  file: File
): Promise<UploadResult> => {
  const path = `${folder}/${Date.now()}_${sanitize(file.name)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, path, name: file.name };
};

export const removeFile = async (bucket: string, path: string): Promise<void> => {
  await supabase.storage.from(bucket).remove([path]);
};

// Buckets do MVP
export const CATALOG_BUCKET = 'catalog';
