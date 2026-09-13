import dayjs, { type Dayjs } from 'dayjs';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_AGENDA, RAIO } from '@maestra/core/constants/design';
import { EVENT_TYPES } from '@maestra/core/constants/maestra';
import { useArtistCapabilities } from '@maestra/core/hooks/useArtistCapabilities';
import type { AgendaEvent } from '@maestra/core/interfaces/maestra';
import { listEvents } from '@maestra/core/services/db/events';

import { BotaoFlutuante } from '@/casca/BotaoFlutuante';
import { FolhaDeCompromisso } from '@/casca/agenda/FolhaDeCompromisso';
import { useArtistaDaRota } from '@/nucleo/artista';
import { Carregando } from '@/casca/Carregando';

// A Agenda — a porta de `src/pages/Agenda/index.tsx`.
//
// Três visões, como na web: DIA (a grade de horas), MÊS (a grade do calendário) e ANO (os doze
// meses com a contagem). A visão do dia é a que abre, e é onde se cria: tocar numa faixa vazia
// abre o formulário já com aquele dia e aquela hora — sobra só o título.
//
// Os rótulos e as cores de tipo saem de `EVENT_TYPES`, do núcleo: são os mesmos da web, então um
// tipo novo aparece nas duas superfícies sem tocar em nenhuma tela.
//
// A tela é CLARA. Ela já foi escura aqui, portada de um `.agenda-reference-page` com
// `background: #0d2146 !important` — mas a página real leva duas classes e a de `.calendar-page`
// vence. Ver `COR_AGENDA`.

type Visao = 'dia' | 'mes' | 'ano';

const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
/** Das 08:00 às 23:00, as mesmas 16 faixas da web. */
const HORAS = Array.from({ length: 16 }, (_, i) => `${String(i + 8).padStart(2, '0')}:00`);

const corDoTipo = (tipo?: string) =>
  EVENT_TYPES[tipo as keyof typeof EVENT_TYPES]?.color ?? COR.apagado;

/** Evento que veio do Plano de Ação — o prazo de uma tarefa, e não um compromisso criado aqui. */
const eTarefa = (e: AgendaEvent) => e.type === 'task' || e.source === 'action_plan';

const encurtar = (texto: string, maximo = 28) =>
  texto.length > maximo ? `${texto.slice(0, maximo).trimEnd()}…` : texto;

export default function Agenda() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const artista = useArtistaDaRota(id);
  const { canEditAgenda: podeEditar } = useArtistCapabilities(artista);

  const [eventos, setEventos] = useState<AgendaEvent[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [visao, setVisao] = useState<Visao>('dia');
  const [cursor, setCursor] = useState<Dayjs>(dayjs());
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [editando, setEditando] = useState<AgendaEvent | null>(null);
  const [dataPadrao, setDataPadrao] = useState<string | undefined>();
  const [horaPadrao, setHoraPadrao] = useState<string | undefined>();

  const buscar = useCallback(() => {
    if (!artista?.id) return;
    setErro(null);
    listEvents(artista.id)
      .then(setEventos)
      .catch(() => setErro('Não consegui carregar a agenda.'))
      .finally(() => setCarregando(false));
  }, [artista?.id]);

  useEffect(() => { buscar(); }, [buscar]);

  const porData = useMemo(() => {
    const mapa: Record<string, AgendaEvent[]> = {};
    for (const e of eventos) (mapa[e.date] = mapa[e.date] ?? []).push(e);
    return mapa;
  }, [eventos]);

  const diaEmFoco = cursor.format('YYYY-MM-DD');
  const doDia = useMemo(
    () => (porData[diaEmFoco] ?? [])
      .slice()
      .sort((a, b) => (a.start_time || '23:59').localeCompare(b.start_time || '23:59')),
    [porData, diaEmFoco],
  );

  const diasDoMes = useMemo(() => {
    const inicio = cursor.startOf('month').startOf('week');
    const fim = cursor.endOf('month').endOf('week');
    const dias: Dayjs[] = [];
    for (let d = inicio; d.isBefore(fim) || d.isSame(fim, 'day'); d = d.add(1, 'day')) dias.push(d);
    return dias;
  }, [cursor]);

  const andar = (passo: number) =>
    setCursor(cursor.add(passo, visao === 'ano' ? 'year' : visao === 'mes' ? 'month' : 'day'));

  const rotulo = visao === 'ano'
    ? cursor.format('YYYY')
    : visao === 'mes'
      ? cursor.format('MMMM [de] YYYY')
      : cursor.format('D [de] MMMM [de] YYYY');

  const criar = (data?: string, hora?: string) => {
    if (!podeEditar) return;
    setEditando(null);
    setDataPadrao(data);
    setHoraPadrao(hora);
    setFolhaAberta(true);
  };

  const editar = (evento: AgendaEvent) => {
    if (!podeEditar) return;
    setEditando(evento);
    setFolhaAberta(true);
  };

  const guardar = (salvo: AgendaEvent) =>
    setEventos((antes) => {
      const i = antes.findIndex((e) => e.id === salvo.id);
      if (i === -1) return [...antes, salvo];
      const proximo = antes.slice();
      proximo[i] = salvo;
      return proximo;
    });

  const remover = (removidoId: string) =>
    setEventos((antes) => antes.filter((e) => e.id !== removidoId));

  /** A faixa em que o evento cai: 08:00 é a primeira, e o que vem antes sobe para ela. */
  const faixaDe = (evento: AgendaEvent) => {
    const hora = Number(evento.start_time?.slice(0, 2) ?? 8);
    return Math.min(Math.max(hora - 8, 0), HORAS.length - 1);
  };

  const semHorario = doDia.find((e) => !e.start_time);

  return (
    <View style={estilos.tela}>
      {/* A barra de ferramentas: hoje, as setas, a data, "Compromisso" e as três visões. */}
      <View style={estilos.ferramentas}>
        <View style={estilos.linhaDeNavegacao}>
          <Pressable onPress={() => setCursor(dayjs())} hitSlop={8} accessibilityRole="button">
            <Text style={estilos.hoje}>Hoje</Text>
          </Pressable>
          <Pressable
            onPress={() => andar(-1)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Período anterior"
          >
            <Feather name="chevron-left" size={20} color={COR_AGENDA.navegar} />
          </Pressable>
          <Pressable
            onPress={() => andar(1)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Próximo período"
          >
            <Feather name="chevron-right" size={20} color={COR_AGENDA.navegar} />
          </Pressable>
          <Text style={estilos.rotuloDoPeriodo} numberOfLines={1}>{rotulo}</Text>
        </View>

        <View style={estilos.linhaDeAcoes}>
          <View style={estilos.abas}>
            {([['dia', 'Dia'], ['mes', 'Mês'], ['ano', 'Ano']] as const).map(([chave, texto]) => {
              const acesa = visao === chave;
              return (
                <Pressable
                  key={chave}
                  style={[estilos.aba, acesa && estilos.abaAcesa]}
                  onPress={() => setVisao(chave)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: acesa }}
                >
                  <Text style={[estilos.abaTexto, acesa && estilos.abaTextoAceso]}>{texto}</Text>
                </Pressable>
              );
            })}
          </View>

        </View>
      </View>

      {carregando ? (
        <Carregando estilo={estilos.espera} />
      ) : erro ? (
        <View style={estilos.conteudo}>
          <View style={estilos.aviso}>
            <Text style={estilos.avisoTitulo}>Agenda indisponível</Text>
            <Text style={estilos.avisoTexto}>{erro}</Text>
          </View>
        </View>
      ) : visao === 'dia' ? (
        <ScrollView
          contentContainerStyle={estilos.conteudo}
          refreshControl={<RefreshControl refreshing={false} onRefresh={buscar} tintColor={COR.primaria} />}
        >
          {/* "Dia todo": o compromisso sem horário do dia em foco, ou a frase de apoio. */}
          <View style={estilos.diaTodo}>
            <Text style={estilos.diaTodoRotulo}>Dia todo</Text>
            <Pressable
              style={estilos.flex}
              onPress={() => semHorario && editar(semHorario)}
              disabled={!semHorario}
            >
              <Text style={estilos.diaTodoTexto} numberOfLines={1}>
                {semHorario?.title ?? 'Planeje sua semana com clareza'}
              </Text>
            </Pressable>
          </View>

          {HORAS.map((hora, i) => {
            const naFaixa = doDia.filter((e) => e.start_time && faixaDe(e) === i);
            return (
              <View key={hora} style={estilos.faixa}>
                <Text style={estilos.hora}>{hora}</Text>
                {/* A faixa vazia é tocável: abre o formulário com o dia e a hora dela. */}
                <Pressable
                  style={estilos.faixaVaga}
                  onPress={() => criar(diaEmFoco, hora)}
                  disabled={!podeEditar}
                  accessibilityRole="button"
                  accessibilityLabel={`Novo compromisso às ${hora}`}
                >
                  {naFaixa.map((evento) => (
                    <Pressable
                      key={evento.id}
                      style={[estilos.evento, { borderLeftColor: corDoTipo(evento.type) }]}
                      onPress={() => editar(evento)}
                      accessibilityRole="button"
                      accessibilityLabel={evento.title}
                    >
                      <Text style={estilos.eventoTitulo} numberOfLines={2}>
                        {encurtar(evento.title, 44)}
                      </Text>
                      {!!evento.location && (
                        <Text style={estilos.eventoLocal} numberOfLines={1}>{evento.location}</Text>
                      )}
                    </Pressable>
                  ))}
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      ) : visao === 'mes' ? (
        <ScrollView contentContainerStyle={estilos.conteudo}>
          <View style={estilos.diasDaSemana}>
            {SEMANA.map((dia) => <Text key={dia} style={estilos.diaDaSemana}>{dia}</Text>)}
          </View>
          <View style={estilos.grade}>
            {diasDoMes.map((dia) => {
              const chave = dia.format('YYYY-MM-DD');
              const doDiaDaGrade = porData[chave] ?? [];
              const foraDoMes = dia.month() !== cursor.month();
              return (
                <Pressable
                  key={chave}
                  style={[estilos.dia, foraDoMes && estilos.diaDeFora]}
                  onPress={() => { setCursor(dia); setVisao('dia'); }}
                  accessibilityRole="button"
                  accessibilityLabel={dia.format('D [de] MMMM')}
                >
                  <Text style={[estilos.numeroDoDia, dia.isSame(dayjs(), 'day') && estilos.numeroDeHoje]}>
                    {dia.date()}
                  </Text>
                  {doDiaDaGrade.slice(0, 2).map((evento) => (
                    <Text
                      key={evento.id}
                      style={[estilos.etiqueta, { color: corDoTipo(evento.type) }]}
                      numberOfLines={1}
                    >
                      {encurtar(evento.title, 12)}
                    </Text>
                  ))}
                  {doDiaDaGrade.length > 2 && (
                    <Text style={estilos.aMais}>+{doDiaDaGrade.length - 2}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={estilos.conteudo}>
          <View style={estilos.meses}>
            {Array.from({ length: 12 }, (_, mes) => {
              const doMes = cursor.month(mes);
              const quantos = eventos.filter((e) => dayjs(e.date).isSame(doMes, 'month')).length;
              return (
                <Pressable
                  key={mes}
                  style={estilos.mes}
                  onPress={() => { setCursor(doMes); setVisao('mes'); }}
                  accessibilityRole="button"
                  accessibilityLabel={doMes.format('MMMM')}
                >
                  <Text style={estilos.mesNome}>{doMes.format('MMMM')}</Text>
                  <Text style={estilos.mesContagem}>
                    {quantos} {quantos === 1 ? 'compromisso' : 'compromissos'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      {!!artista && (
        <FolhaDeCompromisso
          aberta={folhaAberta}
          artistaId={artista.id}
          evento={editando}
          dataPadrao={dataPadrao}
          horaPadrao={horaPadrao}
          aoFechar={() => setFolhaAberta(false)}
          aoSalvar={guardar}
          aoExcluir={remover}
          // Prazo de tarefa se apaga no Plano de Ação, onde a tarefa vive — excluir por aqui
          // deixaria a tarefa sem prazo sem que ninguém tenha pedido isso.
          podeExcluir={!editando || !eTarefa(editando)}
        />
      )}

      {podeEditar && (
        <BotaoFlutuante rotulo="Adicionar compromisso" aoTocar={() => criar(diaEmFoco)} />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  // A Agenda e CLARA, como o resto do app. Ver `COR_AGENDA`.
  tela: { flex: 1, backgroundColor: COR_AGENDA.fundo },
  flex: { flex: 1, minWidth: 0 },
  espera: { marginTop: 48 },
  // 196 = a ilha (34 de reserva + 78) mais o botão flutuante (14 de folga + 56) e mais 14. Eram
  // 122, que só vencia a ilha: a última linha da lista ficava permanentemente debaixo do botão,
  // com os controles dela inalcançáveis por mais que se rolasse.
  conteudo: { paddingHorizontal: 18, paddingBottom: 196 },

  ferramentas: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14, gap: 12 },
  linhaDeNavegacao: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  hoje: { fontSize: 11, fontWeight: '800', color: COR_AGENDA.navegar },
  rotuloDoPeriodo: { flex: 1, fontSize: 11, fontWeight: '700', color: COR_AGENDA.rotulo },
  linhaDeAcoes: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // As tres visoes num trilho, com a ativa erguida em branco.
  abas: {
    flexDirection: 'row', gap: 4, padding: 3,
    borderRadius: 8, backgroundColor: COR_AGENDA.abasFundo,
  },
  aba: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 5 },
  abaAcesa: {
    backgroundColor: COR_AGENDA.abaAtivaFundo,
    shadowColor: 'rgb(61, 84, 126)', shadowOpacity: 0.14, shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  abaTexto: { fontSize: 10, fontWeight: '800', color: COR_AGENDA.navegar },
  abaTextoAceso: { color: COR_AGENDA.abaAtivaTexto },

  diaTodo: {
    flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 57,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: COR_AGENDA.fio,
  },
  diaTodoRotulo: { width: 74, fontSize: 10, fontWeight: '800', color: COR_AGENDA.hora },
  diaTodoTexto: { fontSize: 14, color: COR_AGENDA.texto },

  // A grade do dia: a hora numa coluna estreita e a faixa tocavel ao lado.
  faixa: { flexDirection: 'row', minHeight: 50, borderTopWidth: 1, borderTopColor: COR_AGENDA.fio },
  hora: { width: 74, paddingTop: 8, fontSize: 10, fontWeight: '800', color: COR_AGENDA.hora },
  faixaVaga: { flex: 1, paddingVertical: 4, gap: 4, justifyContent: 'center' },
  evento: {
    borderLeftWidth: 3, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 10,
    backgroundColor: COR.superficie,
  },
  eventoTitulo: { fontSize: 13, fontWeight: '700', color: COR_AGENDA.texto, lineHeight: 17 },
  eventoLocal: { fontSize: 11, color: COR_AGENDA.rotulo, marginTop: 2 },

  diasDaSemana: { flexDirection: 'row', marginTop: 6, marginBottom: 8 },
  diaDaSemana: {
    flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '800', color: COR_AGENDA.navegar,
  },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  dia: {
    width: '13.4%', minHeight: 62, padding: 5, gap: 2,
    borderRadius: 9, backgroundColor: COR.superficie,
  },
  diaDeFora: { opacity: 0.55 },
  numeroDoDia: { fontSize: 12, fontWeight: '800', color: COR_AGENDA.hora },
  numeroDeHoje: { color: COR_AGENDA.hoje },
  etiqueta: { fontSize: 8, fontWeight: '700' },
  aMais: { fontSize: 8, fontWeight: '800', color: COR_AGENDA.navegar },

  meses: { gap: 8 },
  mes: {
    padding: 16, borderRadius: 8, backgroundColor: COR.superficie,
    borderWidth: 1, borderColor: COR.contorno,
  },
  mesNome: { fontSize: 15, fontWeight: '800', color: COR_AGENDA.texto, textTransform: 'capitalize' },
  mesContagem: { fontSize: 12, color: COR_AGENDA.rotulo, marginTop: 3 },

  aviso: {
    borderWidth: 1, borderColor: COR.contorno, borderRadius: 8,
    padding: 18, gap: 6, marginTop: 16, backgroundColor: COR.superficie,
  },
  avisoTitulo: { fontSize: 16, fontWeight: '700', color: COR_AGENDA.texto },
  avisoTexto: { fontSize: 13, color: COR_AGENDA.rotulo, lineHeight: 20 },
});
