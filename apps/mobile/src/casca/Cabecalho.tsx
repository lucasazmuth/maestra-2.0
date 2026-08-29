import { useRouter } from 'expo-router';
import { useEffect, useId, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COR, COR_CABECALHO, RAIO, SOMBRA_DO_BOTAO } from '@maestra/core/constants/design';
import type { Artist } from '@maestra/core/interfaces/maestra';
import { supabase } from '@maestra/core/lib/supabase';
import { countUnread } from '@maestra/core/services/db/notifications';

import { EmblemaNyta } from '@/casca/EmblemaNyta';
import { FotoDoArtista } from '@/casca/FotoDoArtista';
import { NotificationIcon } from '@/icones';
import { useSessao } from '@/nucleo/sessao';

// O cabeçalho do artista, igual ao da web no celular (ver `src/components/Layout/index.tsx`):
// à esquerda o chip do artista atual, à direita o botão da Nyta e o sino.
//
// O chip existe porque no celular a barra inferior mostra a FOTO do artista, mas não o nome —
// e a foto sozinha não basta pra quem tem dois perfis com capa parecida. Tocar nele volta pra
// lista de perfis, como na web.
//
// ⚠️ Divergência conhecida: na web o chip está com texto branco sobre o cabeçalho claro
// (`.topbar-artist-name`, de junho, quando o app ainda era escuro), ou seja, o nome está
// invisível lá. Aqui ele é legível. Copiar o bug seria copiar o acidente, não o desenho.

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
        accessibilityLabel={artista ? `${artista.name}. Trocar de perfil` : 'Trocar de perfil'}
      >
        <FotoDoArtista artista={artista} tamanho={28} />
        <Text style={estilos.nome} numberOfLines={1}>{artista?.name ?? 'Perfil'}</Text>
      </Pressable>

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
        <NotificationIcon size={22} color={COR_CABECALHO.iconeDoBotao} />
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
  // `flex: 1` empurra os dois botões pra direita, que é o que o `margin-left: auto` faz na web.
  chip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 },
  nome: { flexShrink: 1, color: COR.titulo, fontSize: 15, fontWeight: '700' },
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
    top: 4,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: RAIO.pilula,
    borderWidth: 2,
    borderColor: COR.fundo,
    backgroundColor: COR_CABECALHO.naoLidas,
  },
});
