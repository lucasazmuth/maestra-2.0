import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { searchCities } from '@maestra/core/services/db/cities';
import type { ReferenceHorizons as Horizontes } from '@maestra/core/interfaces/maestra';

import { WZ } from '@/casca/wizard/cores';
import {
  Acoes, BotaoFantasma, BotaoPrincipal, Cartao, Pilula, estilosDoKit,
} from '@/casca/wizard/widgets/kit';

// Os widgets de TEXTO: as referências por horizonte, a cidade, a revisão de uma frase montada e a
// proposta que a Nyta compõe na entrevista guiada.

// ---- Referências de posicionamento (3 horizontes) --------------------------------------------

const HORIZONTES: { chave: keyof Horizontes; rotulo: string; pergunta: string }[] = [
  {
    chave: 'curto',
    rotulo: 'Curto prazo · 1 ano',
    pergunta: 'Daqui a 1 ano, com quais artistas você quer estar disputando espaço?',
  },
  {
    chave: 'medio',
    rotulo: 'Médio prazo · 3 anos',
    pergunta: 'E em 3 anos, com quem você quer dividir palco e playlist?',
  },
  {
    chave: 'longo',
    rotulo: 'Longo prazo · +5 anos',
    pergunta: 'Lá na frente, +5 anos: qual o tamanho do sonho? Com quem você quer estar lado a lado?',
  },
];

/**
 * Uma pergunta por vez. Cada nome digitado vira uma pílula removível; a vírgula também separa.
 *
 * O que está escrito no campo CONTA ao avançar: quem digitou e tocou em "Próximo" sem apertar
 * Enter não perde o que escreveu.
 */
export const ReferenciasPorHorizonte = ({
  aoConfirmar,
}: { aoConfirmar: (h: Horizontes) => void }) => {
  const [passo, setPasso] = useState(0);
  const [nomes, setNomes] = useState<Record<string, string[]>>({ curto: [], medio: [], longo: [] });
  const [digitado, setDigitado] = useState('');

  const campo = HORIZONTES[passo];
  const atuais = nomes[campo.chave] || [];
  const ultimo = passo === HORIZONTES.length - 1;

  const separar = (txt: string) => txt.split(',').map((x) => x.trim()).filter(Boolean);
  const juntar = (base: Record<string, string[]>, novos: string[]) => {
    const atual = base[campo.chave] || [];
    const somados = [...atual];
    novos.forEach((p) => {
      if (p && !somados.some((x) => x.toLowerCase() === p.toLowerCase())) somados.push(p);
    });
    return { ...base, [campo.chave]: somados };
  };

  const aoDigitar = (bruto: string) => {
    if (!bruto.includes(',')) { setDigitado(bruto); return; }
    const partes = bruto.split(',');
    const resto = partes.pop() ?? '';
    setNomes((s) => juntar(s, partes.map((x) => x.trim()).filter(Boolean)));
    setDigitado(resto);
  };

  const podeSeguir = atuais.length > 0 || !!digitado.trim();
  const seguir = () => {
    if (!podeSeguir) return;
    const comODigitado = digitado.trim() ? juntar(nomes, separar(digitado)) : nomes;
    if (digitado.trim()) { setNomes(comODigitado); setDigitado(''); }
    if (ultimo) {
      aoConfirmar({
        curto: comODigitado.curto.join(', '),
        medio: comODigitado.medio.join(', '),
        longo: comODigitado.longo.join(', '),
      });
    } else {
      setPasso((n) => n + 1);
    }
  };

  return (
    <Cartao titulo="Referências de posicionamento">
      <View style={estilos.progresso}>
        {HORIZONTES.map((h, i) => (
          <View key={h.chave} style={[estilos.trilho, i <= passo && estilos.trilhoCheio]} />
        ))}
      </View>

      <Text style={estilos.rotuloDoPasso}>
        Passo {passo + 1} de {HORIZONTES.length} · {campo.rotulo}
      </Text>
      <Text style={estilos.pergunta}>{campo.pergunta}</Text>
      <Text style={estilos.apoio}>
        Digite um nome e toque em enviar para adicionar. Toque numa pílula para remover.
      </Text>

      {atuais.length > 0 && (
        <View style={[estilosDoKit.grade, estilos.pilulas]}>
          {atuais.map((c) => (
            <Pilula
              key={c}
              rotulo={c}
              marcada
              aoTocar={() => setNomes((s) => ({
                ...s, [campo.chave]: (s[campo.chave] || []).filter((x) => x !== c),
              }))}
            />
          ))}
        </View>
      )}

      <TextInput
        style={estilos.campo}
        value={digitado}
        onChangeText={aoDigitar}
        onSubmitEditing={() => {
          if (!digitado.trim()) return;
          setNomes((s) => juntar(s, separar(digitado)));
          setDigitado('');
        }}
        placeholder="Digite um nome e toque em enviar…"
        placeholderTextColor={WZ.faint}
        accessibilityLabel={campo.pergunta}
      />

      <Acoes>
        {passo > 0 && <BotaoFantasma rotulo="Voltar" aoTocar={() => setPasso((n) => Math.max(0, n - 1))} />}
        <View style={estilos.empurra} />
        <BotaoPrincipal rotulo={ultimo ? 'Concluir' : 'Próximo'} apagado={!podeSeguir} aoTocar={seguir} />
      </Acoes>
    </Cartao>
  );
};

// ---- Cidade -----------------------------------------------------------------------------------

/** Busca na tabela `br_cities`, com a UF preenchida sozinha, e o caminho manual de reserva. */
export const CidadeDeOrigem = ({
  aoConfirmar,
}: { aoConfirmar: (cidade: string, uf: string) => void }) => {
  const [busca, setBusca] = useState('');
  const [achados, setAchados] = useState<{ nome: string; uf: string }[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [manual, setManual] = useState(false);
  const conta = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (conta.current) clearTimeout(conta.current); }, []);

  const procurar = (texto: string) => {
    setBusca(texto);
    setCidade('');
    if (conta.current) clearTimeout(conta.current);
    if (texto.trim().length < 2) { setAchados([]); setBuscando(false); return; }
    setBuscando(true);
    conta.current = setTimeout(async () => {
      try {
        const cidades = await searchCities(texto);
        setAchados(cidades.map((c) => ({ nome: c.name, uf: c.uf })));
      } catch {
        setAchados([]);
      }
      setBuscando(false);
    }, 300);
  };

  return (
    <Cartao>
      {manual ? (
        <View style={estilos.linhaManual}>
          <TextInput
            style={[estilos.campo, estilos.campoDaCidade]}
            value={cidade}
            onChangeText={setCidade}
            placeholder="Cidade"
            placeholderTextColor={WZ.faint}
            accessibilityLabel="Cidade"
          />
          <TextInput
            style={[estilos.campo, estilos.campoDaUf]}
            value={uf}
            onChangeText={(v) => setUf(v.toUpperCase().slice(0, 2))}
            placeholder="UF"
            placeholderTextColor={WZ.faint}
            autoCapitalize="characters"
            maxLength={2}
            accessibilityLabel="UF"
          />
        </View>
      ) : (
        <>
          <View style={estilos.campoComIcone}>
            <TextInput
              style={estilos.entradaDaBusca}
              value={cidade ? `${cidade}, ${uf}` : busca}
              onChangeText={procurar}
              placeholder="Digite sua cidade…"
              placeholderTextColor={WZ.faint}
              accessibilityLabel="Digite sua cidade"
            />
            {buscando && <ActivityIndicator size="small" color={WZ.blue} />}
          </View>
          {!cidade && achados.length > 0 && (
            <View style={estilos.achados}>
              {achados.slice(0, 8).map((c) => (
                <Pressable
                  key={`${c.nome}-${c.uf}`}
                  style={estilos.achado}
                  onPress={() => { setCidade(c.nome); setUf(c.uf); setAchados([]); }}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.nome}, ${c.uf}`}
                >
                  <Text style={estilos.achadoTexto}>{c.nome}, {c.uf}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}

      <Acoes>
        <Pressable
          onPress={() => { setManual((m) => !m); setCidade(''); setUf(''); setBusca(''); }}
          accessibilityRole="button"
          accessibilityLabel={manual ? 'Buscar na lista' : 'Preencher manualmente'}
        >
          <Text style={estilos.alternar}>
            {manual ? '← Buscar na lista' : 'Não achou? Preencher manualmente'}
          </Text>
        </Pressable>
        <View style={estilos.empurra} />
        <BotaoPrincipal
          rotulo="Continuar"
          apagado={!cidade.trim()}
          aoTocar={() => aoConfirmar(cidade.trim(), uf.trim())}
        />
      </Acoes>
    </Cartao>
  );
};

// ---- Revisão de uma frase montada -------------------------------------------------------------

const Revisao = ({
  titulo, texto, aoConfirmar,
}: { titulo: string; texto: string; aoConfirmar: (texto: string) => void }) => {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(texto);
  useEffect(() => setValor(texto), [texto]);

  return (
    <Cartao>
      <Text style={estilos.rotuloDaRevisao}>{titulo}</Text>
      {editando ? (
        <TextInput
          style={estilos.campoLongo}
          value={valor}
          onChangeText={setValor}
          multiline
          autoFocus
          accessibilityLabel={titulo}
        />
      ) : (
        <Text style={estilos.frase}>{valor}</Text>
      )}
      <Acoes>
        <BotaoFantasma
          rotulo={editando ? 'Pronto' : 'Quero ajustar'}
          aoTocar={() => setEditando((e) => !e)}
        />
        <View style={estilos.empurra} />
        <BotaoPrincipal
          rotulo="Faz sentido, seguir"
          apagado={!valor.trim()}
          aoTocar={() => aoConfirmar(valor.trim())}
        />
      </Acoes>
    </Cartao>
  );
};

export const RevisaoDaVisao = (p: { texto: string; aoConfirmar: (t: string) => void }) => (
  <Revisao titulo="SUA VISÃO" {...p} />
);
export const RevisaoDaMissao = (p: { texto: string; aoConfirmar: (t: string) => void }) => (
  <Revisao titulo="SUA MISSÃO" {...p} />
);

// ---- A entrevista guiada ----------------------------------------------------------------------

/** "Me ajuda a responder" não gera direto: dispara a mini-entrevista da Nyta. */
export const OfertaDeAjuda = ({ aoComecar }: { aoComecar: () => void }) => (
  <View>
    <Pressable
      style={estilos.ajuda}
      onPress={aoComecar}
      accessibilityRole="button"
      accessibilityLabel="Me ajuda a responder"
    >
      <Feather name="star" size={13} color={WZ.blue} />
      <Text style={estilos.ajudaTexto}>Me ajuda a responder</Text>
    </Pressable>
    <Text style={estilos.ajudaApoio}>
      A Nyta te faz umas perguntas e monta a resposta. Ou escreva do seu jeito no campo abaixo.
    </Text>
  </View>
);

/** A proposta composta ao fim da entrevista: editável, com refazer e seguir. */
export const PropostaDaNyta = ({
  texto, aoUsar, aoRefazer,
}: { texto: string; aoUsar: (t: string) => void; aoRefazer: () => void }) => {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(texto);
  useEffect(() => setValor(texto), [texto]);

  return (
    <Cartao>
      {editando ? (
        <TextInput
          style={estilos.campoLongo}
          value={valor}
          onChangeText={setValor}
          multiline
          autoFocus
          accessibilityLabel="A proposta da Nyta"
        />
      ) : (
        <Text style={estilos.frase}>{valor}</Text>
      )}
      <Acoes>
        <BotaoFantasma rotulo="Refazer perguntas" aoTocar={aoRefazer} />
        <BotaoFantasma
          rotulo={editando ? 'Pronto' : 'Quero ajustar'}
          aoTocar={() => setEditando((e) => !e)}
        />
        <View style={estilos.empurra} />
        <BotaoPrincipal
          rotulo="Faz sentido, seguir"
          apagado={!valor.trim()}
          aoTocar={() => aoUsar(valor.trim())}
        />
      </Acoes>
    </Cartao>
  );
};

/** A pílula de "tentar de novo" quando uma geração falha. */
export const TentarDeNovo = ({ aoTentar }: { aoTentar: () => void }) => (
  <Pressable
    style={estilos.tentar}
    onPress={aoTentar}
    accessibilityRole="button"
    accessibilityLabel="Tentar de novo"
  >
    <Feather name="refresh-cw" size={13} color={WZ.blue} />
    <Text style={estilos.ajudaTexto}>Tentar de novo</Text>
  </Pressable>
);

const estilos = StyleSheet.create({
  empurra: { flex: 1 },
  progresso: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  trilho: { height: 4, flex: 1, borderRadius: 2, backgroundColor: WZ.line },
  trilhoCheio: { backgroundColor: WZ.blue },
  rotuloDoPasso: {
    fontSize: 12, fontWeight: '700', letterSpacing: 0.48, textTransform: 'uppercase',
    color: WZ.muted, marginBottom: 6,
  },
  pergunta: { fontSize: 16, fontWeight: '700', lineHeight: 22.4, color: WZ.ink, marginBottom: 14 },
  apoio: { fontSize: 12, color: WZ.muted, marginBottom: 8 },
  pilulas: { marginBottom: 4 },

  campo: {
    paddingVertical: 12, paddingHorizontal: 20, borderRadius: 9999,
    borderWidth: 1, borderColor: WZ.line2, backgroundColor: WZ.surface,
    fontSize: 14, fontWeight: '600', color: WZ.ink, marginTop: 8,
  },
  campoLongo: {
    minHeight: 92, padding: 14, borderRadius: 12, textAlignVertical: 'top',
    borderWidth: 1, borderColor: WZ.line2, backgroundColor: WZ.surface,
    fontSize: 15, lineHeight: 24, color: WZ.ink,
  },
  linhaManual: { flexDirection: 'row', gap: 8 },
  campoDaCidade: { flex: 2 },
  campoDaUf: { flex: 1, textAlign: 'center' },
  campoComIcone: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 20, borderRadius: 9999,
    borderWidth: 1, borderColor: WZ.line2, backgroundColor: WZ.surface,
  },
  entradaDaBusca: { flex: 1, fontSize: 14, fontWeight: '600', color: WZ.ink },
  achados: {
    marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: WZ.line,
    backgroundColor: WZ.surface, overflow: 'hidden',
  },
  achado: { paddingVertical: 11, paddingHorizontal: 14 },
  achadoTexto: { fontSize: 14, color: WZ.text },
  alternar: { fontSize: 12, color: WZ.muted },

  rotuloDaRevisao: {
    fontSize: 12, fontWeight: '700', letterSpacing: 0.72, color: WZ.muted, marginBottom: 8,
  },
  frase: { fontSize: 15, lineHeight: 24, fontWeight: '600', color: WZ.ink },

  ajuda: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6,
    paddingVertical: 5, paddingHorizontal: 14, borderRadius: 9999,
    borderWidth: 1, borderColor: WZ.blue, backgroundColor: WZ.blueSoft,
  },
  ajudaTexto: { fontSize: 12, fontWeight: '800', color: WZ.blue },
  ajudaApoio: { fontSize: 12, color: WZ.faint, marginTop: 8 },
  tentar: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6,
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 9999,
    borderWidth: 1, borderColor: WZ.line2, backgroundColor: WZ.surface,
  },
});
