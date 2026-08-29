import dayjs from 'dayjs';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl,
  StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COR, RAIO } from '@maestra/core/constants/design';
import type { NotificationItem } from '@maestra/core/interfaces/maestra';
import {
  fetchArtistNames, listNotificationsPaginated, markAllAsRead, markAsRead,
} from '@maestra/core/services/db/notifications';
import { useVoltar } from '@/nucleo/navegar';
import { useSessao } from '@/nucleo/sessao';

// A caixa de entrada do artista.
//
// É por aqui que chegam os lembretes do plano e os avisos do produto — e é a tela que o toque
// numa notificação push vai abrir quando o push existir. Escopo de USUÁRIO, não de perfil:
// uma pessoa com cinco perfis tem uma caixa só.
//
// A tela espelha a da web, e não uma releitura: agrupa por artista com a contagem de lembretes,
// marca a não lida com o selo "Novo" e usa o MESMO formato de data (`DD/MM/YYYY HH:mm`, dayjs).
//
// Cheguei a colorir cada item pelo `type` (info/success/warning/error). Tirei: a web não faz
// isso — lá a única distinção é lida ou não lida —, e uma paleta a mais no app seria outro
// produto, não o mesmo visto de outro aparelho.

const quando = (iso?: string) => (iso ? dayjs(iso).format('DD/MM/YYYY HH:mm') : 'Agora');

interface Grupo {
  artistaId: string;
  nome: string;
  itens: NotificationItem[];
}

/** Agrupa por artista preservando a ordem de chegada, como a web faz. */
const agrupar = (itens: NotificationItem[], nomes: Record<string, string>): Grupo[] => {
  const porArtista = new Map<string, Grupo>();
  for (const item of itens) {
    const chave = item.artist_id ?? 'sem-perfil';
    if (!porArtista.has(chave)) {
      porArtista.set(chave, {
        artistaId: chave,
        nome: item.artist_id ? nomes[item.artist_id] ?? 'Perfil' : 'Geral',
        itens: [],
      });
    }
    porArtista.get(chave)!.itens.push(item);
  }
  return [...porArtista.values()];
};

export default function Notificacoes() {
  const { sessao, carregando: carregandoSessao } = useSessao();
  const router = useRouter();
  const voltar = useVoltar('/perfis');

  const [itens, setItens] = useState<NotificationItem[]>([]);
  const [pagina, setPagina] = useState(0);
  const [temMais, setTemMais] = useState(false);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const usuario = sessao?.user.id;

  const buscar = useCallback(
    async (proxima = 0) => {
      if (!usuario) return;
      setErro(null);
      try {
        const { items, hasMore } = await listNotificationsPaginated(usuario, proxima);
        // Página 0 substitui; as seguintes acumulam. Sem isso, "carregar mais" apagaria o topo.
        setItens((atual) => (proxima === 0 ? items : [...atual, ...items]));
        setTemMais(hasMore);
        setPagina(proxima);

        // Os nomes vêm numa consulta só, e não um por item: a notificação guarda o id.
        const ids = [...new Set(items.map((n) => n.artist_id).filter(Boolean))] as string[];
        if (ids.length) {
          const achados = await fetchArtistNames(ids);
          setNomes((atual) => ({ ...atual, ...achados }));
        }
      } catch {
        setErro('Não foi possível carregar as notificações.');
      } finally {
        setCarregando(false);
      }
    },
    [usuario]
  );

  useEffect(() => {
    buscar(0);
  }, [buscar]);

  const abrir = async (item: NotificationItem) => {
    if (!item.read) {
      // Otimista: marcar lida é irrelevante se falhar, e esperar a rede para riscar um aviso
      // deixa a tela parecendo travada.
      setItens((atual) => atual.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      markAsRead(item.id).catch(() => undefined);
    }
    // O `link` é uma rota da WEB (`/artists/:id/...`). Enquanto o app não tem todas as telas,
    // abrir às cegas daria "rota não encontrada" — então só navego para o que existe aqui.
    const perfil = item.artist_id;
    if (perfil) router.push({ pathname: '/perfil/[id]', params: { id: perfil } });
  };

  const lerTudo = async () => {
    if (!usuario) return;
    setItens((atual) => atual.map((n) => ({ ...n, read: true })));
    markAllAsRead(usuario).catch(() => undefined);
  };

  if (!carregandoSessao && !sessao) return <Redirect href="/entrar" />;

  const naoLidas = itens.filter((n) => !n.read).length;
  const vazia = !carregando && itens.length === 0;

  return (
    <SafeAreaView style={estilos.tela}>
      <View style={estilos.cabecalho}>
        <Text style={estilos.voltar} onPress={voltar}>‹  Perfis</Text>
        <View style={estilos.linhaTitulo}>
          <Text style={estilos.titulao}>Notificações</Text>
          {naoLidas > 0 && (
            <Pressable onPress={lerTudo} hitSlop={12}>
              <Text style={estilos.lerTudo}>Marcar todas como lidas</Text>
            </Pressable>
          )}
        </View>
      </View>

      {carregando ? (
        <ActivityIndicator color={COR.primaria} style={estilos.espera} size="large" />
      ) : vazia || erro ? (
        <View style={estilos.conteudo}>
          <View style={estilos.aviso}>
            <Text style={estilos.avisoTitulo}>
              {erro ? 'Notificações indisponíveis' : 'Nada por aqui'}
            </Text>
            <Text style={estilos.avisoTexto}>
              {erro ?? 'Lembretes do seu plano e avisos do produto aparecem nesta tela.'}
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={agrupar(itens, nomes)}
          keyExtractor={(g) => g.artistaId}
          contentContainerStyle={estilos.conteudo}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => buscar(0)} tintColor={COR.primaria} />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => temMais && buscar(pagina + 1)}
          ListFooterComponent={
            temMais ? <ActivityIndicator color={COR.primaria} style={estilos.rodape} /> : null
          }
          renderItem={({ item: grupo }) => (
            <View style={estilos.grupo}>
              <View style={estilos.cabecalhoGrupo}>
                <Text style={estilos.nomeDoGrupo}>{grupo.nome}</Text>
                <Text style={estilos.contagem}>
                  {grupo.itens.length} {grupo.itens.length === 1 ? 'lembrete' : 'lembretes'}
                </Text>
              </View>

              {grupo.itens.map((item) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [
                    estilos.cartao,
                    !item.read && estilos.naoLida,
                    pressed && estilos.pressionada,
                  ]}
                  onPress={() => abrir(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}${item.read ? '' : ', não lida'}`}
                >
                  <View style={estilos.flex}>
                    <Text style={[estilos.titulo, !item.read && estilos.tituloForte]}>
                      {item.title}
                    </Text>
                    {!!item.message && <Text style={estilos.mensagem}>{item.message}</Text>}
                    <Text style={estilos.data}>{quando(item.created_at)}</Text>
                  </View>
                  {!item.read && <Text style={estilos.novo}>Novo</Text>}
                </Pressable>
              ))}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.superficie },
  flex: { flex: 1 },
  cabecalho: { paddingHorizontal: 24, paddingTop: 8, gap: 2 },
  voltar: { fontSize: 16, color: COR.primaria, fontWeight: '600', paddingVertical: 4 },
  linhaTitulo: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  titulao: { fontSize: 26, fontWeight: '800', color: COR.titulo, letterSpacing: -0.4 },
  lerTudo: { fontSize: 13, fontWeight: '600', color: COR.primaria },
  espera: { marginTop: 48 },
  conteudo: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48, gap: 14 },
  rodape: { marginVertical: 16 },
  cartao: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    borderWidth: 1, borderColor: COR.contorno, borderRadius: RAIO.cartao, padding: 14,
  },
  naoLida: { backgroundColor: COR.destaque, borderColor: COR.divisoria },
  pressionada: { opacity: 0.6 },
  grupo: { gap: 8 },
  cabecalhoGrupo: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    gap: 12, marginTop: 8,
  },
  nomeDoGrupo: { fontSize: 15, fontWeight: '800', color: COR.titulo },
  contagem: { fontSize: 12, color: COR.apagado },
  novo: {
    fontSize: 11, fontWeight: '800', color: COR.sobrePrimaria, backgroundColor: COR.primaria,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: RAIO.pilula, overflow: 'hidden',
  },
  titulo: { fontSize: 15, fontWeight: '600', color: COR.texto, lineHeight: 20 },
  tituloForte: { fontWeight: '800', color: COR.titulo },
  mensagem: { fontSize: 14, color: COR.secundario, lineHeight: 20, marginTop: 3 },
  data: { fontSize: 12, color: COR.apagado, marginTop: 6 },
  aviso: { borderWidth: 1, borderColor: COR.contorno, borderRadius: RAIO.cartao, padding: 18, gap: 6 },
  avisoTitulo: { fontSize: 16, fontWeight: '700', color: COR.titulo },
  avisoTexto: { fontSize: 14, color: COR.secundario, lineHeight: 20 },
});
