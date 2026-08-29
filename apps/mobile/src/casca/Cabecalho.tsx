import { useRouter } from 'expo-router';
import { useEffect, useId, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  COR, COR_CABECALHO, COR_PERFIS, COR_PLANO_DA_CONTA, RAIO, SOMBRA_DO_BOTAO,
} from '@maestra/core/constants/design';
import { PAYWALL_DISABLED } from '@maestra/core/constants/maestra';
import { useEntitlements } from '@maestra/core/hooks/useEntitlements';
import type { Artist } from '@maestra/core/interfaces/maestra';
import { supabase } from '@maestra/core/lib/supabase';
import { countUnread } from '@maestra/core/services/db/notifications';

import { EmblemaNyta } from '@/casca/EmblemaNyta';
import { MaestraLogo, NotificationIcon } from '@/icones';
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
  const { isPro } = useEntitlements();
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
        <MaestraLogo size={20} color={COR_PERFIS.titulo} />
        <Text style={estilos.nome}>Maestra</Text>
        {!PAYWALL_DISABLED && (
          <View style={[estilos.selo, isPro ? estilos.seloPro : estilos.seloLivre]}>
            <Text style={[estilos.seloTexto, isPro ? estilos.seloProTexto : estilos.seloLivreTexto]}>
              {isPro ? 'PRO' : 'FREE'}
            </Text>
          </View>
        )}
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
  nome: { color: COR_PERFIS.titulo, fontSize: 20, fontWeight: '800' },
  selo: {
    height: 20, justifyContent: 'center', paddingHorizontal: 8,
    borderRadius: RAIO.pilula, borderWidth: 1,
  },
  seloPro: { borderColor: COR_PLANO_DA_CONTA.proContorno },
  seloLivre: {
    borderColor: COR_PLANO_DA_CONTA.livreContorno,
    backgroundColor: COR_PLANO_DA_CONTA.livreFundo,
  },
  seloTexto: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  seloProTexto: { color: COR_PLANO_DA_CONTA.proTexto },
  seloLivreTexto: { color: COR_PLANO_DA_CONTA.livreTexto },
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
