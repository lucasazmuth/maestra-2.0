import { Dispatch, FC, ReactNode, SetStateAction } from 'react';
import { FiCheck } from 'react-icons/fi';
import type { ActionTask, ArtistContent, ArtistReferences, Strategy } from '../../interfaces/maestra';
import TaskComposer, { SuggTask } from './TaskComposer';
import { TaskDate, TaskCategory, TaskOwner, TaskDelete, AutoTextarea, type Assignee } from './TaskControls';

// Modo avançado do Plano de Ação: dossiê completo (Identidade, Objetivos, SWOT, Estratégias,
// Resumo, Histórico). Leitura sóbria/editorial — tipografia + dividers, ícones de linha cinza,
// sem cor decorativa. As Estratégias são EDITÁVEIS (check, editar texto/prazo, remover, adicionar
// via Nyta ou manual), reaproveitando os handlers do ActionPlan (bundle `crud`).

export interface TaskCrud {
  today: string;
  canManage: boolean; // gestão de tarefas (PRO); quando false, tudo somente-leitura
  toggleDone: (sid: string, t: ActionTask) => void;
  patchTask: (sid: string, tid: string, patch: Partial<ActionTask>) => void;
  delTask: (sid: string, tid: string) => void;
  addTask: (sid: string, task: SuggTask) => void;
  askNyta: (s: Strategy) => void;
  sugg: Record<string, SuggTask[]>;
  setSugg: Dispatch<SetStateAction<Record<string, SuggTask[]>>>;
  loadingSugg: string | null;
  composer: string | null;
  setComposer: Dispatch<SetStateAction<string | null>>;
  assignees: Assignee[];
}

const Section: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <section className="ap-adv-sec">
    <div className="ap-adv-head">
      <h2>{title}</h2>
    </div>
    {children}
  </section>
);

const SwotCol: FC<{ label: string; items?: string[] }> = ({ label, items }) => (
  <div className="ap-adv-swot-col">
    <div className="ap-adv-swot-label">{label}</div>
    {items?.length ? (
      <ul className="ap-adv-list">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    ) : (
      <div className="ap-adv-empty">Sem itens</div>
    )}
  </div>
);

// Mapa de referências (mesmo quadro mental do wizard): 4 quadrantes coloridos + hub central.
const splitRefItems = (s?: string): string[] =>
  (s || '').split(/[,;\n·]+/).map((x) => x.trim()).filter(Boolean);

const REF_QUADRANTS: { key: 'posicionamento' | 'artisticas' | 'comunicacao' | 'gestao'; label: string; color: string }[] = [
  { key: 'posicionamento', label: 'Posicionamento', color: '#3b82f6' },
  { key: 'artisticas', label: 'Artísticas', color: '#eab308' },
  { key: 'comunicacao', label: 'Comunicação com o público', color: '#f97316' },
  { key: 'gestao', label: 'Carreira', color: '#ef4444' },
];

const refHasItems = (refs?: ArtistReferences): boolean => {
  if (!refs) return false;
  const pos = refs.posicionamento || {};
  return !!(refs.artisticas || refs.comunicacao || refs.gestao || pos.curto || pos.medio || pos.longo);
};

const ReferenceMap: FC<{ references?: ArtistReferences }> = ({ references }) => {
  const refs = references || {};
  const pos = refs.posicionamento || {};
  const itemsFor = (key: (typeof REF_QUADRANTS)[number]['key']): string[] =>
    key === 'posicionamento'
      ? [pos.curto, pos.medio, pos.longo].flatMap(splitRefItems)
      : splitRefItems(refs[key as 'artisticas' | 'comunicacao' | 'gestao']);
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {REF_QUADRANTS.map((q) => {
          const items = itemsFor(q.key);
          return (
            <div key={q.key} style={{ background: '#0e0e0e', border: `1px solid ${q.color}40`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: q.color, color: '#0b0b0b', fontWeight: 800, fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', padding: '6px 10px', textAlign: 'center' }}>
                {q.label}
              </div>
              <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 3, minHeight: 58 }}>
                {items.length ? (
                  items.map((it, i) => (
                    <span key={i} style={{ color: '#e8e8e8', fontSize: 12.5, borderBottom: '1px solid #1a1a1a', paddingBottom: 3 }}>{it}</span>
                  ))
                ) : (
                  <span style={{ color: '#6b7280', fontSize: 12 }}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#16a34a',
          color: '#fff',
          fontWeight: 800,
          fontSize: 11,
          letterSpacing: 0.5,
          padding: '7px 13px',
          borderRadius: 9999,
          border: '3px solid #0b0b0b',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        REFERÊNCIAS
      </div>
    </div>
  );
};

export const AdvancedPlan: FC<{ content: ArtistContent; ranked: Strategy[]; crud: TaskCrud }> = ({ content, ranked, crud }) => {
  const id = content.identity || {};
  const swot = content.swotAnalysis;
  const objectives = content.objectives || [];
  const hasIdentity = !!(id.genre || id.vision || id.mission || id.bio || id.values?.length);
  const hasReferences = refHasItems(id.references);

  return (
    <div className="ap-adv">
      {hasIdentity && (
        <Section title="Fundamentos">
          <div className="ap-adv-id">
            {id.genre && (
              <div className="ap-adv-field">
                <span className="ap-adv-field-label">Gênero</span>
                <span className="ap-adv-field-val">{id.genre}</span>
              </div>
            )}
            {id.vision && (
              <div className="ap-adv-block">
                <span className="ap-adv-field-label">Visão</span>
                <p>{id.vision}</p>
              </div>
            )}
            {id.mission && (
              <div className="ap-adv-block">
                <span className="ap-adv-field-label">Missão</span>
                <p>{id.mission}</p>
              </div>
            )}
            {id.bio && (
              <div className="ap-adv-block">
                <span className="ap-adv-field-label">Bio</span>
                <p>{id.bio}</p>
              </div>
            )}
            {!!id.values?.length && (
              <div className="ap-adv-block">
                <span className="ap-adv-field-label">Valores</span>
                <div className="ap-adv-chips">
                  {id.values.map((v, i) => (
                    <span className="ap-adv-chip" key={i}>{v}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {hasReferences && (
        <Section title="Mapa de referências">
          <ReferenceMap references={id.references} />
        </Section>
      )}

      {!!objectives.length && (
        <Section title="Objetivos">
          <ol className="ap-adv-objs">
            {objectives.map((o, i) => (
              <li key={i}>
                <span className="ap-adv-objnum">{String(i + 1).padStart(2, '0')}</span>
                <span>{o}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {swot && (
        <Section title="Análise SWOT">
          <div className="ap-adv-swot">
            <SwotCol label="Forças" items={swot.strengths} />
            <SwotCol label="Fraquezas" items={swot.weaknesses} />
            <SwotCol label="Oportunidades" items={swot.opportunities} />
            <SwotCol label="Ameaças" items={swot.threats} />
          </div>
        </Section>
      )}

      {!!ranked.length && (() => {
        const max = Math.max(...ranked.map((s) => s.finalScore ?? s.score ?? 0), 1);
        return (
          <Section title="Prioridade das estratégias">
            <div className="ap-adv-rank">
              {ranked.map((s, i) => {
                const sc = s.finalScore ?? s.score ?? 0;
                const pct = Math.round((sc / max) * 100);
                return (
                  <div className="ap-adv-rank-row" key={s.id}>
                    <span className="ap-adv-rank-num">{String(i + 1).padStart(2, '0')}</span>
                    <div className="ap-adv-rank-main">
                      <div className="ap-adv-rank-top">
                        <span className="ap-adv-rank-title" title={s.title}>{s.title}</span>
                        <span className="ap-adv-rank-pct">{pct}%</span>
                      </div>
                      <div className="ap-adv-rank-bar"><div style={{ width: `${pct}%` }} /></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        );
      })()}

      {!!ranked.length && (
        <Section title="Estratégias">
          <div className="ap-adv-strats">
            {ranked.map((s, i) => {
              const tasks = (s.tasks || []).filter((t) => t.status !== 'archived');
              const done = tasks.filter((t) => t.status === 'done').length;
              return (
                <div className="ap-adv-strat" key={s.id}>
                  <div className="ap-adv-strat-head">
                    <span className="ap-adv-strat-num">{String(i + 1).padStart(2, '0')}</span>
                    <span className="ap-adv-strat-title">{s.title}</span>
                    <span className="ap-adv-strat-count">{done}/{tasks.length}</span>
                  </div>
                  {s.why && <p className="ap-adv-strat-why">{s.why}</p>}
                  {!!tasks.length && (
                    <ul className="ap-adv-tasks">
                      {tasks.map((t) => {
                        const isDone = t.status === 'done';
                        const od = !!(t.deadline && t.deadline < crud.today && !isDone);
                        return (
                          <li key={t.id} className={isDone ? 'is-done' : ''}>
                            <button
                              className={`ap-adv-task-ico${isDone ? ' is-done' : ''}`}
                              title={isDone ? 'Concluída' : 'Marcar como concluída'}
                              onClick={crud.canManage ? () => crud.toggleDone(s.id, t) : undefined}
                              style={{ cursor: crud.canManage ? 'pointer' : 'default' }}
                            >
                              {isDone && <FiCheck size={11} />}
                            </button>
                            <AutoTextarea
                              key={t.description}
                              className="ap-adv-task-desc"
                              defaultValue={t.description}
                              onCommit={(v) => crud.patchTask(s.id, t.id, { description: v })}
                            />
                            <TaskCategory className="ap-adv-task-cat" value={t.type} onChange={(v) => crud.patchTask(s.id, t.id, { type: v })} />
                            <TaskDate className="ap-adv-task-date" value={t.deadline} overdue={od} onChange={(d) => crud.patchTask(s.id, t.id, { deadline: d })} />
                            <TaskOwner className="ap-adv-task-owner" value={t.owner} assignees={crud.assignees} onChange={(o) => crud.patchTask(s.id, t.id, { owner: o })} />
                            {crud.canManage && <TaskDelete className="ap-adv-task-del" size={13} onDelete={() => crud.delTask(s.id, t.id)} />}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {crud.canManage && (
                    <TaskComposer
                      strategy={s}
                      open={crud.composer === s.id}
                      loading={crud.loadingSugg === s.id}
                      suggestions={crud.sugg[s.id]}
                      accent={false}
                      onOpen={() => crud.setComposer(s.id)}
                      onClose={() => { crud.setComposer(null); crud.setSugg((pp) => ({ ...pp, [s.id]: [] })); }}
                      onAdd={(t) => crud.addTask(s.id, t)}
                      onAskNyta={() => crud.askNyta(s)}
                      onUseSugg={(i) => { crud.addTask(s.id, crud.sugg[s.id]![i]); crud.setSugg((pp) => ({ ...pp, [s.id]: (pp[s.id] || []).filter((_, j) => j !== i) })); }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Resumo executivo agora vive no card da FASE (cabeçalho) — não duplicamos aqui. */}

      {!!content.phaseHistory?.length && (
        <Section title="Histórico de fases">
          <ul className="ap-adv-history">
            {content.phaseHistory.map((h, i) => (
              <li key={i}>
                Fase {h.phase} — {h.phaseLabel}
                <span>{new Date(h.snapshotAt).toLocaleDateString('pt-BR')}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
};

export default AdvancedPlan;
