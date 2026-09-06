import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@maestra/core/lib/supabase';

// Os tres caminhos de entrada do app.
//
// Apple e NATIVO: a Apple exige a folha do sistema, e o `expo-web-browser` reprovaria na
// revisao. Google passa pelo navegador do sistema, e nao por uma biblioteca nativa, porque
// assim reaproveita a configuracao de OAuth que a web ja tem — o que muda e so o endereco de
// retorno, que no app e um deep link.

/** Onde o OAuth devolve o usuario. Em desenvolvimento e `exp://...`; em producao, `maestra://`. */
const enderecoDeRetorno = () => Linking.createURL('/auth/callback');

export const entrarComEmail = async (email: string, senha: string) => {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
  if (error) throw new Error(traduzir(error.message));
};

export const appleDisponivel = () => AppleAuthentication.isAvailableAsync();

export const entrarComApple = async () => {
  const credencial = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  // A Apple so entrega o token de identidade; quem o troca por sessao e o Supabase. Para isso o
  // bundle precisa estar na lista de client IDs autorizados do provedor Apple, no painel.
  if (!credencial.identityToken) throw new Error('A Apple não devolveu o token de identidade.');

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credencial.identityToken,
  });
  if (error) throw new Error(traduzir(error.message));
};

export const entrarComGoogle = async () => {
  const redirectTo = enderecoDeRetorno();

  // `skipBrowserRedirect` porque quem abre o navegador aqui somos nos, e precisamos da URL na
  // mao para saber quando ele voltou.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw new Error(traduzir(error.message));
  if (!data?.url) throw new Error('O Supabase não devolveu a URL de autorização.');

  const resultado = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  // `dismiss` e `cancel` sao a pessoa fechando a folha — nao e erro, e desistencia.
  if (resultado.type !== 'success') return false;

  await trocarUrlPorSessao(resultado.url);
  return true;
};

/**
 * O Supabase devolve os tokens no FRAGMENTO da URL (`#access_token=...`), nao na query. E o
 * mesmo formato do fluxo implicito que a web ja trata.
 */
const trocarUrlPorSessao = async (url: string) => {
  const fragmento = url.split('#')[1] ?? '';
  const campos = new URLSearchParams(fragmento);
  const access_token = campos.get('access_token');
  const refresh_token = campos.get('refresh_token');

  if (!access_token || !refresh_token) {
    const descricao = campos.get('error_description') || new URL(url).searchParams.get('error_description');
    throw new Error(descricao ? traduzir(descricao) : 'O retorno do Google veio sem sessão.');
  }

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw new Error(traduzir(error.message));
};

export const sair = async () => {
  // Sai deste aparelho, não da conta inteira: o padrão do Supabase é global e revogaria também
  // a sessão da web. Ver o comentário em `store/slices/auth.ts`.
  await supabase.auth.signOut({ scope: 'local' });
};

/**
 * As mensagens do Supabase chegam em ingles e tecnicas. Aqui viram algo que a pessoa entenda —
 * e as de configuracao ausente dizem O QUE configurar, porque quem le e a gente.
 */
const traduzir = (mensagem: string): string => {
  const m = mensagem.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (m.includes('provider is not enabled')) {
    return 'Este provedor ainda não está habilitado no Supabase.';
  }
  if (m.includes('unacceptable audience') || m.includes('audience')) {
    return 'O bundle do app não está na lista de client IDs autorizados do provedor Apple, no Supabase.';
  }
  if (m.includes('redirect') && m.includes('not allowed')) {
    return 'O endereço de retorno do app não está liberado nas Redirect URLs do Supabase.';
  }
  return mensagem;
};
