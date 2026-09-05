import { View } from 'react-native';

// O WebView não existe fora do aparelho: ele é um módulo nativo, e importá-lo no jest derruba a
// suíte inteira com "RNCWebViewModule could not be found". Aqui ele vira uma caixa vazia.
//
// O que os testes precisam provar sobre a onda NÃO está dentro do WebView (o desenho é do
// wavesurfer, e é dele a responsabilidade): está em torno dele — que a página é montada com a
// URL certa, e que tocar nela leva a reprodução ao ponto. Isso o mock preserva.

export const WebView = View;
export type WebViewMessageEvent = { nativeEvent: { data: string } };
export default WebView;
