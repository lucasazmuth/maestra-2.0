import { useCallback, useEffect, useRef, useState } from 'react';

import type { ContextoDeAudio, ContextoOffline } from './contexto';
import { Mesa, type Buscar, type EstadoDaMesa, type Pista } from './mesa';

// A mesa ligada a uma tela.
//
// Cria, alimenta e destrói a `Mesa` conforme a gravação aberta muda, e transforma o estado dela
// em algo que o React redesenha. Vive no núcleo porque as duas superfícies precisam do mesmo —
// só o `criarContexto` e o `buscar` é que diferem entre elas.

/** De quanto em quanto tempo a agulha anda. 50 ms é fluido sem ser um desperdício de renders. */
const TIQUE = 50;

const VAZIA: EstadoDaMesa = {
  pistas: [], tocando: false, posicao: 0, duracao: 0, carregando: false, mestre: 1,
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

  // A identidade da MONTAGEM: as pistas, os clipes, e onde cada um entra.
  //
  // Muda a cada edição — arrastar um clipe, cortá-lo, apagar — e é isso que se quer: a mesa
  // precisa de reagendar. O que ela NÃO faz é voltar a baixar o áudio, porque os buffers são
  // guardados por URL lá dentro; arrastar um clipe é uma reprogramação de fontes, não um
  // download.
  //
  // O nome da pista fica de fora de propósito: renomear não muda uma nota do que soa.
  const assinatura = pistas
    .map((p) => `${p.id}|${p.clipes.map((c) => `${c.id}:${c.url}:${c.inicio}:${c.recorte}:${c.duracao}`).join(',')}`)
    .join('||');

  useEffect(() => {
    if (!assinatura) {
      setEstado(VAZIA);
      return undefined;
    }
    // A onda de um clipe é a do seu recorte: cortar ao meio muda o desenho dos dois pedaços.
    guardados.current.clear();
    const { criarContexto, buscar, mono } = gaveta.current;

    // A mesa que já existe continua a servir: ela guarda os buffers, e recarregá-la com a
    // montagem nova é barato. Criar outra deitaria fora o áudio descodificado a cada arrasto.
    if (mesa.current) {
      void mesa.current.carregar(pistas);
      return undefined;
    }

    // Criar o contexto pode falhar — um navegador sem Web Audio, uma sessão de áudio que o
    // sistema recusa. Sem esta guarda, a exceção sobe pelo efeito e derruba a TELA INTEIRA: quem
    // abrisse o editor num navegador antigo veria uma página branca em vez de uma música que não
    // toca. Assim as pistas aparecem, dizem por que não tocam, e tudo o resto (nome, ficha,
    // comentários) continua a funcionar.
    let nova: Mesa;
    try {
      nova = new Mesa(criarContexto(), buscar, { mono });
    } catch (e) {
      const motivo = e instanceof Error ? e.message : 'Este navegador não toca áudio.';
      setEstado({
        ...VAZIA,
        pistas: pistas.map((p) => ({
          id: p.id, nome: p.nome, carga: 'erro', erro: motivo,
          muda: false, solo: false, ganho: p.ganhoInicial ?? 1, pan: p.panInicial ?? 0,
        })),
      });
      return undefined;
    }
    mesa.current = nova;
    nova.ouvir(setEstado);
    void nova.carregar(pistas);

    return undefined;
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
  const panoramar = useCallback((id: string, v: number) => { mesa.current?.panoramar(id, v); }, []);
  const mestreEm = useCallback((v: number) => { mesa.current?.mestreEm(v); }, []);
  /**
   * A montagem inteira num buffer só — a guia que a lista de Músicas toca. Com `apenasPistaId`,
   * renderiza SÓ essa pista — o STEM que se exporta para levar a outro programa.
   */
  const renderizar = useCallback(
    (
      criarOffline: (canais: number, quadros: number, taxa: number) => ContextoOffline,
      apenasPistaId?: string,
    ) => mesa.current?.renderizar(criarOffline, apenasPistaId) ?? Promise.resolve(null),
    [],
  );
  // O descarte é do DESMONTAR, e só dele. Antes vivia na limpeza do efeito da montagem, e
  // então cada arrasto de clipe fechava o contexto de áudio e abria outro — com o download e a
  // descodificação de tudo outra vez.
  useEffect(() => () => {
    const atual = mesa.current;
    mesa.current = null;
    // Sem isto, sair da tela deixa a mesa a tocar por baixo da seguinte e centenas de MB de
    // áudio descodificado presos na memória.
    void atual?.descartar();
  }, []);

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

  return {
    estado, tocar, pausar, alternar, irPara, mudar, solar, ganho, panoramar, mestreEm,
    renderizar, picos,
  };
}
