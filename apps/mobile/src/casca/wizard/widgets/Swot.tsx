import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import type { SwotAnalysis } from '@maestra/core/interfaces/maestra';
import { SWOT_INTERNAL, type InternalClass } from '@maestra/core/wizard/swot';
import { stripEmDash } from '@maestra/core/wizard/limpar';

import { WZ } from '@/casca/wizard/cores';
import {
  Acoes, BotaoPrincipal, CampoDeOutro, Cartao, Contagem,
} from '@/casca/wizard/widgets/kit';

// O DIAGNÓSTICO: o inventário interno (uma pergunta por vez), as listas de oportunidades e
// ameaças, e o quadro final editável.

// ---- Inventário interno -----------------------------------------------------------------------

const RESPOSTAS: [InternalClass, string, string][] = [
  ['forte', 'É um ponto forte', WZ.blue],
  ['melhorar', 'Preciso melhorar nisso', WZ.warn],
  // Neutro ESCURO (e não o `faint`): quando vira preenchimento, precisa carregar texto branco.
  ['na', 'Não se aplica', WZ.text],
];

export const InventarioInterno = ({
  aoConfirmar,
}: { aoConfirmar: (interno: Record<number, InternalClass>) => void }) => {
  const [interno, setInterno] = useState<Record<number, InternalClass>>({});
  const [indice, setIndice] = useState(0);
  const [avancando, setAvancando] = useState(false);
  const total = SWOT_INTERNAL.length;
  const item = SWOT_INTERNAL[indice];

  const responder = (valor: InternalClass) => {
    if (avancando) return;
    const atualizado = { ...interno, [item.id]: valor };
    setInterno(atualizado);
    setAvancando(true);
    // A pausa é o que deixa a escolha ser VISTA antes de a próxima pergunta entrar.
    setTimeout(() => {
      setAvancando(false);
      if (indice + 1 >= total) aoConfirmar(atualizado);
      else setIndice((i) => i + 1);
    }, 380);
  };

  const preenchido = ((indice + (avancando ? 1 : 0)) / total) * 100;

  return (
    <Cartao>
      <View style={estilos.topo}>
        <Text style={estilos.rotuloDaSecao}>DIAGNÓSTICO INTERNO</Text>
        <View style={estilos.contagemDoTopo}>
          <Text style={estilos.deQuantos}>{indice + 1} de {total}</Text>
          {indice > 0 && (
            <Pressable
              onPress={() => { if (!avancando) setIndice((i) => Math.max(0, i - 1)); }}
              accessibilityRole="button"
              accessibilityLabel="Voltar uma pergunta"
            >
              <Text style={estilos.voltar}>← Voltar</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={estilos.trilho}>
        <View style={[estilos.trilhoCheio, { width: `${preenchido}%` }]} />
      </View>

      <Text style={estilos.pergunta}>{stripEmDash(item.label)}</Text>
      <Text style={estilos.explicacao}>{stripEmDash(item.question)}</Text>

      <View style={estilos.respostas}>
        {RESPOSTAS.map(([valor, rotulo, cor]) => {
          const marcada = interno[item.id] === valor;
          return (
            <Pressable
              key={valor}
              style={[
                estilos.resposta,
                marcada && { borderColor: cor, backgroundColor: cor },
                avancando && !marcada && estilos.apagada,
              ]}
              onPress={() => responder(valor)}
              accessibilityRole="radio"
              accessibilityState={{ checked: marcada }}
              accessibilityLabel={rotulo}
            >
              <View style={[estilos.disco, marcada && estilos.discoMarcado]}>
                {marcada && <Feather name="check" size={13} color={WZ.surface} />}
              </View>
              <Text style={[estilos.respostaTexto, marcada && estilos.respostaMarcada]}>
                {rotulo}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Cartao>
  );
};

// ---- Oportunidades / ameaças -------------------------------------------------------------------

export const ListaDeMarcar = ({
  itens, titulo, cor = WZ.blue, rotuloDoBotao, aoConfirmar,
}: {
  itens: { id: number; label: string }[];
  titulo?: string;
  cor?: string;
  rotuloDoBotao: string;
  aoConfirmar: (ids: number[]) => void;
}) => {
  const [marcados, setMarcados] = useState<number[]>([]);
  const alternar = (id: number) => setMarcados((s) => (
    s.includes(id) ? s.filter((x) => x !== id) : [...s, id]
  ));

  return (
    <Cartao>
      {!!titulo && (
        <Text style={[estilos.rotuloDaSecao, { color: cor }]}>{titulo.toUpperCase()}</Text>
      )}
      <View style={estilos.lista}>
        {itens.map((c) => {
          const marcado = marcados.includes(c.id);
          return (
            <Pressable
              key={c.id}
              style={[estilos.linha, marcado && estilos.linhaMarcada]}
              onPress={() => alternar(c.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: marcado }}
              accessibilityLabel={c.label}
            >
              <View style={[estilos.caixa, marcado && estilos.caixaMarcada]}>
                {marcado && <Feather name="check" size={14} color={WZ.surface} />}
              </View>
              <Text style={estilos.linhaTexto}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Acoes>
        <Contagem n={marcados.length} singular="selecionada" plural="selecionadas" />
        <View style={estilos.empurra} />
        <BotaoPrincipal rotulo={rotuloDoBotao} aoTocar={() => aoConfirmar(marcados)} />
      </Acoes>
    </Cartao>
  );
};

// ---- O quadro final ----------------------------------------------------------------------------

const QUADRANTES: { chave: keyof SwotAnalysis; rotulo: string; cor: string }[] = [
  { chave: 'strengths', rotulo: 'Forças', cor: WZ.blue },
  { chave: 'weaknesses', rotulo: 'Fraquezas', cor: WZ.danger },
  { chave: 'opportunities', rotulo: 'Oportunidades', cor: WZ.ok },
  { chave: 'threats', rotulo: 'Ameaças', cor: WZ.warn },
];

const Quadrante = ({
  rotulo, cor, itens, aoRemover, aoAdicionar,
}: {
  rotulo: string;
  cor: string;
  itens: string[];
  aoRemover: (i: number) => void;
  aoAdicionar: (v: string) => void;
}) => {
  const [aberto, setAberto] = useState(false);
  return (
    <View style={[estilos.quadrante, { borderTopColor: cor }]}>
      <Text style={[estilos.tituloDoQuadrante, { color: cor }]}>
        {rotulo} <Text style={estilos.quantos}>({itens.length})</Text>
      </Text>
      <View style={estilos.chips}>
        {itens.map((item, i) => (
          <View key={`${item}-${i}`} style={estilos.chip}>
            <View style={[estilos.pontinho, { backgroundColor: cor }]} />
            <Text style={estilos.chipTexto}>{item}</Text>
            <Pressable
              onPress={() => aoRemover(i)}
              accessibilityRole="button"
              accessibilityLabel={`Remover ${item}`}
            >
              <Feather name="x" size={12} color={WZ.muted} />
            </Pressable>
          </View>
        ))}
      </View>
      {aberto ? (
        <CampoDeOutro
          espacoReservado="Adicionar…"
          rotuloDoBotao="Adicionar"
          aoUsar={(v) => { aoAdicionar(v); setAberto(false); }}
        />
      ) : (
        <Pressable
          style={estilos.adicionar}
          onPress={() => setAberto(true)}
          accessibilityRole="button"
          accessibilityLabel={`Adicionar em ${rotulo}`}
        >
          <Feather name="plus" size={14} color={WZ.text} />
          <Text style={estilos.adicionarTexto}>Adicionar</Text>
        </Pressable>
      )}
    </View>
  );
};

export const QuadroSwot = ({
  swot, aoConfirmar,
}: { swot: SwotAnalysis; aoConfirmar: (swot: SwotAnalysis, edicoes: string[]) => void }) => {
  const [quadro, setQuadro] = useState<SwotAnalysis>(swot);
  const atualizar = (chave: keyof SwotAnalysis, lista: string[]) =>
    setQuadro((q) => ({ ...q, [chave]: lista }));

  // O que o artista escreveu ou mudou: está no quadro final e não estava no original. Vira "fato
  // absoluto" nas etapas seguintes.
  const edicoes = (): string[] => {
    const original = new Set(
      QUADRANTES.flatMap((c) => (swot[c.chave] || []).map((s) => s.trim().toLowerCase())),
    );
    return QUADRANTES
      .flatMap((c) => quadro[c.chave] || [])
      .filter((item) => !original.has(item.trim().toLowerCase()));
  };

  return (
    <Cartao>
      <View style={estilos.quadro}>
        {QUADRANTES.map((c) => {
          const itens = quadro[c.chave] || [];
          return (
            <Quadrante
              key={c.chave}
              rotulo={c.rotulo}
              cor={c.cor}
              itens={itens}
              aoRemover={(i) => atualizar(c.chave, itens.filter((_, j) => j !== i))}
              aoAdicionar={(v) => atualizar(c.chave, [...itens, v])}
            />
          );
        })}
      </View>
      <Acoes>
        <BotaoPrincipal rotulo="Está ótimo, seguir" aoTocar={() => aoConfirmar(quadro, edicoes())} />
      </Acoes>
    </Cartao>
  );
};

const estilos = StyleSheet.create({
  empurra: { flex: 1 },
  topo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, marginBottom: 10,
  },
  rotuloDaSecao: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: WZ.blue, marginBottom: 10,
  },
  contagemDoTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deQuantos: { fontSize: 12, fontWeight: '600', color: WZ.muted },
  voltar: { fontSize: 12, color: WZ.muted },
  trilho: { height: 3, borderRadius: 3, backgroundColor: WZ.line, marginBottom: 14 },
  trilhoCheio: { height: 3, borderRadius: 3, backgroundColor: WZ.blue },
  pergunta: { fontSize: 16.5, fontWeight: '700', lineHeight: 22.3, color: WZ.ink, marginBottom: 4 },
  explicacao: { fontSize: 13.5, lineHeight: 19.6, color: WZ.muted, marginBottom: 14 },
  respostas: { gap: 8 },
  resposta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10,
    borderWidth: 1, borderColor: WZ.line2, backgroundColor: WZ.surface2,
  },
  apagada: { opacity: 0.35 },
  disco: {
    width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: WZ.faint,
  },
  discoMarcado: { borderWidth: 0, backgroundColor: 'rgba(0,0,0,0.18)' },
  respostaTexto: { flex: 1, fontSize: 13.5, fontWeight: '600', color: WZ.text },
  respostaMarcada: { color: WZ.surface },

  lista: { gap: 6 },
  linha: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10,
    borderWidth: 1, borderColor: WZ.line2, backgroundColor: WZ.surface2,
  },
  linhaMarcada: { borderColor: WZ.blue, backgroundColor: WZ.blueSoft },
  linhaTexto: { flex: 1, fontSize: 14, color: WZ.text },
  caixa: {
    width: 20, height: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: WZ.faint,
  },
  caixaMarcada: { borderWidth: 0, backgroundColor: WZ.blue },

  quadro: { gap: 12 },
  quadrante: { borderRadius: 8, padding: 12, borderTopWidth: 3, backgroundColor: WZ.surface2 },
  tituloDoQuadrante: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  quantos: { color: WZ.faint, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 7, paddingHorizontal: 11, borderRadius: 9999,
    borderWidth: 1, borderColor: WZ.line2, backgroundColor: WZ.surface,
  },
  pontinho: { width: 6, height: 6, borderRadius: 3 },
  chipTexto: { fontSize: 13, color: WZ.text },
  adicionar: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginTop: 4,
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 9999,
    borderWidth: 1, borderColor: WZ.line2, backgroundColor: WZ.surface,
  },
  adicionarTexto: { fontSize: 13, fontWeight: '800', color: WZ.text },
});
