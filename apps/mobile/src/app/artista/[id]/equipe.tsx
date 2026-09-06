import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';

import { COR, COR_CATALOGO, COR_EQUIPE, RAIO } from '@maestra/core/constants/design';
import { ARTISTS_DEFAULT_IMAGE } from '@maestra/core/constants/spotify';
import type { ArtistMember } from '@maestra/core/interfaces/maestra';
import { listMembers } from '@maestra/core/services/db/members';

import { BotaoFlutuante } from '@/casca/BotaoFlutuante';
import { CabecalhoDoModulo, FOLGA_APOS_O_CABECALHO } from '@/casca/CabecalhoDoModulo';
import { FolhaDeConvite } from '@/casca/equipe/FolhaDeConvite';
import { FolhaDoMembro, SeloDeEstado } from '@/casca/equipe/FolhaDoMembro';
import { useArtistaDaRota } from '@/nucleo/artista';
import { useSessao } from '@/nucleo/sessao';

// A equipe do perfil.
//
// A tela era só leitura, e eu tinha escrito que convidar "se faz melhor sentado". Não se faz: é
// um e-mail, um nome e quatro caixas de seleção, e quem precisa dar acesso a alguém costuma
// precisar disso no momento em que a pessoa está do lado.
//
// Convidar, editar acessos e remover são do DONO do perfil. Quem é membro abre a mesma folha e
// só lê — o rodapé some, porque um "Salvar" que não salva é pior do que botão nenhum.
//
// ⚠️ As pílulas de acesso NÃO aparecem na linha: a folha da web esconde `.accessSummary` abaixo
// de 600px. Eu tinha portado uma pílula-resumo que a web não mostra aqui — quem quer auditar
// acesso abre o "···", que é onde a lista completa está.

const nomeDe = (m: ArtistMember) => m.name || m.email.split('@')[0];

export default function Equipe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const artista = useArtistaDaRota(id);
  const { sessao } = useSessao();
  const usuario = sessao?.user;

  const [membros, setMembros] = useState<ArtistMember[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [convidando, setConvidando] = useState(false);
  const [noFoco, setNoFoco] = useState<ArtistMember | null>(null);

  // Só o dono do perfil convida, edita acessos e remove — é a mesma conta da web (`role`).
  const souODono = artista?.role !== 'member';

  // Só a foto de quem está logado existe: `artist_members` não tem coluna de avatar, e o
  // `user_metadata` das outras pessoas o cliente não lê.
  const fotoDe = (membro: ArtistMember) => {
    const meta = (usuario?.user_metadata ?? {}) as Record<string, string | undefined>;
    const souEu = Boolean(usuario?.id && membro.user_id && usuario.id === membro.user_id)
      || Boolean(usuario?.email && membro.email.toLowerCase() === usuario.email.toLowerCase());
    return souEu ? (meta.avatar_url || meta.picture || null) : null;
  };

  const buscar = useCallback(async () => {
    if (!id) return;
    setErro(null);
    try {
      setMembros(await listMembers(String(id)));
    } catch {
      setErro('Não foi possível carregar a equipe.');
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => { buscar(); }, [buscar]);

  const vazia = !carregando && membros.length === 0;

  return (
    <View style={estilos.tela}>
      <ScrollView
        contentContainerStyle={estilos.conteudo}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={buscar} tintColor={COR.primaria} />
        }
      >
        <CabecalhoDoModulo
          titulo="Equipe"
          descricao="Gerencie quem participa da operação e o que cada pessoa pode acessar."
        />

        {carregando ? (
          <ActivityIndicator color={COR.primaria} style={estilos.espera} size="large" />
        ) : erro ? (
          <View style={estilos.aviso}>
            <Text style={estilos.avisoTitulo}>Equipe indisponível</Text>
            <Text style={estilos.avisoTexto}>{erro}</Text>
          </View>
        ) : vazia ? (
          <View style={estilos.vazio}>
            <View style={estilos.iconeDoVazio}>
              <Feather name="user" size={22} color={COR_EQUIPE.email} />
            </View>
            <Text style={estilos.vazioTitulo}>Sua equipe começa aqui</Text>
            <Text style={estilos.vazioTexto}>
              Convide colaboradores por e-mail e defina os acessos de cada pessoa.
            </Text>
          </View>
        ) : (
          <View style={estilos.lista}>
            {membros.map((item, indice) => (
              <View
                key={item.id}
                style={[estilos.cartao, indice === membros.length - 1 && estilos.ultimo]}
              >
                <Image source={{ uri: fotoDe(item) || ARTISTS_DEFAULT_IMAGE }} style={estilos.avatar} />
                <View style={estilos.flex}>
                  <Text style={estilos.nome} numberOfLines={1}>{nomeDe(item)}</Text>
                  <Text style={estilos.email} numberOfLines={1}>{item.email}</Text>
                </View>
                <SeloDeEstado estado={item.status} />
                <Pressable
                  style={estilos.mais}
                  onPress={() => setNoFoco(item)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Mais opções de ${nomeDe(item)}`}
                >
                  <Feather name="more-horizontal" size={18} color={COR_EQUIPE.mais} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <FolhaDeConvite
        aberta={convidando}
        artistaId={String(id)}
        aoFechar={() => setConvidando(false)}
        aoConvidar={(membro) => setMembros((atual) => [...atual, membro])}
      />

      <FolhaDoMembro
        membro={noFoco}
        souODono={souODono}
        foto={noFoco ? fotoDe(noFoco) : null}
        aoFechar={() => setNoFoco(null)}
        aoSalvar={(atualizado) => setMembros((atual) =>
          atual.map((m) => (m.id === atualizado.id ? atualizado : m)))}
        aoRemover={(idDoMembro) => setMembros((atual) =>
          atual.filter((m) => m.id !== idDoMembro))}
      />

      {souODono && (
        <BotaoFlutuante rotulo="Convidar membro" aoTocar={() => setConvidando(true)} />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  // Um contorno só em volta da lista inteira, e cada pessoa é uma faixa branca separada por um
  // fio — é assim que a web desenha os dois módulos de lista (Equipe e Músicas).
  tela: { flex: 1, backgroundColor: COR.fundo },
  flex: { flex: 1, minWidth: 0 },
  // 196 = a ilha (34 de reserva + 78) mais o botão flutuante (14 de folga + 56) e mais 14. Eram
  // 122, que só vencia a ilha: a última linha da lista ficava permanentemente debaixo do botão,
  // com os controles dela inalcançáveis por mais que se rolasse.
  conteudo: {
    // Sem recuo de cima: ele é todo do `CabecalhoDoModulo`, para o título nascer à mesma
    // altura em todos os módulos.
    paddingHorizontal: 14, paddingBottom: 196,
  },
  espera: { marginTop: 48 },
  lista: {
    marginTop: FOLGA_APOS_O_CABECALHO,
    borderWidth: 1, borderColor: COR_EQUIPE.contorno, borderRadius: 8,
    overflow: 'hidden',
  },
  cartao: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    minHeight: 78, paddingVertical: 12, paddingHorizontal: 10,
    borderBottomWidth: 1, borderBottomColor: COR_EQUIPE.fio,
    backgroundColor: COR.superficie,
  },
  ultimo: { borderBottomWidth: 0 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COR_EQUIPE.avatarFundo },
  nome: { fontSize: 14, fontWeight: '600', color: COR_EQUIPE.nome },
  email: { fontSize: 13, fontWeight: '500', color: COR_EQUIPE.email, marginTop: 3 },
  mais: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  vazio: {
    alignItems: 'center', gap: 8, marginTop: 28, padding: 34,
    borderWidth: 1, borderStyle: 'dashed', borderColor: COR_EQUIPE.contorno, borderRadius: 8,
  },
  iconeDoVazio: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_EQUIPE.avatarFundo,
  },
  vazioTitulo: { fontSize: 16, fontWeight: '700', color: COR_EQUIPE.nome, marginTop: 4 },
  vazioTexto: { fontSize: 13, color: COR_EQUIPE.email, lineHeight: 20, textAlign: 'center' },
  aviso: {
    marginTop: 28, borderWidth: 1, borderColor: COR_EQUIPE.contorno, borderRadius: RAIO.campo,
    padding: 18, gap: 6,
  },
  avisoTitulo: { fontSize: 16, fontWeight: '700', color: COR_CATALOGO.titulo },
  avisoTexto: { fontSize: 13, color: COR_CATALOGO.apoio, lineHeight: 20 },
});
