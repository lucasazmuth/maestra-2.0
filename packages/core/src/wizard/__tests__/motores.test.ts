import { generateObjectives, generateStrategies, prioritizeStrategies, seedScheduledPlan } from '../motores';
import { STRATEGY_BANK } from '../../constants/strategyBank';
import { PRIORITY, PRIORITY_INFO } from '../prioridade';
import { buildActionPlan } from '../../services/planoDeAcao';
import type { ArtistIdentity, Strategy } from '../../interfaces/maestra';

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

describe('motor v4', () => {
  const cases: [number[], number[], number][] = [
    [[17], [15], 2],
    [[4,6,7,8,12,13,15,16,17,20], [1,3,8,13], 17],
    [[10,13,15,16,17], [3,5,6,9,14], 18],
    [[14,16,19], [4,6,16,21,22], 13],
    [[6,7,9,10,14,19], [9,10,11,13,18], 21],
    [[4,5,6,7,17], [3,8,15,17,19,20], 14],
  ];
  it.each(cases)('reproduz F=%j O=%j: %i estrategias', (weaknesses, opportunities, count) => {
    const internal = Object.fromEntries(weaknesses.map(id => [id, 'melhorar' as const]));
    const result = generateStrategies({ internal, opportunities }, {});
    expect(result).toHaveLength(count);
    expect(result.every(s => s.bankVersion === '4.0' && s.description)).toBe(true);
  });
  it('caso minimo retorna apenas 34 e 43', () => {
    expect(generateStrategies({ internal: {17: 'melhorar'}, opportunities: [15] }, {})
      .map(s => s.bankId).sort()).toEqual(['34', '43']);
  });
  it('nao gera universais ou estrategias apenas por forcas e ameacas', () => {
    expect(generateStrategies({}, {})).toEqual([]);
    expect(generateStrategies({internal: {1: 'forte'}, threats: [1]}, {})).toEqual([]);
  });
  it('projeto incentivado exige oportunidade e fraqueza', () => {
    const ids = (internal: any, opportunities: number[]) => generateStrategies({internal, opportunities}, {}).map(s=>s.bankId);
    expect(ids({17:'melhorar'}, [])).not.toContain('38');
    expect(ids({}, [2])).not.toContain('38');
    expect(ids({17:'melhorar'}, [2])).toContain('38');
    expect(ids({17:'melhorar'}, [4])).toContain('38');
  });
});

describe('priorizacao v3', () => {
  it('calcula 87% no exemplo DIG SHW FIN da estrategia 1', () => {
    const result = prioritizeStrategies([{id:'a', bankId:'1', title:'1', type:'WO', tasks:[]}],
      ['Resultados digitais', 'Agenda de shows', 'Sustentabilidade financeira']);
    expect(result[0].finalScore).toBe(87);
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
  it('45 estrategias e 449 tarefas com cobertura completa', () => {
    expect(STRATEGY_BANK).toHaveLength(45);
    expect(STRATEGY_BANK.reduce((n, s) => n + s.tasks.length, 0)).toBe(449);
    expect(new Set(STRATEGY_BANK.map(s => s.id)).size).toBe(45);
    for (let id = 1; id <= 20; id++) expect(STRATEGY_BANK.some(s => s.triggers.weaknesses.includes(id))).toBe(true);
    for (let id = 1; id <= 22; id++) expect(STRATEGY_BANK.some(s => [...s.requires_any_opportunity, ...s.triggers.opportunities].includes(id))).toBe(true);
    for (const s of STRATEGY_BANK) {
      expect(s.tasks.length).toBeGreaterThan(0);
      expect(PRIORITY[s.id]).toBeDefined();
      expect(PRIORITY[s.id]).toHaveLength(8);
      expect(PRIORITY[s.id].every(n => Number.isInteger(n) && n >= 1 && n <= 10)).toBe(true);
      expect(PRIORITY_INFO[s.id].explicacoes).toHaveLength(8);
      expect(PRIORITY_INFO[s.id].explicacoes.every(text => text.trim().length > 0)).toBe(true);
    }
  });
});

describe('preservacao de planos', () => {
  it('nao substitui tarefas editadas e datas existentes', () => {
    const strategy: Strategy = { id: 'saved', bankId: '1', bankVersion: '4.0', type: 'WO', title: 'Meu titulo', tasks: [
      {id:'task', description:'Minha tarefa editada', owner:'self', status:'done', deadline:'2027-01-01'},
    ] };
    expect(buildActionPlan(strategy)).toEqual(strategy.tasks);
    expect(seedScheduledPlan([strategy], '2026-01-01', 6)[0].tasks).toEqual(strategy.tasks);
  });
  it('mantem tarefas canonicas de IDs removidos em planos legados', () => {
    expect(buildActionPlan({id:'old', bankId:'26', type:'WO', title:'Antiga', tasks:[]})).toHaveLength(10);
  });
  it('usa o banco novo em estrategias v4', () => {
    const s = generateStrategies({internal:{17:'melhorar'}, opportunities:[15]}, {})[0];
    expect(buildActionPlan(s).map(t => t.description)).toEqual(STRATEGY_BANK.find(b=>b.id===s.bankId)?.tasks);
  });
});
