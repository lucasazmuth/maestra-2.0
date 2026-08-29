// Metadados que o próprio arquivo de áudio responde. Digitar duração à mão é trabalho que
// ninguém confere — e o nome do arquivo já costuma ser o nome da gravação ("guia vocal v2").
// Usado pelo modal da Versão e pela seção Versões do modal da Música.

export const readAudioDuration = (file: File): Promise<string | null> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (value: string | null) => { URL.revokeObjectURL(url); resolve(value); };
    audio.addEventListener('loadedmetadata', () => {
      const secs = audio.duration;
      if (!Number.isFinite(secs) || secs <= 0) return done(null);
      const m = Math.floor(secs / 60);
      const s = String(Math.floor(secs % 60)).padStart(2, '0');
      done(`${m}:${s}`);
    });
    // Formato que o navegador não decodifica não impede o envio — só fica sem duração.
    audio.addEventListener('error', () => done(null));
    audio.src = url;
  });

// A regra do nome mora no núcleo: o app nativo batiza a versão do mesmo jeito, e duas cópias
// dela viravam dois nomes diferentes para o mesmo arquivo.
export { tituloDoArquivo as titleFromFileName } from '@maestra/core/services/armazenamento';
