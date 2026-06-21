import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { supabase } from '../../lib/supabase';
import type { PixData } from './subscription';

// Cobrança única (R$199,90) de um artista JÁ EXISTENTE (criado no diagnóstico).
// A confirmação apenas DESBLOQUEIA o perfil (artists.is_locked → false).

function categorizeError(error: { message?: string } | null | undefined, fallback: string): string {
  const msg = error?.message || '';
  return msg && msg.length <= 200 ? msg : fallback;
}

export interface ArtistPurchaseEntry {
  status: 'idle' | 'pending' | 'received' | 'failed';
  pixData: PixData | null;
  artistId: string | null;
  loading: boolean;
  error: string | null;
}

export interface ArtistPurchasesState {
  byPurchase: Record<string, ArtistPurchaseEntry>;
}

const initialState: ArtistPurchasesState = { byPurchase: {} };

const emptyEntry = (): ArtistPurchaseEntry => ({
  status: 'idle',
  pixData: null,
  artistId: null,
  loading: false,
  error: null,
});

// ─── Thunks ───────────────────────────────────────────────────────────────────

/**
 * Cria a cobrança única de um perfil JÁ EXISTENTE (PIX ou cartão).
 * Cartão aprovado na hora já retorna `status: 'received'` + `artistId`; PIX
 * retorna `pixData` e o perfil é desbloqueado quando o webhook confirmar.
 */
export const createArtistCharge = createAsyncThunk(
  'artistPurchases/createCharge',
  async (
    payload: {
      artistId: string;
      customerId: string;
      billingType?: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD';
      // Parcelamento (somente cartão de CRÉDITO); 1 ou ausente = à vista.
      installmentCount?: number;
      creditCard?: {
        holderName: string;
        number: string;
        expiryMonth: string;
        expiryYear: string;
        ccv: string;
      };
      creditCardHolderInfo?: {
        name: string;
        email?: string;
        cpfCnpj: string;
        postalCode: string;
        addressNumber?: string;
        phone: string;
      };
    },
    { rejectWithValue }
  ) => {
    const { data, error } = await supabase.functions.invoke('asaas-create-artist-charge', {
      body: payload,
    });
    if (error) {
      return rejectWithValue({ message: categorizeError(error, 'Erro ao criar a cobrança do perfil') });
    }
    const d = data as { purchaseId: string; artistId?: string; status?: string; pixData?: PixData | null };
    return {
      purchaseId: d.purchaseId,
      artistId: d.artistId ?? null,
      status: d.status,
      pixData: d.pixData ?? null,
    };
  }
);

/**
 * Aguarda a confirmação do pagamento (webhook marca received e desbloqueia o perfil).
 * Poll resiliente: 5s, até 10min, tolerando erros isolados. Retorna o artistId.
 */
export const pollArtistPurchase = createAsyncThunk(
  'artistPurchases/poll',
  async (payload: { purchaseId: string }, { rejectWithValue, signal }) => {
    const { purchaseId } = payload;
    const intervalMs = 5000;
    const maxMs = 10 * 60 * 1000;
    const start = Date.now();
    let consecutiveErrors = 0;

    while (Date.now() - start < maxMs) {
      if (signal.aborted) return rejectWithValue({ purchaseId, message: 'Cancelado' });

      const { data, error } = await supabase
        .from('artist_purchases')
        .select('status, artist_id')
        .eq('id', purchaseId)
        .maybeSingle();

      if (error) {
        consecutiveErrors += 1;
        if (consecutiveErrors >= 3) {
          return rejectWithValue({ purchaseId, message: 'Falha ao verificar o pagamento.' });
        }
      } else {
        consecutiveErrors = 0;
        if (data && data.status === 'received' && data.artist_id) {
          return { purchaseId, artistId: data.artist_id as string };
        }
        if (data && data.status === 'failed') {
          return rejectWithValue({ purchaseId, message: 'O pagamento não foi confirmado.' });
        }
      }

      await new Promise((r) => setTimeout(r, intervalMs));
    }

    return rejectWithValue({ purchaseId, message: 'Tempo de confirmação excedido.' });
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const ensure = (state: ArtistPurchasesState, id: string): ArtistPurchaseEntry => {
  if (!state.byPurchase[id]) state.byPurchase[id] = emptyEntry();
  return state.byPurchase[id];
};

const artistPurchasesSlice = createSlice({
  name: 'artistPurchases',
  initialState,
  reducers: {
    resetArtistPurchase(state, action: { payload: string }) {
      delete state.byPurchase[action.payload];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createArtistCharge.pending, (state) => {
        // Sem purchaseId ainda; o erro/loading inicial vive no componente.
        void state;
      })
      .addCase(createArtistCharge.fulfilled, (state, action) => {
        const { purchaseId, artistId, status, pixData } = action.payload;
        const e = ensure(state, purchaseId);
        e.loading = false;
        e.pixData = pixData;
        e.artistId = artistId;
        e.status = status === 'received' ? 'received' : 'pending';
      })
      .addCase(pollArtistPurchase.fulfilled, (state, action) => {
        const e = ensure(state, action.payload.purchaseId);
        e.status = 'received';
        e.artistId = action.payload.artistId;
        e.pixData = null;
      })
      .addCase(pollArtistPurchase.rejected, (state, action) => {
        const payload = action.payload as { purchaseId: string; message: string } | undefined;
        if (!payload) return;
        const e = ensure(state, payload.purchaseId);
        e.error = payload.message;
        if (/não foi confirmado/.test(payload.message)) e.status = 'failed';
      });
  },
});

export const { resetArtistPurchase } = artistPurchasesSlice.actions;
export default artistPurchasesSlice.reducer;
