import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import type { ArtistContent, ArtistIdentity } from '@maestra/core/interfaces/maestra';
import {
  GENDER_OPTIONS, MISSION_FINANCIAL_OPTIONS, STAGE_OPTIONS, VISION_ONDE_OPTIONS,
} from '@maestra/core/wizard/dados';
import { STEP_LABELS, currentStepIndex } from '@maestra/core/wizard/script';

import { WZ } from '@/casca/wizard/cores';

// O PLANO acumulado: o que já foi produzido, etapa por etapa.
//
// Na web ele é a coluna da direita no desktop e uma folha de tela cheia no celular. Aqui é sempre
// a folha — é o que existe em 375px — aberta pela barra da etapa.
//
// As nove etapas aparecem SEMPRE, inclusive as que ainda não chegaram: elas entram trancadas, com
// o nome do que vem. Antes a coluna listava só até a atual, e quem estava na etapa 2 não tinha
// como saber o que faltava.

/** Os poucos campos que esta tela sabe GRAVAR. */
type Editavel = 'genre' | 'city' | 'vision' | 'mission' | 'values';

const itensDeReferencia = (s?: string): string[] =>
  (s || '').split(/[,;\n·]+/).map((x) => x.trim()).filter(Boolean);

const previa = (texto: string): string => {
  const limpo = texto.replace(/[#*_>`]/g, '').replace(/\s+/g, ' ').trim();
  return limpo.length > 220 ? `${limpo.slice(0, 220)}…` : limpo;
};

// ---- As primitivas do corpo de um cartão -----------------------------------------------------

const Campo = ({
  rotulo, children, aoEditar,
}: { rotulo: string; children: ReactNode; aoEditar?: () => void }) => (
  <View style={estilos.campo}>
    <View style={estilos.cabecaDoCampo}>
      <Text style={estilos.rotuloDoCampo}>{rotulo}</Text>
      {!!aoEditar && (
        <Pressable
          onPress={aoEditar}
          accessibilityRole="button"
          accessibilityLabel={`Editar ${rotulo.toLowerCase()}`}
          hitSlop={8}
        >
          <Feather name="edit-3" size={13} color={WZ.muted} />
        </Pressable>
      )}
    </View>
    {children}
  </View>
);

const Texto = ({
  rotulo, valor, aoEditar,
}: { rotulo: string; valor?: string; aoEditar?: () => void }) => {
  if (!valor) return null;
  return (
    <Campo rotulo={rotulo} aoEditar={aoEditar}>
      <Text style={estilos.valor}>{valor}</Text>
    </Campo>
  );
};

const Lista = ({
  rotulo, itens, numerada, cor, nota, teto, aoEditar,
}: {
  rotulo: string;
  itens: string[];
  numerada?: boolean;
  cor?: string;
  nota?: string;
  teto?: number;
  aoEditar?: () => void;
}) => {
  if (!itens.length) return null;
  const mostrados = teto ? itens.slice(0, teto) : itens;
  return (
    <Campo rotulo={rotulo} aoEditar={aoEditar}>
      {mostrados.map((item, i) => (
        <View key={`${item}-${i}`} style={estilos.itemDaLista}>
          {numerada
            ? <Text style={estilos.numeroDoItem}>{i + 1}.</Text>
            : <View style={[estilos.pontinho, !!cor && { backgroundColor: cor }]} />}
          <Text style={estilos.valorDoItem}>{item}</Text>
        </View>
      ))}
      {!!teto && itens.length > teto && (
        <Text style={estilos.maisItens}>+{itens.length - teto}</Text>
      )}
      {!!nota && <Text style={estilos.nota}>{nota}</Text>}
    </Campo>
  );
};

const QUADRANTES: { chave: 'strengths' | 'weaknesses' | 'opportunities' | 'threats'; rotulo: string; cor: string }[] = [
  { chave: 'strengths', rotulo: 'Forças', cor: WZ.blue },
  { chave: 'weaknesses', rotulo: 'Fraquezas', cor: WZ.danger },
  { chave: 'opportunities', rotulo: 'Oportunidades', cor: WZ.ok },
  { chave: 'threats', rotulo: 'Ameaças', cor: WZ.warn },
];

const corpoDaEtapa = (
  i: number, d: ArtistContent, editar: (k: Editavel) => void, podeEditar: boolean,
): ReactNode[] => {
  const id = d.identity || {};
  const lapis = (k: Editavel) => (podeEditar ? () => editar(k) : undefined);

  switch (i) {
    case 0: {
      const refs = id.references || {};
      const pos = refs.posicionamento || {};
      return [
        <Texto key="pronome" rotulo="Pronome" valor={GENDER_OPTIONS.find((o) => o.value === id.gender)?.label || id.gender} />,
        <Texto key="genero" rotulo="Estilo musical" valor={id.genre} aoEditar={lapis('genre')} />,
        <Texto key="momento" rotulo="Momento de carreira" valor={STAGE_OPTIONS.find((o) => o.value === id.stage)?.label || id.stage} />,
        <Lista key="art" rotulo="Referências artísticas" itens={itensDeReferencia(refs.artisticas)} />,
        <Lista key="com" rotulo="Referências de comunicação" itens={itensDeReferencia(refs.comunicacao)} />,
        <Lista key="ges" rotulo="Referências de gestão" itens={itensDeReferencia(refs.gestao)} />,
        <Lista key="pos" rotulo="Referências de posicionamento" itens={[pos.curto, pos.medio, pos.longo].flatMap(itensDeReferencia)} />,
      ];
    }
    case 1: {
      const vp = id.visionParts || {};
      return [
        <Texto key="cidade" rotulo="Cidade de origem" valor={id.city ? `${id.city}${id.state ? `/${id.state}` : ''}` : undefined} aoEditar={lapis('city')} />,
        <Texto key="onde" rotulo="Alcance geográfico" valor={VISION_ONDE_OPTIONS.find((o) => o.value === vp.onde)?.label || vp.onde} />,
        <Lista key="porquem" rotulo="Reconhecido por" itens={vp.porQuem || []} />,
        <Texto key="subs" rotulo="Como o quê" valor={vp.substantivo} />,
        <Texto key="adj" rotulo="Atributo" valor={vp.adjetivo} />,
        <Texto key="falam" rotulo="O que falam de você" valor={vp.oQueFalam} />,
        <Texto key="visao" rotulo="Visão" valor={id.vision} aoEditar={lapis('vision')} />,
      ];
    }
    case 2: {
      const mp = id.missionParts || {};
      return [
        <Texto key="entrega" rotulo="O que a carreira entrega" valor={mp.entrega} />,
        <Texto key="paraquem" rotulo="Para quem" valor={mp.paraQuem} />,
        <Texto key="retorno" rotulo="Retorno financeiro esperado" valor={MISSION_FINANCIAL_OPTIONS.find((o) => o.value === mp.financialTier)?.label || mp.financialTier} />,
        <Texto key="missao" rotulo="Missão" valor={id.mission} aoEditar={lapis('mission')} />,
      ];
    }
    case 3:
      return [<Lista key="valores" rotulo="Valores escolhidos" itens={id.values || []} aoEditar={lapis('values')} />];
    case 4:
      return [<Lista key="obj" rotulo="Objetivos definidos" itens={d.objectives || []} numerada />];
    case 5: {
      const s = d.swotAnalysis;
      if (!s) return [];
      return QUADRANTES.map((q) => (
        <Lista key={q.chave} rotulo={q.rotulo} itens={s[q.chave] || []} cor={q.cor} />
      ));
    }
    case 6:
      return [
        <Lista key="estrategias" rotulo="Estratégias geradas" itens={(d.strategies || []).map((s) => s.title)} numerada teto={6} />,
      ];
    case 7: {
      const pontuadas = (d.strategies || []).filter((s) => typeof s.finalScore === 'number');
      if (!pontuadas.length) return [];
      const topo = pontuadas.slice().sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0)).slice(0, 3);
      const comTarefas = (d.strategies || []).filter((s) => (s.tasks?.length || 0) > 0).length;
      return [
        <Lista
          key="topo"
          rotulo="No topo da prioridade"
          itens={topo.map((s) => s.title)}
          numerada
          nota={comTarefas > 0 ? `${comTarefas} no plano de ação` : undefined}
        />,
      ];
    }
    case 8:
      return [
        <Texto key="resumo" rotulo="Resumo executivo" valor={d.executiveSummary ? previa(d.executiveSummary) : undefined} />,
      ];
    default:
      return [];
  }
};

// ---- O editor de um campo ---------------------------------------------------------------------

const EditorDoCampo = ({
  tipo, draft, aoGravar, aoCancelar,
}: {
  tipo: Editavel;
  draft: ArtistContent;
  aoGravar: (patch: Partial<ArtistContent>) => Promise<void> | void;
  aoCancelar: () => void;
}) => {
  const id = draft.identity || {};
  const inicial = tipo === 'genre' ? id.genre || ''
    : tipo === 'vision' ? id.vision || ''
      : tipo === 'mission' ? id.mission || ''
        : tipo === 'values' ? (id.values || []).join('\n')
          : id.city || '';
  const [texto, setTexto] = useState(inicial);
  const [uf, setUf] = useState(id.state || '');
  const [gravando, setGravando] = useState(false);
  const varias = tipo === 'vision' || tipo === 'mission' || tipo === 'values';

  const gravar = async () => {
    const identity: ArtistIdentity = { ...id };
    if (tipo === 'genre') identity.genre = texto.trim();
    else if (tipo === 'vision') identity.vision = texto.trim();
    else if (tipo === 'mission') identity.mission = texto.trim();
    else if (tipo === 'values') {
      identity.values = texto.split('\n').map((v) => v.trim()).filter(Boolean);
    } else {
      identity.city = texto.trim();
      identity.state = uf.trim().toUpperCase();
    }
    setGravando(true);
    try {
      await aoGravar({ identity });
      aoCancelar();
    } finally {
      setGravando(false);
    }
  };

  return (
    <View style={estilos.editor}>
      {tipo === 'city' ? (
        <View style={estilos.linhaDaCidade}>
          <View style={estilos.flex}>
            <Text style={estilos.rotuloDoEditor}>Cidade</Text>
            <TextInput
              style={estilos.entrada}
              value={texto}
              onChangeText={setTexto}
              autoFocus
              accessibilityLabel="Cidade"
            />
          </View>
          <View style={estilos.caixaDaUf}>
            <Text style={estilos.rotuloDoEditor}>UF</Text>
            <TextInput
              style={estilos.entrada}
              value={uf}
              onChangeText={(v) => setUf(v.toUpperCase().slice(0, 2))}
              maxLength={2}
              autoCapitalize="characters"
              accessibilityLabel="UF"
            />
          </View>
        </View>
      ) : (
        <TextInput
          style={[estilos.entrada, varias && estilos.entradaLonga]}
          value={texto}
          onChangeText={setTexto}
          multiline={varias}
          autoFocus
          accessibilityLabel="Editar"
        />
      )}
      {tipo === 'values' && <Text style={estilos.dicaDoEditor}>Um valor por linha.</Text>}
      <View style={estilos.acoesDoEditor}>
        <Pressable
          onPress={gravar}
          accessibilityRole="button"
          accessibilityLabel="Salvar"
          disabled={gravando}
        >
          <Text style={estilos.salvar}>{gravando ? 'Salvando…' : '✓ Salvar'}</Text>
        </Pressable>
        <Pressable onPress={aoCancelar} accessibilityRole="button" accessibilityLabel="Cancelar">
          <Text style={estilos.cancelar}>✕ Cancelar</Text>
        </Pressable>
      </View>
    </View>
  );
};

// ---- A folha ------------------------------------------------------------------------------------

export const Plano = ({
  draft, aoFechar, aoEditar,
}: {
  draft: ArtistContent;
  aoFechar: () => void;
  aoEditar?: (patch: Partial<ArtistContent>) => Promise<void> | void;
}) => {
  const atual = currentStepIndex(draft);
  const [editando, setEditando] = useState<Editavel | null>(null);
  const [abertaAMao, setAbertaAMao] = useState<Record<number, boolean>>({});

  // Ao concluir uma etapa, as aberturas manuais são descartadas: a recém-concluída fecha e a nova
  // abre. Sem isto, uma etapa aberta à mão ficaria aberta para sempre e a folha viraria uma pilha.
  useEffect(() => { setAbertaAMao({}); }, [atual]);

  const aberta = (i: number) => abertaAMao[i] ?? i === atual;
  const alternar = (i: number) => setAbertaAMao((m) => ({ ...m, [i]: !aberta(i) }));

  const etapas = STEP_LABELS.map((rotulo, i) => ({
    rotulo,
    i,
    campos: corpoDaEtapa(i, draft, setEditando, !!aoEditar).filter(Boolean),
  }));
  const temAlgo = etapas.some((e) => e.i <= atual && e.campos.length);

  return (
    <View style={estilos.folha}>
      <View style={estilos.cabeca}>
        <Text style={estilos.tituloDaFolha}>
          Etapa {atual + 1} de {STEP_LABELS.length} · {STEP_LABELS[atual]}
        </Text>
        <Pressable
          onPress={aoFechar}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          hitSlop={8}
        >
          <Feather name="x" size={18} color={WZ.muted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={estilos.corpo}>
        {!temAlgo && (
          <Text style={estilos.vazio}>
            Seus resultados aparecem aqui conforme você avança com a Nyta.
          </Text>
        )}

        {etapas.map(({ rotulo, i, campos }) => {
          if (i > atual) {
            return (
              <View key={rotulo} style={[estilos.etapa, estilos.etapaTrancada]}>
                <View style={estilos.linhaDaEtapa}>
                  <View style={estilos.selo}>
                    <Feather name="lock" size={11} color={WZ.faint} />
                  </View>
                  <Text style={estilos.rotuloTrancado}>{rotulo}</Text>
                </View>
              </View>
            );
          }
          return (
            <View key={rotulo} style={[estilos.etapa, i === atual && estilos.etapaAtual]}>
              <Pressable
                style={estilos.linhaDaEtapa}
                onPress={() => alternar(i)}
                accessibilityRole="button"
                accessibilityState={{ expanded: aberta(i) }}
                accessibilityLabel={rotulo}
              >
                <View style={[estilos.selo, i < atual && estilos.seloConcluido]}>
                  {i < atual
                    ? <Feather name="check" size={13} color={WZ.blue} />
                    : <Text style={estilos.numeroDaEtapa}>{i + 1}</Text>}
                </View>
                <Text style={estilos.rotuloDaEtapa}>{rotulo}</Text>
                {i === atual && <Text style={estilos.agora}>agora</Text>}
                <View style={estilos.flex} />
                <Feather
                  name={aberta(i) ? 'chevron-up' : 'chevron-down'}
                  size={15}
                  color={WZ.faint}
                />
              </Pressable>

              {aberta(i) && campos.length > 0 && (
                <View style={estilos.corpoDaEtapa}>{campos}</View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {!!editando && !!aoEditar && (
        <View style={estilos.folhaDoEditor}>
          <EditorDoCampo
            tipo={editando}
            draft={draft}
            aoGravar={aoEditar}
            aoCancelar={() => setEditando(null)}
          />
        </View>
      )}
    </View>
  );
};

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  folha: { flex: 1, backgroundColor: WZ.canvas },
  cabeca: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: WZ.line, backgroundColor: WZ.surface,
  },
  tituloDaFolha: { flex: 1, fontSize: 13, fontWeight: '800', color: WZ.ink },
  corpo: { padding: 14, gap: 8, paddingBottom: 40 },
  vazio: { fontSize: 13, lineHeight: 19.5, color: WZ.muted, paddingVertical: 12 },

  etapa: {
    borderRadius: 12, borderWidth: 1, borderColor: WZ.line, backgroundColor: WZ.surface,
    overflow: 'hidden',
  },
  etapaAtual: { borderColor: WZ.blueSoft },
  etapaTrancada: { opacity: 0.6 },
  linhaDaEtapa: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, paddingHorizontal: 14,
  },
  selo: {
    width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    backgroundColor: WZ.surface2,
  },
  seloConcluido: { backgroundColor: WZ.blueSoft },
  numeroDaEtapa: { fontSize: 11, fontWeight: '800', color: WZ.muted },
  rotuloDaEtapa: { fontSize: 14, fontWeight: '700', color: WZ.ink },
  rotuloTrancado: { fontSize: 14, fontWeight: '600', color: WZ.faint },
  agora: {
    fontSize: 10, fontWeight: '800', letterSpacing: 0.4, color: WZ.blue,
    paddingVertical: 2, paddingHorizontal: 7, borderRadius: 9999, backgroundColor: WZ.blueSoft,
  },
  corpoDaEtapa: {
    gap: 14, padding: 14, paddingTop: 4, borderTopWidth: 1, borderTopColor: WZ.line,
  },

  campo: { gap: 5 },
  cabecaDoCampo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rotuloDoCampo: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase',
    color: WZ.quiet,
  },
  valor: { fontSize: 14, lineHeight: 21, color: WZ.text },
  itemDaLista: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  pontinho: { width: 5, height: 5, borderRadius: 2.5, marginTop: 8, backgroundColor: WZ.marker },
  numeroDoItem: { fontSize: 13, fontWeight: '700', color: WZ.marker, minWidth: 16 },
  valorDoItem: { flex: 1, fontSize: 14, lineHeight: 21, color: WZ.text },
  maisItens: { fontSize: 12, fontWeight: '700', color: WZ.quiet },
  nota: { fontSize: 12, color: WZ.muted },

  folhaDoEditor: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: 14, borderTopWidth: 1, borderTopColor: WZ.line, backgroundColor: WZ.surface,
    shadowColor: 'rgb(107, 129, 170)', shadowOpacity: 0.13, shadowRadius: 27,
    shadowOffset: { width: 0, height: -12 }, elevation: 8,
  },
  editor: { gap: 8 },
  rotuloDoEditor: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.4, color: WZ.quiet, marginBottom: 4,
  },
  entrada: {
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
    borderWidth: 1, borderColor: WZ.line2, backgroundColor: WZ.surface,
    fontSize: 14, color: WZ.ink,
  },
  entradaLonga: { minHeight: 90, textAlignVertical: 'top' },
  linhaDaCidade: { flexDirection: 'row', gap: 10 },
  caixaDaUf: { width: 70 },
  dicaDoEditor: { fontSize: 12, color: WZ.muted },
  acoesDoEditor: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  salvar: { fontSize: 13, fontWeight: '800', color: WZ.blue },
  cancelar: { fontSize: 13, fontWeight: '600', color: WZ.muted },
});
