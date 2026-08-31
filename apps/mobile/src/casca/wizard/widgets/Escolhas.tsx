import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { listGenres } from '@maestra/core/services/db/genres';
import type { ArtistGender, ArtistStage, SpotifyProfile } from '@maestra/core/interfaces/maestra';
import {
  ADJETIVO_SEEDS, GENDER_OPTIONS, MISSION_FINANCIAL_OPTIONS, STAGE_OPTIONS,
  SUBSTANTIVO_OPTIONS, VISION_ONDE_OPTIONS, VISION_PORQUEM_OPTIONS, flex,
} from '@maestra/core/wizard/dados';
import type { MissionFinancialTier } from '@maestra/core/interfaces/maestra';

import { WZ } from '@/casca/wizard/cores';
import {
  Acoes, BotaoPrincipal, Cartao, CampoDeOutro, Contagem, Pilula, PilulaDeOutro, estilosDoKit,
} from '@/casca/wizard/widgets/kit';

// Os widgets de ESCOLHA: uma opção, várias opções, e as duas variações do wizard.
//
// São a porta de `SingleChoiceCard`, `MultiChoiceCard` e `GenreChips` (widgets.tsx). O que muda
// entre eles não é o desenho, é a regra: escolha única confirma no toque; múltipla acumula e
// confirma no botão; algumas têm teto (2 sinais de reconhecimento, 5 valores).

// ---- Escolha única ---------------------------------------------------------------------------

/** Lista de pílulas; tocar CONFIRMA na hora (sem botão). Opcionalmente com um campo "Outro". */
export const EscolhaUnica = ({
  titulo, opcoes, aoConfirmar, outro,
}: {
  titulo?: string;
  opcoes: { value: string; label: string }[];
  aoConfirmar: (valor: string) => void;
  outro?: { espacoReservado: string };
}) => {
  const [aberto, setAberto] = useState(false);
  return (
    <Cartao titulo={titulo}>
      <View style={estilosDoKit.grade}>
        {opcoes.map((o) => (
          <Pilula key={o.value} rotulo={o.label} unica aoTocar={() => aoConfirmar(o.value)} />
        ))}
        {!!outro && <PilulaDeOutro aoTocar={() => setAberto((v) => !v)} />}
      </View>
      {!!outro && aberto && (
        <CampoDeOutro espacoReservado={outro.espacoReservado} aoUsar={aoConfirmar} />
      )}
    </Cartao>
  );
};

export const GeneroGramatical = ({ aoConfirmar }: { aoConfirmar: (g: ArtistGender) => void }) => (
  <EscolhaUnica
    opcoes={GENDER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
    aoConfirmar={(v) => aoConfirmar(v as ArtistGender)}
  />
);

export const MomentoDeCarreira = ({ aoConfirmar }: { aoConfirmar: (s: ArtistStage) => void }) => (
  <EscolhaUnica
    opcoes={STAGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
    aoConfirmar={(v) => aoConfirmar(v as ArtistStage)}
    outro={{ espacoReservado: 'Descrever o meu momento…' }}
  />
);

export const AteOndeChegar = ({ aoConfirmar }: { aoConfirmar: (valor: string) => void }) => (
  <EscolhaUnica
    titulo="Até onde você quer chegar"
    opcoes={VISION_ONDE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
    aoConfirmar={aoConfirmar}
    outro={{ espacoReservado: 'Outro alcance…' }}
  />
);

export const RetornoFinanceiro = ({
  aoConfirmar,
}: { aoConfirmar: (tier: MissionFinancialTier) => void }) => (
  <Cartao titulo="O retorno que você quer">
    <View style={estilos.coluna}>
      {MISSION_FINANCIAL_OPTIONS.map((o) => (
        <Pilula key={o.value} rotulo={o.label} unica aoTocar={() => aoConfirmar(o.value)} />
      ))}
    </View>
  </Cartao>
);

// ---- Múltipla escolha ------------------------------------------------------------------------

/** Chips + campo livre; junta os escolhidos numa string (ex.: "cantor e compositor"). */
export const EscolhaMultipla = ({
  titulo, opcoes, espacoReservado, junta = ' e ', aoConfirmar,
}: {
  titulo?: string;
  opcoes: string[];
  espacoReservado: string;
  junta?: string;
  aoConfirmar: (junto: string) => void;
}) => {
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [aberto, setAberto] = useState(false);
  const alternar = (o: string) => setEscolhidos((s) => (
    s.includes(o) ? s.filter((x) => x !== o) : [...s, o]
  ));
  const proprios = escolhidos.filter((s) => !opcoes.includes(s));

  return (
    <Cartao titulo={titulo}>
      <View style={estilosDoKit.grade}>
        {opcoes.map((o) => (
          <Pilula key={o} rotulo={o} marcada={escolhidos.includes(o)} aoTocar={() => alternar(o)} />
        ))}
        {proprios.map((c) => (
          <Pilula key={c} rotulo={c} marcada aoTocar={() => alternar(c)} />
        ))}
        <PilulaDeOutro aoTocar={() => setAberto((v) => !v)} />
      </View>
      {aberto && (
        <CampoDeOutro
          espacoReservado={espacoReservado}
          rotuloDoBotao="Adicionar"
          aoUsar={(t) => {
            setEscolhidos((s) => (s.some((x) => x.toLowerCase() === t.toLowerCase()) ? s : [...s, t]));
            setAberto(false);
          }}
        />
      )}
      <Acoes>
        <View style={estilos.empurra} />
        <BotaoPrincipal
          rotulo="Confirmar"
          apagado={!escolhidos.length}
          aoTocar={() => aoConfirmar(escolhidos.join(junta))}
        />
      </Acoes>
    </Cartao>
  );
};

export const ComoSeDefine = ({
  genero, aoConfirmar,
}: { genero?: ArtistGender; aoConfirmar: (valor: string) => void }) => (
  <EscolhaMultipla
    titulo="Como você se define"
    opcoes={SUBSTANTIVO_OPTIONS.map((s) => flex(genero, s))}
    espacoReservado="Como você se define…"
    aoConfirmar={aoConfirmar}
  />
);

export const SeuAtributo = ({ aoConfirmar }: { aoConfirmar: (valor: string) => void }) => (
  <EscolhaMultipla
    titulo="Seu atributo"
    opcoes={ADJETIVO_SEEDS}
    espacoReservado="Escreva o seu atributo…"
    aoConfirmar={aoConfirmar}
  />
);

// ---- Sinais de reconhecimento (teto de 2) ----------------------------------------------------

export const SinaisDeReconhecimento = ({
  aoConfirmar,
}: { aoConfirmar: (rotulos: string[]) => void }) => {
  const MAX = 2;
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [aberto, setAberto] = useState(false);
  const [aviso, setAviso] = useState('');
  const noTeto = escolhidos.length >= MAX;

  const alternar = (rotulo: string) => {
    if (!escolhidos.includes(rotulo) && noTeto) {
      setAviso('Você pode escolher até 2 opções. Desmarque uma para trocar.');
      return;
    }
    setAviso('');
    setEscolhidos((s) => (s.includes(rotulo) ? s.filter((x) => x !== rotulo) : [...s, rotulo]));
  };
  const proprios = escolhidos.filter((s) => !VISION_PORQUEM_OPTIONS.some((o) => o.label === s));

  return (
    <Cartao titulo="Seus sinais de reconhecimento">
      <Text style={estilos.apoio}>
        Escolha até 2 opções (as que mais traduzem o que você sente).
      </Text>
      <View style={estilosDoKit.grade}>
        {VISION_PORQUEM_OPTIONS.map((o) => (
          <Pilula
            key={o.label}
            rotulo={o.label}
            marcada={escolhidos.includes(o.label)}
            aoTocar={() => alternar(o.label)}
          />
        ))}
        {proprios.map((c) => (
          <Pilula key={c} rotulo={c} marcada aoTocar={() => alternar(c)} />
        ))}
        <PilulaDeOutro aoTocar={() => setAberto((v) => !v)} />
      </View>
      {aberto && (
        <CampoDeOutro
          espacoReservado="Escrever do meu jeito…"
          rotuloDoBotao="Adicionar"
          aoUsar={(t) => {
            alternar(t);
            setAberto(false);
          }}
        />
      )}
      {!!aviso && <Text style={estilos.aviso}>{aviso}</Text>}
      <Acoes>
        <Text style={[estilos.contador, noTeto && estilos.contadorNoTeto]}>
          {escolhidos.length}/{MAX}
        </Text>
        <View style={estilos.empurra} />
        <BotaoPrincipal
          rotulo="Confirmar"
          apagado={!escolhidos.length}
          aoTocar={() => aoConfirmar(escolhidos)}
        />
      </Acoes>
    </Cartao>
  );
};

// ---- Gêneros musicais ------------------------------------------------------------------------

export const GenerosMusicais = ({
  sp, generosDaChartmetric, aoConfirmar,
}: {
  sp?: SpotifyProfile;
  generosDaChartmetric?: string[];
  aoConfirmar: (generos: string[]) => void;
}) => {
  const [opcoes, setOpcoes] = useState<string[] | null>(null);
  const [escolhidos, setEscolhidos] = useState<string[]>(() => generosDaChartmetric || []);

  useEffect(() => {
    listGenres()
      .then((g) => setOpcoes(g.map((x) => x.name)))
      .catch(() => setOpcoes([]));
  }, []);

  // Os da Chartmetric e os do Spotify primeiro, depois a lista curada — sem repetir.
  const todos = useMemo(() => {
    const mapa = new Map<string, string>();
    [...(generosDaChartmetric || []), ...(sp?.genres || []), ...(opcoes || [])].forEach((g) => {
      if (g) mapa.set(g.toLowerCase(), g);
    });
    return [...mapa.values()];
  }, [opcoes, sp?.genres, generosDaChartmetric]);

  const alternar = (g: string) => setEscolhidos((sel) => (
    sel.some((x) => x.toLowerCase() === g.toLowerCase())
      ? sel.filter((x) => x.toLowerCase() !== g.toLowerCase())
      : [...sel, g]
  ));

  return (
    <Cartao titulo="Seu estilo musical">
      {opcoes === null
        ? <Text style={estilos.carregando}>Carregando gêneros…</Text>
        : (
          <View style={estilosDoKit.grade}>
            {todos.map((g) => (
              <Pilula
                key={g}
                rotulo={g}
                marcada={escolhidos.some((x) => x.toLowerCase() === g.toLowerCase())}
                aoTocar={() => alternar(g)}
              />
            ))}
          </View>
        )}
      <Acoes>
        {!!escolhidos.length && (
          <Contagem n={escolhidos.length} singular="selecionado" plural="selecionados" />
        )}
        <View style={estilos.empurra} />
        <BotaoPrincipal
          rotulo="Confirmar"
          apagado={!escolhidos.length}
          aoTocar={() => aoConfirmar(escolhidos)}
        />
      </Acoes>
    </Cartao>
  );
};

const estilos = StyleSheet.create({
  coluna: { gap: 8 },
  empurra: { flex: 1 },
  apoio: { fontSize: 12, color: WZ.muted, marginBottom: 8 },
  aviso: { fontSize: 12, color: WZ.warn, marginTop: 10 },
  contador: { fontSize: 13, color: WZ.muted },
  contadorNoTeto: { fontWeight: '700', color: WZ.warn },
  carregando: { fontSize: 14, color: WZ.muted },
});
