import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ESPERA_DA_MARCA } from '@maestra/core/constants/design';

import { MaestraSimbolo } from '@/icones';

// A ESPERA DE UMA TELA: a marca da Maestra a respirar.
//
// ⚠️ NÃO É UMA RODA. Uma roda a girar é o sinal de espera de toda a gente, e por isso não é de
// ninguém: a tela podia ser de qualquer aplicativo. A web já mostrava a marca a respirar
// (`src/components/spinner/spinner.scss`) e o aplicativo é que tinha ficado com o círculo do
// sistema — nos dois sítios em que se espera mais tempo, que é justamente onde se olha.
//
// ⚠️ A RODA PEQUENA FICA ONDE ESTÁ: dentro de um botão a gravar, ao pé de um campo, no rodapé de
// uma lista que busca mais. Ali ela não é a espera da TELA, é o estado de um controlo — e a web
// faz o mesmo, com a roda do antd dentro dos botões. Uma marca a respirar dentro de um botão de
// 44 pt seria um logotipo a piscar numa caixa.
//
// Os números da respiração vêm do núcleo: a web escreve-os em `@keyframes` e esta tela em
// `reanimated`, e duas cópias de uma curva divergem sem que ninguém repare.

const { cor, marca, caixa, ciclo, quadros } = ESPERA_DA_MARCA;

/** Quanto tempo dura o trecho que TERMINA neste quadro. */
const duracao = (i: number) => Math.round((quadros[i].em - quadros[i - 1].em) * ciclo);

export const Carregando = ({ cor: tinta = cor, estilo }: {
  /** A tinta da marca. O editor é escuro e pede a dele; o resto do app fica com a de repouso. */
  cor?: string;
  estilo?: StyleProp<ViewStyle>;
}) => {
  const andar = useSharedValue(0);
  // ⚠️ QUEM PEDIU MENOS MOVIMENTO NÃO LEVA UMA MARCA A PULSAR. É uma preferência do sistema, e
  // para parte das pessoas é o que separa usar o aplicativo de não conseguir olhar para ele. A
  // web já a respeita (`prefers-reduced-motion` no `spinner.scss`), e ali a marca fica parada e
  // INTEIRA — não no quadro de repouso, que é apagado de propósito para a respiração ter para
  // onde crescer.
  const semMovimento = useReducedMotion();

  useEffect(() => {
    if (semMovimento) return;
    // ⚠️ COMEÇA NO PRIMEIRO QUADRO E ANDA ATÉ AO ÚLTIMO, que é igual ao primeiro: assim o laço
    // fecha sem salto. `withRepeat(..., -1)` sem `reverse`, porque a curva já volta sozinha —
    // invertê-la tocaria a respiração ao contrário em metade das voltas.
    andar.value = 0;
    andar.value = withRepeat(
      withSequence(
        ...quadros.slice(1).map((_, i) => withTiming(i + 1, {
          duration: duracao(i + 1),
          easing: Easing.inOut(Easing.ease),
        })),
      ),
      -1,
    );
  }, [andar, semMovimento]);

  const respirando = useAnimatedStyle(() => {
    // `andar` caminha entre os ÍNDICES dos quadros; cada trecho interpola os dois que o limitam.
    const i = Math.min(Math.floor(andar.value), quadros.length - 2);
    const parte = andar.value - i;
    const de = quadros[i];
    const ate = quadros[i + 1];
    return {
      opacity: de.opacidade + (ate.opacidade - de.opacidade) * parte,
      transform: [{ scale: de.escala + (ate.escala - de.escala) * parte }],
    };
  });

  return (
    <View style={[estilos.caixa, estilo]} accessibilityRole="progressbar" accessibilityLabel="Carregando">
      <Animated.View style={semMovimento ? estilos.parada : respirando}>
        <MaestraSimbolo size={marca} color={tinta} />
      </Animated.View>
    </View>
  );
};

const estilos = StyleSheet.create({
  // `alignSelf` porque a roda que ela substitui não tinha largura e centrava-se sozinha numa
  // coluna; a marca tem, e sem isto encostava-se à esquerda em meia dúzia de telas.
  caixa: {
    width: caixa, height: caixa, alignSelf: 'center',
    alignItems: 'center', justifyContent: 'center',
  },
  /** Sem movimento: inteira e opaca, como a web deixa a dela. */
  parada: { opacity: 1, transform: [{ scale: 1 }] },
});
