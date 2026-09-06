import { Linking } from 'react-native';

import { supabase } from '@maestra/core/lib/supabase';

// ONDE A MAESTRA COBRA.
//
// Duas compras, dois caminhos, por decisão do produto:
//
// · o DESBLOQUEIO de perfil, pagamento único, acontece dentro do app, no checkout da Asaas;
// · a assinatura PRO sai para o checkout da web, com a pessoa já autenticada.
//
// O RISCO, escrito aqui porque quem mexer nisto precisa saber: a App Store 3.1.1 exige compra
// pelo meio de pagamento DELA para bem digital consumido no app, e o texto dela cita
// "unlocking a full version" ao lado de "subscriptions" — o desbloqueio cai nessa descrição, e
// cobrar por Asaas aqui dentro é o caso que a diretriz nomeia. A política de Pagamentos do
// Google Play diz o equivalente. Não é uma leitura de canto: é o motivo pelo qual esta chave
// esteve desligada.
//
// O caminho da assinatura assume a outra diretriz, a 3.1.3 (anti-steering, que alcança botão e
// link para outro meio de pagamento). Essa permissão mudou várias vezes entre 2024 e 2026 e
// varia por país; antes de cada submissão, o texto vigente precisa ser conferido.
//
// As duas saídas, se a revisão recusar:
//
// · o desbloqueio: `VENDE_DESBLOQUEIO_NO_APP = false` devolve a compra para o navegador. A tela
//   já sabe fazer as duas coisas, nada precisa ser reescrito;
// · a assinatura: `MODO_DE_VENDA = 'nenhuma'` faz os botões virarem informação, sem link e sem
//   preço, que é o desenho que o Spotify usa.

export type ModoDeVenda = 'link-externo' | 'nenhuma';

export const MODO_DE_VENDA: ModoDeVenda = 'link-externo';

/**
 * O desbloqueio de perfil é cobrado DENTRO do app?
 *
 * Sim, por decisão do produto: cartão e PIX pela Asaas, na propria tela de desbloqueio.
 *
 * Ligar isto é o que assume a exposição à 3.1.1 descrita acima. Desligar devolve a compra ao
 * navegador, com o mesmo repasse autenticado que a assinatura usa — a tela `desbloquear/[id]`
 * tem os dois corpos e escolhe por esta chave.
 *
 * A assinatura NÃO acompanha: ela é recorrente e continua saindo para a web.
 */
export const VENDE_DESBLOQUEIO_NO_APP = true;

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
