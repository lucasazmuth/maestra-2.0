import { FC, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { DatePicker, Input, Select, Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { FiTrash2, FiUploadCloud } from 'react-icons/fi';
import dayjs from 'dayjs';

import type { CatalogItem, MusicGenre, Split } from '@maestra/core/interfaces/maestra';
import { CATALOG_STATUS_OPTIONS, SPLIT_ROLES } from '@maestra/core/constants/maestra';

import AnalysisHint from '../AnalysisHint';
import modalStyles from '../StandardModal.module.scss';

// OS CAMPOS DA FICHA, num lugar só.
//
// Eles nasceram dentro do `TrackModal` e viviam lá dentro. Agora a ficha tem DUAS casas — o
// modal de sempre, e a aba "Ficha" do editor de música — e um formulário copiado divergiria no
// primeiro ajuste: alguém acrescenta um campo numa das telas e a outra fica para trás, sem
// ninguém dar por isso até um dado se perder.
//
// Por isso os campos moram aqui, e as duas telas montam a mesma coisa.

const uid = () => Math.random().toString(36).slice(2, 10);

export const SplitEditor: FC<{
  splits: Split[];
  onChange: (s: Split[]) => void;
}> = ({ splits, onChange }) => {
  const total = splits.reduce((acc, s) => acc + (Number(s.percentage) || 0), 0);
  return (
    <div className={modalStyles.splitEditor}>
      {!!splits.length && (
        <div className={modalStyles.splitHeader} aria-hidden="true">
          <span>Nome</span>
          <span>Função</span>
          <span>Percentual</span>
          <span />
        </div>
      )}
      {splits.map((s, i) => (
        <div key={s.id} className={modalStyles.splitRow}>
          <Input
            className={modalStyles.splitName}
            placeholder='Nome do participante'
            value={s.name}
            aria-label={`Nome do participante ${i + 1}`}
            onChange={(e) => {
              const next = splits.slice();
              next[i] = { ...s, name: e.target.value };
              onChange(next);
            }}
          />
          <Select
            className={modalStyles.splitRole}
            placeholder='Selecione a função'
            value={s.role || undefined}
            aria-label={`Função do participante ${i + 1}`}
            options={SPLIT_ROLES.map((r) => ({ value: r, label: r }))}
            onChange={(v) => {
              const next = splits.slice();
              next[i] = { ...s, role: v };
              onChange(next);
            }}
          />
          <Input
            className={modalStyles.splitPercentage}
            type='number'
            suffix='%'
            value={s.percentage}
            min={0}
            max={100}
            aria-label={`Percentual do participante ${i + 1}`}
            onChange={(e) => {
              const next = splits.slice();
              const value = Math.max(0, Math.min(100, Number(e.target.value) || 0));
              next[i] = { ...s, percentage: value };
              onChange(next);
            }}
          />
          <button
            type='button'
            className={modalStyles.splitRemove}
            aria-label={`Remover ${s.name || `participante ${i + 1}`}`}
            title='Remover participante'
            onClick={() => onChange(splits.filter((x) => x.id !== s.id))}
          >
            <FiTrash2 size={15} />
          </button>
        </div>
      ))}
      {!splits.length && (
        <div className={modalStyles.splitEmpty}>Nenhum participante adicionado.</div>
      )}
      <div className={modalStyles.splitFooter}>
        <button
          type='button'
          className={modalStyles.splitAdd}
          onClick={() => onChange([...splits, { id: uid(), name: '', role: '', percentage: 0 }])}
        >
          + Adicionar participante
        </button>
        <span
          className={modalStyles.splitTotal}
          style={{ color: total === 100 ? '#2ec47a' : total > 100 ? '#ff6b6f' : '#b3b3b3' }}
        >
          Total <strong>{total}%</strong>
        </span>
      </div>
    </div>
  );
};

// Ações "Trocar"/"Remover" do estado preenchido.
const ghostBtn: CSSProperties = {
  background: '#fff', border: '1px solid #dce5f0', color: '#5e739b',
  borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 800,
  cursor: 'pointer', whiteSpace: 'nowrap',
};

// Campo de upload estilizado (dropzone + clique), com estados de envio, preview (miniatura) e
// ações Trocar/Remover — substitui o <input file> cru. Cores do design claro: a caixa vivia em
// #181818 e aparecia como um retângulo preto dentro do modal branco.
export const UploadField: FC<{
  accept: string;
  hint: string;
  uploading: boolean;
  hasValue: boolean;
  fileName?: string | null;
  thumb?: ReactNode;
  onFile: (f: File) => void;
  onClear: () => void;
}> = ({ accept, hint, uploading, hasValue, fileName, thumb, onFile, onClear }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const pick = () => inputRef.current?.click();

  return (
    <>
      <input
        ref={inputRef}
        type='file'
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
      />
      {hasValue && !uploading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fbfcfe', border: '1px solid #e1e7f0', borderRadius: 8, padding: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: '#edf2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, color: '#3361ff' }}>
            {thumb}
          </div>
          {/* Sem o selo verde "Enviado": este bloco só existe quando o arquivo já está lá — a
              miniatura e o nome dizem isso sozinhos. */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#62769b', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {fileName || 'Arquivo enviado'}
            </div>
          </div>
          <button type='button' onClick={pick} style={ghostBtn}>Trocar</button>
          <button type='button' onClick={onClear} style={{ ...ghostBtn, color: '#c0405c', padding: '6px 10px' }} aria-label='Remover'>
            <FiTrash2 size={15} />
          </button>
        </div>
      ) : (
        <div
          onClick={uploading ? undefined : pick}
          onDragOver={(e) => { e.preventDefault(); if (!uploading) setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); if (uploading) return; const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
          style={{
            border: `1.5px dashed ${drag ? '#8aa5ff' : '#cad5e5'}`,
            background: drag ? '#eef3ff' : '#fbfcfe',
            borderRadius: 8, padding: '20px 16px', textAlign: 'center',
            cursor: uploading ? 'default' : 'pointer', transition: 'border-color .15s, background .15s',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}
        >
          {uploading ? (
            <>
              <Spin indicator={<LoadingOutlined style={{ fontSize: 22, color: '#3361ff' }} spin />} />
              <div style={{ color: '#7c8db0', fontSize: 12 }}>Enviando…</div>
            </>
          ) : (
            <>
              <FiUploadCloud size={24} color='#3361ff' />
              <div style={{ color: '#62769b', fontSize: 12, fontWeight: 800 }}>
                Arraste aqui ou <span style={{ color: '#3361ff' }}>clique para escolher</span>
              </div>
              <div style={{ color: '#9aa9c2', fontSize: 10 }}>{hint}</div>
            </>
          )}
        </div>
      )}
    </>
  );
};

// Seção Versões, dentro da ficha da música: as gravações moram no Espaço Jam, mas anexar uma
// aqui é o caminho curto — quem está preenchendo a ficha já tem o arquivo à mão. O que sobe
// por aqui é exatamente o que aparece lá, porque é a mesma tabela.
//
// Enquanto a música ainda não existe (cadastro), não há projeto para pendurar a versão: o
// arquivo escolhido fica no rascunho e vira a V1 no momento de salvar.
// Ver o comentário no lugar onde ele era usado: o bloco de versões saiu da ficha, e o
// componente fica à espera de uma decisão sobre as gravações antigas. Apagá-lo agora seria
// deitar fora a única tela que sabe lidar com elas.
// eslint-disable-next-line @typescript-eslint/no-unused-vars

/** O que os campos precisam de saber de fora. */
export interface DadosDaFicha {
  draft: Partial<CatalogItem>;
  set: (parte: Partial<CatalogItem>) => void;
  genres: MusicGenre[];
  assigneeOptions: { id: string; name: string }[];
  /** Qual envio está em curso, para o campo da capa mostrar que está a trabalhar. */
  uploading: 'cover' | 'audio' | null;
  aoEnviarCapa: (arquivo: File) => void;
  /** A gravação de onde a deteção de BPM e tom lê o resultado. */
  versionId?: string | null;
}

export const CamposDaFicha: FC<DadosDaFicha> = ({
  draft, set, genres, assigneeOptions, uploading, aoEnviarCapa, versionId,
}) => (
        <div className={modalStyles.form} style={{ paddingTop: 0 }}>
          <label className={modalStyles.field}>
            <span>Título</span>
            <Input
              placeholder='Título da música'
              value={draft.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </label>
          <div className={modalStyles.fieldGrid}>
            <label className={modalStyles.field}>
              <span>Status</span>
              <Select
                placeholder='Status'
                value={draft.status}
                options={CATALOG_STATUS_OPTIONS.map((s) => ({ value: s.id, label: s.label }))}
                onChange={(v) => set({ status: v })}
              />
            </label>
            <label className={modalStyles.field}>
              <span>Gênero</span>
              <Select
                placeholder='Gênero'
                allowClear
                showSearch
                optionFilterProp='label'
                value={draft.genre || undefined}
                options={genres.map((g) => ({ value: g.name, label: g.name }))}
                onChange={(v) => set({ genre: v })}
              />
            </label>
          </div>
          <label className={modalStyles.field}>
            <span>Responsável</span>
            <Select
              placeholder='Selecione o responsável'
              allowClear
              value={draft.assignee?.id}
              options={assigneeOptions.map((o) => ({ value: o.id, label: o.name }))}
              onChange={(v) => {
                const o = assigneeOptions.find((x) => x.id === v);
                set({ assignee: o ? { id: o.id, name: o.name } : null });
              }}
            />
          </label>
          {/* Duração saiu daqui: pertence à gravação, e cada versão tem a sua. Está no
              modal de Versão (VersionModal). */}
          <label className={modalStyles.field}>
            <span>Data de lançamento</span>
            <DatePicker
              placeholder='Selecione a data'
              value={draft.release_date ? dayjs(draft.release_date) : null}
              onChange={(d) => set({ release_date: d ? d.format('YYYY-MM-DD') : null })}
            />
          </label>
          <div className={modalStyles.fieldGridFour}>
            <label className={modalStyles.field}>
              <span>ISRC</span>
              <Input placeholder='ISRC' value={draft.isrc || ''} onChange={(e) => set({ isrc: e.target.value })} />
            </label>
            <label className={modalStyles.field}>
              <span>UPC</span>
              <Input placeholder='UPC' value={draft.upc || ''} onChange={(e) => set({ upc: e.target.value })} />
            </label>
            <label className={modalStyles.field}>
              <span>BPM</span>
              <Input placeholder='BPM' value={draft.bpm || ''} onChange={(e) => set({ bpm: e.target.value })} />
            </label>
            <label className={modalStyles.field}>
              <span>Tom</span>
              <Input placeholder='Tom' value={draft.key || ''} onChange={(e) => set({ key: e.target.value })} />
            </label>
          </div>
          {/* O que a máquina ouviu, ao lado dos campos que ela preenche — e nunca por cima
              deles: "usar" escreve no rascunho, e é a pessoa quem salva. Vivia no Espaço
              JAM; saiu de lá porque é uma ação ocasional e a tela principal tinha coisas
              demais. Só existe quando a faixa tem uma versão com áudio para ouvir. */}
          {!!versionId && (
            <AnalysisHint versionId={versionId} onUse={({ bpm, tom }) => set({ bpm, key: tom })} />
          )}
          <label className={modalStyles.field}>
            <span>Capa</span>
            <UploadField
              accept='image/*'
              hint='PNG ou JPG'
              uploading={uploading === 'cover'}
              hasValue={!!draft.cover_image}
              fileName={draft.cover_image_name}
              thumb={draft.cover_image
                ? <img src={draft.cover_image} alt='capa' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <FiUploadCloud size={18} />}
              onFile={(f) => aoEnviarCapa(f)}
              onClear={() => set({ cover_image: null, cover_image_name: null })}
            />
          </label>
          {/* ⚠️ O BLOCO DE VERSÕES SAIU DA FICHA, e com ele o gesto de eleger uma
              gravação principal.
              O modelo mudou: uma música deixou de ser "várias gravações alternativas, uma
              delas a boa" e passou a ser UMA montagem — bateria, piano, voz — que soa
              junta. Escolher uma "principal" entre pistas de um mesmo arranjo não quer
              dizer nada: seria eleger a bateria como a música.
              O componente fica no arquivo, sem uso, à espera da decisão do dono do
              produto sobre o que fazer com as gravações antigas. */}
        </div>
);

/** Os créditos: quem escreveu a obra, e quem gravou o fonograma. */
export const CamposDosSplits: FC<{
  draft: Partial<CatalogItem>;
  set: (parte: Partial<CatalogItem>) => void;
}> = ({ draft, set }) => (
  <div className={modalStyles.splitSections}>
    <div className={modalStyles.splitSection}>
      <div className={modalStyles.splitSectionTitle}>
        <strong>Composição</strong>
        <span>Créditos autorais da obra</span>
      </div>
      <SplitEditor
        splits={draft.composition_splits || []}
        onChange={(s) => set({ composition_splits: s })}
      />
    </div>
    <div className={modalStyles.splitSection}>
      <div className={modalStyles.splitSectionTitle}>
        <strong>Gravação</strong>
        <span>Créditos do fonograma</span>
      </div>
      <SplitEditor
        splits={draft.recording_splits || []}
        onChange={(s) => set({ recording_splits: s })}
      />
    </div>
  </div>
);
