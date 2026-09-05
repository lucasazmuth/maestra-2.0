import { Image, StyleSheet, Text, View } from 'react-native';

import { COR } from '@maestra/core/constants/design';
import type { Artist } from '@maestra/core/interfaces/maestra';

// A foto do perfil, ou a inicial do nome.
//
// A web cai num PNG padrão (`ARTISTS_DEFAULT_IMAGE`), mas aquela constante é montada com
// `process.env.PUBLIC_URL`, que no React Native não existe — usá-la aqui daria a URL literal
// "undefined/images/artist.png" e um quadrado cinza quebrado. A inicial diz mais e não depende
// da rede.

const inicial = (nome: string) => (nome.trim()[0] ?? '?').toUpperCase();

export const FotoDoArtista = ({ artista, tamanho }: { artista?: Artist; tamanho: number }) => {
  const foto = artista?.content?.spotifyProfile?.image;
  const forma = { width: tamanho, height: tamanho, borderRadius: tamanho / 2 };

  if (foto) return <Image source={{ uri: foto }} style={forma} />;
  return (
    <View style={[forma, estilos.vazia]}>
      <Text style={[estilos.inicial, { fontSize: tamanho * 0.42 }]}>
        {inicial(artista?.name ?? '?')}
      </Text>
    </View>
  );
};

const estilos = StyleSheet.create({
  vazia: { alignItems: 'center', justifyContent: 'center', backgroundColor: COR.destaque },
  inicial: { fontWeight: '800', color: COR.apagado },
});
