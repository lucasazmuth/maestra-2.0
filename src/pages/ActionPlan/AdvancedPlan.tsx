import { Dispatch, FC, ReactNode, SetStateAction, useState } from 'react';
import { FiCheck, FiEdit2, FiX, FiPlus, FiTrash2 } from 'react-icons/fi';
import type { ActionTask, ArtistContent, ArtistReferences, Strategy } from '../../interfaces/maestra';
import TaskComposer, { SuggTask } from './TaskComposer';
import { TaskDate, TaskCategory, TaskOwner, TaskDelete, AutoTextarea, type Assignee } from './TaskControls';

// Texto editável inline (visão/missão/bio/gênero): mostra o valor + lápis; ao editar vira textarea
// com Salvar/Cancelar. Salvar chama onSave com o texto novo.
const EditableText: FC<{ value: string; placeholder: string; canEdit: boolean; onSave: (v: string) => void }> = ({ value, placeholder, canEdit, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (editing) {
    return (
      <div className="ap-adv-editbox">
        <textarea className="ap-adv-edit-area" value={draft} autoFocus rows={3} onChange={(e) => setDraft(e.target.value)} />
        <div className="ap-adv-edit-actions">
          <button className="ap-adv-edit-save" onClick={() => { onSave(draft.trim()); setEditing(false); }}><FiCheck size={13} /> Salvar</button>
          <button className="ap-adv-edit-cancel" onClick={() => { setDraft(value); setEditing(false); }}><FiX size={13} /> Cancelar</button>
        </div>
      </div>
    );
  }
  return (
    <div className="ap-adv-editable">
      <p>{value || <span className="ap-adv-muted">{placeholder}</span>}</p>
      {canEdit && <button className="ap-adv-pencil" onClick={() => { setDraft(value); setEditing(true); }} aria-label="Editar"><FiEdit2 size={13} /></button>}
    </div>
  );
};

// Lista editável (valores como chips, objetivos numerados): editar item, remover, adicionar.
const EditableList: FC<{ items: string[]; chips?: boolean; canEdit: boolean; onSave: (items: string[]) => void }> = ({ items, chips, canEdit, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(items);
  if (!editing) {
    return (
      <div className="ap-adv-editable">
        {chips ? (
          <div className="ap-adv-chips">{items.map((v, i) => <span className="ap-adv-chip" key={i}>{v}</span>)}</div>
        ) : (
          <ol className="ap-adv-objs">{items.map((o, i) => <li key={i}><span className="ap-adv-objnum">{String(i + 1).padStart(2, '0')}</span><span>{o}</span></li>)}</ol>
        )}
        {canEdit && <button className="ap-adv-pencil" onClick={() => { setDraft(items); setEditing(true); }} aria-label="Editar"><FiEdit2 size={13} /></button>}
      </div>
    );
  }
  return (
    <div className="ap-adv-editbox">
      {draft.map((it, i) => (
        <div className="ap-adv-edit-row" key={i}>
          <input className="ap-adv-edit-input" value={it} onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? e.target.value : x)))} />
          <button className="ap-adv-row-del" onClick={() => setDraft((d) => d.filter((_, j) => j !== i))} aria-label="Remover"><FiTrash2 size={13} /></button>
        </div>
      ))}
      <button className="ap-adv-row-add" onClick={() => setDraft((d) => [...d, ''])}><FiPlus size={13} /> Adicionar</button>
      <div className="ap-adv-edit-actions">
        <button className="ap-adv-edit-save" onClick={() => { onSave(draft.map((s) => s.trim()).filter(Boolean)); setEditing(false); }}><FiCheck size={13} /> Salvar</button>
        <button className="ap-adv-edit-cancel" onClick={() => { setDraft(items); setEditing(false); }}><FiX size={13} /> Cancelar</button>
      </div>
    </div>
  );
};

// Modo avançado do Plano de Ação: dossiê completo (Identidade, Objetivos, SWOT, Estratégias,
// Resumo, Histórico). Leitura sóbria/editorial — tipografia + dividers, ícones de linha cinza,
// sem cor decorativa. As Estratégias são EDITÁVEIS (check, editar texto/prazo, remover, adicionar
// via Nyta ou manual), reaproveitando os handlers do ActionPlan (bundle `crud`).

export interface TaskCrud {
  today: string;
  canManage: boolean; // pode gerenciar tarefas (livre no plano gratuito p/ o dono); false = leitura
  canUseNyta: boolean; // "Pedir ideias pra Nyta" (IA) é recurso PRO
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

// Campos de texto plano + os 3 horizontes do posicionamento — usados no modo de edição.
const REF_TEXT_FIELDS: { key: 'artisticas' | 'comunicacao' | 'gestao'; label: string }[] = [
  { key: 'artisticas', label: 'Artísticas' },
  { key: 'comunicacao', label: 'Comunicação com o público' },
  { key: 'gestao', label: 'Carreira' },
];
const REF_POS_FIELDS: { key: 'curto' | 'medio' | 'longo'; label: string }[] = [
  { key: 'curto', label: 'Curto prazo (1 ano)' },
  { key: 'medio', label: 'Médio prazo (3 anos)' },
  { key: 'longo', label: 'Longo prazo (+5 anos)' },
];

const ReferenceMap: FC<{ references?: ArtistReferences; canEdit?: boolean; onSave?: (refs: ArtistReferences) => void }> = ({ references, canEdit, onSave }) => {
  const refs = references || {};
  const pos = refs.posicionamento || {};
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ArtistReferences>(refs);

  // Modo edição: formulário com os 3 textos planos + os 3 horizontes do posicionamento.
  if (editing) {
    const dpos = draft.posicionamento || {};
    return (
      <div className="ap-adv-editbox">
        <div>
          <span className="ap-adv-field-label">Posicionamento</span>
          {REF_POS_FIELDS.map((f) => (
            <div key={f.key} style={{ marginTop: 8 }}>
              <span className="ap-adv-ref-sub">{f.label}</span>
              <textarea
                className="ap-adv-edit-area"
                rows={2}
                value={dpos[f.key] || ''}
                onChange={(e) => setDraft((d) => ({ ...d, posicionamento: { ...(d.posicionamento || {}), [f.key]: e.target.value } }))}
              />
            </div>
          ))}
        </div>
        {REF_TEXT_FIELDS.map((f) => (
          <div key={f.key}>
            <span className="ap-adv-field-label">{f.label}</span>
            <textarea
              className="ap-adv-edit-area"
              rows={2}
              style={{ marginTop: 6 }}
              value={draft[f.key] || ''}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
            />
          </div>
        ))}
        <p className="ap-adv-note">Separe várias referências por vírgula, ponto-e-vírgula ou quebra de linha.</p>
        <div className="ap-adv-edit-actions">
          <button className="ap-adv-edit-save" onClick={() => { onSave?.(draft); setEditing(false); }}><FiCheck size={13} /> Salvar</button>
          <button className="ap-adv-edit-cancel" onClick={() => { setDraft(refs); setEditing(false); }}><FiX size={13} /> Cancelar</button>
        </div>
      </div>
    );
  }

  const itemsFor = (key: (typeof REF_QUADRANTS)[number]['key']): string[] =>
    key === 'posicionamento'
      ? [pos.curto, pos.medio, pos.longo].flatMap(splitRefItems)
      : splitRefItems(refs[key as 'artisticas' | 'comunicacao' | 'gestao']);
  return (
    <div style={{ position: 'relative' }}>
      {canEdit && (
        <button className="ap-adv-pencil" onClick={() => { setDraft(refs); setEditing(true); }} aria-label="Editar referências" style={{ position: 'absolute', top: -2, right: -2, zIndex: 2 }}><FiEdit2 size={13} /></button>
      )}
      <div className="ap-adv-refmap">
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
        className="ap-adv-refmap-hub"
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

export const AdvancedPlan: FC<{
  content: ArtistContent;
  ranked: Strategy[];
  // Bundle de CRUD das tarefas. Sem ele (ex.: página de Perfil), a seção editável "Estratégias"
  // não é renderizada — o Perfil mostra só o dossiê (Fundamentos/Referências/Objetivos/SWOT/Prioridade).
  crud?: TaskCrud;
  // Salva edições do dossiê (merge raso no content). canEdit = pode editar (dono pago/PRO).
  onSaveContent?: (patch: Partial<ArtistContent>) => void;
  canEdit?: boolean;
}> = ({ content, ranked, crud, onSaveContent, canEdit = false }) => {
  const id = content.identity || {};
  const swot = content.swotAnalysis;
  const objectives = content.objectives || [];
  const canEditId = canEdit && !!onSaveContent;
  const saveId = (patch: Partial<ArtistContent['identity']>) => onSaveContent?.({ identity: { ...id, ...patch } });
  const hasIdentity = !!(id.genre || id.vision || id.mission || id.bio || id.values?.length);
  const hasReferences = refHasItems(id.references);

  return (
    <div className="ap-adv">
      {(hasIdentity || canEditId) && (
        <Section title="Fundamentos">
          <div className="ap-adv-id">
            {(id.genre || canEditId) && (
              <div className="ap-adv-block">
                <span className="ap-adv-field-label">Gênero</span>
                <EditableText value={id.genre || ''} placeholder="Sem gênero definido" canEdit={canEditId} onSave={(v) => saveId({ genre: v })} />
              </div>
            )}
            {(id.vision || canEditId) && (
              <div className="ap-adv-block">
                <span className="ap-adv-field-label">Visão</span>
                <EditableText value={id.vision || ''} placeholder="Sem visão definida" canEdit={canEditId} onSave={(v) => saveId({ vision: v })} />
              </div>
            )}
            {(id.mission || canEditId) && (
              <div className="ap-adv-block">
                <span className="ap-adv-field-label">Missão</span>
                <EditableText value={id.mission || ''} placeholder="Sem missão definida" canEdit={canEditId} onSave={(v) => saveId({ mission: v })} />
              </div>
            )}
            {(id.bio || canEditId) && (
              <div className="ap-adv-block">
                <span className="ap-adv-field-label">Bio</span>
                <EditableText value={id.bio || ''} placeholder="Sem bio" canEdit={canEditId} onSave={(v) => saveId({ bio: v })} />
              </div>
            )}
            {(!!id.values?.length || canEditId) && (
              <div className="ap-adv-block">
                <span className="ap-adv-field-label">Valores</span>
                <EditableList items={id.values || []} chips canEdit={canEditId} onSave={(items) => saveId({ values: items })} />
              </div>
            )}
          </div>
        </Section>
      )}

      {(hasReferences || canEditId) && (
        <Section title="Mapa de referências">
          <ReferenceMap references={id.references} canEdit={canEditId} onSave={(refs) => saveId({ references: refs })} />
        </Section>
      )}

      {(!!objectives.length || canEditId) && (
        <Section title="Objetivos">
          <EditableList items={objectives} canEdit={canEditId} onSave={(items) => onSaveContent?.({ objectives: items })} />
          {canEditId && <p className="ap-adv-note">Editar os objetivos aqui não altera as estratégias já criadas. Para uma nova estratégia alinhada a um objetivo, use “Nova estratégia”.</p>}
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

      {crud && !!ranked.length && (
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
                      canUseNyta={crud.canUseNyta}
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
