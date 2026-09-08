import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { COR, COR_AGENDA, RAIO } from '@maestra/core/constants/design';
import { EVENT_STATUS, EVENT_TYPES } from '@maestra/core/constants/maestra';
import type { AgendaEvent } from '@maestra/core/interfaces/maestra';
import * as eventos from '@maestra/core/services/db/events';

import { Bloco, Folha, Linha } from '../Folha';

// O formulário de compromisso — a porta do `EventModal` da web.
//
// Mesmos campos, na mesma ordem: título, tipo, status, data, início, fim, local e descrição. E a
// mesma regra do fim: vindo de uma faixa da agenda, ele nasce uma hora depois do início — em
// branco obrigaria a abrir mais um seletor para o caso mais comum.
//
// Data e hora são digitadas, e não escolhidas num seletor: os seletores nativos do iOS e do
// Android são telas inteiras com formas diferentes, e o que a web tem aqui é um campo de texto
// com máscara. Um campo que aceita `28/08/2026` funciona igual nos dois e não esconde o valor.

const vazio = (data?: string, hora?: string): Partial<AgendaEvent> => ({
  title: '',
  type: 'other',
  date: data || dayjs().format('YYYY-MM-DD'),
  start_time: hora || null,
  // Uma hora de duração como palpite, como na web.
  end_time: hora ? umaHoraDepois(hora) : null,
  status: 'scheduled',
});

/** `2026-08-29` → `29/08/2026`, que é como se escreve uma data aqui. */
const paraBR = (iso?: string | null) => (iso ? dayjs(iso).format('DD/MM/YYYY') : '');

/**
 * `29/08/2026` → `2026-08-29`, ou `null` se não for data.
 *
 * À mão, e não com `dayjs(texto, 'DD/MM/YYYY')`: ler um formato exige o plugin
 * `customParseFormat`, que o app não carrega — sem ele o dayjs devolve `Invalid Date` para
 * QUALQUER data digitada, e ninguém consegue salvar. O teste pegou isso antes do aparelho.
 */
const paraISO = (br: string): string | null => {
  const partes = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(br.trim());
  if (!partes) return null;
  const [, dia, mes, ano] = partes.map(Number) as unknown as [string, number, number, number];
  const d = dayjs(new Date(ano, mes - 1, dia));
  // `31/02` vira 3 de março ao construir a data — comparar de volta rejeita o dia que não existe.
  if (!d.isValid() || d.date() !== dia || d.month() !== mes - 1) return null;
  return d.format('YYYY-MM-DD');
};

/** Aceita `9`, `09`, `9:30`, `09:30` — e devolve `09:30`. */
const horaLimpa = (texto: string): string | null => {
  const so = texto.replace(/[^\d]/g, '');
  if (!so) return null;
  const h = Number(so.slice(0, 2));
  const m = Number(so.slice(2, 4) || 0);
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** Uma hora depois, sem plugin de formato — o palpite de fim quando o início veio de uma faixa. */
const umaHoraDepois = (hora: string): string | null => {
  const limpa = horaLimpa(hora);
  if (!limpa) return null;
  const [h, m] = limpa.split(':').map(Number);
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * Um campo do formulário: o rótulo em cima, o controle embaixo.
 *
 * No escopo do MÓDULO, e não dentro da folha: um componente declarado dentro de outro é uma
 * referência nova a cada render, e o React remonta a subárvore. Aqui isso tinha efeito visível —
 * cada tecla digitada remontava o campo e fechava o teclado, e só a primeira letra entrava.
 */
const Campo = ({ rotulo, children }: { rotulo: string; children: React.ReactNode }) => (
  <View style={estilos.campo}>
    <Text style={estilos.rotulo}>{rotulo}</Text>
    {children}
  </View>
);

export const FolhaDeCompromisso = ({
  aberta, artistaId, evento, dataPadrao, horaPadrao, aoFechar, aoSalvar, aoExcluir, podeExcluir,
}: {
  aberta: boolean;
  artistaId: string;
  evento: AgendaEvent | null;
  dataPadrao?: string;
  horaPadrao?: string;
  aoFechar: () => void;
  aoSalvar: (e: AgendaEvent) => void;
  aoExcluir: (id: string) => void;
  podeExcluir: boolean;
}) => {
  const [rascunho, setRascunho] = useState<Partial<AgendaEvent>>(vazio(dataPadrao, horaPadrao));
  const [dataEscrita, setDataEscrita] = useState('');
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Reabrir a folha em outro evento precisa recarregar o rascunho: sem isto, editar um
  // compromisso depois de criar outro mostraria os dados do anterior.
  useEffect(() => {
    if (!aberta) return;
    const base = evento ?? vazio(dataPadrao, horaPadrao);
    setRascunho(base);
    setDataEscrita(paraBR(base.date));
    setErro(null);
  }, [aberta, evento, dataPadrao, horaPadrao]);

  const mudar = (parte: Partial<AgendaEvent>) => setRascunho((r) => ({ ...r, ...parte }));

  const salvar = async () => {
    if (!rascunho.title?.trim()) {
      setErro('Informe o título.');
      return;
    }
    const data = paraISO(dataEscrita);
    if (!data) {
      setErro('A data precisa estar no formato 28/08/2026.');
      return;
    }

    setErro(null);
    setGravando(true);
    try {
      const dados = {
        artist_id: artistaId,
        title: rascunho.title.trim(),
        type: rascunho.type || 'other',
        date: data,
        start_time: rascunho.start_time || null,
        end_time: rascunho.end_time || null,
        location: rascunho.location || null,
        description: rascunho.description || null,
        status: rascunho.status || 'scheduled',
      };
      const salvo = evento
        ? await eventos.updateEvent(evento.id, dados)
        : await eventos.createEvent(dados as Parameters<typeof eventos.createEvent>[0]);
      aoSalvar(salvo);
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar.');
    } finally {
      setGravando(false);
    }
  };

  const confirmarExclusao = () => {
    if (!evento) return;
    Alert.alert('Excluir evento?', 'Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await eventos.deleteEvent(evento.id);
            aoExcluir(evento.id);
            aoFechar();
          } catch (e) {
            setErro(e instanceof Error ? e.message : 'Não consegui excluir.');
          }
        },
      },
    ]);
  };

  return (
    <Folha
      aberta={aberta}
      titulo={evento ? 'Editar compromisso' : 'Novo compromisso'}
      aoFechar={aoFechar}
      acao={{ rotulo: 'Salvar', aoTocar: salvar, carregando: gravando }}
      // Excluir só existe editando, e só para quem pode. Num compromisso que ainda não nasceu o
      // botão não teria o que apagar.
      destrutiva={evento && podeExcluir ? { rotulo: 'Excluir', aoTocar: confirmarExclusao } : undefined}
    >
      <Bloco rotulo="O compromisso">
        <Linha primeira>
          <Campo rotulo="Título">
            <TextInput
              style={estilos.entrada}
              value={rascunho.title ?? ''}
              onChangeText={(t) => mudar({ title: t })}
              placeholder="Título do compromisso"
              placeholderTextColor={COR.espaçoReservado}
              autoFocus={!evento}
              accessibilityLabel="Título"
            />
          </Campo>
        </Linha>

        <Linha>
          <Campo rotulo="Tipo">
            <View style={estilos.opcoes}>
              {(Object.keys(EVENT_TYPES) as (keyof typeof EVENT_TYPES)[]).map((tipo) => {
                const escolhido = (rascunho.type ?? 'other') === tipo;
                return (
                  <Pressable
                    key={tipo}
                    style={[estilos.opcao, escolhido && estilos.opcaoEscolhida]}
                    onPress={() => mudar({ type: tipo })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: escolhido }}
                  >
                    <View style={[estilos.pontoDoTipo, { backgroundColor: EVENT_TYPES[tipo].color }]} />
                    <Text style={[estilos.opcaoTexto, escolhido && estilos.opcaoTextoEscolhido]}>
                      {EVENT_TYPES[tipo].label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Campo>
        </Linha>

        <Linha>
          <Campo rotulo="Status">
            <View style={estilos.opcoes}>
              {(Object.keys(EVENT_STATUS) as (keyof typeof EVENT_STATUS)[]).map((estado) => {
                const escolhido = (rascunho.status ?? 'scheduled') === estado;
                return (
                  <Pressable
                    key={estado}
                    style={[estilos.opcao, escolhido && estilos.opcaoEscolhida]}
                    onPress={() => mudar({ status: estado })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: escolhido }}
                  >
                    <Text style={[estilos.opcaoTexto, escolhido && estilos.opcaoTextoEscolhido]}>
                      {EVENT_STATUS[estado].label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Campo>
        </Linha>
      </Bloco>

      <Bloco rotulo="Quando">
        <Linha primeira>
          <Campo rotulo="Data">
            <TextInput
              style={estilos.entrada}
              value={dataEscrita}
              onChangeText={setDataEscrita}
              placeholder="28/08/2026"
              placeholderTextColor={COR.espaçoReservado}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Data"
            />
          </Campo>
        </Linha>

        <Linha>
          <View style={estilos.lado}>
            <View style={estilos.flex}>
              <Campo rotulo="Início">
                <TextInput
                  style={estilos.entrada}
                  value={rascunho.start_time ?? ''}
                  onChangeText={(t) => mudar({ start_time: t })}
                  onBlur={() => mudar({ start_time: horaLimpa(rascunho.start_time ?? '') })}
                  placeholder="09:00"
                  placeholderTextColor={COR.espaçoReservado}
                  keyboardType="numbers-and-punctuation"
                  accessibilityLabel="Início"
                />
              </Campo>
            </View>
            <View style={estilos.flex}>
              <Campo rotulo="Fim">
                <TextInput
                  style={estilos.entrada}
                  value={rascunho.end_time ?? ''}
                  onChangeText={(t) => mudar({ end_time: t })}
                  onBlur={() => mudar({ end_time: horaLimpa(rascunho.end_time ?? '') })}
                  placeholder="10:00"
                  placeholderTextColor={COR.espaçoReservado}
                  keyboardType="numbers-and-punctuation"
                  accessibilityLabel="Fim"
                />
              </Campo>
            </View>
          </View>
        </Linha>
      </Bloco>

      <Bloco rotulo="Onde e o quê">
        <Linha primeira>
          <Campo rotulo="Local">
            <TextInput
              style={estilos.entrada}
              value={rascunho.location ?? ''}
              onChangeText={(t) => mudar({ location: t })}
              placeholder="Local do compromisso"
              placeholderTextColor={COR.espaçoReservado}
              accessibilityLabel="Local"
            />
          </Campo>
        </Linha>

        <Linha>
          <Campo rotulo="Descrição">
            <TextInput
              style={[estilos.entrada, estilos.entradaAlta]}
              value={rascunho.description ?? ''}
              onChangeText={(t) => mudar({ description: t })}
              placeholder="Adicione informações importantes"
              placeholderTextColor={COR.espaçoReservado}
              multiline
              accessibilityLabel="Descrição"
            />
          </Campo>
        </Linha>
      </Bloco>

      {!!erro && <Text style={estilos.erro}>{erro}</Text>}
    </Folha>
  );
};

// A casca (fundo, cabeçalho, rolagem e rodapé) mora na `Folha`. Aqui ficam só os campos.
const estilos = StyleSheet.create({
  flex: { flex: 1 },
  campo: { gap: 6 },
  rotulo: { fontSize: 11, fontWeight: '800', color: COR_AGENDA.navegar, letterSpacing: 0.4 },
  // SEM moldura: o campo já está dentro do bloco branco, e a linha que o separa do vizinho é a
  // divisória. Com a borda de antes, cada campo virava uma caixa dentro de outra caixa.
  entrada: {
    paddingVertical: 2,
    fontSize: 15, color: COR_AGENDA.texto,
  },
  entradaAlta: { minHeight: 78, textAlignVertical: 'top' },
  lado: { flexDirection: 'row', gap: 12 },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcao: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 9, paddingHorizontal: 12,
    borderRadius: RAIO.pilula, borderWidth: 1, borderColor: COR.contorno,
  },
  opcaoEscolhida: { borderColor: COR.primaria, backgroundColor: COR.destaque },
  opcaoTexto: { fontSize: 13, fontWeight: '700', color: COR.secundario },
  opcaoTextoEscolhido: { color: COR.primaria },
  pontoDoTipo: { width: 7, height: 7, borderRadius: 4 },
  erro: { fontSize: 13, color: COR.erro, lineHeight: 19, paddingHorizontal: 4 },
});
