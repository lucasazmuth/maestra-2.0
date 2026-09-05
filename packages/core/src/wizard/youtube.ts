// O id de um vídeo do YouTube, a partir de qualquer formato de URL.
//
// Mora no núcleo porque as duas superfícies mostram os MESMOS vídeos de apoio (`wizard/videos`),
// e cada uma monta seu player: a web num iframe, o app num WebView. O que não pode divergir é a
// leitura da URL — um formato aceito num lado e não no outro seria um vídeo que só aparece na web.

/**
 * Aceita URL completa em qualquer formato do YouTube, ou o id nu de 11 caracteres.
 * Devolve `null` quando não reconhece — e aí o componente mostra o espaço reservado em vez de
 * renderizar um iframe quebrado.
 */
export const extractYouTubeId = (input?: string): string | null => {
  const valor = (input || '').trim();
  if (!valor) return null;

  // Id nu (é o que sobra depois de qualquer um dos formatos abaixo).
  if (/^[\w-]{11}$/.test(valor)) return valor;

  const padroes = [
    /youtu\.be\/([\w-]{11})/,            // youtu.be/ID
    /[?&]v=([\w-]{11})/,                 // youtube.com/watch?v=ID
    /\/embed\/([\w-]{11})/,              // youtube.com/embed/ID
    /\/shorts\/([\w-]{11})/,             // youtube.com/shorts/ID
    /\/live\/([\w-]{11})/,               // youtube.com/live/ID
  ];
  for (const padrao of padroes) {
    const achado = padrao.exec(valor);
    if (achado) return achado[1];
  }
  return null;
};
