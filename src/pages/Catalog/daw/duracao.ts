/**
 * Quanto dura um ficheiro de áudio, sem o descodificar.
 *
 * O `<audio>` do navegador responde nos metadados — dezenas de kilobytes lidos, e não o
 * ficheiro inteiro. É isso que permite criar o clipe com o tamanho certo no momento do envio,
 * em vez de esperar a descodificação de 40 MB só para desenhar um retângulo.
 *
 * Devolve 0 quando o navegador não reconhece o formato: quem chama decide o que fazer (aqui, o
 * ficheiro é recusado antes de subir).
 */
export const duracaoDoArquivo = (arquivo: File): Promise<number> => new Promise((pronto) => {
  const endereco = URL.createObjectURL(arquivo);
  const audio = new Audio();
  const acabar = (segundos: number) => {
    URL.revokeObjectURL(endereco);
    pronto(Number.isFinite(segundos) && segundos > 0 ? segundos : 0);
  };
  audio.preload = 'metadata';
  audio.onloadedmetadata = () => acabar(audio.duration);
  audio.onerror = () => acabar(0);
  audio.src = endereco;
});
