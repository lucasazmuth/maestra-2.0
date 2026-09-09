import { useCallback, useEffect, useRef, useState } from 'react';

import type { ContextoDeAudio } from './contexto';
import { Mesa, type Buscar, type EstadoDaMesa, type Pista } from './mesa';

// A mesa ligada a uma tela.
//
// Cria, alimenta e destrói a `Mesa` conforme a gravação aberta muda, e transforma o estado dela
// em algo que o React redesenha. Vive no núcleo porque as duas superfícies precisam do mesmo —
// só o `criarContexto` e o `buscar` é que diferem entre elas.

/** De quanto em quanto tempo a agulha anda. 50 ms é fluido sem ser um desperdício de renders. */
const TIQUE = 50;

const VAZIA: EstadoDaMesa = {
  pistas: [], tocando: false, posicao: 0, duracao: 0, carregando: false,
};

export interface DependenciasDaMesa {
  criarContexto: () => ContextoDeAudio;
  buscar: Buscar;
  /** Somar os canais: metade da memória, sem o panorama. Ligado no app. */
  mono?: boolean;
}

export function useMesa(pistas: Pista[], deps: DependenciasDaMesa) {
  const [estado, setEstado] = useState<EstadoDaMesa>(VAZIA);
  const mesa = useRef<Mesa | null>(null);

  // ⚠️ Os picos ficam guardados, e isso não é otimização prematura: `picos()` percorre o PCM
  // inteiro (dezenas de milhões de amostras por pista) e a tela pede-os A CADA TIQUE, 20 vezes
  // por segundo, para cada pista. Sem a gaveta, tocar seis stems varreria ~500 MB de memória
  // por segundo só para desenhar as mesmas barras de sempre.
  //
  // A chave inclui `n` porque a mesma pista pode ser pedida em duas resoluções (a lista e uma
  // vista ampliada), e guardar só uma devolveria à outra o número errado de barras.
  const guardados = useRef(new Map<string, number[]>());

  // As dependências ficam numa gaveta em vez de entrarem no efeito: `criarContexto` e `buscar`
  // são funções que a tela recria a cada render, e como dependências fariam a mesa ser
  // destruída e recarregada a cada tecla digitada no cabeçalho.
  const gaveta = useRef(deps);
  gaveta.current = deps;

  // A identidade da mesa é o CONJUNTO de pistas, e não o array (que muda de referência a cada
  // render). Trocar de gravação muda esta linha; renomear uma pista, não — e renomear não pode
  // recarregar 400 MB de áudio.
  //
  // Ordenada de propósito: a ordem das pistas é assunto da TELA (é ela que empilha as linhas),
  // não da mesa, que toca todas ao mesmo tempo. Sem o `sort`, "mover para cima" mudaria a
  // assinatura e a mesa descarregaria e descodificaria tudo de novo — vários segundos de
  // silêncio para trocar duas linhas de lugar.
  const assinatura = pistas.map((p) => `${p.id}:${p.url}`).sort().join('|');

  useEffect(() => {
    if (!assinatura) {
      setEstado(VAZIA);
      return undefined;
    }
    guardados.current.clear();
    const { criarContexto, buscar, mono } = gaveta.current;
    const nova = new Mesa(criarContexto(), buscar, { mono });
    mesa.current = nova;
    const largar = nova.ouvir(setEstado);
    void nova.carregar(pistas);

    return () => {
      largar();
      mesa.current = null;
      // Sem isto, sair da tela deixa a mesa a tocar por baixo da seguinte e centenas de MB de
      // áudio descodificado presos na memória.
      void nova.descartar();
    };
    // `pistas` de propósito fora: quem manda é a assinatura. Ver o comentário acima.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura]);

  // O relógio só corre enquanto há som. Parada, a mesa não gasta um render.
  useEffect(() => {
    if (!estado.tocando) return undefined;
    const conta = setInterval(() => {
      const atual = mesa.current;
      if (!atual) return;
      atual.verificarFim();
      setEstado(atual.estado());
    }, TIQUE);
    return () => clearInterval(conta);
  }, [estado.tocando]);

  const tocar = useCallback(() => { void mesa.current?.tocar(); }, []);
  const pausar = useCallback(() => { mesa.current?.pausar(); }, []);
  const alternar = useCallback(() => {
    const atual = mesa.current;
    if (!atual) return;
    if (atual.estado().tocando) atual.pausar(); else void atual.tocar();
  }, []);
  const irPara = useCallback((s: number) => { mesa.current?.irPara(s); }, []);
  const mudar = useCallback((id: string, v: boolean) => { mesa.current?.mudar(id, v); }, []);
  const solar = useCallback((id: string, v: boolean) => { mesa.current?.solar(id, v); }, []);
  const ganho = useCallback((id: string, v: number) => { mesa.current?.ganho(id, v); }, []);
  const picos = useCallback((id: string, n: number) => {
    const chave = `${id}:${n}`;
    const pronto = guardados.current.get(chave);
    if (pronto) return pronto;
    const novos = mesa.current?.picos(id, n) ?? [];
    // Vazio não entra: quer dizer que a pista ainda está a descodificar, e guardar isso
    // congelaria a onda em nada mesmo depois de o áudio chegar.
    if (novos.length) guardados.current.set(chave, novos);
    return novos;
  }, []);

  return { estado, tocar, pausar, alternar, irPara, mudar, solar, ganho, picos };
}
