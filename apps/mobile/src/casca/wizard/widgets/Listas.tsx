import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MAX_OBJECTIVES } from '@maestra/core/constants/maestra';
import type { ArtistIdentity, MissionParts } from '@maestra/core/interfaces/maestra';
import { seedValues } from '@maestra/core/wizard/dados';
import { generateObjectives } from '@maestra/core/wizard/motores';

import { WZ } from '@/casca/wizard/cores';
import {
  Acoes, BotaoPrincipal, CampoDeOutro, Cartao, Pilula, PilulaDeOutro, estilosDoKit,
} from '@/casca/wizard/widgets/kit';

// Valores e objetivos: duas listas com TETO, e o teto é o ponto.
//
// Valores: de 3 a 5. Objetivos: até `MAX_OBJECTIVES`, que existe para manter foco — o aviso ao
// bater o teto pergunta o que trocar, em vez de só recusar.

export const Valores = ({
  semente, aoConfirmar,
}: { semente?: string[]; aoConfirmar: (valores: string[]) => void }) => {
  const MIN = 3;
  const MAX = 5;
  const [opcoes, setOpcoes] = useState<string[]>(
    () => (semente?.length ? semente : seedValues()).slice(0, 12),
  );
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [aberto, setAberto] = useState(false);
  const [aviso, setAviso] = useState('');

  const alternar = (v: string) => {
    if (escolhidos.includes(v)) {
      setAviso('');
      setEscolhidos((s) => s.filter((x) => x !== v));
      return;
    }
    if (escolhidos.length >= MAX) {
      setAviso(`Você já selecionou ${MAX} valores. Remova um para escolher outro.`);
      return;
    }
    setAviso('');
    setEscolhidos((s) => [...s, v]);
  };

  return (
    <Cartao titulo="Seus valores">
      <View style={estilosDoKit.grade}>
        {opcoes.map((v) => (
          <Pilula key={v} rotulo={v} marcada={escolhidos.includes(v)} aoTocar={() => alternar(v)} />
        ))}
        <PilulaDeOutro aoTocar={() => setAberto((a) => !a)} />
      </View>
      {aberto && (
        <CampoDeOutro
          espacoReservado="Escrever meu próprio valor…"
          rotuloDoBotao="Adicionar"
          aoUsar={(t) => {
            setOpcoes((o) => (o.some((x) => x.toLowerCase() === t.toLowerCase()) ? o : [...o, t]));
            alternar(t);
            setAberto(false);
          }}
        />
      )}
      {!!aviso && <Text style={estilos.aviso}>{aviso}</Text>}
      <Acoes>
        <Text style={estilos.contador}>
          {escolhidos.length}/{MAX}
          {escolhidos.length < MIN ? `, escolha ao menos ${MIN}` : ''}
        </Text>
        <View style={estilos.empurra} />
        <BotaoPrincipal
          rotulo="Confirmar valores"
          apagado={escolhidos.length < MIN}
          aoTocar={() => aoConfirmar(escolhidos)}
        />
      </Acoes>
    </Cartao>
  );
};

export const Objetivos = ({
  identidade, partesDaMissao, aoConfirmar,
}: {
  identidade: ArtistIdentity;
  partesDaMissao: MissionParts;
  aoConfirmar: (objetivos: string[]) => void;
}) => {
  // O universo é DETERMINÍSTICO (Fontes 1–4 do método, sem IA e sem rede).
  const universo = useMemo(
    () => generateObjectives(identidade, partesDaMissao), [identidade, partesDaMissao],
  );
  const [opcoes, setOpcoes] = useState<string[]>(universo);
  // Começa sem nada marcado: quem escolhe o que vai para o plano é o artista.
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [aberto, setAberto] = useState(false);
  const [aviso, setAviso] = useState('');

  const alternar = (o: string) => {
    if (escolhidos.includes(o)) {
      setAviso('');
      setEscolhidos((s) => s.filter((x) => x !== o));
      return;
    }
    if (escolhidos.length >= MAX_OBJECTIVES) {
      setAviso(`O limite é ${MAX_OBJECTIVES}, pra manter foco. Desmarque um pra trocar.`);
      return;
    }
    setAviso('');
    setEscolhidos((s) => [...s, o]);
  };

  return (
    <Cartao titulo="Seus objetivos">
      <View style={estilosDoKit.grade}>
        {opcoes.map((o) => (
          <Pilula key={o} rotulo={o} marcada={escolhidos.includes(o)} aoTocar={() => alternar(o)} />
        ))}
        <PilulaDeOutro aoTocar={() => setAberto((a) => !a)} />
      </View>
      {aberto && (
        <CampoDeOutro
          espacoReservado="Acrescentar um objetivo…"
          rotuloDoBotao="Adicionar"
          aoUsar={(t) => {
            setOpcoes((s) => (s.some((x) => x.toLowerCase() === t.toLowerCase()) ? s : [...s, t]));
            alternar(t);
            setAberto(false);
          }}
        />
      )}
      {!!aviso && <Text style={estilos.aviso}>{aviso}</Text>}
      <Acoes>
        <Text style={estilos.contador}>{escolhidos.length}/{MAX_OBJECTIVES}</Text>
        <View style={estilos.empurra} />
        <BotaoPrincipal
          rotulo="Confirmar objetivos"
          apagado={!escolhidos.length}
          aoTocar={() => aoConfirmar(escolhidos)}
        />
      </Acoes>
    </Cartao>
  );
};

const estilos = StyleSheet.create({
  empurra: { flex: 1 },
  contador: { fontSize: 13, color: WZ.muted },
  aviso: { fontSize: 12, color: WZ.warn, marginTop: 10 },
});
