import { FC, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { App, DatePicker, Input, Select } from 'antd';
import dayjs from 'dayjs';
import { FiCheck, FiEdit3, FiPlus, FiRefreshCw, FiTrash2, FiX } from 'react-icons/fi';

import { listGenres } from '../../../services/db/genres';
import { searchCities } from '../../../services/db/cities';
import { TASK_OWNER_SELF, MAX_OBJECTIVES } from '../../../constants/maestra';
import { AiButton, ghostBtn, primaryBtn } from '../components';
import { SuccessConfetti } from '../../../components/SuccessConfetti';
import { normalizeQuizQuestion } from '../types';
import {
  ADJETIVO_SEEDS,
  GENDER_OPTIONS,
  MISSION_FINANCIAL_OPTIONS,
  STAGE_OPTIONS,
  SUBSTANTIVO_OPTIONS,
  VISION_ONDE_OPTIONS,
  VISION_PORQUEM_OPTIONS,
  flex,
  seedValues,
} from './wizardData';
import { SAY } from './nytaPersona';
import { SWOT_INTERNAL } from '../method/swotItems';
import { generateObjectives } from '../method/engines';
import { stripEmDash } from '../clean';
import type {
  ActionTask,
  ArtistGender,
  ArtistIdentity,
  ArtistStage,
  MissionFinancialTier,
  MissionParts,
  QuizQuestion,
  ReferenceHorizons as ReferenceHorizonsData,
  SpotifyProfile,
  Strategy,
  SwotAnalysis,
} from '../../../interfaces/maestra';

// Widgets interativos renderizados dentro do chat da Nyta. Cada um coleta uma resposta
// estruturada e devolve via callback — o orquestrador (NytaChat) ecoa a resposta como
// mensagem do usuário e persiste no draft.

const uid = () => Math.random().toString(36).slice(2, 10);

// ---- Gênero musical ----------------------------------------------------------------------------

export const GenreChips: FC<{
  sp?: SpotifyProfile;
  // Metodologia v2, Q2: gêneros (principal + secundários) vindos da Chartmetric. Vêm pré-selecionados.
  cmGenres?: string[];
  onConfirm: (genres: string[]) => void;
}> = ({ sp, cmGenres, onConfirm }) => {
  const [options, setOptions] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string[]>(() => cmGenres || []);

  useEffect(() => {
    listGenres()
      .then((g) => setOptions(g.map((x) => x.name)))
      .catch(() => setOptions([]));
  }, []);

  // Todos os gêneros visíveis como bolhas: os da Chartmetric e os do Spotify primeiro,
  // depois a lista curada (sem duplicar, case-insensitive).
  const allGenres = useMemo(() => {
    const map = new Map<string, string>();
    [...(cmGenres || []), ...(sp?.genres || []), ...(options || [])].forEach((g) => {
      if (g) map.set(g.toLowerCase(), g);
    });
    return Array.from(map.values());
  }, [options, sp?.genres, cmGenres]);

  const toggle = (g: string) =>
    setSelected((sel) => {
      const has = sel.some((x) => x.toLowerCase() === g.toLowerCase());
      return has ? sel.filter((x) => x.toLowerCase() !== g.toLowerCase()) : [...sel, g];
    });

  return (
    <div className='nyta-card'>
      <div className='wiz-card-title'>Seu estilo musical</div>
      {options === null ? (
        <p style={{ color: '#b3b3b3', margin: 0, fontSize: 14 }}>Carregando gêneros…</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {allGenres.map((g, i) => {
            const active = selected.some((x) => x.toLowerCase() === g.toLowerCase());
            return (
              <button
                key={g}
                className={`wiz-genre-chip${active ? ' wiz-genre-chip--active' : ''}`}
                style={{ animationDelay: `${Math.min(i * 25, 600)}ms` }}
                onClick={() => toggle(g)}
              >
                {g}
              </button>
            );
          })}
        </div>
      )}
      <div className='nyta-card-actions'>
        {!!selected.length && (
          <span style={{ color: '#b3b3b3', fontSize: 13, alignSelf: 'center' }}>
            {selected.length} selecionado{selected.length > 1 ? 's' : ''}
          </span>
        )}
        <button
          style={{ ...primaryBtn, marginLeft: 'auto', opacity: selected.length ? 1 : 0.5 }}
          disabled={!selected.length}
          onClick={() => onConfirm(selected)}
        >
          Confirmar
        </button>
      </div>
    </div>
  );
};

// ---- Escolha única (genérico) ------------------------------------------------------------------

// Lista de opções como pílulas; clicar confirma na hora (sem botão extra). Usado na abertura
// (gênero gramatical, estágio) e na Visão (onde). Opcionalmente um campo livre ("outro").
const SingleChoiceCard: FC<{
  options: { value: string; label: string }[];
  onConfirm: (value: string) => void;
  custom?: { placeholder: string };
  title?: string;
}> = ({ options, onConfirm, custom, title }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  return (
    <div className='nyta-card'>
      {title && <div className='wiz-card-title'>{title}</div>}
      <div className='wiz-option-grid'>
        {options.map((o, i) => (
          <button
            key={o.value}
            className='wiz-option-pill'
            style={{ animationDelay: `${i * 50}ms` }}
            onClick={() => onConfirm(o.value)}
          >
            {o.label}
          </button>
        ))}
        {custom && (
          <button className='wiz-option-pill wiz-option-pill--custom' onClick={() => setOpen((v) => !v)}>
            <FiEdit3 size={14} /> Outro
          </button>
        )}
      </div>
      {custom && open && (
        <div className='wiz-custom-row'>
          <input
            className='wiz-custom-input'
            autoFocus
            value={text}
            placeholder={custom.placeholder}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && text.trim()) {
                e.preventDefault();
                onConfirm(text.trim());
              }
            }}
          />
          <button
            style={{ ...primaryBtn, padding: '8px 16px', opacity: text.trim() ? 1 : 0.5 }}
            disabled={!text.trim()}
            onClick={() => onConfirm(text.trim())}
          >
            Usar
          </button>
        </div>
      )}
    </div>
  );
};

// "Explique-me melhor" (Metodologia v2, Q1): texto de apoio colapsável sobre por que tratar a
// carreira como um negócio. Aparece junto da primeira pergunta.
export const ExplainMore: FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 10 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'transparent',
          border: '1px solid #2a2a2a',
          borderRadius: 9999,
          color: '#b3b3b3',
          fontSize: 12.5,
          fontWeight: 600,
          padding: '6px 14px',
          cursor: 'pointer',
        }}
      >
        {open ? 'Ocultar' : 'Explique-me melhor'}
      </button>
      {open && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SAY.explainMore().map((p, i) => (
            <p key={i} style={{ color: '#b3b3b3', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
              {p}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

export const GenderChoice: FC<{ onConfirm: (g: ArtistGender) => void }> = ({ onConfirm }) => (
  <div>
    <ExplainMore />
    <SingleChoiceCard
      options={GENDER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
      onConfirm={(v) => onConfirm(v as ArtistGender)}
    />
  </div>
);

export const StageChoice: FC<{ onConfirm: (s: ArtistStage) => void }> = ({ onConfirm }) => (
  <SingleChoiceCard
    options={STAGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
    onConfirm={(v) => onConfirm(v as ArtistStage)}
    custom={{ placeholder: 'Descrever o meu momento…' }}
  />
);

// ---- Visão (fórmula por partes) ----------------------------------------------------------------

export const VisionOndeChoice: FC<{ onConfirm: (value: string) => void }> = ({ onConfirm }) => (
  <SingleChoiceCard
    title='Até onde você quer chegar'
    options={VISION_ONDE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
    onConfirm={onConfirm}
    custom={{ placeholder: 'Outro alcance…' }}
  />
);

// Q2 — múltipla escolha, teto 2 (+ campo livre). Devolve os rótulos escolhidos (etiquetas derivadas fora).
export const VisionPorQuemChoice: FC<{ onConfirm: (labels: string[]) => void }> = ({ onConfirm }) => {
  // O `message` estático do antd é no-op dentro do <App> (não renderiza). Pega a instância do
  // contexto pra o toast realmente aparecer — mesmo padrão do bloqueio de criar perfil.
  const { message: toast } = App.useApp();
  const [sel, setSel] = useState<string[]>([]);
  const MAX = 2;
  // Ao tentar passar de 2, mostra um toast. Checa FORA do updater (sem efeito colateral no reducer).
  // `key` fixa evita empilhar vários toasts iguais em cliques repetidos (atualiza o mesmo).
  const warnLimit = () => toast.warning({ content: 'Você pode escolher até 2 opções. Desmarque uma para trocar.', key: 'vision-porquem-max' });
  const toggle = (label: string) => {
    if (!sel.includes(label) && sel.length >= MAX) { warnLimit(); return; }
    setSel((s) => (s.includes(label) ? s.filter((x) => x !== label) : [...s, label]));
  };
  const addOwn = (t: string) => {
    if (sel.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    if (sel.length >= MAX) { warnLimit(); return; }
    setSel((s) => [...s, t]);
  };
  const custom = sel.filter((s) => !VISION_PORQUEM_OPTIONS.some((o) => o.label === s));
  const atMax = sel.length >= MAX;
  return (
    <div className='nyta-card'>
      <div className='wiz-card-title'>Seus sinais de reconhecimento</div>
      <div style={{ color: '#7d7d7d', fontSize: 12, marginBottom: 8 }}>Escolha até 2 opções (as que mais traduzem o que você sente).</div>
      <div className='wiz-option-grid'>
        {VISION_PORQUEM_OPTIONS.map((o, i) => {
          const active = sel.includes(o.label);
          return (
            <button
              key={o.label}
              className={`wiz-option-pill${active ? ' wiz-option-pill--selected' : ''}`}
              style={{ animationDelay: `${i * 40}ms` }}
              onClick={() => toggle(o.label)}
            >
              {active && (
                <span className='wiz-option-check'>
                  <FiCheck size={14} />
                </span>
              )}
              {o.label}
            </button>
          );
        })}
        {custom.map((c) => (
          <button key={c} className='wiz-option-pill wiz-option-pill--selected' onClick={() => toggle(c)} title='Toque para remover'>
            <span className='wiz-option-check'>
              <FiCheck size={14} />
            </span>
            {c}
          </button>
        ))}
      </div>
      <AddOwnField placeholder='Escrever do meu jeito…' label='Escrever do meu jeito' onAdd={addOwn} />
      <div className='nyta-card-actions'>
        <span style={{ color: atMax ? '#f59e0b' : '#b3b3b3', fontSize: 13, fontWeight: atMax ? 700 : 400, alignSelf: 'center' }}>{sel.length}/{MAX}</span>
        <button
          style={{ ...primaryBtn, marginLeft: 'auto', opacity: sel.length ? 1 : 0.5 }}
          disabled={!sel.length}
          onClick={() => onConfirm(sel)}
        >
          Confirmar
        </button>
      </div>
    </div>
  );
};

// Campo "escrever o meu" COLAPSADO: por padrão mostra só um botão "+"; ao clicar, abre o input
// (autofocus). Some de volta após adicionar (ou se sair vazio). Evita o campo competir visualmente
// com as opções (usuário leigo achava que o campo era a ação principal). Usado em todos os widgets
// de escolha com opção de adicionar o próprio item.
const AddOwnField: FC<{ placeholder: string; label: string; onAdd: (value: string) => void }> = ({ placeholder, label, onAdd }) => {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState('');
  const commit = () => {
    const t = val.trim();
    if (t) onAdd(t);
    setVal('');
    setOpen(false);
  };
  if (!open) {
    return (
      <button
        type='button'
        onClick={() => setOpen(true)}
        style={{ ...ghostBtn, marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px' }}
      >
        <FiPlus size={15} /> {label}
      </button>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
      <Input
        autoFocus
        placeholder={placeholder}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onPressEnter={commit}
        onBlur={() => { if (!val.trim()) setOpen(false); }}
      />
      <button style={{ ...ghostBtn, padding: '8px 14px' }} onClick={commit}>
        <FiPlus />
      </button>
    </div>
  );
};

// Múltipla escolha (chips) + campo livre. Junta os escolhidos numa string (ex.: "cantor e compositor").
const MultiChoiceCard: FC<{
  options: string[];
  placeholder: string;
  title?: string;
  joiner?: string;
  onConfirm: (joined: string) => void;
}> = ({ options, placeholder, title, joiner = ' e ', onConfirm }) => {
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (o: string) => setSel((s) => (s.includes(o) ? s.filter((x) => x !== o) : [...s, o]));
  const addOwn = (t: string) =>
    setSel((s) => (s.some((x) => x.toLowerCase() === t.toLowerCase()) ? s : [...s, t]));
  const custom = sel.filter((s) => !options.includes(s));
  return (
    <div className='nyta-card'>
      {title && <div className='wiz-card-title'>{title}</div>}
      <div className='wiz-option-grid'>
        {options.map((o, i) => {
          const active = sel.includes(o);
          return (
            <button
              key={o}
              className={`wiz-option-pill${active ? ' wiz-option-pill--selected' : ''}`}
              style={{ animationDelay: `${i * 40}ms` }}
              onClick={() => toggle(o)}
            >
              {active && (
                <span className='wiz-option-check'>
                  <FiCheck size={14} />
                </span>
              )}
              {o}
            </button>
          );
        })}
        {custom.map((c) => (
          <button key={c} className='wiz-option-pill wiz-option-pill--selected' onClick={() => toggle(c)} title='Toque para remover'>
            <span className='wiz-option-check'>
              <FiCheck size={14} />
            </span>
            {c}
          </button>
        ))}
      </div>
      <AddOwnField placeholder={placeholder} label='Escrever o meu' onAdd={addOwn} />
      <div className='nyta-card-actions'>
        <button
          style={{ ...primaryBtn, marginLeft: 'auto', opacity: sel.length ? 1 : 0.5 }}
          disabled={!sel.length}
          onClick={() => onConfirm(sel.join(joiner))}
        >
          Confirmar
        </button>
      </div>
    </div>
  );
};

// Q3 — substantivo (múltipla escolha flexionada + campo livre).
export const VisionSubstantivoChoice: FC<{ gender?: ArtistGender; onConfirm: (value: string) => void }> = ({ gender, onConfirm }) => (
  <MultiChoiceCard title='Como você se define' options={SUBSTANTIVO_OPTIONS.map((s) => flex(gender, s))} placeholder='Como você se define…' onConfirm={onConfirm} />
);

// Q4 — atributo (múltipla escolha seedada + campo livre).
export const VisionAdjetivoChoice: FC<{ onConfirm: (value: string) => void }> = ({ onConfirm }) => (
  <MultiChoiceCard title='Seu atributo' options={ADJETIVO_SEEDS} placeholder='Escreva o seu atributo…' onConfirm={onConfirm} />
);

// ---- Referências de posicionamento (3 horizontes — Metodologia v2, Q5) -------------------------

const HORIZON_FIELDS: { key: keyof ReferenceHorizonsData; label: string; question: string }[] = [
  { key: 'curto', label: 'Curto prazo · 1 ano', question: 'Daqui a 1 ano, com quais artistas você quer estar disputando espaço?' },
  { key: 'medio', label: 'Médio prazo · 3 anos', question: 'E em 3 anos, com quem você quer dividir palco e playlist?' },
  { key: 'longo', label: 'Longo prazo · +5 anos', question: 'Lá na frente, +5 anos: qual o tamanho do sonho? Com quem você quer estar lado a lado?' },
];

// Uma pergunta por vez (stepper): cada horizonte (curto/médio/longo) usa o MESMO formato dos outros
// seletores do wizard (MultiChoiceCard) — pills selecionáveis dos relacionados no Spotify + campo pra
// escrever o seu. Mantém o contrato {curto,medio,longo} (strings), montado no fim.
export const ReferenceHorizons: FC<{
  onConfirm: (h: ReferenceHorizonsData) => void;
}> = ({ onConfirm }) => {
  const [step, setStep] = useState(0);
  const [sel, setSel] = useState<Record<string, string[]>>({ curto: [], medio: [], longo: [] });
  const [own, setOwn] = useState('');

  const field = HORIZON_FIELDS[step];
  const chosen = sel[field.key] || [];
  const isLast = step === HORIZON_FIELDS.length - 1;
  // Removidas as sugestões do Spotify (vinham internacionais/irrelevantes p/ artista BR). Só o que
  // o artista digita — mostrado como pills removíveis.
  const customPills = chosen;

  const parseNames = (txt: string) => txt.split(',').map((x) => x.trim()).filter(Boolean);
  const toggle = (name: string) =>
    setSel((s) => {
      const cur = s[field.key] || [];
      return { ...s, [field.key]: cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name] };
    });
  const mergeOwn = (base: Record<string, string[]>) => {
    const ns = parseNames(own);
    if (!ns.length) return base;
    const cur = base[field.key] || [];
    const merged = [...cur];
    ns.forEach((p) => { if (!merged.some((x) => x.toLowerCase() === p.toLowerCase())) merged.push(p); });
    return { ...base, [field.key]: merged };
  };
  const addNames = (names: string[]) =>
    setSel((s) => {
      const cur = s[field.key] || [];
      const merged = [...cur];
      names.forEach((p) => { if (p && !merged.some((x) => x.toLowerCase() === p.toLowerCase())) merged.push(p); });
      return { ...s, [field.key]: merged };
    });
  // Sem botão "+": o campo é a única forma de adicionar. Enter adiciona o que está escrito; digitar
  // vírgula também (o trecho após a última vírgula continua no campo).
  const addOwn = () => { if (!own.trim()) return; addNames(parseNames(own)); setOwn(''); };
  const onInputChange = (raw: string) => {
    if (!raw.includes(',')) { setOwn(raw); return; }
    const parts = raw.split(',');
    const trailing = parts.pop() ?? '';
    addNames(parts.map((x) => x.trim()).filter(Boolean));
    setOwn(trailing);
  };
  // O que estiver digitado também conta ao avançar (sem precisar adicionar antes).
  const canNext = chosen.length > 0 || !!own.trim();
  const next = () => {
    if (!canNext) return;
    const s2 = mergeOwn(sel);
    if (own.trim()) { setSel(s2); setOwn(''); }
    if (isLast) onConfirm({ curto: s2.curto.join(', '), medio: s2.medio.join(', '), longo: s2.longo.join(', ') });
    else setStep((n) => n + 1);
  };

  return (
    <div className='nyta-card'>
      <div className='wiz-card-title'>Referências de posicionamento</div>
      {/* Progresso (3 horizontes) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {HORIZON_FIELDS.map((f, i) => (
          <div key={f.key} style={{ height: 4, flex: 1, borderRadius: 2, background: i <= step ? '#af2896' : '#3a3a3a', transition: 'background .25s' }} />
        ))}
      </div>

      <div style={{ color: '#7d7d7d', fontSize: 12, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 6 }}>
        Passo {step + 1} de {HORIZON_FIELDS.length} · {field.label}
      </div>
      <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, lineHeight: 1.4, marginBottom: 14 }}>{field.question}</div>

      {/* Só o campo de digitar. O artista escreve os nomes (vírgula separa vários); cada um vira uma
          pill removível. (Removidas as sugestões do Spotify — vinham internacionais/irrelevantes.) */}
      <div style={{ color: '#7d7d7d', fontSize: 12, marginBottom: 8 }}>Digite um nome e tecle Enter para adicionar. Toque numa pill pra remover.</div>
      {customPills.length > 0 && (
        <div className='wiz-option-grid' style={{ marginBottom: 4 }}>
          {customPills.map((c) => (
            <button key={c} className='wiz-option-pill wiz-option-pill--selected' onClick={() => toggle(c)} title='Toque para remover'>
              <span className='wiz-option-check'><FiCheck size={14} /></span>
              {c}
            </button>
          ))}
        </div>
      )}
      <Input
        style={{ marginTop: 8 }}
        placeholder='Digite um nome e tecle Enter…'
        value={own}
        onChange={(e) => onInputChange(e.target.value)}
        onPressEnter={addOwn}
      />

      <div className='nyta-card-actions'>
        {step > 0 && (
          <button style={ghostBtn} onClick={() => setStep((n) => Math.max(0, n - 1))}>Voltar</button>
        )}
        <button
          style={{ ...primaryBtn, marginLeft: 'auto', opacity: canNext ? 1 : 0.5 }}
          disabled={!canNext}
          onClick={next}
        >
          {isLast ? 'Concluir' : 'Próximo'}
        </button>
      </div>
    </div>
  );
};

// ---- Mapa de referências (mind-map — Metodologia v2, Q6/Q13) -----------------------------------

const splitRefItems = (s?: string): string[] =>
  (s || '').split(/[,;\n·]+/).map((x) => x.trim()).filter(Boolean);

// Quadrantes do mapa mental (posições no grid 2x2 + cor do cabeçalho).
const REF_QUADRANTS: {
  key: 'posicionamento' | 'artisticas' | 'comunicacao' | 'gestao';
  label: string;
  color: string;
  pos: 'tl' | 'tr' | 'bl' | 'br';
}[] = [
  { key: 'posicionamento', label: 'Posicionamento', color: '#3b82f6', pos: 'tl' },
  { key: 'artisticas', label: 'Artísticas', color: '#eab308', pos: 'tr' },
  { key: 'comunicacao', label: 'Comunicação com o público', color: '#f97316', pos: 'bl' },
  { key: 'gestao', label: 'Carreira', color: '#ef4444', pos: 'br' },
];

export const ReferenceMapCard: FC<{ references?: ArtistIdentity['references'] }> = ({ references }) => {
  const refs = references || {};
  const pos = refs.posicionamento || {};
  const itemsFor = (key: (typeof REF_QUADRANTS)[number]['key']): string[] => {
    if (key === 'posicionamento') return [pos.curto, pos.medio, pos.longo].flatMap(splitRefItems);
    return splitRefItems(refs[key as 'artisticas' | 'comunicacao' | 'gestao']);
  };
  const Quadrant: FC<{ q: (typeof REF_QUADRANTS)[number] }> = ({ q }) => {
    const items = itemsFor(q.key);
    return (
      <div style={{ background: '#0e0e0e', border: `1px solid ${q.color}40`, borderRadius: 10, overflow: 'hidden' }}>
        <div
          style={{
            background: q.color,
            color: '#0b0b0b',
            fontWeight: 800,
            fontSize: 11,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            padding: '6px 10px',
            textAlign: 'center',
          }}
        >
          {q.label}
        </div>
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 3, minHeight: 58 }}>
          {items.length ? (
            items.map((it, i) => (
              <span key={i} style={{ color: '#e8e8e8', fontSize: 12.5, borderBottom: '1px solid #1a1a1a', paddingBottom: 3 }}>
                {it}
              </span>
            ))
          ) : (
            <span style={{ color: '#6b7280', fontSize: 12 }}>—</span>
          )}
        </div>
      </div>
    );
  };
  const byPos = (p: 'tl' | 'tr' | 'bl' | 'br') => REF_QUADRANTS.find((q) => q.pos === p)!;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: '#fff', fontWeight: 800, fontSize: 13, marginBottom: 10 }}>Seu mapa de referências</div>
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Quadrant q={byPos('tl')} />
          <Quadrant q={byPos('tr')} />
          <Quadrant q={byPos('bl')} />
          <Quadrant q={byPos('br')} />
        </div>
        {/* Hub central do mapa mental */}
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
    </div>
  );
};

// ---- Cidade/UF + mapa de referências (Metodologia v2, Q6) --------------------------------------

// Dropdown de cidade (busca na tabela br_cities) com preenchimento automático da UF. Ao escolher,
// devolve cidade + UF. Tem fallback manual caso o local não esteja na base do IBGE.
const CitySelect: FC<{ onPick: (city: string, uf: string) => void }> = ({ onPick }) => {
  const [opts, setOpts] = useState<{ value: string; label: string; city: string; uf: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSearch = (text: string) => {
    if (tRef.current) clearTimeout(tRef.current);
    if (text.trim().length < 2) {
      setOpts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    tRef.current = setTimeout(async () => {
      const cities = await searchCities(text);
      setOpts(
        cities.map((c) => ({ value: `${c.name}|${c.uf}`, label: `${c.name}, ${c.uf}`, city: c.name, uf: c.uf }))
      );
      setLoading(false);
    }, 300);
  };

  return (
    <Select
      showSearch
      size='large'
      filterOption={false}
      className='wiz-city-select'
      popupClassName='wiz-city-dropdown'
      placeholder='Digite sua cidade…'
      onSearch={onSearch}
      notFoundContent={loading ? 'Buscando…' : null}
      options={opts}
      style={{ width: '100%' }}
      onChange={(val) => {
        const o = opts.find((x) => x.value === val);
        if (o) onPick(o.city, o.uf);
      }}
    />
  );
};

// Card de cidade/UF (Metodologia v2, Q6) — exibido SEPARADO do mapa de referências (o mapa é
// mostrado inline pela Nyta antes desta pergunta). Dropdown com auto-UF + fallback manual.
export const CityInputCard: FC<{
  onConfirm: (city: string, state: string) => void;
}> = ({ onConfirm }) => {
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [manual, setManual] = useState(false);
  return (
    <div className='nyta-card'>
      {manual ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Input size='large' style={{ flex: 2, minWidth: 160 }} placeholder='Cidade' value={city} onChange={(e) => setCity(e.target.value)} />
          <Input size='large' style={{ flex: 1, minWidth: 70 }} placeholder='UF' maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} />
        </div>
      ) : (
        <CitySelect
          onPick={(c, u) => {
            setCity(c);
            setState(u);
          }}
        />
      )}
      <div className='nyta-card-actions' style={{ alignItems: 'center' }}>
        <button
          style={{ background: 'none', border: 'none', color: '#7a7a7a', fontSize: 12, cursor: 'pointer', padding: 0 }}
          onClick={() => {
            setManual((m) => !m);
            setCity('');
            setState('');
          }}
        >
          {manual ? '← Buscar na lista' : 'Não achou? Preencher manualmente'}
        </button>
        <button
          style={{
            ...primaryBtn,
            marginLeft: 'auto',
            ...(city.trim()
              ? {}
              : { background: '#2a2a2a', color: '#6b7280', cursor: 'not-allowed' }),
          }}
          disabled={!city.trim()}
          onClick={() => city.trim() && onConfirm(city.trim(), state.trim())}
        >
          Continuar
        </button>
      </div>
    </div>
  );
};

// ---- Missão: tier financeiro (Metodologia v2, Q12) ---------------------------------------------

export const MissionFinancialChoice: FC<{ onConfirm: (tier: MissionFinancialTier) => void }> = ({ onConfirm }) => (
  <div className='nyta-card'>
    <div className='wiz-card-title'>O retorno que você quer</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {MISSION_FINANCIAL_OPTIONS.map((o, i) => (
        <button
          key={o.value}
          className='wiz-option-pill'
          style={{ textAlign: 'left', animationDelay: `${i * 50}ms` }}
          onClick={() => onConfirm(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
);

// ---- Revisão de frase montada (visão / missão) -------------------------------------------------

const ReviewCard: FC<{ title: string; text: string; onConfirm: (text: string) => void }> = ({ title, text, onConfirm }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(text);
  useEffect(() => setVal(text), [text]);
  return (
    <div className='nyta-card'>
      <div style={{ color: '#b3b3b3', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {title}
      </div>
      {editing ? (
        <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} value={val} onChange={(e) => setVal(e.target.value)} autoFocus />
      ) : (
        <p style={{ color: '#fff', fontSize: 15, lineHeight: 1.6, margin: 0, fontWeight: 600 }}>{val}</p>
      )}
      <div className='nyta-card-actions'>
        <button style={ghostBtn} onClick={() => setEditing((e) => !e)}>
          {editing ? 'Pronto' : 'Quero ajustar'}
        </button>
        <button style={{ ...primaryBtn, marginLeft: 'auto', opacity: val.trim() ? 1 : 0.5 }} disabled={!val.trim()} onClick={() => onConfirm(val.trim())}>
          Faz sentido, seguir
        </button>
      </div>
    </div>
  );
};

export const VisionReviewCard: FC<{ text: string; onConfirm: (text: string) => void }> = (p) => (
  <ReviewCard title='Sua visão' {...p} />
);
export const MissionReviewCard: FC<{ text: string; onConfirm: (text: string) => void }> = (p) => (
  <ReviewCard title='Sua missão' {...p} />
);

// ---- Visão / Missão com sugestão da IA ---------------------------------------------------------

// "Sugerir com IA" não gera direto: dispara a mini-entrevista da Nyta (perguntas guiadas);
// a IA compõe a versão final a partir das respostas do usuário.
export const TextPromptHelper: FC<{
  onStart: () => void;
}> = ({ onStart }) => (
  <div>
    <AiButton small onClick={onStart}>
      Me ajuda a responder
    </AiButton>
    <p style={{ color: '#6b7280', fontSize: 12, margin: '8px 0 0' }}>
      A Nyta te faz umas perguntas e monta a resposta. Ou escreva do seu jeito no campo abaixo.
    </p>
  </div>
);

// Proposta composta pela IA ao fim da mini-entrevista: o resultado fica em destaque (editável),
// com um botão primário CLARO para seguir e a opção de refazer as perguntas.
export const ProposalPick: FC<{
  text: string;
  onUse: (text: string) => void;
  onRedo: () => void;
}> = ({ text, onUse, onRedo }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(text);
  useEffect(() => setVal(text), [text]);
  return (
    <div className='nyta-card'>
      {editing ? (
        <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} value={val} onChange={(e) => setVal(e.target.value)} autoFocus />
      ) : (
        <p style={{ color: '#fff', fontSize: 15, lineHeight: 1.6, margin: 0, fontWeight: 600 }}>{val}</p>
      )}
      <div className='nyta-card-actions' style={{ flexWrap: 'wrap', gap: 8 }}>
        <button style={ghostBtn} onClick={onRedo}>
          <FiRefreshCw size={13} style={{ marginRight: 6 }} /> Refazer perguntas
        </button>
        <button style={ghostBtn} onClick={() => setEditing((e) => !e)}>
          {editing ? 'Pronto' : 'Quero ajustar'}
        </button>
        <button
          style={{ ...primaryBtn, marginLeft: 'auto', opacity: val.trim() ? 1 : 0.5 }}
          disabled={!val.trim()}
          onClick={() => onUse(val.trim())}
        >
          Faz sentido, seguir
        </button>
      </div>
    </div>
  );
};

// ---- Valores do projeto ------------------------------------------------------------------------

// Chips seedados a partir da entrega da missão (Metodologia v2) — não é lista fixa. Teto 3–5.
export const ValueChips: FC<{
  seed?: string[];
  onConfirm: (values: string[]) => void;
}> = ({ seed, onConfirm }) => {
  const { message: toast } = App.useApp(); // `message` estático é no-op dentro do <App>
  const [options, setOptions] = useState<string[]>(() => (seed?.length ? seed : seedValues()).slice(0, 12));
  const [selected, setSelected] = useState<string[]>([]);
  const MAX = 5;
  const MIN = 3;

  const limitMsg = `Você já selecionou ${MAX} valores. Remova um para escolher outro.`;
  const toggle = (v: string) =>
    setSelected((sel) => {
      if (sel.includes(v)) return sel.filter((x) => x !== v);
      if (sel.length >= MAX) {
        toast.warning(limitMsg);
        return sel;
      }
      return [...sel, v];
    });

  const addOwn = (t: string) => {
    setOptions((opts) =>
      opts.some((o) => o.toLowerCase() === t.toLowerCase()) ? opts : [...opts, t]
    );
    setSelected((sel) => {
      if (sel.some((s) => s.toLowerCase() === t.toLowerCase())) return sel;
      if (sel.length >= MAX) {
        toast.warning(limitMsg);
        return sel;
      }
      return [...sel, t];
    });
  };

  return (
    <div className='nyta-card'>
      <div className='wiz-card-title'>Seus valores</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map((v, i) => {
          const active = selected.includes(v);
          return (
            <button
              key={v}
              className={`wiz-genre-chip${active ? ' wiz-genre-chip--active' : ''}`}
              style={{ animationDelay: `${Math.min(i * 30, 500)}ms` }}
              onClick={() => toggle(v)}
            >
              {v}
            </button>
          );
        })}
      </div>
      <AddOwnField placeholder='Escrever meu próprio valor…' label='Escrever meu valor' onAdd={addOwn} />
      <div className='nyta-card-actions'>
        <span style={{ color: '#b3b3b3', fontSize: 13, alignSelf: 'center' }}>
          {selected.length}/{MAX}
          {selected.length < MIN && `, escolha ao menos ${MIN}`}
        </span>
        <button
          style={{ ...primaryBtn, marginLeft: 'auto', opacity: selected.length >= MIN ? 1 : 0.5 }}
          disabled={selected.length < MIN}
          onClick={() => onConfirm(selected)}
        >
          Confirmar valores
        </button>
      </div>
    </div>
  );
};

// ---- Objetivos (determinístico; cap 5, financeiro sem trava — Metodologia v2) -------------------

export const ObjectiveChips: FC<{
  identity: ArtistIdentity;
  missionParts: MissionParts;
  onConfirm: (objectives: string[]) => void;
}> = ({ identity, missionParts, onConfirm }) => {
  const { message: toast } = App.useApp(); // `message` estático é no-op dentro do <App>
  // Universo determinístico oferecido pela Nyta (Fontes 1–4, dedup). Sem IA, sem rede.
  const universe = useMemo(() => generateObjectives(identity, missionParts), [identity, missionParts]);
  const [options, setOptions] = useState<string[]>(universe);
  // Começa com até MAX_OBJECTIVES marcados (o artista tira/troca o que quiser).
  const [selected, setSelected] = useState<string[]>(universe.slice(0, MAX_OBJECTIVES));

  const toggle = (o: string) =>
    setSelected((sel) => {
      if (sel.includes(o)) return sel.filter((x) => x !== o);
      if (sel.length >= MAX_OBJECTIVES) {
        toast.warning(`O limite é ${MAX_OBJECTIVES}, pra manter foco. Desmarque um pra trocar.`);
        return sel;
      }
      return [...sel, o];
    });

  const addOwn = (t: string) => {
    if (selected.length >= MAX_OBJECTIVES) {
      toast.warning(`O limite é ${MAX_OBJECTIVES}, pra manter foco. Qual desses você gostaria de trocar?`);
      return;
    }
    setOptions((s) => (s.some((x) => x.toLowerCase() === t.toLowerCase()) ? s : [...s, t]));
    setSelected((sel) => (sel.some((x) => x.toLowerCase() === t.toLowerCase()) ? sel : [...sel, t]));
  };

  return (
    <div className='nyta-card'>
      <div className='wiz-card-title'>Seus objetivos</div>
      <div className='wiz-option-grid'>
        {options.map((s, i) => {
          const active = selected.includes(s);
          return (
            <button
              key={s}
              className={`wiz-option-pill${active ? ' wiz-option-pill--selected' : ''}`}
              style={{ animationDelay: `${i * 50}ms` }}
              onClick={() => toggle(s)}
            >
              {active && (
                <span className='wiz-option-check'>
                  <FiCheck size={14} />
                </span>
              )}
              {s}
            </button>
          );
        })}
      </div>
      <AddOwnField placeholder='Acrescentar um objetivo…' label='Acrescentar objetivo' onAdd={addOwn} />
      <div className='nyta-card-actions'>
        <span style={{ color: '#b3b3b3', fontSize: 13, alignSelf: 'center' }}>
          {selected.length}/{MAX_OBJECTIVES}
        </span>
        <button
          style={{ ...primaryBtn, marginLeft: 'auto', opacity: selected.length ? 1 : 0.4 }}
          disabled={!selected.length}
          onClick={() => onConfirm(selected)}
        >
          Confirmar objetivos
        </button>
      </div>
    </div>
  );
};

// ---- Pergunta de quiz (bolhas) -----------------------------------------------------------------

export const QuizOptions: FC<{
  question: QuizQuestion | string;
  onAnswer: (value: string) => void;
  // Volta para a pergunta anterior (disponível a partir da 2ª pergunta).
  onBack?: () => void;
  // Conteúdo opcional no topo (ex.: legenda SO/ST/WO/WT no quiz de estratégia).
  headerExtra?: ReactNode;
  // Gate de qualidade da opção própria: valida ANTES de virar chip (qualidade importa).
  // Retorna ok:false + reask gentil quando o texto é lixo/fora do tema. Fail-open no erro.
  validateCustom?: (text: string) => Promise<{ ok: boolean; reask: string }>;
  // (legado) focar o input do chat — o fluxo atual usa o campo custom inline.
  focusInput?: () => void;
}> = ({ question, onAnswer, onBack, headerExtra, validateCustom }) => {
  const q = normalizeQuizQuestion(question);
  // Toda pergunta aceita múltiplas escolhas + opções próprias do artista (ele decide
  // quantas marcar e quando confirmar). Nada de auto-avançar na 1ª opção tocada.
  const [selected, setSelected] = useState<string[]>([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  const [checking, setChecking] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  const toggle = (opt: string) =>
    setSelected((s) => (s.includes(opt) ? s.filter((x) => x !== opt) : [...s, opt]));

  const addCustom = async () => {
    const t = customText.trim();
    if (!t || checking) return;
    if (selected.some((x) => x.toLowerCase() === t.toLowerCase())) {
      setCustomText('');
      return;
    }
    // Mesmo gate das respostas digitadas: a opção própria só entra se for aproveitável.
    if (validateCustom) {
      setChecking(true);
      setCustomError(null);
      const { ok, reask } = await validateCustom(t);
      setChecking(false);
      if (!ok) {
        setCustomError(reask || 'Tenta deixar essa ideia um pouco mais clara pra eu aproveitar.');
        return;
      }
    }
    setSelected((s) => [...s, t]);
    setCustomText('');
    setCustomError(null);
    // Sucesso: oculta o campo. Pra adicionar outra, o artista toca "Escrever do meu jeito" de novo.
    setCustomOpen(false);
  };

  if (!q.options.length) {
    return (
      <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
        Responda no campo de mensagem abaixo.
      </p>
    );
  }

  // Itens escritos pelo artista (fora da lista da IA) viram chips selecionados extras.
  const customSelected = selected.filter((s) => !q.options.includes(s));

  return (
    <div>
      {headerExtra}
      <p style={{ color: '#af2896', fontSize: 13, fontWeight: 700, margin: '0 0 10px' }}>
        Escolha uma ou mais, ou escreva a sua
      </p>
      <div className='wiz-option-grid'>
        {q.options.map((opt, i) => {
          const isSel = selected.includes(opt);
          return (
            <button
              key={opt}
              className={`wiz-option-pill${isSel ? ' wiz-option-pill--selected' : ''}`}
              style={{ animationDelay: `${i * 50}ms` }}
              onClick={() => toggle(opt)}
            >
              {isSel && (
                <span className='wiz-option-check'>
                  <FiCheck size={14} />
                </span>
              )}
              {opt}
            </button>
          );
        })}
        {customSelected.map((opt) => (
          <button
            key={opt}
            className='wiz-option-pill wiz-option-pill--selected'
            onClick={() => toggle(opt)}
            title='Toque para remover'
          >
            <span className='wiz-option-check'>
              <FiCheck size={14} />
            </span>
            {opt}
          </button>
        ))}
        <button
          className='wiz-option-pill wiz-option-pill--custom'
          style={{ animationDelay: `${q.options.length * 50}ms` }}
          onClick={() => setCustomOpen((o) => !o)}
        >
          <FiEdit3 size={14} />
          Escrever do meu jeito
        </button>
      </div>

      {customOpen && (
        <>
          <div className='wiz-custom-row'>
            <input
              className='wiz-custom-input'
              value={customText}
              autoFocus
              disabled={checking}
              placeholder='Escreva sua opção e toque em Adicionar'
              onChange={(e) => {
                setCustomText(e.target.value);
                if (customError) setCustomError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <button
              style={{
                ...primaryBtn,
                padding: '8px 16px',
                opacity: customText.trim() && !checking ? 1 : 0.5,
              }}
              disabled={!customText.trim() || checking}
              onClick={addCustom}
            >
              {checking ? 'Verificando…' : 'Adicionar'}
            </button>
          </div>
          {customError && (
            <p style={{ color: '#f59e0b', fontSize: 13, margin: '8px 2px 0', maxWidth: 720 }}>
              {customError}
            </p>
          )}
        </>
      )}

      <div className='nyta-card-actions' style={{ justifyContent: 'space-between' }}>
        {onBack ? (
          <button style={{ ...ghostBtn, padding: '6px 14px', fontSize: 12 }} onClick={onBack}>
            ← Voltar
          </button>
        ) : (
          <span />
        )}
        <button
          style={{ ...primaryBtn, opacity: selected.length ? 1 : 0.5 }}
          disabled={!selected.length}
          onClick={() => onAnswer(selected.join('; '))}
        >
          {selected.length > 1 ? `Confirmar (${selected.length})` : 'Confirmar'}
        </button>
      </div>
    </div>
  );
};

// ---- Diagnóstico interno: 20 itens, um a um (Metodologia v2) ------------------------------------

type InternalClass = 'forte' | 'melhorar' | 'na';

export const SwotInternalCard: FC<{
  onConfirm: (internal: Record<number, InternalClass>) => void;
}> = ({ onConfirm }) => {
  const [internal, setInternal] = useState<Record<number, InternalClass>>({});
  const [idx, setIdx] = useState(0);
  const [advancing, setAdvancing] = useState(false);
  const total = SWOT_INTERNAL.length;
  const item = SWOT_INTERNAL[idx];
  const options: [InternalClass, string, string][] = [
    ['forte', 'É um ponto forte', '#af2896'],
    ['melhorar', 'Preciso melhorar nisso', '#e9a21a'],
    ['na', 'Não se aplica', '#6b7280'],
  ];
  const answer = (val: InternalClass) => {
    if (advancing) return;
    const updated = { ...internal, [item.id]: val };
    setInternal(updated);
    setAdvancing(true);
    window.setTimeout(() => {
      setAdvancing(false);
      if (idx + 1 >= total) onConfirm(updated);
      else setIdx((i) => i + 1);
    }, 380);
  };
  const barPct = ((idx + (advancing ? 1 : 0)) / total) * 100;
  return (
    <div className='nyta-card'>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
        <span style={{ color: '#af2896', fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          Diagnóstico interno
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ color: '#7a7a7a', fontSize: 12, fontWeight: 600 }}>{idx + 1} de {total}</span>
          {idx > 0 && (
            <button
              disabled={advancing}
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              style={{ background: 'none', border: 'none', color: '#7a7a7a', fontSize: 12, cursor: 'pointer', padding: 0 }}
            >
              ← Voltar
            </button>
          )}
        </span>
      </div>
      <div style={{ height: 3, borderRadius: 3, background: '#1f1f1f', marginBottom: 14, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${barPct}%`, background: '#af2896', borderRadius: 3, transition: 'width .3s ease' }} />
      </div>
      <div key={idx} style={{ animation: 'wizSlideInRight .28s ease both' }}>
        <p style={{ fontSize: 16.5, marginBottom: 4, lineHeight: 1.35, color: '#fff', fontWeight: 700 }}>{stripEmDash(item.label)}</p>
        <p style={{ fontSize: 13.5, marginBottom: 14, lineHeight: 1.45, color: '#9a9a9a' }}>{stripEmDash(item.question)}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {options.map(([val, label, color]) => {
            const active = internal[item.id] === val;
            const dim = advancing && !active;
            return (
              <button
                key={val}
                disabled={advancing}
                onClick={() => answer(val)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  textAlign: 'left',
                  border: `1px solid ${active ? color : '#2a2a2a'}`,
                  background: active ? color : '#121212',
                  color: active ? '#000' : '#e8e8e8',
                  borderRadius: 10,
                  fontSize: 13.5,
                  fontWeight: 600,
                  padding: '12px 14px',
                  cursor: advancing ? 'default' : 'pointer',
                  opacity: dim ? 0.35 : 1,
                  transform: active && advancing ? 'scale(1.015)' : 'scale(1)',
                  transition: 'opacity .2s ease, background .2s ease, border-color .2s ease, transform .2s ease',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    flexShrink: 0,
                    border: active ? 'none' : '1.5px solid #3a3a3a',
                    background: active ? 'rgba(0,0,0,0.18)' : 'transparent',
                  }}
                >
                  {active && <FiCheck size={13} />}
                </span>
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ---- Checklist de oportunidades / ameaças (checkbox à esquerda — Metodologia v2) ----------------

export const SwotChecklist: FC<{
  items: { id: number; label: string }[];
  confirmLabel: string;
  onConfirm: (ids: number[]) => void;
  title?: string;
  accent?: string;
}> = ({ items, confirmLabel, onConfirm, title, accent = '#af2896' }) => {
  const [sel, setSel] = useState<number[]>([]);
  const toggle = (id: number) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <div className='nyta-card'>
      {title && (
        <div style={{ color: accent, fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 }}>
          {title}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((c) => {
          const active = sel.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => toggle(c.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                textAlign: 'left',
                border: `1px solid ${active ? '#af2896' : '#2a2a2a'}`,
                background: active ? 'rgba(175, 40, 150, 0.12)' : '#121212',
                color: '#e8e8e8',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 500,
                padding: '11px 14px',
                cursor: 'pointer',
                transition: 'background .15s ease, border-color .15s ease',
              }}
            >
              <span
                aria-hidden
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  flexShrink: 0,
                  border: active ? 'none' : '1.5px solid #3a3a3a',
                  background: active ? '#af2896' : 'transparent',
                  color: '#000',
                }}
              >
                {active && <FiCheck size={14} />}
              </span>
              {c.label}
            </button>
          );
        })}
      </div>
      <div className='nyta-card-actions'>
        <span style={{ color: '#7a7a7a', fontSize: 13, alignSelf: 'center' }}>
          {sel.length} selecionada{sel.length === 1 ? '' : 's'}
        </span>
        <button style={{ ...primaryBtn, marginLeft: 'auto' }} onClick={() => onConfirm(sel)}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
};

// ---- Inventário SWOT editável ------------------------------------------------------------------

const SWOT_COLS: { key: keyof SwotAnalysis; label: string; color: string }[] = [
  { key: 'strengths', label: 'Forças', color: '#af2896' },
  { key: 'weaknesses', label: 'Fraquezas', color: '#e91429' },
  { key: 'opportunities', label: 'Oportunidades', color: '#3b82f6' },
  { key: 'threats', label: 'Ameaças', color: '#f59e0b' },
];

export const SwotBoardCard: FC<{
  swot: SwotAnalysis;
  onConfirm: (swot: SwotAnalysis, userEdits: string[]) => void;
}> = ({ swot, onConfirm }) => {
  const [board, setBoard] = useState<SwotAnalysis>(swot);
  const [inputs, setInputs] = useState<Record<string, string>>({});

  const update = (key: keyof SwotAnalysis, list: string[]) =>
    setBoard((b) => ({ ...b, [key]: list }));

  // Itens que o artista escreveu/alterou: presentes no board final mas não na
  // versão original gerada pela IA. Viram "fatos absolutos" nas etapas seguintes.
  const computeUserEdits = (): string[] => {
    const original = new Set(
      SWOT_COLS.flatMap((c) => (swot[c.key] || []).map((s) => s.trim().toLowerCase()))
    );
    return SWOT_COLS.flatMap((c) => board[c.key] || []).filter(
      (item) => !original.has(item.trim().toLowerCase())
    );
  };

  return (
    <div className='nyta-card'>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {SWOT_COLS.map((c) => {
          const items = board[c.key] || [];
          const addItem = () => {
            const v = (inputs[c.key] || '').trim();
            if (!v) return;
            update(c.key, [...items, v]);
            setInputs((s) => ({ ...s, [c.key]: '' }));
          };
          const canAdd = !!(inputs[c.key] || '').trim();
          return (
            <div key={c.key} style={{ background: '#121212', borderRadius: 8, padding: 12, borderTop: `3px solid ${c.color}` }}>
              <div style={{ color: c.color, fontWeight: 800, fontSize: 14, marginBottom: 8 }}>
                {c.label} <span style={{ color: '#6b7280', fontWeight: 700 }}>({items.length})</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {items.map((item, i) => (
                  <span key={`${item}-${i}`} className='wiz-swot-chip'>
                    <span style={{ width: 6, height: 6, minWidth: 6, borderRadius: '50%', background: c.color }} />
                    {item}
                    <button className='wiz-swot-chip-del' title='Remover' onClick={() => update(c.key, items.filter((_, j) => j !== i))}>
                      <FiX size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Input
                  size='small'
                  placeholder='Adicionar…'
                  value={inputs[c.key] || ''}
                  onChange={(e) => setInputs((s) => ({ ...s, [c.key]: e.target.value }))}
                  onPressEnter={addItem}
                />
                <button
                  title='Adicionar'
                  aria-label='Adicionar'
                  onClick={addItem}
                  disabled={!canAdd}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    width: 30,
                    borderRadius: 8,
                    border: `1px solid ${canAdd ? c.color : '#2a2a2a'}`,
                    background: canAdd ? c.color : 'transparent',
                    color: canAdd ? '#000' : '#6b7280',
                    cursor: canAdd ? 'pointer' : 'not-allowed',
                    transition: 'background .15s ease, border-color .15s ease, color .15s ease',
                  }}
                >
                  <FiPlus size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className='nyta-card-actions'>
        <button style={primaryBtn} onClick={() => onConfirm(board, computeUserEdits())}>
          Está ótimo, seguir
        </button>
      </div>
    </div>
  );
};

// ---- Revisão de estratégias --------------------------------------------------------------------

// Monta o texto "responde a:" a partir dos itens da SWOT que a estratégia endereça (tooltip + linha).
const swotRefsLine = (s: Strategy): string => {
  const r = s.swotRefs || {};
  const parts: string[] = [];
  if (r.weaknesses?.length) parts.push(`Fraquezas: ${r.weaknesses.join(', ')}`);
  if (r.opportunities?.length) parts.push(`Oportunidades: ${r.opportunities.join(', ')}`);
  if (r.strengths?.length) parts.push(`Forças: ${r.strengths.join(', ')}`);
  return parts.join(' · ');
};

export const StrategyCards: FC<{
  strategies: Strategy[];
  onConfirm: (strategies: Strategy[]) => void;
}> = ({ strategies, onConfirm }) => {
  // Lista somente-leitura: as estratégias vêm das matrizes determinísticas e não são editáveis
  // aqui (sem adicionar nem excluir). O artista revisa e segue pra priorização.
  return (
    <div className='nyta-card'>
      <div
        style={{
          color: '#b3b3b3',
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 4,
        }}
      >
        Suas estratégias <span style={{ color: '#6b7280' }}>({strategies.length})</span>
      </div>
      <p style={{ color: '#7d7d7d', fontSize: 12.5, margin: '0 0 12px', lineHeight: 1.45 }}>
        Construídas a partir do seu diagnóstico, cruzando suas forças, fraquezas e oportunidades.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {strategies.map((s) => {
          const refsLine = swotRefsLine(s);
          return (
            <div
              key={s.id}
              title={refsLine || undefined}
              style={{ position: 'relative', background: '#1f1f1f', border: '1px solid #2a2a2a', borderRadius: 8, padding: '14px 16px' }}
            >
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{stripEmDash(s.title)}</div>
              {s.description && (
                <p style={{ color: '#b3b3b3', fontSize: 13, margin: '6px 0 0', lineHeight: 1.55 }}>{s.description}</p>
              )}
              {s.why && (
                <p style={{ color: '#7d7d7d', fontSize: 12, margin: '8px 0 0', lineHeight: 1.5 }}>{s.why}</p>
              )}
              {refsLine && (
                <p style={{ color: '#6b7280', fontSize: 11.5, margin: '8px 0 0', lineHeight: 1.5 }}>
                  <span style={{ color: '#af2896', fontWeight: 700 }}>Responde a:</span> {refsLine}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className='nyta-card-actions'>
        <button
          style={{ ...primaryBtn, marginLeft: 'auto', opacity: strategies.length ? 1 : 0.5 }}
          disabled={!strategies.length}
          onClick={() => onConfirm(strategies)}
        >
          Curti, vamos priorizar
        </button>
      </div>
    </div>
  );
};

// ---- Priorização (matriz de notas 0–10 estratégia × objetivo, Doc 6 §1) ------------------------

// Efeito "digitando" letra a letra — destaca a troca de objetivo na priorização (a estratégia
// fica parada enquanto o artista pontua os objetivos, então o objetivo "digitado" sinaliza a troca).
const Typewriter: FC<{ text: string; speed?: number }> = ({ text: rawText, speed = 18 }) => {
  const text = stripEmDash(rawText);
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!text) return;
    const id = window.setInterval(() => {
      setN((p) => {
        if (p >= text.length) {
          window.clearInterval(id);
          return p;
        }
        return p + 1;
      });
    }, speed);
    return () => window.clearInterval(id);
  }, [text, speed]);
  return (
    <>
      {text.slice(0, n)}
      {n < text.length && <span style={{ opacity: 0.5, fontWeight: 400 }}>▌</span>}
    </>
  );
};

const SCALE = Array.from({ length: 11 }, (_, i) => i); // 0..10
// Cor da nota (vermelho → âmbar → verde) e palavra de apoio, pra dar leitura visual ao 0–10.
const scoreColor = (n: number): string => (n <= 3 ? '#e0564f' : n <= 6 ? '#e9a21a' : '#af2896');
const scoreWord = (n?: number): string =>
  typeof n !== 'number' ? 'Toque numa nota' : n === 0 ? 'Não ajuda em nada' : n <= 3 ? 'Ajuda pouco' : n <= 6 ? 'Ajuda' : n <= 9 ? 'Ajuda bastante' : 'Ajuda muito';

const stratComplete = (s: Strategy, objCount: number) =>
  Array.from({ length: objCount }, (_, i) => (s.objectiveScores || {})[i]).every(
    (v) => typeof v === 'number'
  );

export const PriorityScale: FC<{
  strategies: Strategy[];
  objectives: string[];
  // Confirma a priorização entregando as estratégias pontuadas + os ids das que o artista escolheu
  // para virar tarefas (plano de ação). As não selecionadas ficam salvas sem tarefas.
  onConfirm: (strategies: Strategy[], selectedIds: string[]) => void;
  // Notas sugeridas pela IA: mapa id da estratégia → { índice do objetivo → nota }.
  onSuggest?: () => Promise<Record<string, { byObjective: Record<number, number> }>>;
  // Fala da Nyta após o artista escolher como priorizar (resposta do método).
  onAnnounce?: (texts: string[]) => void;
}> = ({ strategies, objectives, onConfirm, onSuggest, onAnnounce }) => {
  const [list, setList] = useState<Strategy[]>(strategies);
  // Seleção do modal de destaque: quais estratégias viram tarefas (começa vazia — o artista escolhe).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const alreadyScored = strategies.some((s) => stratComplete(s, objectives.length));
  const [idx, setIdx] = useState(() => {
    const i = strategies.findIndex((s) => !stratComplete(s, objectives.length));
    return i === -1 ? strategies.length : i;
  });
  // Em vez de priorizar automaticamente, PERGUNTAMOS primeiro: deixar a Maestra priorizar
  // (ela analisa as metas e ordena) ou pontuar manualmente. Se já houver notas (retomada da
  // etapa), pula a escolha e vai direto para a ordem.
  const [chose, setChose] = useState(!(onSuggest && !alreadyScored));
  const [booting, setBooting] = useState(false);
  // Pontuação manual UM objetivo por vez (formulário): qual objetivo da estratégia atual,
  // pausa de feedback ao escolher e nota sob o cursor (preview do medidor).
  const [objIdx, setObjIdx] = useState(0);
  const [advancing, setAdvancing] = useState(false);
  const [hoverVal, setHoverVal] = useState<number | null>(null);

  // Deixar a Maestra priorizar: busca as notas sugeridas, preenche e mostra a ordem pronta.
  const runAi = async () => {
    onAnnounce?.(SAY.priorityAiChosen());
    setChose(true);
    setBooting(true);
    try {
      const scores = onSuggest ? await onSuggest() : {};
      setList((prev) =>
        prev.map((s) => {
          const sug = scores[s.id]?.byObjective || {};
          const objectiveScores: Record<number, number> = { ...(s.objectiveScores || {}) };
          objectives.forEach((_, oi) => {
            objectiveScores[oi] = typeof sug[oi] === 'number' ? sug[oi] : objectiveScores[oi] ?? 5;
          });
          return { ...s, objectiveScores };
        })
      );
      setIdx(strategies.length); // vai direto para a ordem pronta
    } finally {
      setBooting(false);
    }
  };

  // Pontuar manualmente: começa pela primeira estratégia.
  const goManual = () => {
    onAnnounce?.(SAY.priorityManualChosen());
    setChose(true);
    setIdx(0);
  };

  const maxScore = objectives.length * 10;

  // Escolha inicial: IA ou manual (em vez de priorizar sozinha).
  if (!chose) {
    return (
      <div className='nyta-card'>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, marginBottom: 6 }}>
          Como você quer priorizar?
        </div>
        <div style={{ color: '#b3b3b3', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
          São {list.length} estratégias. Não dá pra fazer tudo ao mesmo tempo, então a gente
          coloca em ordem de importância, começando pelas que mais te aproximam dos seus objetivos.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            style={{ ...primaryBtn, width: '100%', display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 24px' }}
            onClick={runAi}
          >
            <span style={{ fontWeight: 800 }}>Me ajuda, Nyta</span>
            <span style={{ fontWeight: 500, fontSize: 12, opacity: 0.8 }}>
              Ela analisa e já te entrega a ordem pronta
            </span>
          </button>
          <button
            style={{ ...ghostBtn, width: '100%', display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 24px' }}
            onClick={goManual}
          >
            <span style={{ fontWeight: 700 }}>Eu prefiro priorizar por conta própria</span>
            <span style={{ fontWeight: 500, fontSize: 12, color: '#9a9a9a' }}>
              Você decide a importância de cada uma, no seu ritmo
            </span>
          </button>
        </div>
      </div>
    );
  }

  if (booting) {
    return (
      <div className='nyta-card'>
        <div style={{ color: '#b3b3b3', fontSize: 14, padding: '8px 2px' }}>
          Organizando suas estratégias por ordem de importância…
        </div>
      </div>
    );
  }

  const revealed = idx >= list.length;

  if (revealed) {
    const scored = list.map((s) => ({
      ...s,
      finalScore: Array.from({ length: objectives.length }, (_, i) => (s.objectiveScores || {})[i] || 0).reduce((a, b) => a + b, 0),
    }));
    const ranked = scored.slice().sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
    const toggleSel = (id: string) =>
      setSelected((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    const count = selected.size;

    // Modal de destaque (overlay sobre a tela, fora do scroll do chat) com confetes. O artista
    // SELECIONA quais estratégias viram tarefas; só as escolhidas geram o plano de ação.
    return createPortal(
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.72)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, boxSizing: 'border-box',
        }}
      >
        <SuccessConfetti />
        <div
          style={{
            position: 'relative', width: '100%', maxWidth: 1200, height: '94vh', maxHeight: '94vh',
            background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 16,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            animation: 'wizPillIn 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
          }}
        >
          <div style={{ padding: '22px 22px 12px' }}>
            <div style={{ fontFamily: 'SpotifyMixUITitle', color: '#fff', fontWeight: 800, fontSize: 22, lineHeight: 1.2 }}>
              Sua ordem de prioridade está pronta
            </div>
            <div style={{ color: '#b3b3b3', fontSize: 13.5, marginTop: 8, lineHeight: 1.5 }}>
              Da mais importante para a menos. <b style={{ color: '#fff' }}>Selecione as estratégias</b> que você
              quer transformar em tarefas agora, as outras ficam guardadas pra depois.
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ranked.map((s, i) => {
              const on = selected.has(s.id);
              const pct = Math.round(((s.finalScore || 0) / Math.max(maxScore, 1)) * 100);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleSel(s.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16, textAlign: 'left', cursor: 'pointer',
                    background: on ? 'rgba(175,40,150,0.12)' : '#202020',
                    border: `1px solid ${on ? '#af2896' : 'transparent'}`,
                    borderRadius: 12, padding: '18px 20px', transition: 'background .15s, border-color .15s',
                  }}
                >
                  <span style={{ color: on ? '#d264bb' : '#7d7d7d', fontWeight: 800, fontSize: 22, minWidth: 32 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span
                    aria-hidden
                    style={{
                      flexShrink: 0, width: 22, height: 22, borderRadius: 6,
                      border: `2px solid ${on ? '#af2896' : '#4a4a4a'}`, background: on ? '#af2896' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                    }}
                  >
                    {on && <FiCheck size={14} />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 7 }}>
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, lineHeight: 1.4 }}>{stripEmDash(s.title)}</span>
                      <span style={{ color: '#b3b3b3', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{pct}%</span>
                    </span>
                    <span className='wiz-score-bar' style={{ display: 'block' }}>
                      <span style={{ display: 'block', width: `${pct}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #af2896, #509bf5)' }} />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ padding: '12px 22px 18px', borderTop: '1px solid #232323' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ color: '#b3b3b3', fontSize: 12.5 }}>
                <b style={{ color: '#fff' }}>{count}</b> de {ranked.length} selecionada{count === 1 ? '' : 's'}
              </span>
              <button
                style={{ background: 'none', border: 'none', color: '#af2896', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                onClick={() => setSelected(count === ranked.length ? new Set() : new Set(ranked.map((s) => s.id)))}
              >
                {count === ranked.length ? 'Limpar' : 'Selecionar todas'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                style={ghostBtn}
                onClick={() => {
                  // Refazer priorização: volta pra tela de escolha (Me ajuda, Nyta / pontuar à mão),
                  // limpando as notas e a seleção — não joga direto na pontuação manual.
                  setSelected(new Set());
                  setList(strategies.map((s) => ({ ...s, objectiveScores: undefined, finalScore: undefined })));
                  setIdx(0);
                  setChose(false);
                }}
              >
                Refazer priorização
              </button>
              <button
                style={{ ...primaryBtn, marginLeft: 'auto', opacity: count ? 1 : 0.5 }}
                disabled={!count}
                onClick={() => onConfirm(scored, Array.from(selected))}
              >
                Gerar plano de ação
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  const strategy = list[idx];
  const totalObj = objectives.length;
  const curVal = (strategy.objectiveScores || {})[objIdx];
  const shownVal = hoverVal != null ? hoverVal : curVal; // nota que o medidor exibe (preview no hover)
  const answeredSoFar = idx * totalObj + objIdx; // progresso global entre todas as perguntas
  // Só libera o "Avançar" quando TODAS as estratégias têm nota em TODOS os objetivos.
  const allComplete = list.every((s) => stratComplete(s, objectives.length));

  // Avança UMA pergunta: próximo objetivo → próxima estratégia. No último item NÃO pula sozinho:
  // o usuário conclui ali e segue pelo botão "Avançar" (que então fica liberado).
  const advanceOne = () => {
    if (objIdx + 1 < totalObj) {
      setObjIdx((o) => o + 1);
    } else if (idx + 1 < list.length) {
      setIdx((i) => i + 1);
      setObjIdx(0);
    }
  };

  const goBackOne = () => {
    if (objIdx > 0) setObjIdx((o) => o - 1);
    else if (idx > 0) {
      setIdx((i) => i - 1);
      setObjIdx(totalObj - 1);
    }
  };

  // Escolhe a nota do objetivo atual: grava, dá uma pausa de feedback e desliza pra próxima.
  const pick = (value: number) => {
    if (advancing) return;
    setList((prev) =>
      prev.map((s) =>
        s.id === strategy.id
          ? { ...s, objectiveScores: { ...(s.objectiveScores || {}), [objIdx]: value } }
          : s
      )
    );
    setHoverVal(null);
    setAdvancing(true);
    window.setTimeout(() => {
      setAdvancing(false);
      advanceOne();
    }, 480);
  };

  return (
    <div className='nyta-card'>
      {/* Cabeçalho: estratégia atual + progresso global */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <span style={{ color: '#b3b3b3', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Estratégia {idx + 1} de {list.length}
        </span>
        <span style={{ color: '#7a7a7a', fontSize: 12, fontWeight: 600 }}>
          {answeredSoFar + 1} de {list.length * totalObj}
        </span>
      </div>
      <div style={{ height: 3, borderRadius: 3, background: '#1f1f1f', marginBottom: 14, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(answeredSoFar / (list.length * totalObj)) * 100}%`, background: '#af2896', borderRadius: 3, transition: 'width .3s ease' }} />
      </div>

      {/* UMA pergunta por vez: re-monta por key pra deslizar entrando */}
      {/* A estratégia (key=idx) só desliza quando MUDA de estratégia; o título fica estável. */}
      <div key={idx} style={{ animation: 'wizSlideInRight .28s ease both' }}>
        <div style={{ background: '#121212', borderRadius: 12, padding: '16px 16px 18px' }}>
          <div style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 12, lineHeight: 1.25 }}>
            {stripEmDash(strategy.title)}
          </div>
          <div style={{ height: 1, background: '#222', margin: '0 0 12px' }} />
          {/* O objetivo (key=objIdx) anima a cada troca: fade-sobe + flash magenta, pra o usuário
              perceber que o objetivo mudou mesmo com a estratégia parada. */}
          <div key={objIdx} style={{ animation: 'wizObjSwap .32s ease both' }}>
            <div style={{ color: '#6b7280', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 4 }}>
              OBJETIVO {objIdx + 1} DE {totalObj}
            </div>
            <div style={{ color: '#b3b3b3', fontSize: 15, marginBottom: 16, lineHeight: 1.5, minHeight: 46 }}>
              Ajuda a conquistar o objetivo{' '}
              <strong style={{ color: '#fff', fontSize: 17 }}>
                “<Typewriter text={objectives[objIdx] || ''} />”
              </strong>
              ?
            </div>
          </div>

          {/* Medidor visual 0–10: barras que sobem e enchem até a nota (vermelho → âmbar → verde) */}
          <div
            style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 64, marginBottom: 8 }}
            onMouseLeave={() => setHoverVal(null)}
          >
            {SCALE.map((n) => {
              const filled = typeof shownVal === 'number' && n <= shownVal;
              const h = 22 + n * 4; // 22..62px → rampa ascendente
              return (
                <button
                  key={n}
                  disabled={advancing}
                  onMouseEnter={() => !advancing && setHoverVal(n)}
                  onClick={() => pick(n)}
                  aria-label={`Nota ${n}`}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: h,
                    borderRadius: 6,
                    border: 'none',
                    background: filled ? scoreColor(typeof shownVal === 'number' ? shownVal : n) : '#242424',
                    color: filled ? 'rgba(0,0,0,0.65)' : '#666',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: advancing ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    paddingBottom: 3,
                    transition: 'background .12s ease, height .12s ease',
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280', fontSize: 11, marginBottom: 12 }}>
            <span>0 · não ajuda</span>
            <span>10 · ajuda muito</span>
          </div>

          {/* Leitura grande da nota sob o cursor / escolhida */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 30 }}>
            <span
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: typeof shownVal === 'number' ? scoreColor(shownVal) : '#3a3a3a',
                lineHeight: 1,
                minWidth: 34,
              }}
            >
              {typeof shownVal === 'number' ? shownVal : '–'}
            </span>
            <span style={{ color: typeof shownVal === 'number' ? '#fff' : '#6b7280', fontSize: 14, fontWeight: 600 }}>
              {scoreWord(shownVal)}
            </span>
          </div>
        </div>
      </div>

      <div className='nyta-card-actions' style={{ alignItems: 'center' }}>
        {answeredSoFar > 0 && (
          <button style={ghostBtn} disabled={advancing} onClick={goBackOne}>
            ← Voltar
          </button>
        )}
        {!allComplete && (
          <span style={{ color: '#7a7a7a', fontSize: 12, marginLeft: 'auto' }}>
            Pontue todos os objetivos pra avançar.
          </span>
        )}
        <button
          style={{
            ...primaryBtn,
            marginLeft: allComplete ? 'auto' : 12,
            opacity: allComplete && !advancing ? 1 : 0.4,
            cursor: allComplete && !advancing ? 'pointer' : 'not-allowed',
          }}
          disabled={!allComplete || advancing}
          onClick={() => allComplete && setIdx(list.length)}
        >
          Avançar
        </button>
      </div>
    </div>
  );
};

// ---- Setup do cronograma: início + duração (Metodologia v2) -------------------------------------

const DURATION_OPTIONS: { months: number; label: string; hint: string }[] = [
  { months: 6, label: '6 meses', hint: 'ritmo intenso' },
  { months: 12, label: '12 meses', hint: 'mais comum' },
  { months: 18, label: '18 meses', hint: 'mais folga' },
  { months: 24, label: '24 meses', hint: 'longo prazo' },
];

export const PlanScheduleSetup: FC<{
  onConfirm: (startISO: string, months: number) => void;
}> = ({ onConfirm }) => {
  const [start, setStart] = useState(() => dayjs());
  const [months, setMonths] = useState(12);
  return (
    <div className='nyta-card'>
      <div style={{ marginBottom: 4, color: '#fff', fontWeight: 800, fontSize: 16 }}>Quando você quer começar?</div>
      <p style={{ color: '#b3b3b3', fontSize: 12.5, margin: '0 0 16px', lineHeight: 1.45 }}>
        Com a data de início e o prazo, eu já distribuo as tarefas pelo período, começando pelas
        estratégias mais prioritárias. Você ajusta tudo depois.
      </p>

      <div style={{ color: '#7a7a7a', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Data de início
      </div>
      <DatePicker
        size='large'
        style={{ width: '100%', marginBottom: 18 }}
        value={start}
        allowClear={false}
        format='DD/MM/YYYY'
        disabledDate={(d) => d.isBefore(dayjs(), 'day')}
        onChange={(d) => d && setStart(d)}
      />

      <div style={{ color: '#7a7a7a', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Em quanto tempo quer realizar
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {DURATION_OPTIONS.map((o) => {
          const active = months === o.months;
          return (
            <button
              key={o.months}
              onClick={() => setMonths(o.months)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 2,
                textAlign: 'left',
                border: `1px solid ${active ? '#af2896' : '#2a2a2a'}`,
                background: active ? 'rgba(175, 40, 150, 0.12)' : '#121212',
                color: '#e8e8e8',
                borderRadius: 10,
                padding: '12px 14px',
                cursor: 'pointer',
                transition: 'background .15s ease, border-color .15s ease',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 14, color: active ? '#fff' : '#e8e8e8' }}>{o.label}</span>
              <span style={{ fontSize: 11.5, color: '#7a7a7a' }}>{o.hint}</span>
            </button>
          );
        })}
      </div>

      <div className='nyta-card-actions'>
        <button style={{ ...primaryBtn, marginLeft: 'auto' }} onClick={() => onConfirm(start.format('YYYY-MM-DD'), months)}>
          Montar meu cronograma
        </button>
      </div>
    </div>
  );
};

// ---- Cronograma (timeline editável) ------------------------------------------------------------

const fmtDate = (iso?: string) =>
  iso ? dayjs(iso).toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : 'sem data';

export const TimelineCard: FC<{
  strategies: Strategy[];
  onChange: (strategies: Strategy[]) => void;
  onConfirm: () => void;
}> = ({ strategies, onChange, onConfirm }) => {
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingDesc, setEditingDesc] = useState<string | null>(null);

  const ordered = strategies
    .slice()
    .sort((a, b) => (b.finalScore ?? b.score ?? 0) - (a.finalScore ?? a.score ?? 0));

  const updateTask = (sid: string, tid: string, patch: Partial<ActionTask>) =>
    onChange(
      strategies.map((s) =>
        s.id === sid ? { ...s, tasks: (s.tasks || []).map((t) => (t.id === tid ? { ...t, ...patch } : t)) } : s
      )
    );

  const removeTask = (sid: string, tid: string) =>
    onChange(strategies.map((s) => (s.id === sid ? { ...s, tasks: (s.tasks || []).filter((t) => t.id !== tid) } : s)));

  const addTask = (sid: string) => {
    const id = uid();
    onChange(
      strategies.map((s) =>
        s.id === sid
          ? {
              ...s,
              tasks: [
                ...(s.tasks || []),
                { id, description: 'Nova tarefa', type: 'acoes', owner: TASK_OWNER_SELF, deadline: dayjs().add(7, 'day').format('YYYY-MM-DD'), status: 'todo' as const },
              ],
            }
          : s
      )
    );
    setEditingDesc(id);
  };

  return (
    <div className='nyta-card'>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {ordered.map((s, si) => {
          const tasks = (s.tasks || []).slice().sort((a, b) => ((a.deadline || '9999') < (b.deadline || '9999') ? -1 : 1));
          return (
            <div key={s.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span className='wiz-slot-rank' style={{ minWidth: 'auto', fontSize: 18, color: '#af2896' }}>#{si + 1}</span>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, flex: 1 }}>{stripEmDash(s.title)}</span>
              </div>
              <div className='wiz-timeline'>
                {tasks.map((t) => (
                  <div key={t.id} className='wiz-timeline-item'>
                    {editingDate === t.id ? (
                      <DatePicker
                        size='small'
                        autoFocus
                        open
                        value={t.deadline ? dayjs(t.deadline) : undefined}
                        disabledDate={(d) => d.isBefore(dayjs(), 'day')}
                        onChange={(d) => {
                          if (d) updateTask(s.id, t.id, { deadline: d.format('YYYY-MM-DD') });
                          setEditingDate(null);
                        }}
                        onOpenChange={(open) => !open && setEditingDate(null)}
                      />
                    ) : (
                      <button className='wiz-date-pill' style={{ border: 'none' }} onClick={() => setEditingDate(t.id)}>
                        {fmtDate(t.deadline)}
                      </button>
                    )}
                    {editingDesc === t.id ? (
                      <Input
                        size='small'
                        autoFocus
                        defaultValue={t.description}
                        onBlur={(e) => {
                          updateTask(s.id, t.id, { description: e.target.value.trim() || t.description });
                          setEditingDesc(null);
                        }}
                        onPressEnter={(e) => {
                          updateTask(s.id, t.id, { description: (e.target as HTMLInputElement).value.trim() || t.description });
                          setEditingDesc(null);
                        }}
                      />
                    ) : (
                      <span
                        style={{ color: '#d0d0d0', fontSize: 13, flex: 1, cursor: 'text', lineHeight: '22px' }}
                        onClick={() => setEditingDesc(t.id)}
                      >
                        {t.description}
                      </span>
                    )}
                    <button className='wiz-timeline-del' title='Remover' onClick={() => removeTask(s.id, t.id)}>
                      <FiTrash2 size={13} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addTask(s.id)}
                  style={{ background: 'transparent', border: '1px dashed #444', borderRadius: 9999, color: '#b3b3b3', fontSize: 12, fontWeight: 600, padding: '4px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 2 }}
                >
                  <FiPlus size={12} /> Adicionar tarefa
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className='nyta-card-actions'>
        <button style={primaryBtn} onClick={onConfirm}>
          Aprovar plano de ação
        </button>
      </div>
    </div>
  );
};

// ---- Resumo final ------------------------------------------------------------------------------

export const FinalSummaryCard: FC<{
  summary: string;
  concluded: boolean;
  onFinish: () => void;
}> = ({ summary, concluded, onFinish }) => (
  <div className='nyta-card'>
    <div className='nyta-md' style={{ color: '#d0d0d0', lineHeight: 1.7, fontSize: 14 }}>
      <ReactMarkdown>{summary}</ReactMarkdown>
    </div>
    <div className='nyta-card-actions'>
      <button style={{ ...primaryBtn, marginLeft: 'auto' }} onClick={onFinish}>
        {concluded ? 'Ir para o painel' : 'Concluir e liberar o painel'}
      </button>
    </div>
  </div>
);

// ---- Retry (falha de IA) -----------------------------------------------------------------------

export const RetryPill: FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <button className='wiz-option-pill wiz-option-pill--custom' onClick={onRetry}>
    <FiRefreshCw size={14} /> Tentar novamente
  </button>
);
