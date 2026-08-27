import { supabase } from './supabase';
import { ambiente } from '../nucleo/ambiente';

// Token app-only do Spotify (Client Credentials), obtido via Edge Function `spotify-app-token`
// (que detém o client_secret). Acessa apenas dados públicos (search, artist, albums, tracks) —
// não depende de login do usuário no Spotify, Development Mode ou allowlist.

const ACCESS_KEY = 'spotify_app_token';
const EXPIRY_KEY = 'spotify_app_token_expiry';

let inMemoryToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

const now = () => Date.now();

const isExpired = (): boolean => {
  const expiry = Number(ambiente().armazenamento.ler(EXPIRY_KEY) || 0);
  return !expiry || now() >= expiry;
};

/** Solicita um novo token de app via Edge Function. */
export const refreshSpotifyToken = async (): Promise<string | null> => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke('spotify-app-token', {
        body: {},
      });
      if (error || !data?.access_token) return null;

      inMemoryToken = data.access_token as string;
      const ttl = (Number(data.expires_in) || 3600) * 1000;
      ambiente().armazenamento.gravar(ACCESS_KEY, inMemoryToken);
      // Renova um pouco antes de expirar.
      ambiente().armazenamento.gravar(EXPIRY_KEY, String(now() + ttl - 5 * 60 * 1000));
      return inMemoryToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/** Retorna um access token válido do Spotify (app-only), renovando se necessário. */
export const getSpotifyToken = async (): Promise<string | null> => {
  const cached = inMemoryToken || ambiente().armazenamento.ler(ACCESS_KEY);
  if (cached && !isExpired()) {
    inMemoryToken = cached;
    return cached;
  }
  return refreshSpotifyToken();
};

export const clearSpotifyTokens = () => {
  inMemoryToken = null;
  ambiente().armazenamento.apagar(ACCESS_KEY);
  ambiente().armazenamento.apagar(EXPIRY_KEY);
};
