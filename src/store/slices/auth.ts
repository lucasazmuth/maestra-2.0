import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '../../lib/supabase';
import { clearSpotifyTokens } from '../../lib/spotifyToken';

interface AuthState {
  user?: User | null;
  session?: Session | null;
  requesting: boolean;
}

const initialState: AuthState = {
  user: undefined,
  session: undefined,
  requesting: true,
};

/** Lê a sessão atual do Supabase (em reloads). */
export const bootstrapSession = createAsyncThunk('auth/bootstrapSession', async () => {
  const { data } = await supabase.auth.getSession();
  return { session: data.session ?? null, user: data.session?.user ?? null };
});

/** Login por email/senha. */
export const signIn = createAsyncThunk(
  'auth/signIn',
  async ({ email, password }: { email: string; password: string }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { session: data.session ?? null, user: data.user ?? null };
  }
);

/** Cadastro por email/senha (signup aberto). Grava o nome em user_metadata. */
export const signUp = createAsyncThunk(
  'auth/signUp',
  async ({ email, password, name }: { email: string; password: string; name?: string }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name || '' } },
    });
    if (error) throw error;
    return { session: data.session ?? null, user: data.user ?? null };
  }
);

/** Login social (Google/Facebook). Redireciona o navegador para o provedor e volta para a app;
 * a sessão é capturada pelo onAuthStateChange. Requer o provedor habilitado no Supabase Auth. */
export const signInWithProvider = createAsyncThunk(
  'auth/signInWithProvider',
  async (provider: 'google' | 'facebook') => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return data;
  }
);

export const signOut = createAsyncThunk('auth/signOut', async () => {
  await supabase.auth.signOut();
  clearSpotifyTokens();
  return true;
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<{ session: Session | null }>) {
      state.session = action.payload.session;
      state.user = action.payload.session?.user ?? null;
      state.requesting = false;
    },
    setRequesting(state, action: PayloadAction<{ requesting: boolean }>) {
      state.requesting = action.payload.requesting;
    },
    clearAuth(state) {
      state.user = null;
      state.session = null;
      state.requesting = false;
    },
  },
  extraReducers: (builder) => {
    const applied = (state: AuthState, action: any) => {
      state.session = action.payload.session;
      state.user = action.payload.user;
      state.requesting = false;
    };
    builder.addCase(bootstrapSession.fulfilled, applied);
    builder.addCase(bootstrapSession.rejected, (state) => {
      state.requesting = false;
    });
    builder.addCase(signIn.fulfilled, applied);
    builder.addCase(signUp.fulfilled, applied);
    builder.addCase(signOut.fulfilled, (state) => {
      state.user = null;
      state.session = null;
      state.requesting = false;
    });
  },
});

export const authActions = {
  ...authSlice.actions,
  bootstrapSession,
  signIn,
  signUp,
  signInWithProvider,
  signOut,
};

export default authSlice.reducer;
