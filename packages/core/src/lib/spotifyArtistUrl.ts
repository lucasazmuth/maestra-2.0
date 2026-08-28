// Extrai o ID do artista a partir do que a pessoa colar no campo de busca.
//
// POR QUE: buscar por nome falha para nomes curtos ou comuns. Uma artista chamada "BEA" não
// aparece na lista, porque o Spotify ordena por relevância global e ela fica soterrada por
// artistas maiores. Colar o link do perfil resolve de forma determinística: em vez de procurar,
// vamos direto no ID.
//
// Formatos aceitos:
//   https://open.spotify.com/artist/4vw5eIWVPuA40r24ApsbGH
//   https://open.spotify.com/intl-pt/artist/4vw5eIWVPuA40r24ApsbGH?si=0fE0t-B6TG64lEusAvuuKA
//   http://open.spotify.com/artist/...            (sem https)
//   spotify:artist:4vw5eIWVPuA40r24ApsbGH         (URI do app desktop)
//   4vw5eIWVPuA40r24ApsbGH                        (só o ID, se alguém copiar solto)
//
// O `/intl-pt/` (ou qualquer outro locale) aparece quando a pessoa copia do app em português —
// que é justamente o caso mais comum aqui. Ignorar esse segmento é obrigatório.

// IDs do Spotify são 22 caracteres em base62.
const ID = '[A-Za-z0-9]{22}';

const RE_URI = new RegExp(`^spotify:artist:(${ID})$`);
// O segmento de locale é opcional: /artist/ID ou /intl-pt/artist/ID.
const RE_URL = new RegExp(`open\\.spotify\\.com/(?:[A-Za-z-]+/)?artist/(${ID})`);
const RE_ID_PURO = new RegExp(`^${ID}$`);

/**
 * Devolve o ID do artista se a entrada for um link/URI/ID do Spotify; senão `null`
 * (aí o texto é tratado como nome e vai para a busca normal).
 */
export const extractSpotifyArtistId = (input: string): string | null => {
  const s = (input || '').trim();
  if (!s) return null;

  const uri = s.match(RE_URI);
  if (uri) return uri[1];

  const url = s.match(RE_URL);
  if (url) return url[1];

  // ID solto. Só vale se a string inteira for exatamente o ID: um nome de artista com 22
  // caracteres base62 E sem nenhum espaço é praticamente inexistente, mas exigir a coincidência
  // exata evita transformar um nome comprido em busca por ID por engano.
  if (RE_ID_PURO.test(s)) return s;

  return null;
};

/** `true` quando a entrada parece um link do Spotify (mesmo que quebrado/incompleto). Serve para
 *  a tela avisar "esse link não parece válido" em vez de buscar o texto como se fosse um nome. */
export const parecerLinkDoSpotify = (input: string): boolean =>
  /spotify\.com|spotify:/i.test((input || '').trim());
