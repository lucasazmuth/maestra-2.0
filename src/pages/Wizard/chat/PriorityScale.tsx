import { FC, useEffect, useRef, useState } from 'react';
import type { Strategy } from '@maestra/core/interfaces/maestra';
import { suggestScores } from '@maestra/core/wizard/motores';
import { explanationFor, PRIORITY_INFO } from '@maestra/core/wizard/prioridade';
import { STRATEGY_BY_ID } from '@maestra/core/constants/strategyBank';
import './priorityScale.scss';

interface Props {
  strategies: Strategy[];
  objectives: string[];
  onConfirm: (strategies: Strategy[], selectedIds: string[]) => void;
  onProgress?: (strategies: Strategy[]) => void;
  onSuggest?: () => Promise<Record<string, { byObjective: Record<number, number> }>>;
  onAnnounce?: (texts: string[]) => void;
}

const percent = (scores: Record<number, number>, count: number) => count
  ? Math.round(Array.from({ length: count }, (_, i) => scores[i] || 0).reduce((a, b) => a + b, 0) / count * 10)
  : 0;

const SCALE = Array.from({ length: 11 }, (_, index) => index);
const scoreColor = (score: number) => score <= 3 ? '#d94c4c' : score <= 6 ? '#c78316' : '#3361ff';
const scoreWord = (score?: number) => score == null ? 'Escolha uma nota' : score === 0 ? 'Não ajuda em nada' : score <= 3 ? 'Ajuda pouco' : score <= 6 ? 'Ajuda' : score <= 9 ? 'Ajuda bastante' : 'Ajuda muito';

export const PriorityScale: FC<Props> = ({ strategies, objectives, onConfirm, onProgress }) => {
  const canonical = suggestScores(strategies, objectives);
  const [list, setList] = useState(strategies);
  const resumed = strategies.some(s => s.priorityVersion === '3.0');
  const manual = strategies.some(s => s.priorityMode === 'manual');
  const firstPending = strategies.findIndex(s => !s.priorityReviewed);
  const [mode, setMode] = useState<'choose' | 'manual' | 'rank'>(
    resumed ? manual && firstPending !== -1 ? 'manual' : 'rank' : 'choose'
  );
  const [index, setIndex] = useState(Math.max(0, firstPending));
  const [objectiveIndex, setObjectiveIndex] = useState(0);
  const [hoverScore, setHoverScore] = useState<number | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;
  const pending = useRef<Strategy[] | null>(null);
  const confirmed = useRef(false);
  const flush = () => {
    if (pending.current && !confirmed.current) {
      progressRef.current?.(pending.current);
      pending.current = null;
    }
  };
  useEffect(() => {
    const timer = window.setTimeout(flush, 700);
    return () => window.clearTimeout(timer);
  }, [list]);
  useEffect(() => () => flush(), []);

  const update = (next: Strategy[]) => {
    pending.current = next;
    setList(next);
  };
  const start = (manual: boolean) => {
    update(list.map(s => ({
      ...s,
      priorityVersion: '3.0',
      priorityMode: manual ? 'manual' : 'canonical',
      priorityReviewed: !manual,
      objectiveScores: manual
        ? { ...canonical[s.id]?.byObjective, ...s.artistScores }
        : { ...canonical[s.id]?.byObjective },
    })));
    setIndex(0);
    setSelected([]);
    setMode(manual ? 'manual' : 'rank');
  };
  const scored = list.map(s => ({
    ...s,
    finalScore: percent(s.objectiveScores || {}, objectives.length),
    canonicalPercent: percent(canonical[s.id]?.byObjective || {}, objectives.length),
    priorityVersion: '3.0',
  }));
  const ranked = [...scored].sort((a, b) => (b.finalScore - a.finalScore)
    || ((STRATEGY_BY_ID[a.bankId || '']?.order ?? 999) - (STRATEGY_BY_ID[b.bankId || '']?.order ?? 999)));
  const limit = Math.min(10, list.length);

  if (!list.length) return <div className="nyta-card">Nenhuma estratégia disponível para priorizar.</div>;
  if (!objectives.length) return <div className="nyta-card">Escolha seus objetivos antes de priorizar.</div>;

  return <section className="nyta-card priority-v3" aria-label="Priorização de estratégias">
    {mode === 'choose' ? <>
      <h3>Como você quer priorizar?</h3>
      <p>{list.length} estratégias para os seus objetivos.</p>
      <div className="priority-v3__actions">
        <button type="button" className="priority-v3__nyta-action" onClick={() => start(false)}>Priorizar com a Nyta</button>
        <button type="button" className="priority-v3__manual-action" onClick={() => start(true)}>Priorizar por conta própria</button>
      </div>
    </> : mode === 'manual' ? (() => {
      const strategy = list[index];
      const currentScore = strategy.objectiveScores?.[objectiveIndex];
      const shownScore = hoverScore ?? currentScore;
      const answered = index * objectives.length + objectiveIndex;
      const pick = (score: number) => {
        if (advancing) return;
        const scores = { ...strategy.objectiveScores, [objectiveIndex]: score };
        const completedStrategy = objectiveIndex + 1 === objectives.length;
        update(list.map((item) => item.id === strategy.id ? { ...item, objectiveScores: scores, artistScores: scores, priorityReviewed: completedStrategy || item.priorityReviewed } : item));
        setHoverScore(null);
        setAdvancing(true);
        window.setTimeout(() => {
          setAdvancing(false);
          if (objectiveIndex + 1 < objectives.length) setObjectiveIndex((value) => value + 1);
          else if (index + 1 < list.length) { setIndex((value) => value + 1); setObjectiveIndex(0); }
          else setMode('rank');
        }, 360);
      };
      return <>
        <div className="priority-v3__progress"><span>Estratégia {index + 1} de {list.length}</span><span>{answered + 1} de {list.length * objectives.length}</span></div>
        <div className="priority-v3__progress-line"><i style={{ width: `${(answered / Math.max(list.length * objectives.length, 1)) * 100}%` }} /></div>
        <section className="priority-v3__question">
          <h3>{strategy.title}</h3>
          <span className="priority-v3__eyebrow">Objetivo {objectiveIndex + 1} de {objectives.length}</span>
          <p>Ajuda a conquistar <strong>{objectives[objectiveIndex]}</strong>?</p>
          <div className="priority-v3__scale" onMouseLeave={() => setHoverScore(null)}>
            {SCALE.map((score) => <button key={score} type="button" disabled={advancing} aria-label={`Nota ${score}`} onMouseEnter={() => setHoverScore(score)} onClick={() => pick(score)} style={{ height: 22 + score * 4, background: shownScore != null && score <= shownScore ? scoreColor(shownScore) : undefined }}>{score}</button>)}
          </div>
          <div className="priority-v3__scale-legend"><span>0 · não ajuda</span><span>10 · ajuda muito</span></div>
          <div className="priority-v3__score-readout" style={{ color: shownScore == null ? undefined : scoreColor(shownScore) }}><strong>{shownScore ?? '–'}</strong><span>{scoreWord(shownScore)}</span></div>
        </section>
      </>;
    })() : <>
      <h3>Escolha até {limit} estratégias</h3>
      <p aria-live="polite">{selected.length} de {limit} escolhidas</p>
      {ranked.map(s => {
        const info = PRIORITY_INFO[s.bankId || ''];
        const checked = selected.includes(s.id);
        return <article className="priority-v3__strategy" key={s.id}>
          <label className="priority-v3__selection">
            <input type="checkbox" checked={checked} disabled={!checked && selected.length >= limit}
              onChange={() => setSelected(checked ? selected.filter(id => id !== s.id) : [...selected, s.id])} />
            <span>{s.title}</span><strong>{s.finalScore}%</strong>
          </label>
          {s.description && <p>{s.description}</p>}
          {info?.recomendada && <p className="priority-v3__recommendation">Recomendada pela Nyta: {info.motivo_recomendada}</p>}
          <details>
            <summary>Impacto nos seus objetivos</summary>
            {objectives.map((objective, i) => <p key={i}>
              <strong>{objective}: {s.objectiveScores?.[i]}/10</strong><br />
              {explanationFor(s.bankId || '', objective)}
            </p>)}
            {s.artistScores && <p>Você: {s.finalScore}% · Nyta: {s.canonicalPercent}%</p>}
          </details>
        </article>;
      })}
      <div className="priority-v3__actions">
        <button type="button" onClick={() => setMode('choose')}>Refazer priorização</button>
        <button type="button" disabled={!selected.length} onClick={() => {
          confirmed.current = true;
          pending.current = null;
          onConfirm(scored, selected);
        }}>Gerar plano de ação</button>
      </div>
    </>}
  </section>;
};
