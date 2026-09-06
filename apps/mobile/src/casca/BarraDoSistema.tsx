import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_PERFIS } from '@maestra/core/constants/design';
import { countUnread } from '@maestra/core/services/db/notifications';

import { BotaoRedondo, MenuDoSistema, itensDoSistema } from '@/casca/marca/MenuDoSistema';
import { SeloDoPlano } from '@/casca/marca/SeloDoPlano';
import { MaestraMarca, NotificationIcon } from '@/icones';
import { useOfertaDoPro } from '@/nucleo/assinatura';
import { sair } from '@/nucleo/entrar';
import { irParaOCheckout } from '@/nucleo/loja';
import { useSessao } from '@/nucleo/sessao';

/** Assinatura e suporte continuam na web. */
const SITE = 'https://www.maestramanager.com';

// A BARRA DO SISTEMA — o cabeçalho das telas que ficam FORA de um artista.
//
// A marca com a pílula do plano à esquerda; o sino e o menu de grade à direita. É a mesma barra
// da web, e o mesmo desenho do cabeçalho de dentro do artista (`casca/Cabecalho`), que só
// acrescenta a Nyta e o selo do artista.
//
// Ela nasceu porque a lista de perfis tinha esta barra e as outras duas telas do sistema —
// Configurações e Notificações — tinham um "‹ Perfis" solto no lugar dela. Três telas irmãs com
// três cabeçalhos diferentes fazem o app parecer três aplicativos.
//
// O CAMINHO DE VOLTA é a marca, como no cabeçalho de dentro do artista: tocá-la leva aos
// perfis. Por isso o "‹ Perfis" não faz falta — e o menu de grade tem "Trocar perfil" para quem
// procurar ali.

export const BarraDoSistema = ({ aqui }: { aqui?: 'perfis' | 'configuracoes' }) => {
  const router = useRouter();
  const { sessao } = useSessao();
  const usuario = sessao?.user.id;
  const [naoLidas, setNaoLidas] = useState(0);
  const [menuAberto, setMenuAberto] = useState(false);
  const oferecerPro = useOfertaDoPro();

  useEffect(() => {
    if (!usuario) { setNaoLidas(0); return; }
    // Falha em silêncio de propósito: a contagem é um enfeite do cabeçalho, e derrubar a tela
    // por causa dela seria trocar o essencial pelo acessório.
    countUnread(usuario).then(setNaoLidas).catch(() => undefined);
  }, [usuario]);

  return (
    <View style={estilos.barra}>
      <Pressable
        style={estilos.marca}
        onPress={() => router.push('/perfis')}
        accessibilityRole="button"
        accessibilityLabel="Maestra. Ir para os perfis"
      >
        <MaestraMarca size={24} color={COR_PERFIS.titulo} />
      </Pressable>

      {/* Fora do toque da marca: o selo não leva a lugar nenhum, e a marca leva aos perfis. */}
      <SeloDoPlano />

      <View style={estilos.espaco} />

      <BotaoRedondo
        rotulo={naoLidas > 0 ? `Notificações (${naoLidas} não lidas)` : 'Notificações'}
        aoTocar={() => router.push('/notificacoes')}
        marca={naoLidas > 0}
      >
        <NotificationIcon size={28} color={COR_PERFIS.sino} />
      </BotaoRedondo>

      <BotaoRedondo rotulo="Menu do sistema" aoTocar={() => setMenuAberto(true)}>
        <Feather name="grid" size={23} color={COR_PERFIS.menu} />
      </BotaoRedondo>

      <MenuDoSistema
        aberto={menuAberto}
        aoFechar={() => setMenuAberto(false)}
        itens={itensDoSistema(
          {
            perfis: () => router.push('/perfis'),
            configuracoes: () => router.push('/conta'),
            suporte: () => { void Linking.openURL(`${SITE}/suporte`); },
            sair: () => { void sair(); },
            pro: () => { void irParaOCheckout({ destino: 'assinatura' }); },
          },
          { aqui, oferecerPro },
        )}
      />
    </View>
  );
};

const estilos = StyleSheet.create({
  barra: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingTop: 8, paddingBottom: 20,
    backgroundColor: COR.fundo,
  },
  marca: { flexDirection: 'row', alignItems: 'center' },
  /** O que empurra os botões para a direita — o `margin-left: auto` da web. */
  espaco: { flex: 1 },
});
