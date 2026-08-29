import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { COR_JAM, ONDA_DA_VERSAO } from '@maestra/core/constants/design';

import { WAVESURFER } from '@/casca/jam/wavesurfer.gerado';

// A onda da versão — a MESMA da web.
//
// Não é uma imitação desenhada com barras: é o wavesurfer.js, o mesmo arquivo que a web importa
// (`src/pages/Catalog/WaveSurferWaveform.tsx`), rodando dentro de um WebView com as mesmas
// opções. Tentei antes uma barra de progresso no lugar dela; o desenho da onda não sai de
// lugar nenhum sem decodificar o áudio, e decodificar MP3 em JavaScript no React Native não é
// coisa que se faça por baixo de uma lista. O motor do WebView já sabe fazer isso.
//
// O que o WebView NÃO faz é tocar: quem toca é o `expo-audio` da tela, um player só, como na
// web o LocalPlayerBar é um só. Aqui a onda desenha e diz onde a pessoa tocou; a posição vem
// de fora.
//
// A página não busca nada na rede além do próprio áudio — o wavesurfer vai embutido.

const pagina = (url: string) => `<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
  html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
  #onda { width: 100%; height: 62px; display: flex; align-items: center; }
  #aviso {
    font: 400 12px -apple-system, system-ui, sans-serif;
    color: ${COR_JAM.apoio}; font-style: italic; padding: 22px 0;
  }
</style></head>
<body>
<div id="onda"></div>
<div id="aviso">Analisando áudio…</div>
<script>${WAVESURFER}</script>
<script>
  var avisar = function (dados) {
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(dados));
  };
  var aviso = document.getElementById('aviso');
  // As opcoes vem do NUCLEO, as mesmas que a web usa em WaveSurferWaveform. Copia-las para ca
  // daria duas ondas diferentes para o mesmo arquivo no dia em que uma das duas mudasse.
  // (Sem acento e sem crase de proposito: isto aqui e o corpo de um template literal.)
  var onda = WaveSurfer.create(Object.assign(
    { container: document.getElementById('onda'), url: ${JSON.stringify(url)} },
    ${JSON.stringify(ONDA_DA_VERSAO)},
  ));
  onda.on('ready', function () {
    aviso.style.display = 'none';
    avisar({ tipo: 'pronta', duracao: onda.getDuration() });
  });
  onda.on('error', function () {
    aviso.textContent = 'Não foi possível ler a waveform';
    avisar({ tipo: 'erro' });
  });
  onda.on('interaction', function (segundo) { avisar({ tipo: 'buscar', segundo: segundo }); });
  // A posição vem de fora: o áudio toca no aparelho, não aqui.
  window.posicionar = function (segundo) {
    try { onda.setTime(Math.max(0, segundo)); } catch (e) {}
  };
</script>
</body></html>`;

export const Onda = memo(({ url, segundo, aoBuscar, aoSaberDuracao }: {
  url: string;
  segundo: number;
  aoBuscar: (segundo: number) => void;
  aoSaberDuracao?: (segundos: number) => void;
}) => {
  const teia = useRef<WebView>(null);
  const [pronta, setPronta] = useState(false);

  // A página é montada UMA vez por URL. Sem o memo, cada segundo de reprodução remontaria o
  // WebView, e a onda recomeçaria a carregar do zero a cada tique.
  const html = useMemo(() => pagina(url), [url]);

  useEffect(() => {
    if (!pronta) return;
    teia.current?.injectJavaScript(`window.posicionar(${Number(segundo) || 0}); true;`);
  }, [segundo, pronta]);

  const receber = (evento: WebViewMessageEvent) => {
    try {
      const dados = JSON.parse(evento.nativeEvent.data) as {
        tipo: string; segundo?: number; duracao?: number;
      };
      if (dados.tipo === 'pronta') {
        setPronta(true);
        if (dados.duracao) aoSaberDuracao?.(dados.duracao);
      }
      if (dados.tipo === 'buscar' && typeof dados.segundo === 'number') aoBuscar(dados.segundo);
    } catch { /* mensagem que não é nossa: ignora */ }
  };

  return (
    <View style={estilos.caixa}>
      <WebView
        ref={teia}
        source={{ html }}
        originWhitelist={['*']}
        style={estilos.teia}
        containerStyle={estilos.teia}
        scrollEnabled={false}
        // O fundo transparente vem do estilo mais do `background: transparent` no <body> da
        // página: sem os dois, a onda aparece num retângulo branco dentro do cartão.
        androidLayerType="software"
        onMessage={receber}
        // A barra de rolagem e o menu de seleção não têm o que fazer numa onda.
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        menuItems={[]}
      />
    </View>
  );
});
Onda.displayName = 'Onda';

/** Enquanto não há áudio, o lugar da onda diz por quê — como na web. */
export const SemOnda = () => (
  <View style={estilos.caixa}>
    <Text style={estilos.vazio}>Nenhum áudio anexado</Text>
  </View>
);

const estilos = StyleSheet.create({
  caixa: { flex: 1, height: 62, justifyContent: 'center' },
  teia: { flex: 1, backgroundColor: 'transparent' },
  vazio: { fontSize: 13, fontStyle: 'italic', color: COR_JAM.apoio },
});
