import { fmtBRL } from './realCopy';

export interface Chartmetric {
  monthly_listeners?: number | null;
  monthly_listeners_rank?: number | null;
  career_rank?: number | null;
  top_cities?: { name: string; country: string; listeners: number }[];
  audience?: { top_countries?: { name: string; code?: string | null; listeners?: number | null }[] } | null;
  playlists?: { count?: number; reach?: number; top?: { name: string; followers?: number; curator?: string | null; editorial?: boolean }[] } | null;
  similar?: { name: string; image?: string | null }[] | null;
}

const PREMIO_LABELS = ['Nunca fui indicada nem premiada', 'Já fui indicada (sem ganhar)', 'Prêmio local/regional', 'Prêmio nacional', 'Prêmio internacional'];
const IMPRENSA_LABELS = ['Nunca apareci na mídia', 'Repercussão local/regional', 'Repercussão nacional', 'Repercussão internacional'];

export const v2InputsView = (ri: any) => ({
  monthly_listeners: ri?.spotifyListeners ?? null,
  sp_followers: ri?.spotifyFollowers ?? null,
  social: { instagram: ri?.igFollowers ?? null, tiktok: ri?.tiktokFollowers ?? null, youtube: ri?.youtubeMonthlyViews ?? null },
  faturamento: fmtBRL(Number(ri?.showsPerMonth ?? 0) * Number(ri?.cache ?? 0) + Number(ri?.faturamentoForaShows ?? 0)),
  shows_pagos: String(ri?.showsPerMonth ?? 0),
  maior_publico: String(ri?.avgAudience ?? 0),
  premios: PREMIO_LABELS[ri?.premios] ?? '—',
  imprensa: IMPRENSA_LABELS[ri?.imprensa] ?? '—',
});
