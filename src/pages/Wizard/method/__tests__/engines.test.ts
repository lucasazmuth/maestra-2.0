import { generateObjectives, generateStrategies, prioritizeStrategies, seedScheduledPlan } from '../engines';
import { STRATEGY_BANK } from '../strategyBank';
import { PRIORITY } from '../priorityMatrix';
import type { ArtistIdentity, Strategy } from '../../../../interfaces/maestra';

// Validações dos motores determinísticos contra os exemplos resolvidos dos documentos da v2.

describe('generateObjectives (Nyta_Etapa_Objetivos_v2)', () => {
  it('caso médio — público + mercado, missão com tier "eu" (5 objetivos, dedup da agenda)', () => {
    // Fonte 3 (simbólico) = primeira oração da MISSÃO montada (antes do "gerando").
    const identity: ArtistIdentity = {
      recognitionTags: ['publico', 'mercado'],
      mission: 'Proporcionar memória afetiva e nostalgia para o público, gerando em paralelo resultados financeiros relevantes.',
    };
    const objs = generateObjectives(identity, { financialTier: 'eu' });
    expect(objs).toEqual([
      'Ampliar a agenda de shows',
      'Ampliar os resultados digitais',
      'Obter reconhecimento do mercado',
      'Proporcionar memória afetiva e nostalgia para o público',
      'Gerar resultados financeiros relevantes',
    ]);
  });

  it('caso excedente — crítica/mídia + classe + internacional (6 objetivos)', () => {
    const identity: ArtistIdentity = {
      recognitionTags: ['critica_midia', 'classe_artistica', 'internacional'],
      mission: 'Compartilhar experimentações afrobrasileiras com o público, alcançando em paralelo sustentabilidade financeira para o projeto.',
    };
    const objs = generateObjectives(identity, { financialTier: 'projeto' });
    expect(objs).toHaveLength(6);
    expect(objs).toContain('Compartilhar experimentações afrobrasileiras com o público');
    expect(objs).toContain('Alcançar repercussão internacional');
    expect(objs).toContain('Alcançar sustentabilidade financeira para o projeto');
  });

  it('rede de segurança: corrige preposição duplicada no objetivo simbólico', () => {
    const objs = generateObjectives(
      { recognitionTags: ['publico'], mission: 'Oferecer sentido de viver para pra pessoas que gostam de skate.' },
      { financialTier: 'hobby' }
    );
    expect(objs).toContain('Oferecer sentido de viver para pessoas que gostam de skate');
    expect(objs.join(' ')).not.toMatch(/para\s+pra/i);
  });

  it('hobby não gera objetivo financeiro', () => {
    const objs = generateObjectives(
      { recognitionTags: ['publico'], mission: 'Oferecer alegria para o público.' },
      { financialTier: 'hobby' }
    );
    expect(objs.some((o) => /financ|sustenta/i.test(o))).toBe(false);
    expect(objs).toContain('Oferecer alegria para o público');
  });
});

describe('generateStrategies (Nyta_Etapa_Estrategias_v3)', () => {
  it('dedup do #26 quando fraquezas 6 (agenda) e 7 (gestão comercial) marcadas', () => {
    const strategies = generateStrategies(
      { internal: { 6: 'melhorar', 7: 'melhorar' } },
      { name: 'Teste' }
    );
    const ids = strategies.map((s) => s.bankId);
    expect(ids.filter((id) => id === '26')).toHaveLength(1);
  });

  it('personaliza o nome na estratégia #43 (Lojinha)', () => {
    const strategies = generateStrategies(
      { internal: { 17: 'melhorar' } }, // #17 dispara, entre outras, a #43
      { name: 'Cami', gender: 'ela' }
    );
    const loja = strategies.find((s) => s.bankId === '43');
    expect(loja?.title).toContain('Lojinha da Cami');
  });

  it('força focada potencializa (tipo SO + swotRefs.strengths)', () => {
    // Fraqueza 18 gera a #1; força focada 6 (agenda) potencializa a #1 (Matriz C §7).
    const strategies = generateStrategies(
      { internal: { 18: 'melhorar', 6: 'forte' } },
      { name: 'Teste' }
    );
    const s1 = strategies.find((s) => s.bankId === '1');
    expect(s1?.type).toBe('SO');
    expect(s1?.swotRefs?.strengths).toContain('Agenda de shows');
    // A força aparece em swotRefs.strengths ("Responde a:"), NÃO mais como prefixo no título.
    expect(s1?.title).not.toContain('Alavancando');
  });
});

describe('prioritizeStrategies (Nyta_Matriz_Priorizacao_v2 §4)', () => {
  it('exemplo: objetivos DIG/SHW/FIN → #26 (29) vem antes do #1 (28)', () => {
    const objectives = [
      'Ampliar os resultados digitais', // DIG
      'Ampliar a agenda de shows', // SHW
      'Gerar resultados financeiros relevantes', // FIN
    ];
    const strategies: Strategy[] = [
      { id: 'a', bankId: '1', type: 'WO', title: '#1', tasks: [] },
      { id: 'b', bankId: '26', type: 'WO', title: '#26', tasks: [] },
    ];
    const ranked = prioritizeStrategies(strategies, objectives);
    expect(ranked[0].bankId).toBe('26');
    expect(ranked.find((s) => s.bankId === '1')?.finalScore).toBe(28); // 10+9+9
    expect(ranked.find((s) => s.bankId === '26')?.finalScore).toBe(29); // 9+10+10
  });
});

describe('seedScheduledPlan (Plano de Ação — início + duração, cascata por prioridade)', () => {
  const strategies: Strategy[] = [
    { id: 'a', bankId: '1', type: 'WO', title: '#1', tasks: [], finalScore: 20 },
    { id: 'b', bankId: '26', type: 'WO', title: '#26', tasks: [], finalScore: 29 },
  ];

  it('ordena por prioridade e semeia 10 tarefas datadas por estratégia', () => {
    const out = seedScheduledPlan(strategies, '2026-01-01', 12);
    expect(out[0].bankId).toBe('26'); // maior finalScore primeiro
    expect(out[0].tasks).toHaveLength(10);
    expect(out[0].tasks.every((t) => !!t.deadline)).toBe(true);
  });

  it('cadência semanal dentro da estratégia, começando na data de início', () => {
    const out = seedScheduledPlan(strategies, '2026-01-01', 12);
    expect(out[0].tasks[0].deadline).toBe('2026-01-01');
    expect(out[0].tasks[1].deadline).toBe('2026-01-08'); // +7 dias
  });

  it('mantém todas as tarefas dentro do horizonte escolhido', () => {
    const out = seedScheduledPlan(strategies, '2026-01-01', 6);
    const all = out.flatMap((s) => s.tasks.map((t) => new Date(t.deadline!).getTime()));
    const limite = new Date('2026-07-02').getTime(); // ~6 meses
    expect(Math.max(...all)).toBeLessThanOrEqual(limite);
  });
});

describe('integridade das tabelas', () => {
  it('todas as 53 estratégias têm 10 tarefas e linha na matriz de priorização', () => {
    expect(STRATEGY_BANK).toHaveLength(53);
    for (const s of STRATEGY_BANK) {
      expect(s.tasks).toHaveLength(10);
      expect(PRIORITY[s.id]).toBeDefined();
      expect(PRIORITY[s.id]).toHaveLength(8);
    }
  });
});
