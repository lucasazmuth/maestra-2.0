import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';

import { COR, RAIO, COR_CATALOGO, COR_EQUIPE } from '@maestra/core/constants/design';
import { MVP_ACCESS_LEVEL_OPTIONS } from '@maestra/core/constants/maestra';
import type { ArtistMember } from '@maestra/core/interfaces/maestra';
import { listMembers } from '@maestra/core/services/db/members';

import { useArtistaDaRota } from '@/nucleo/artista';

// A equipe do perfil.
//
// Em leitura, e isso e escolha: o que se quer saber do celular e QUEM alcanca este perfil e o
// que cada um pode mexer. Convidar exige digitar e-mail e escolher niveis — um formulario que
// se faz melhor sentado, e que a web ja tem.
//
// Os rotulos de acesso saem de `MVP_ACCESS_LEVEL_OPTIONS`, do nucleo: sao os mesmos da web, e um
// nivel novo aparece nos dois sem ninguem lembrar de duplicar. A lista tambem mostra so os tres
// primeiros mais um "+N", como la — a linha e para reconhecer, nao para auditar.

const ROTULOS: Record<string, string> = { active: 'Ativo', pending: 'Pendente', rejected: 'Recusado' };

const nomeDe = (m: ArtistMember) => m.name || m.email.split('@')[0];

const Avatar = ({ membro }: { membro: ArtistMember }) => (
  <View style={estilos.avatar}>
    <Text style={estilos.inicial}>{(nomeDe(membro).trim()[0] ?? '?').toUpperCase()}</Text>
  </View>
);

/**
 * O nível de acesso, em UMA pílula.
 *
 * A web resume tudo numa etiqueta só ("Acesso completo", ou o nome do nível quando é um) e
 * guarda o detalhe no menu de cada linha. O app listava até três pílulas mais um "+2" — o que
 * enche a linha de um membro com acesso amplo, justamente o caso mais comum.
 */
const Acessos = ({ membro }: { membro: ArtistMember }) => {
  const niveis = membro.access_levels ?? [];
  if (!niveis.length) return <Text style={estilos.semAcesso}>Sem acessos</Text>;

  const rotulo = niveis.includes('full')
    ? 'Acesso completo'
    : niveis.length === 1
      ? MVP_ACCESS_LEVEL_OPTIONS.find((o) => o.id === niveis[0])?.label ?? 'Acesso'
      : `${niveis.length} acessos`;

  return (
    <View style={estilos.pilulas}>
      <Text style={estilos.pilula}>{rotulo}</Text>
    </View>
  );
};

export default function Equipe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const artista = useArtistaDaRota(id);

  const [membros, setMembros] = useState<ArtistMember[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

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

  useEffect(() => {
    buscar();
  }, [buscar]);

  const ativos = membros.filter((m) => m.status === 'active').length;
  const pendentes = membros.filter((m) => m.status === 'pending').length;
  const vazia = !carregando && membros.length === 0;

  return (
    <View style={estilos.tela}>

      <View style={estilos.cabecalho}>
        <Text style={estilos.sobretitulo}>TIME DO ARTISTA</Text>
        <Text style={estilos.titulao}>Equipe</Text>
        <Text style={estilos.resumo}>
          Gerencie quem participa da operação e o que cada pessoa pode acessar.
        </Text>
      </View>

      {carregando ? (
        <ActivityIndicator color={COR.primaria} style={estilos.espera} size="large" />
      ) : vazia || erro ? (
        <View style={estilos.conteudo}>
          <View style={estilos.aviso}>
            <Text style={estilos.avisoTitulo}>{erro ? 'Equipe indisponível' : 'Ninguém na equipe'}</Text>
            <Text style={estilos.avisoTexto}>
              {erro ?? 'Convites são feitos na web. Quem aceitar aparece aqui, com o que pode acessar.'}
            </Text>
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={estilos.conteudo}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={buscar} tintColor={COR.primaria} />
          }
        >
          {/* O contorno e da LISTA, e nao de cada membro — e assim que a web desenha os dois
              modulos de lista (Equipe e Musicas). Uma equipe tem poucas pessoas, entao ela e
              renderizada inteira, como la. */}
          <View style={estilos.lista}>
            {membros.map((item, index) => (
              <View
                key={item.id}
                style={[estilos.cartao, index === membros.length - 1 && estilos.ultimo]}
              >
                <Avatar membro={item} />
                <View style={estilos.flex}>
                  <Text style={estilos.nome} numberOfLines={1}>{nomeDe(item)}</Text>
                  <Text style={estilos.email} numberOfLines={1}>{item.email}</Text>
                </View>
                <View style={estilos.selo}>
                  <View
                    style={[
                      estilos.ponto,
                      { backgroundColor: item.status === 'active' ? COR_EQUIPE.ativoPonto : COR_EQUIPE.pendente },
                    ]}
                  />
                  <Text style={[estilos.seloTexto, item.status === 'active' && estilos.seloAtivo]}>
                    {ROTULOS[item.status] ?? item.status}
                  </Text>
                </View>
                {/* As pilulas de acesso descem pra segunda linha quando nao cabem ao lado do
                    nome — `flexWrap` no cartao com `width: 100%` nelas. */}
                <Acessos membro={item} />
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  // Mesmo desenho de lista do Catalogo, que e o que a web usa nos dois: um contorno so em volta
  // da lista inteira, e cada membro e uma faixa branca de 78px separada por um fio. As pilulas
  // de acesso descem pra segunda linha do cartao quando nao cabem.
  tela: { flex: 1, backgroundColor: COR.fundo },
  flex: { flex: 1, minWidth: 0 },
  cabecalho: {
    paddingHorizontal: 14, paddingTop: 18, paddingBottom: 30,
    borderBottomWidth: 1, borderBottomColor: COR_CATALOGO.contornoDoTopo, marginHorizontal: 4,
  },
  sobretitulo: {
    fontSize: 9, fontWeight: '800', color: COR_CATALOGO.rotulo, marginBottom: 8,
  },
  titulao: { fontSize: 27, fontWeight: '800', color: COR_CATALOGO.titulo },
  resumo: { fontSize: 12, color: COR_CATALOGO.apoio, marginTop: 9, lineHeight: 18 },
  espera: { marginTop: 48 },
  conteudo: {
    paddingHorizontal: 14, paddingTop: 28, paddingBottom: 122,
  },
  // O contorno e da LISTA, nao de cada membro.
  lista: {
    borderWidth: 1, borderColor: COR_CATALOGO.contornoDoTopo, borderRadius: 8, overflow: 'hidden',
  },
  cartao: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14, rowGap: 10,
    minHeight: 78, paddingVertical: 12, paddingHorizontal: 10,
    borderBottomWidth: 1, borderBottomColor: COR_CATALOGO.fio,
    backgroundColor: COR.superficie,
  },
  ultimo: { borderBottomWidth: 0 },
  avatar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: COR.destaque,
    alignItems: 'center', justifyContent: 'center',
  },
  inicial: { fontSize: 17, fontWeight: '800', color: COR.secundario },
  nome: { fontSize: 14, fontWeight: '600', color: COR_EQUIPE.nome },
  email: { fontSize: 13, fontWeight: '500', color: COR_EQUIPE.email, marginTop: 2 },
  pilulas: { flexShrink: 0 },
  pilula: {
    fontSize: 10.5, fontWeight: '700', color: COR_EQUIPE.acessoTexto,
    backgroundColor: COR_EQUIPE.acessoFundo,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, overflow: 'hidden',
  },
  semAcesso: { fontSize: 11, color: COR_EQUIPE.pendente, fontStyle: 'italic' },
  selo: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  ponto: { width: 6, height: 6, borderRadius: 3 },
  seloTexto: { fontSize: 10, fontWeight: '800', color: COR_EQUIPE.pendente },
  seloAtivo: { color: COR_EQUIPE.ativoTexto },
  aviso: {
    borderWidth: 1, borderColor: COR_CATALOGO.contornoDoTopo, borderRadius: 8, padding: 18, gap: 6,
  },
  avisoTitulo: { fontSize: 16, fontWeight: '700', color: COR_CATALOGO.titulo },
  avisoTexto: { fontSize: 13, color: COR_CATALOGO.apoio, lineHeight: 20 },
});
