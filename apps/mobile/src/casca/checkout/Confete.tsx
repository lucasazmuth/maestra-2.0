import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { WebView } from 'react-native-webview';

import { COR_SUCESSO } from '@maestra/core/constants/design';

import { CONFETE, FUNDO_DA_COMEMORACAO } from '@/casca/checkout/confete.gerado';

// A comemoração da tela de sucesso: o fundo com as auroras e o confete.
//
// Os dois rodam num WebView porque é a única forma de serem os MESMOS da web — o fundo é o
// mesmo SVG (que tem desfoque gaussiano, coisa que o react-native-svg não desenha direito) e o
// confete é o mesmo canvas, com a mesma física. Refazer 200 peças em `Animated` seria outro
// desenho, e ainda passaria cada quadro pela ponte.
//
// ⚠️ O corpo da página é OPACO de propósito. O WKWebView não pinta um `<canvas>` sobre fundo
// transparente — foi o que segurou a onda do Espaço da versão por uma tarde. Como o fundo desta
// tela é o SVG, a camada opaca É o desenho: nada se perde.

const pagina = (comConfete: boolean) => `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <style>
      html, body { margin: 0; height: 100%; overflow: hidden; background: #000; }
      body {
        background-image: url("${FUNDO_DA_COMEMORACAO}");
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
      }
      canvas { position: fixed; inset: 0; width: 100vw; height: 100vh; }
    </style>
  </head>
  <body>
    <canvas id="confete"></canvas>
    <script>
      ${CONFETE}
      ${comConfete ? "desenharConfete(document.getElementById('confete'));" : ''}
    </script>
  </body>
</html>`;

export const Confete = () => {
  // Quem pediu menos movimento no sistema fica só com o fundo — a mesma regra da web, que não
  // desenha confete nenhum com `prefers-reduced-motion`.
  const [comConfete, setComConfete] = useState<boolean | null>(null);
  useEffect(() => {
    let vivo = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((menos) => { if (vivo) setComConfete(!menos); });
    return () => { vivo = false; };
  }, []);

  if (comConfete === null) return <View style={estilos.camadaVazia} />;

  return (
    <View style={estilos.camada} pointerEvents="none">
      <WebView
        source={{ html: pagina(comConfete) }}
        style={estilos.pagina}
        scrollEnabled={false}
        originWhitelist={['*']}
        androidLayerType="hardware"
      />
    </View>
  );
};

const estilos = StyleSheet.create({
  camada: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  // Enquanto a preferência de movimento não responde, a camada é só o preto do fundo: sem isto
  // a tela pisca branco no quadro em que o WebView entra.
  camadaVazia: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: COR_SUCESSO.pagina,
  },
  pagina: { flex: 1, backgroundColor: COR_SUCESSO.pagina },
});
