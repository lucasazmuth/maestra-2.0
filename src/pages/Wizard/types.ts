import type { Dispatch, SetStateAction } from 'react';
import type {
  Artist,
  ArtistContent,
  ArtistIdentity,
  QuizQuestion,
  SpotifyProfile,
} from '../../interfaces/maestra';

// Contrato comum das etapas do wizard. O shell (index.tsx) é dono do draft,
// da persistência e do estado de IA; cada etapa só renderiza e delega.
export interface WizardStepProps {
  artist: Artist;
  draft: ArtistContent;
  setDraft: Dispatch<SetStateAction<ArtistContent>>;
  identity: ArtistIdentity;
  sp?: SpotifyProfile;
  busy: boolean;
  aiGuard: (fn: () => Promise<void>) => () => Promise<void>;
  persist: (patch: Partial<ArtistContent>, nextStep?: number) => Promise<void>;
  goNext: () => void;
  goBack: () => void;
}

// Perguntas legadas são strings simples; sem opções, o quiz cai no modo texto livre.
export function normalizeQuizQuestion(q: string | QuizQuestion): QuizQuestion {
  if (typeof q === 'string') return { question: q, options: [], multi: false };
  return {
    question: q.question || '',
    options: Array.isArray(q.options) ? q.options : [],
    multi: !!q.multi,
  };
}
