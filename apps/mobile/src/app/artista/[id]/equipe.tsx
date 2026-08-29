import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View,
} from 'react-native';

import { COR, RAIO } from '@maestra/core/constants/design';
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

const Acessos = ({ membro }: { membro: ArtistMember }) => {
  const niveis = membro.access_levels ?? [];
  if (!niveis.length) return <Text style={estilos.semAcesso}>Sem acessos</Text>;

  const mostrados = niveis.slice(0, 3);
  const resto = niveis.length - mostrados.length;
  return (
    <View style={estilos.pilulas}>
      {mostrados.map((nivel) => {
        const rotulo = MVP_ACCESS_LEVEL_OPTIONS.find((o) => o.id === nivel)?.label;
        return rotulo ? (
          <Text key={nivel} style={estilos.pilula}>{rotulo}</Text>
        ) : null;
      })}
      {resto > 0 && <Text style={estilos.pilula}>+{resto}</Text>}
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
        <Text style={estilos.titulao}>Equipe</Text>
        {!carregando && !erro && membros.length > 0 && (
          <Text style={estilos.resumo}>
            {ativos} {ativos === 1 ? 'ativo' : 'ativos'}
            {pendentes > 0 && `, ${pendentes} ${pendentes === 1 ? 'pendente' : 'pendentes'}`}
          </Text>
        )}
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
        <FlatList
          data={membros}
          keyExtractor={(m) => m.id}
          contentContainerStyle={estilos.conteudo}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={buscar} tintColor={COR.primaria} />
          }
          renderItem={({ item }) => (
            <View style={estilos.cartao}>
              <Avatar membro={item} />
              <View style={estilos.flex}>
                <Text style={estilos.nome} numberOfLines={1}>{nomeDe(item)}</Text>
                <Text style={estilos.email} numberOfLines={1}>{item.email}</Text>
                <Acessos membro={item} />
              </View>
              <View style={estilos.selo}>
                <Feather
                  name={item.status === 'active' ? 'check-circle' : 'clock'}
                  size={13}
                  color={item.status === 'active' ? COR.primaria : COR.apagado}
                />
                <Text style={[estilos.seloTexto, item.status === 'active' && estilos.seloAtivo]}>
                  {ROTULOS[item.status] ?? item.status}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  flex: { flex: 1 },
  cabecalho: { paddingHorizontal: 24, paddingTop: 8, gap: 2 },
  titulao: { fontSize: 26, fontWeight: '800', color: COR.titulo, letterSpacing: -0.4 },
  resumo: { fontSize: 13, color: COR.apagado, marginTop: 2 },
  espera: { marginTop: 48 },
  conteudo: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 122, gap: 8 },
  cartao: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    borderWidth: 1, borderColor: COR.contorno, borderRadius: RAIO.cartao, padding: 14,
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: COR.destaque,
    alignItems: 'center', justifyContent: 'center',
  },
  inicial: { fontSize: 17, fontWeight: '800', color: COR.secundario },
  nome: { fontSize: 16, fontWeight: '700', color: COR.titulo },
  email: { fontSize: 13, color: COR.apagado, marginTop: 1 },
  pilulas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  pilula: {
    fontSize: 11, fontWeight: '700', color: COR.secundario, backgroundColor: COR.destaque,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: RAIO.pilula, overflow: 'hidden',
  },
  semAcesso: { fontSize: 12, color: COR.apagado, marginTop: 8, fontStyle: 'italic' },
  selo: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0, marginTop: 2 },
  seloTexto: { fontSize: 12, fontWeight: '700', color: COR.apagado },
  seloAtivo: { color: COR.primaria },
  aviso: { borderWidth: 1, borderColor: COR.contorno, borderRadius: RAIO.cartao, padding: 18, gap: 6 },
  avisoTitulo: { fontSize: 16, fontWeight: '700', color: COR.titulo },
  avisoTexto: { fontSize: 14, color: COR.secundario, lineHeight: 20 },
});
