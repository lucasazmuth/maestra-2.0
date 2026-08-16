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

export const titleFromFileName = (name: string) =>
  name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
