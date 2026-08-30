import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';

import { COR, COR_DIAGNOSTICO } from '@maestra/core/constants/design';

// A fala da Maestra, escrita letra a letra.
//
// É a assinatura do fluxo: a pergunta não aparece pronta, ela é DITA — e a interação só entra
// depois que ela termina (`aoTerminar`), que é o que dá o ritmo de conversa em vez de
// formulário. Os 18ms por caractere são os mesmos da web.
//
// Quem pediu menos animação no sistema recebe a frase inteira de uma vez, como lá.
//
// O cursor é um caractere no meio do texto, e não uma View: ele precisa acompanhar a última
// letra, e a frase quebra em três linhas centradas. Ele acende e apaga sem transição — é o
// `steps(1)` da folha da web.

const PASSO = 18;
const PISCADA = 450;

export const Fala = ({ texto, aoTerminar }: { texto: string; aoTerminar?: () => void }) => {
  const [escrito, setEscrito] = useState('');
  const [escrevendo, setEscrevendo] = useState(false);
  const [cursorAceso, setCursorAceso] = useState(true);
  const terminou = useRef(aoTerminar);
  terminou.current = aoTerminar;

  useEffect(() => {
    if (!texto) return undefined;
    let vivo = true;
    let conta: ReturnType<typeof setInterval> | undefined;

    void AccessibilityInfo.isReduceMotionEnabled().then((menosMovimento) => {
      if (!vivo) return;
      if (menosMovimento) { setEscrito(texto); setEscrevendo(false); terminou.current?.(); return; }
      setEscrevendo(true);
      setEscrito('');
      let i = 0;
      conta = setInterval(() => {
        i += 1;
        setEscrito(texto.slice(0, i));
        if (i >= texto.length) {
          if (conta) clearInterval(conta);
          setEscrevendo(false);
          terminou.current?.();
        }
      }, PASSO);
    });

    return () => { vivo = false; if (conta) clearInterval(conta); };
  }, [texto]);

  useEffect(() => {
    if (!escrevendo) { setCursorAceso(true); return undefined; }
    const conta = setInterval(() => setCursorAceso((aceso) => !aceso), PISCADA);
    return () => clearInterval(conta);
  }, [escrevendo]);

  return (
    <Text style={estilos.texto} accessibilityLiveRegion="polite">
      {escrito}
      {escrevendo && <Text style={cursorAceso ? estilos.cursor : estilos.cursorApagado}>▌</Text>}
    </Text>
  );
};

const estilos = StyleSheet.create({
  texto: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 33.6,
    textAlign: 'center',
    color: COR_DIAGNOSTICO.titulo,
    marginBottom: 28,
  },
  cursor: { color: COR.primaria },
  cursorApagado: { color: 'transparent' },
});
