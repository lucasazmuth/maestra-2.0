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

/** Sessão só "vale" se o e-mail estiver confirmado (ou for login social, que já vem confirmado).
 *  Usuário recém-cadastrado e ainda NÃO confirmado não é considerado logado — ele precisa digitar
 *  o código de verificação primeiro. Compartilhado entre bootstrap e onAuthStateChange. */
export const confirmedOrNull = (session: Session | null): Session | null =>
  !session?.user || session.user.email_confirmed_at ? session : null;

/** Lê a sessão atual do Supabase (em reloads). */
export const bootstrapSession = createAsyncThunk('auth/bootstrapSession', async () => {
  const { data } = await supabase.auth.getSession();
  const session = confirmedOrNull(data.session ?? null);
  return { session, user: session?.user ?? null };
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

/** Confirma o e-mail do cadastro com o CÓDIGO (OTP) recebido por e-mail (via Brevo). Em sucesso,
 *  já devolve a sessão (usuário logado). O tipo varia entre versões do Supabase ('email' no
 *  moderno, 'signup' no legado) — tenta um e cai pro outro. */
export const verifySignupOtp = createAsyncThunk(
  'auth/verifySignupOtp',
  async ({ email, token }: { email: string; token: string }) => {
    let res = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (res.error) {
      const retry = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
      if (!retry.error) res = retry;
    }
    if (res.error) throw res.error;
    return { session: res.data.session ?? null, user: res.data.user ?? null };
  }
);

/** Reenvia o código de confirmação de cadastro. */
export const resendSignupOtp = createAsyncThunk(
  'auth/resendSignupOtp',
  async ({ email }: { email: string }) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw error;
    return true;
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
    // signUp NÃO loga: se a confirmação estiver ligada, o usuário precisa do código antes (verifyOtp).
    builder.addCase(verifySignupOtp.fulfilled, applied);
    builder.addCase(signOut.fulfilled, (state) => {
      state.user = null;
      state.session = null;
      state.requesting = false;
    });
  },
});

export const authActions = {
  ...authSlice.actions,
  confirmedOrNull,
  bootstrapSession,
  signIn,
  signUp,
  verifySignupOtp,
  resendSignupOtp,
  signInWithProvider,
  signOut,
};

export default authSlice.reducer;
