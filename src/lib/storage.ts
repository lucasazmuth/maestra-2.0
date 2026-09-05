import { enviarArquivo, removerArquivo, BALDE_DO_CATALOGO } from '@maestra/core/services/armazenamento';

// O envio mora no núcleo agora, numa forma que serve às duas superfícies (bytes + nome + tipo).
// Aqui fica só a ponte a partir do `File` do navegador, que o React Native não tem.

export interface UploadResult {
  url: string;
  path: string;
  name: string;
}

export const uploadFile = async (
  bucket: string,
  folder: string,
  file: File
): Promise<UploadResult> =>
  enviarArquivo(bucket, folder, { nome: file.name, tipo: file.type, dados: file });

export const removeFile = async (bucket: string, path: string): Promise<void> =>
  removerArquivo(bucket, path);

export const CATALOG_BUCKET = BALDE_DO_CATALOGO;
