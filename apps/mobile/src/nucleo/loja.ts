import { Linking } from 'react-native';

import { supabase } from '@maestra/core/lib/supabase';

// ONDE A MAESTRA COBRA, E POR QUÊ NÃO É AQUI DENTRO.
//
// As duas lojas exigem que bem digital consumido no app seja vendido pelo meio de pagamento
// delas — App Store 3.1.1 e a política de Pagamentos do Google Play. A assinatura PRO e o
// desbloqueio de perfil são exatamente isso.
//
// A decisão do produto foi vender pelo checkout da web, com o app levando quem quer pagar até
// lá já autenticado. Isso reduz a exposição da 3.1.1 (nada é cobrado aqui dentro) e assume a da
// 3.1.3 (o anti-steering, que alcança botão e link que levem a outro meio de pagamento). A
// permissão para esse link mudou várias vezes entre 2024 e 2026 e varia por país; antes de cada
// submissão, o texto vigente da diretriz precisa ser conferido.
//
// Se a revisão recusar, o conserto é `MODO_DE_VENDA = 'nenhuma'`: os botões viram informação,
// sem link e sem preço, que é o desenho que o Spotify usa. Nenhuma tela precisa ser reescrita.

export type ModoDeVenda = 'link-externo' | 'nenhuma';

export const MODO_DE_VENDA: ModoDeVenda = 'link-externo';

/**
 * O desbloqueio de perfil é cobrado DENTRO do app?
 *
 * Não. Ele é bem digital consumido aqui dentro, exatamente como a assinatura — a 3.1.1 não
 * distingue pagamento único de recorrente, e o texto dela cita "unlocking a full version" junto
 * com "subscriptions". O checkout continua no código, atrás desta chave, porque a web e o
 * Android o usam; no app ele fica desligado e a compra acontece no navegador.
 */
export const VENDE_DESBLOQUEIO_NO_APP = false;

/** O endereço nu, para quando o repasse autenticado falhar. */
const SITE = 'https://www.maestramanager.com';

export type DestinoDeCompra =
  | { destino: 'assinatura' }
  | { destino: 'desbloqueio'; artistId: string };

const enderecoNu = (alvo: DestinoDeCompra) =>
  (alvo.destino === 'desbloqueio'
    ? `${SITE}/artists/${alvo.artistId}/desbloquear`
    : `${SITE}/assinatura`);

/**
 * Leva para o checkout da web já com a sessão pronta.
 *
 * Abre no navegador DO SISTEMA, e não num navegador embutido: uma compra dentro de uma janela do
 * próprio app é o que a diretriz trata como compra no app. Fora, é o navegador da pessoa.
 *
 * Falhou o repasse, abre o endereço mesmo assim — a pessoa entra na conta à mão. Uma compra a
 * menos é melhor que um botão que não faz nada.
 */
export const irParaOCheckout = async (alvo: DestinoDeCompra): Promise<void> => {
  let url = enderecoNu(alvo);
  try {
    const { data } = await supabase.functions.invoke('checkout-handoff', { body: alvo });
    if (typeof data?.url === 'string' && data.url.startsWith('https://')) url = data.url;
  } catch {
    /* fica o endereço nu */
  }
  await Linking.openURL(url);
};
