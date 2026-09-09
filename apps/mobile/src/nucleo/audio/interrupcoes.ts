import { useEffect, useRef } from 'react';
import { AudioManager } from 'react-native-audio-api';

// O que fazer quando o telefone toca.
//
// Uma chamada, um alarme, o Siri: o sistema tira a sessão de áudio da aplicação sem avisar
// ninguém. Sem isto, a mesa fica a achar que está a tocar — a agulha anda, o botão diz "pausar",
// e não sai som nenhum. Pior: ao voltar da chamada, o som não volta, e a única saída é fechar a
// gravação e abrir outra vez.
//
// ⚠️ O `shouldResume` do sistema é uma SUGESTÃO, e não uma ordem: ele diz "podes voltar", não
// "volta". Quem decide é o que estava a acontecer antes — se a pessoa já tinha pausado a mesa
// antes de atender, voltar da chamada não pode pôr a música a tocar sozinha no ouvido dela.

export const useInterrupcoesDeAudio = (mesa: {
  estado: { tocando: boolean };
  pausar: () => void;
  tocar: () => void;
}) => {
  // O estado atual numa gaveta: o ouvinte é registado UMA vez e viveria para sempre com o
  // primeiro valor se lesse `mesa.estado` diretamente.
  const tocando = useRef(false);
  tocando.current = mesa.estado.tocando;

  const acoes = useRef({ pausar: mesa.pausar, tocar: mesa.tocar });
  acoes.current = { pausar: mesa.pausar, tocar: mesa.tocar };

  /** Estava a tocar quando a chamada entrou? Só nesse caso é que se retoma. */
  const retomar = useRef(false);

  useEffect(() => {
    AudioManager.observeAudioInterruptions(true);
    const assinatura = AudioManager.addSystemEventListener('interruption', ({ type, shouldResume }) => {
      if (type === 'began') {
        retomar.current = tocando.current;
        acoes.current.pausar();
        return;
      }
      if (shouldResume && retomar.current) acoes.current.tocar();
      retomar.current = false;
    });

    return () => {
      assinatura.remove();
      AudioManager.observeAudioInterruptions(false);
    };
  }, []);
};
