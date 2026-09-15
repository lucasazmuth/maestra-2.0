import { pilaresDoPainel } from '../pilaresDoPainel';
import type { Artist } from '../../interfaces/maestra';
import type { JourneyState } from '../../hooks/useJourneyState';

// Os três cartões da home são a ÚNICA porta do Diagnóstico, do Plano e do Planejamento: os três
// saíram da navegação. Um estado errado aqui não é um rótulo feio, é um beco sem saída — a pessoa
// não tem outro caminho para conferir se o que o cartão diz é verdade.
//
// Por isso o teste percorre os estados, e não a aparência: o que prende é qual CTA e qual destino
// cada situação produz.

const jornada = (p: Partial<JourneyState> = {}): JourneyState => ({
  paid: true, hasDiagnostic: true, hasPlan: true, resumingPlan: false,
  tasksTotal: 10, tasksDone: 3, tasksPending: 7, pct: 30,
  stage: 'tasks',
  next: { stage: 'tasks', kicker: '', title: '', desc: '', ctaLabel: '', to: '', accent: '' },
  ...p,
});

const artista = (content: Partial<Artist['content']> = {}): Artist => ({
  id: 'a-1', name: 'Artista', content: content as Artist['content'],
} as Artist);

const comDiagnostico = {
  realIndex: {
    profile: { key: 'Rising', name: 'Rising', description: '', insights: [] },
    pattern: { r: true, e: false, a: true, l: false },
    inputs: {},
    computedAt: '2026-02-10T12:00:00.000Z',
  },
};

const TUDO = { viewPlanning: true, manageTasks: true };

describe('pilares do painel', () => {
  it('são três, na ordem onde estou, execução, para onde ir', () => {
    const [um, dois, tres] = pilaresDoPainel(artista(comDiagnostico), jornada(), TUDO);
    expect([um.chave, dois.chave, tres.chave]).toEqual(['diagnostico', 'execucao', 'planejamento']);
    expect([um.rotulo, dois.rotulo, tres.rotulo]).toEqual(['Onde estou', 'Execução', 'Para onde ir']);
  });

  describe('onde estou', () => {
    it('conta o perfil e quantas dimensões acenderam', () => {
      const [pilar] = pilaresDoPainel(artista(comDiagnostico), jornada(), TUDO);
      expect(pilar.linha).toBe('Você está em Rising, com 2 de 4 dimensões acesas.');
      expect(pilar.marcas).toEqual([true, false, true, false]);
      expect(pilar.destino).toBe('diagnostico');
    });

    it('mostra a data da leitura, que é o que diz se o espelho está velho', () => {
      const [pilar] = pilaresDoPainel(artista(comDiagnostico), jornada(), TUDO);
      expect(pilar.detalhe).toContain('2026');
    });

    // Refazer o diagnóstico é PRO. Sem esta ramificação o cartão convidaria para uma tela que a
    // pessoa não pode usar, e ela não teria como saber por quê.
    it('sem diagnóstico e sem PRO, o convite é conhecer o PRO', () => {
      const [pilar] = pilaresDoPainel(
        artista(), jornada({ hasDiagnostic: false }), { viewPlanning: true, manageTasks: false },
      );
      expect(pilar.estado).toBe('vazio');
      expect(pilar.destino).toBe('assinatura');
    });

    it('sem diagnóstico e com PRO, leva a fazer o diagnóstico', () => {
      const [pilar] = pilaresDoPainel(artista(), jornada({ hasDiagnostic: false }), TUDO);
      expect(pilar.destino).toBe('refazerDiagnostico');
    });
  });

  describe('execução', () => {
    it('conta o progresso e anuncia a próxima tarefa', () => {
      const [, pilar] = pilaresDoPainel(
        artista({
          strategies: [{
            id: 'e1', type: 'growth', title: 'Estratégia', tasks: [
              { id: 't1', description: 'Gravar o teaser', status: 'done' },
              { id: 't2', description: 'Definir o conceito do media kit', status: 'todo' },
            ],
          }],
        } as Partial<Artist['content']>),
        jornada(), TUDO,
      );
      expect(pilar.linha).toBe('3 de 10 tarefas concluídas.');
      expect(pilar.detalhe).toBe('Próxima: Definir o conceito do media kit');
      expect(pilar.progresso).toEqual({ feito: 3, total: 10, pct: 30 });
      expect(pilar.destino).toBe('plano');
    });

    // O plano nasce das estratégias: mandar para o Plano de Ação sem planejamento entrega uma
    // tela de bloqueio. O cartão corta caminho e leva direto ao wizard.
    it('sem planejamento, leva ao wizard em vez do plano', () => {
      const [, pilar] = pilaresDoPainel(artista(), jornada({ hasPlan: false }), TUDO);
      expect(pilar.estado).toBe('travado');
      expect(pilar.destino).toBe('wizard');
      expect(pilar.cta).toBe('Criar planejamento');
    });

    it('planejamento pela metade convida a continuar, não a criar de novo', () => {
      const [, pilar] = pilaresDoPainel(artista(), jornada({ hasPlan: false, resumingPlan: true }), TUDO);
      expect(pilar.cta).toBe('Continuar planejamento');
    });

    it('com o plano pronto e sem tarefas, convida a montá-las', () => {
      const [, pilar] = pilaresDoPainel(
        artista(), jornada({ tasksTotal: 0, tasksDone: 0, tasksPending: 0, pct: 0 }), TUDO,
      );
      expect(pilar.estado).toBe('vazio');
      expect(pilar.destino).toBe('plano');
    });

    // O ciclo fecha medindo de novo: é a única etapa que devolve a pessoa ao começo do método.
    it('com tudo feito, fecha o ciclo mandando medir de novo', () => {
      const [, pilar] = pilaresDoPainel(
        artista(), jornada({ tasksDone: 10, tasksPending: 0, pct: 100 }), TUDO,
      );
      expect(pilar.estado).toBe('concluido');
      expect(pilar.destino).toBe('refazerDiagnostico');
    });

    it('sem PRO, tudo feito não promete o que não dá: fica nas tarefas', () => {
      const [, pilar] = pilaresDoPainel(
        artista(), jornada({ tasksDone: 10, tasksPending: 0, pct: 100 }),
        { viewPlanning: true, manageTasks: false },
      );
      expect(pilar.destino).toBe('plano');
    });
  });

  describe('para onde ir', () => {
    it('com plano pronto, a linha é a visão que a pessoa escreveu', () => {
      const [, , pilar] = pilaresDoPainel(
        artista({ identity: { vision: 'Levar o samba de raiz para os palcos da Europa' }, objectives: ['a', 'b'] } as Partial<Artist['content']>),
        jornada(), TUDO,
      );
      expect(pilar.linha).toBe('Levar o samba de raiz para os palcos da Europa');
      expect(pilar.destino).toBe('planejamento');
    });

    it('sem visão escrita, cai nos números do plano', () => {
      const [, , pilar] = pilaresDoPainel(
        artista({ objectives: ['a', 'b'], strategies: [{ id: 'e1', type: 'growth', title: 'x', tasks: [] }] } as Partial<Artist['content']>),
        jornada(), TUDO,
      );
      expect(pilar.linha).toBe('2 objetivos e 1 estratégias ativas.');
    });

    it('nada começado convida a criar', () => {
      const [, , pilar] = pilaresDoPainel(artista(), jornada({ hasPlan: false }), TUDO);
      expect(pilar.estado).toBe('vazio');
      expect(pilar.destino).toBe('wizard');
    });
  });

  // Perfil por pagar: os três cartões continuam à vista (é o que explica o que a pessoa ganha),
  // mas nenhum deles entrega uma tela que ela ainda não pode abrir.
  it('perfil travado não esconde os cartões, redireciona para o desbloqueio', () => {
    const [, dois, tres] = pilaresDoPainel(
      artista(comDiagnostico), jornada(), { viewPlanning: false, manageTasks: false },
    );
    expect([dois.estado, tres.estado]).toEqual(['travado', 'travado']);
    expect([dois.destino, tres.destino]).toEqual(['assinatura', 'assinatura']);
  });

  // A voz da marca não leva travessão nem emoji, e isto aqui é copy de produto, não comentário.
  it('a copy dos cartões não tem travessão nem emoji', () => {
    const texto = pilaresDoPainel(artista(comDiagnostico), jornada(), TUDO)
      .flatMap((p) => [p.rotulo, p.titulo, p.linha, p.detalhe || '', p.cta])
      .join(' ');
    expect(texto).not.toMatch(/—/);
    expect(texto).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
