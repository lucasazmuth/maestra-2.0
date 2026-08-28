import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView, SectionList,
  StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BRAND, BRAND_ONYX } from '@maestra/core/constants/brand';
import { EVENT_TYPES } from '@maestra/core/constants/maestra';
import type { AgendaEvent } from '@maestra/core/interfaces/maestra';
import { listEvents } from '@maestra/core/services/db/events';
import { useAppSelector } from '@maestra/core/store/store';

// A Agenda.
//
// No computador ela e um calendario; no celular, o que se quer saber e "o que vem agora". Por
// isso a tela abre nos PROXIMOS, em ordem, e o passado fica abaixo — nao ha grade de mes aqui.
//
// Os rotulos e as cores de tipo saem de `EVENT_TYPES`, do nucleo: sao os mesmos da web, entao um
// tipo novo aparece nos dois sem ninguem lembrar de duplicar.

/** `YYYY-MM-DD` do dia de hoje na hora LOCAL — `toISOString` daria UTC e erraria a virada. */
const hoje = () => {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
};

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Formata sem `Date` de string com fuso: `new Date('2026-03-01')` volta um dia em UTC-3. */
const porExtenso = (data: string) => {
  const [ano, mes, dia] = data.split('-').map(Number);
  const semana = DIAS[new Date(ano, mes - 1, dia).getDay()];
  return `${semana}, ${dia} de ${MESES[mes - 1]}`;
};

const horario = (evento: AgendaEvent) => {
  if (!evento.start_time) return null;
  const inicio = evento.start_time.slice(0, 5);
  return evento.end_time ? `${inicio} – ${evento.end_time.slice(0, 5)}` : inicio;
};

const Cartao = ({ evento }: { evento: AgendaEvent }) => {
  const tipo = EVENT_TYPES[evento.type as keyof typeof EVENT_TYPES] ?? EVENT_TYPES.other;
  const hora = horario(evento);
  const cancelado = evento.status === 'cancelled';

  return (
    <View style={estilos.cartao}>
      <View style={[estilos.fita, { backgroundColor: tipo.color }]} />
      <View style={estilos.flex}>
        <Text style={[estilos.titulo, cancelado && estilos.cancelado]} numberOfLines={2}>
          {evento.title}
        </Text>
        <View style={estilos.meta}>
          <Text style={[estilos.tipo, { color: tipo.color }]}>{tipo.label}</Text>
          {!!hora && <Text style={estilos.hora}>{hora}</Text>}
        </View>
        {!!evento.location && <Text style={estilos.local} numberOfLines={1}>{evento.location}</Text>}
        {cancelado && <Text style={estilos.selo}>Cancelado</Text>}
      </View>
    </View>
  );
};

export default function Agenda() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const artista = useAppSelector((s) => s.artists.items.find((a) => a.id === id));

  const [eventos, setEventos] = useState<AgendaEvent[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    if (!id) return;
    setErro(null);
    try {
      setEventos(await listEvents(String(id)));
    } catch {
      setErro('Não foi possível carregar a agenda.');
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  const corte = hoje();
  const proximos = eventos.filter((e) => e.date >= corte);
  // O passado desce em ordem inversa: o que acabou de acontecer interessa mais que o de um ano.
  const passados = eventos.filter((e) => e.date < corte).reverse();

  const secoes = [
    { titulo: 'Próximos', dados: proximos },
    { titulo: 'Já passaram', dados: passados },
  ].filter((s) => s.dados.length > 0);

  const vazia = !carregando && eventos.length === 0;

  return (
    <SafeAreaView style={estilos.tela}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={estilos.cabecalho}>
        <Text style={estilos.voltar} onPress={() => router.back()}>
          ‹  {artista?.name ?? 'Perfil'}
        </Text>
        <Text style={estilos.titulão}>Agenda</Text>
      </View>

      {carregando ? (
        <ActivityIndicator color={BRAND} style={estilos.espera} size="large" />
      ) : vazia || erro ? (
        <ScrollView
          contentContainerStyle={estilos.conteudo}
          refreshControl={<RefreshControl refreshing={false} onRefresh={buscar} tintColor={BRAND} />}
        >
          <View style={estilos.aviso}>
            <Text style={estilos.avisoTitulo}>{erro ? 'Agenda indisponível' : 'Nada marcado'}</Text>
            <Text style={estilos.avisoTexto}>
              {erro ?? 'Compromissos criados na web aparecem aqui, com os próximos no topo.'}
            </Text>
          </View>
        </ScrollView>
      ) : (
        <SectionList
          sections={secoes.map((s) => ({ title: s.titulo, data: s.dados }))}
          keyExtractor={(e) => e.id}
          contentContainerStyle={estilos.conteudo}
          stickySectionHeadersEnabled={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={buscar} tintColor={BRAND} />}
          renderSectionHeader={({ section }) => (
            <Text style={estilos.secao}>{section.title}</Text>
          )}
          renderSectionFooter={() => <View style={estilos.folga} />}
          renderItem={({ item, index, section }) => {
            const anterior = section.data[index - 1] as AgendaEvent | undefined;
            // A data so aparece quando muda: repeti-la em cada cartao do mesmo dia e ruido.
            const novoDia = anterior?.date !== item.date;
            return (
              <View>
                {novoDia && <Text style={estilos.dia}>{porExtenso(item.date)}</Text>}
                <Cartao evento={item} />
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  cabecalho: { paddingHorizontal: 24, paddingTop: 8, gap: 2 },
  voltar: { fontSize: 16, color: BRAND, fontWeight: '600', paddingVertical: 4 },
  titulão: { fontSize: 26, fontWeight: '800', color: BRAND_ONYX, letterSpacing: -0.4 },
  espera: { marginTop: 48 },
  conteudo: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 },
  secao: { fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: '#9ca3af', fontWeight: '700', marginBottom: 8 },
  folga: { height: 22 },
  dia: { fontSize: 13, fontWeight: '700', color: '#6b7280', marginTop: 10, marginBottom: 6 },
  cartao: {
    flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 14, padding: 14, marginBottom: 8, overflow: 'hidden',
  },
  fita: { width: 4, borderRadius: 2, marginVertical: -14, marginLeft: -14 },
  titulo: { fontSize: 16, fontWeight: '700', color: BRAND_ONYX, lineHeight: 21 },
  cancelado: { textDecorationLine: 'line-through', color: '#9ca3af' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 },
  tipo: { fontSize: 12, fontWeight: '700' },
  hora: { fontSize: 12, color: '#6b7280' },
  local: { fontSize: 13, color: '#9ca3af', marginTop: 3 },
  selo: { fontSize: 12, color: '#b32d45', fontWeight: '700', marginTop: 4 },
  aviso: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, padding: 18, gap: 6 },
  avisoTitulo: { fontSize: 16, fontWeight: '700', color: BRAND_ONYX },
  avisoTexto: { fontSize: 14, color: '#6b7280', lineHeight: 20 },
});
