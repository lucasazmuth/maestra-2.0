import { extractSpotifyArtistId, parecerLinkDoSpotify } from '../spotifyArtistUrl';

const ID = '4vw5eIWVPuA40r24ApsbGH';

describe('extractSpotifyArtistId', () => {
  it('aceita a URL com locale e query, do jeito que o app em português copia', () => {
    // Caso real que originou a funcionalidade: artista "BEA" não aparecia na busca por nome.
    expect(
      extractSpotifyArtistId(
        `https://open.spotify.com/intl-pt/artist/${ID}?si=0fE0t-B6TG64lEusAvuuKA`
      )
    ).toBe(ID);
  });

  it('aceita a URL simples, sem locale nem query', () => {
    expect(extractSpotifyArtistId(`https://open.spotify.com/artist/${ID}`)).toBe(ID);
  });

  it('aceita qualquer locale, não só pt', () => {
    expect(extractSpotifyArtistId(`https://open.spotify.com/intl-de/artist/${ID}`)).toBe(ID);
    expect(extractSpotifyArtistId(`https://open.spotify.com/intl-ja/artist/${ID}`)).toBe(ID);
  });

  it('aceita http e sem protocolo', () => {
    expect(extractSpotifyArtistId(`http://open.spotify.com/artist/${ID}`)).toBe(ID);
    expect(extractSpotifyArtistId(`open.spotify.com/artist/${ID}`)).toBe(ID);
  });

  it('aceita a URI do app desktop', () => {
    expect(extractSpotifyArtistId(`spotify:artist:${ID}`)).toBe(ID);
  });

  it('aceita o ID solto', () => {
    expect(extractSpotifyArtistId(ID)).toBe(ID);
  });

  it('ignora espaços nas pontas (colar costuma trazer)', () => {
    expect(extractSpotifyArtistId(`  https://open.spotify.com/artist/${ID}  `)).toBe(ID);
  });

  it('devolve null para nome de artista, que deve seguir para a busca normal', () => {
    expect(extractSpotifyArtistId('BEA')).toBeNull();
    expect(extractSpotifyArtistId('Anitta')).toBeNull();
    expect(extractSpotifyArtistId('')).toBeNull();
  });

  it('não confunde link de álbum, faixa ou playlist com artista', () => {
    expect(extractSpotifyArtistId(`https://open.spotify.com/album/${ID}`)).toBeNull();
    expect(extractSpotifyArtistId(`https://open.spotify.com/track/${ID}`)).toBeNull();
    expect(extractSpotifyArtistId(`https://open.spotify.com/playlist/${ID}`)).toBeNull();
    expect(extractSpotifyArtistId(`spotify:album:${ID}`)).toBeNull();
  });

  it('rejeita ID com tamanho errado', () => {
    expect(extractSpotifyArtistId('https://open.spotify.com/artist/abc')).toBeNull();
    expect(extractSpotifyArtistId('abc123')).toBeNull();
  });

  it('não trata um nome comprido como se fosse ID', () => {
    // 22+ caracteres, mas com espaço: é nome, não ID.
    expect(extractSpotifyArtistId('Banda Muito Comprida Ok')).toBeNull();
  });
});

describe('parecerLinkDoSpotify', () => {
  it('reconhece link e URI, mesmo incompletos', () => {
    expect(parecerLinkDoSpotify('https://open.spotify.com/artist/quebrado')).toBe(true);
    expect(parecerLinkDoSpotify('spotify:artist:')).toBe(true);
  });

  it('não confunde nome de artista com link', () => {
    expect(parecerLinkDoSpotify('BEA')).toBe(false);
    expect(parecerLinkDoSpotify('')).toBe(false);
  });
});
