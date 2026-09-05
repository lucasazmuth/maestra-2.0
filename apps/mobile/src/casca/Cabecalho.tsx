import { useRouter } from 'expo-router';
import { useEffect, useId, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  COR, COR_CABECALHO, COR_PERFIS, RAIO, SOMBRA_DO_BOTAO,
} from '@maestra/core/constants/design';
import type { Artist } from '@maestra/core/interfaces/maestra';
import { supabase } from '@maestra/core/lib/supabase';
import { countUnread } from '@maestra/core/services/db/notifications';

import { EmblemaNyta } from '@/casca/EmblemaNyta';
import { SeloDoPlano } from '@/casca/marca/SeloDoPlano';
import { MaestraMarca, NotificationIcon } from '@/icones';
import { irParaOCheckout } from '@/nucleo/loja';
import { useSessao } from '@/nucleo/sessao';

// O cabeçalho, igual ao da web no celular (ver `src/components/Layout/index.tsx`): à esquerda a
// MARCA com o selo do plano, à direita o botão da Nyta e o sino.
//
// Ele já mostrou o chip do artista aqui, por causa de um bloco de CSS (`.topbar-artist`, de
// junho) que o descrevia em detalhe. Lendo o DOM da web em execução: o chip NÃO É RENDERIZADO —
// o componente nunca foi ligado, e aquele CSS é código morto. Quem diz de quem é a tela é a
// foto do artista na ilha de baixo, nas duas superfícies.
//
// Tocar na marca volta pra lista de perfis, como o logotipo da web.

export const Cabecalho = ({ artista, id }: { artista?: Artist; id: string }) => {
  const router = useRouter();
  const margem = useSafeAreaInsets();
  const { sessao } = useSessao();
  const usuario = sessao?.user.id;
  const [naoLidas, setNaoLidas] = useState(0);
  // O canal leva um sufixo por INSTÂNCIA, e não só o id do usuário.
  //
  // O Supabase guarda os canais por nome: pedir um nome que já existe devolve o canal existente,
  // e chamar `.on()` num canal já inscrito estoura. Dois cabeçalhos vivos ao mesmo tempo — que é
  // o que acontece no instante em que se troca de artista, com a casca velha ainda montada e a
  // nova já montando — pediam os dois o mesmo nome, e a tela quebrava.
  //
  // A web não tem esse problema porque lá o cabeçalho é um só, dentro do Layout, e nunca
  // coexiste consigo mesmo. Aqui a navegação é por rota, então a sobreposição é normal.
  const instancia = useId().replace(/[^a-zA-Z0-9]/g, '');

  // Mesma mecânica da web: conta ao montar e escuta o realtime, pra acender e apagar sem
  // precisar navegar. Sem isso o ponto só sumiria na próxima abertura do app.
  useEffect(() => {
    if (!usuario) { setNaoLidas(0); return undefined; }
    let vivo = true;
    const recontar = () => { countUnread(usuario).then((n) => { if (vivo) setNaoLidas(n); }).catch(() => {}); };
    recontar();
    const canal = supabase
      .channel(`notifications-badge:${usuario}:${instancia}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${usuario}` },
        recontar,
      )
      .subscribe();
    return () => { vivo = false; void supabase.removeChannel(canal); };
  }, [usuario, instancia]);

  return (
    <View style={[estilos.cabecalho, { paddingTop: margem.top, height: 72 + margem.top }]}>
      <Pressable
        style={estilos.chip}
        onPress={() => router.push('/perfis')}
        accessibilityRole="button"
        accessibilityLabel="Maestra. Ir para os perfis"
      >
        {/* A MARCA, e não o símbolo mais a palavra escrita: a web desenha "Maestra" com o
            vetor do lettering, e escrever numa fonte do app dá outra logo. */}
        <MaestraMarca size={24} color={COR_PERFIS.titulo} />
      </Pressable>

      {/* O selo fica FORA do toque da marca: ele leva à assinatura, e a marca aos perfis. */}
      <SeloDoPlano aoTocar={() => void irParaOCheckout({ destino: 'assinatura' })} />

      <View style={estilos.espaco} />

      <Pressable
        style={estilos.redondo}
        onPress={() => router.push(`/artista/${id}/nyta` as never)}
        accessibilityRole="button"
        accessibilityLabel="Abrir Nyta IA"
      >
        <EmblemaNyta size={20} />
      </Pressable>

      <Pressable
        style={estilos.redondo}
        onPress={() => router.push('/notificacoes')}
        accessibilityRole="button"
        accessibilityLabel={naoLidas > 0 ? `Notificações (${naoLidas} não lidas)` : 'Notificações'}
      >
        <NotificationIcon size={28} color={COR_PERFIS.sino} />
        {naoLidas > 0 && <View style={estilos.ponto} />}
      </Pressable>
    </View>
  );
};

const estilos = StyleSheet.create({
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    backgroundColor: COR.fundo,
  },
  chip: { flexDirection: 'row', alignItems: 'center' },
  // O que empurra os botões para a direita — é o `margin-left: auto` da web.
  espaco: { flex: 1 },
  // 42px no celular; no desktop a web usa 51.
  redondo: {
    width: 42,
    height: 42,
    borderRadius: RAIO.pilula,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COR_CABECALHO.botao,
    ...SOMBRA_DO_BOTAO,
  },

  // A borda da cor do fundo recorta o ponto do ícone, como o `border: 2px solid var(--canvas)`.
  ponto: {
    position: 'absolute',
    top: 0,
    right: 7,
    width: 10,
    height: 10,
    borderRadius: RAIO.pilula,
    borderWidth: 2,
    borderColor: COR.fundo,
    backgroundColor: COR_CABECALHO.naoLidas,
  },
});
