import { FC, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Modal, Input, Select, DatePicker, Tabs, App, Spin, Button, Popconfirm } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { FiUploadCloud, FiMusic, FiTrash2, FiCheckCircle, FiPlay, FiPause } from 'react-icons/fi';
import dayjs from 'dayjs';

import type { CatalogItem, Split, MusicGenre } from '../interfaces/maestra';
import { CATALOG_STATUS_OPTIONS, SPLIT_ROLES } from '../constants/maestra';
import { uploadFile, CATALOG_BUCKET } from '../lib/storage';
import * as catalogDb from '../services/db/catalog';
import modalStyles from './StandardModal.module.scss';

interface Props {
  open: boolean;
  artistId: string;
  item?: CatalogItem | null; // edição quando presente
  genres: MusicGenre[];
  assigneeOptions: { id: string; name: string }[];
  currentUserName: string;
  // Autoria da versão criada/atualizada (o "quem subiu esta faixa" que aparece no Espaço Jam).
  currentUserId?: string | null;
  currentUserAvatar?: string | null;
  onClose: () => void;
  onSaved: (item: CatalogItem) => void;
  onDelete?: (id: string) => Promise<void> | void; // exclui a faixa (só na edição)
}

const emptyDraft = (): Partial<CatalogItem> => ({
  title: '',
  status: 'composition',
  composition_splits: [],
  recording_splits: [],
});

const uid = () => Math.random().toString(36).slice(2, 10);

const SplitEditor: FC<{
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
const UploadField: FC<{
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
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#62769b', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {fileName || 'Arquivo enviado'}
            </div>
            <div style={{ color: '#1d8a68', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <FiCheckCircle size={12} /> Enviado
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

// Player de áudio no visual do sistema (substitui o <audio controls> cru do navegador):
// botão play/pause no lugar do ícone, barra de progresso e tempo, + Trocar/Remover.
const fmtTime = (s: number) => {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, '0')}`;
};

const AudioPreview: FC<{ src: string; fileName?: string | null; onFile: (f: File) => void; onClear: () => void }> = ({ src, fileName, onFile, onClear }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play(); else a.pause();
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#1f1f1f', border: '1px solid #2f2f2f', borderRadius: 10, padding: 10 }}>
      <audio
        ref={audioRef}
        src={src}
        preload='metadata'
        style={{ display: 'none' }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
      />
      <input
        ref={inputRef}
        type='file'
        accept='audio/*'
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
      />
      <button
        type='button'
        onClick={toggle}
        aria-label={playing ? 'Pausar' : 'Reproduzir'}
        style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: '#9A4FD1', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
      >
        {playing ? <FiPause size={18} /> : <FiPlay size={18} style={{ marginLeft: 2 }} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {fileName || 'Áudio enviado'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <span style={{ color: '#b3b3b3', fontSize: 11, fontVariantNumeric: 'tabular-nums', minWidth: 32 }}>{fmtTime(cur)}</span>
          <input
            type='range'
            min={0}
            max={dur || 0}
            step={0.1}
            value={Math.min(cur, dur || 0)}
            onChange={(e) => { const a = audioRef.current; const v = Number(e.target.value); if (a) a.currentTime = v; setCur(v); }}
            aria-label='Progresso do áudio'
            style={{ flex: 1, accentColor: '#9A4FD1', height: 4, cursor: 'pointer' }}
          />
          <span style={{ color: '#7a7a7a', fontSize: 11, fontVariantNumeric: 'tabular-nums', minWidth: 32, textAlign: 'right' }}>{fmtTime(dur)}</span>
        </div>
      </div>
      <button type='button' onClick={() => inputRef.current?.click()} style={ghostBtn}>Trocar</button>
      <button type='button' onClick={onClear} style={{ ...ghostBtn, color: '#ff6b6f', padding: '6px 10px' }} aria-label='Remover'>
        <FiTrash2 size={15} />
      </button>
    </div>
  );
};

export const TrackModal: FC<Props> = ({ open, artistId, item, genres, assigneeOptions, currentUserName, currentUserId, currentUserAvatar, onClose, onSaved, onDelete }) => {
  // message do contexto <App> do antd — o `message` estático é no-op aqui (toasts não apareciam).
  const { message } = App.useApp();
  const [draft, setDraft] = useState<Partial<CatalogItem>>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!item || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete(item.id);
      onClose();
    } catch (e: any) {
      message.error(e?.message || 'Erro ao excluir');
    } finally {
      setDeleting(false);
    }
  };
  const [uploading, setUploading] = useState<'cover' | 'audio' | null>(null);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    if (open) {
      setDraft(item ? { ...item } : emptyDraft());
      setNoteText('');
    }
  }, [open, item]);

  // Adiciona uma observação ao histórico (salva junto com a faixa).
  const addNote = () => {
    const text = noteText.trim();
    if (!text) return;
    set({
      history: [
        ...(draft.history || []),
        { id: uid(), author: currentUserName, text, at: new Date().toISOString() },
      ],
    });
    setNoteText('');
  };

  const set = (patch: Partial<CatalogItem>) => setDraft((d) => ({ ...d, ...patch }));

  const handleUpload = async (kind: 'cover' | 'audio', file: File) => {
    setUploading(kind);
    try {
      const res = await uploadFile(CATALOG_BUCKET, `${artistId}/${kind}`, file);
      if (kind === 'cover') set({ cover_image: res.url, cover_image_name: res.name });
      else set({ audio_file: res.url, audio_file_name: res.name });
    } catch (e: any) {
      message.error(e?.message || 'Falha no upload');
    } finally {
      setUploading(null);
    }
  };

  const handleSave = async () => {
    if (!draft.title?.trim()) {
      message.warning('Informe o título da música (aba Informações) antes de salvar.');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        artist_id: artistId,
        title: draft.title,
        status: draft.status || 'composition',
        genre: draft.genre || null,
        release_date: draft.release_date || null,
        isrc: draft.isrc || null,
        upc: draft.upc || null,
        bpm: draft.bpm || null,
        key: draft.key || null,
        duration: draft.duration || null,
        lyrics: draft.lyrics || null,
        cover_image: draft.cover_image || null,
        cover_image_name: draft.cover_image_name || null,
        audio_file: draft.audio_file || null,
        audio_file_name: draft.audio_file_name || null,
        composition_splits: draft.composition_splits || [],
        recording_splits: draft.recording_splits || [],
        assignee: draft.assignee || null,
        history: draft.history || [],
      };
      // Grava a MÚSICA como projeto (+ a V1 dela). Antes isto ia pra `catalog_items`, a tabela
      // legada, e um espelho posterior tentava criar o projeto — mas falhava e era engolido,
      // então a música sumia no reload. Ver saveCatalogProjectFromForm.
      const saved = await catalogDb.saveCatalogProjectFromForm(
        {
          ...payload,
          id: item?.project_id || item?.id,
          versionId: item?.version_id,
        },
        { id: currentUserId, name: currentUserName, avatar: currentUserAvatar },
      );
      onSaved(saved);
      onClose();
    } catch (e: any) {
      message.error(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      centered
      width={640}
      destroyOnHidden
      rootClassName={modalStyles.modal}
      title={
        <div className={modalStyles.heading}>
          <span className={modalStyles.kicker}>Música</span>
          <span className={modalStyles.title}>
            {draft.title?.trim() || (item ? 'Editar música' : 'Nova música')}
          </span>
          <span className={modalStyles.subtitle}>
            {item
              ? 'A ficha da obra: identidade, créditos e letra. As gravações ficam nas versões.'
              : 'A ficha da obra. O áudio que você enviar aqui vira a primeira versão (V1).'}
          </span>
        </div>
      }
      footer={
        <div className={modalStyles.footer}>
          {/* Excluir vive AQUI (não na linha de músicas) — só na edição de uma música existente. */}
          {item && onDelete && (
            <Popconfirm
              title='Excluir música?'
              description='Esta ação não pode ser desfeita.'
              okText='Excluir'
              cancelText='Cancelar'
              okButtonProps={{ danger: true }}
              onConfirm={handleDelete}
            >
              <Button
                className={modalStyles.dangerButton}
                danger
                type='text'
                icon={<FiTrash2 />}
                loading={deleting}
              >
                Excluir música
              </Button>
            </Popconfirm>
          )}
          <div className={modalStyles.footerActions}>
            <Button onClick={onClose}>Cancelar</Button>
            <Button type='primary' loading={saving} onClick={handleSave}>
              Salvar
            </Button>
          </div>
        </div>
      }
    >
      <Tabs
        className={modalStyles.tabs}
        items={[
          {
            key: 'info',
            label: 'Informações',
            children: (
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
                    onFile={(f) => handleUpload('cover', f)}
                    onClear={() => set({ cover_image: null, cover_image_name: null })}
                  />
                </label>
              </div>
            ),
          },
          {
            key: 'lyrics',
            label: 'Letras',
            children: (
              <Input.TextArea
                rows={10}
                placeholder='Letra da música…'
                value={draft.lyrics || ''}
                onChange={(e) => set({ lyrics: e.target.value })}
              />
            ),
          },
          {
            key: 'splits',
            label: 'Splits',
            children: (
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
            ),
          },
          {
            key: 'audio',
            label: 'Áudio',
            children: (
              <div>
                {/* No CADASTRO o áudio é aceito aqui: ele vira a V1 da música, e obrigar a
                    pessoa a criar a música e só depois subir a primeira gravação seria um passo
                    a mais sem ganho. Na EDIÇÃO ele sai: o arquivo já pertence a uma versão
                    específica, e trocá-lo por aqui sobrescreveria a versão principal sem a
                    pessoa escolher qual. Esse é o trabalho do Espaço Jam. */}
                {item ? (
                  <div className={modalStyles.hint}>
                    <FiMusic size={18} />
                    <div>
                      <strong>O áudio agora vive nas versões</strong>
                      <small>
                        Cada gravação desta música (guia, mix, master) é uma versão, com o
                        próprio arquivo. Abra o Espaço Jam para enviar ou substituir.
                      </small>
                    </div>
                  </div>
                ) : draft.audio_file && uploading !== 'audio' ? (
                  <AudioPreview
                    src={draft.audio_file}
                    fileName={draft.audio_file_name}
                    onFile={(f) => handleUpload('audio', f)}
                    onClear={() => set({ audio_file: null, audio_file_name: null })}
                  />
                ) : (
                  <UploadField
                    accept='audio/*'
                    hint='Vira a primeira versão (V1) da música'
                    uploading={uploading === 'audio'}
                    hasValue={false}
                    thumb={<FiMusic size={20} />}
                    onFile={(f) => handleUpload('audio', f)}
                    onClear={() => set({ audio_file: null, audio_file_name: null })}
                  />
                )}
              </div>
            ),
          },
          {
            key: 'history',
            label: 'Histórico',
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Input.TextArea
                    autoSize={{ minRows: 2, maxRows: 5 }}
                    placeholder='Deixe uma observação ou interação…'
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                  />
                  <button
                    onClick={addNote}
                    disabled={!noteText.trim()}
                    style={{
                      background: '#9A4FD1',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 8,
                      padding: '8px 16px',
                      fontWeight: 700,
                      cursor: noteText.trim() ? 'pointer' : 'not-allowed',
                      opacity: noteText.trim() ? 1 : 0.5,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Adicionar
                  </button>
                </div>
                {(draft.history || []).length === 0 ? (
                  <div style={{ color: '#888', fontSize: 13, padding: '8px 0' }}>
                    Nenhuma observação ainda. As anotações são salvas junto com a música.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(draft.history || [])
                      .slice()
                      .reverse()
                      .map((n) => (
                        <div
                          key={n.id}
                          style={{ background: '#1f1f1f', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 12px' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                            <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{n.author}</span>
                            <span style={{ color: '#888', fontSize: 12 }}>{dayjs(n.at).format('DD/MM/YYYY HH:mm')}</span>
                          </div>
                          <div style={{ color: '#d0d0d0', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.text}</div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
};

export default TrackModal;
