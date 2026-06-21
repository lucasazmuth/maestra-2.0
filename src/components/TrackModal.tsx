import { FC, useEffect, useState } from 'react';
import { Modal, Input, Select, DatePicker, Tabs, message } from 'antd';
import dayjs from 'dayjs';

import type { CatalogItem, Split, MusicGenre } from '../interfaces/maestra';
import { CATALOG_STATUS_OPTIONS, SPLIT_ROLES } from '../constants/maestra';
import { uploadFile, CATALOG_BUCKET } from '../lib/storage';
import * as catalogDb from '../services/db/catalog';

interface Props {
  open: boolean;
  artistId: string;
  item?: CatalogItem | null; // edição quando presente
  genres: MusicGenre[];
  assigneeOptions: { id: string; name: string }[];
  currentUserName: string;
  onClose: () => void;
  onSaved: (item: CatalogItem) => void;
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
    <div>
      {splits.map((s, i) => (
        <div key={s.id} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <Input
            placeholder='Nome'
            value={s.name}
            onChange={(e) => {
              const next = splits.slice();
              next[i] = { ...s, name: e.target.value };
              onChange(next);
            }}
          />
          <Select
            style={{ width: 160 }}
            placeholder='Função'
            value={s.role || undefined}
            options={SPLIT_ROLES.map((r) => ({ value: r, label: r }))}
            onChange={(v) => {
              const next = splits.slice();
              next[i] = { ...s, role: v };
              onChange(next);
            }}
          />
          <Input
            type='number'
            style={{ width: 90 }}
            suffix='%'
            value={s.percentage}
            onChange={(e) => {
              const next = splits.slice();
              next[i] = { ...s, percentage: Number(e.target.value) };
              onChange(next);
            }}
          />
          <button
            onClick={() => onChange(splits.filter((x) => x.id !== s.id))}
            style={{ background: 'transparent', border: 'none', color: '#e91429', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => onChange([...splits, { id: uid(), name: '', role: '', percentage: 0 }])}
          style={{
            background: 'transparent',
            border: '1px solid #444',
            color: '#fff',
            borderRadius: 9999,
            padding: '4px 12px',
            cursor: 'pointer',
          }}
        >
          + Adicionar
        </button>
        <span style={{ color: total === 100 ? '#af2896' : '#b3b3b3', fontSize: 13 }}>
          Total: {total}%
        </span>
      </div>
    </div>
  );
};

export const TrackModal: FC<Props> = ({ open, artistId, item, genres, assigneeOptions, currentUserName, onClose, onSaved }) => {
  const [draft, setDraft] = useState<Partial<CatalogItem>>(emptyDraft());
  const [saving, setSaving] = useState(false);
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
      message.warning('Informe o título');
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
      const saved = item
        ? await catalogDb.updateCatalogItem(item.id, payload)
        : await catalogDb.createCatalogItem(payload);
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
      destroyOnClose
      title={<span style={{ color: '#fff', fontWeight: 700 }}>{item ? 'Editar faixa' : 'Nova faixa'}</span>}
      okText={saving ? 'Salvando…' : 'Salvar'}
      onOk={handleSave}
      okButtonProps={{ loading: saving, style: { background: '#af2896', color: '#fff' } }}
    >
      <Tabs
        items={[
          {
            key: 'info',
            label: 'Informações',
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Input
                  placeholder='Título *'
                  value={draft.title}
                  onChange={(e) => set({ title: e.target.value })}
                />
                <div style={{ display: 'flex', gap: 12 }}>
                  <Select
                    style={{ flex: 1 }}
                    placeholder='Status'
                    value={draft.status}
                    options={CATALOG_STATUS_OPTIONS.map((s) => ({ value: s.id, label: s.label }))}
                    onChange={(v) => set({ status: v })}
                  />
                  <Select
                    style={{ flex: 1 }}
                    placeholder='Gênero'
                    allowClear
                    showSearch
                    optionFilterProp='label'
                    value={draft.genre || undefined}
                    options={genres.map((g) => ({ value: g.name, label: g.name }))}
                    onChange={(v) => set({ genre: v })}
                  />
                </div>
                <Select
                  style={{ width: '100%' }}
                  placeholder='Responsável'
                  allowClear
                  value={draft.assignee?.id}
                  options={assigneeOptions.map((o) => ({ value: o.id, label: o.name }))}
                  onChange={(v) => {
                    const o = assigneeOptions.find((x) => x.id === v);
                    set({ assignee: o ? { id: o.id, name: o.name } : null });
                  }}
                />
                <div style={{ display: 'flex', gap: 12 }}>
                  <DatePicker
                    style={{ flex: 1 }}
                    placeholder='Data de lançamento'
                    value={draft.release_date ? dayjs(draft.release_date) : null}
                    onChange={(d) => set({ release_date: d ? d.format('YYYY-MM-DD') : null })}
                  />
                  <Input
                    style={{ flex: 1 }}
                    placeholder='Duração (ex.: 3:24)'
                    value={draft.duration || ''}
                    onChange={(e) => set({ duration: e.target.value })}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Input placeholder='ISRC' value={draft.isrc || ''} onChange={(e) => set({ isrc: e.target.value })} />
                  <Input placeholder='UPC' value={draft.upc || ''} onChange={(e) => set({ upc: e.target.value })} />
                  <Input placeholder='BPM' value={draft.bpm || ''} onChange={(e) => set({ bpm: e.target.value })} />
                  <Input placeholder='Tom' value={draft.key || ''} onChange={(e) => set({ key: e.target.value })} />
                </div>
                <div>
                  <label style={{ color: '#b3b3b3', fontSize: 13 }}>Capa</label>
                  <input
                    type='file'
                    accept='image/*'
                    onChange={(e) => e.target.files?.[0] && handleUpload('cover', e.target.files[0])}
                  />
                  {uploading === 'cover' && <span style={{ color: '#b3b3b3' }}> enviando…</span>}
                  {draft.cover_image && (
                    <img src={draft.cover_image} alt='capa' style={{ height: 48, marginLeft: 8, borderRadius: 4 }} />
                  )}
                </div>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <h4 style={{ color: '#fff' }}>Composição (obra)</h4>
                  <SplitEditor
                    splits={draft.composition_splits || []}
                    onChange={(s) => set({ composition_splits: s })}
                  />
                </div>
                <div>
                  <h4 style={{ color: '#fff' }}>Gravação (fonograma)</h4>
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
                <label style={{ color: '#b3b3b3', fontSize: 13 }}>Arquivo de áudio</label>
                <input
                  type='file'
                  accept='audio/*'
                  onChange={(e) => e.target.files?.[0] && handleUpload('audio', e.target.files[0])}
                />
                {uploading === 'audio' && <div style={{ color: '#b3b3b3' }}>enviando…</div>}
                {draft.audio_file && (
                  <audio controls src={draft.audio_file} style={{ width: '100%', marginTop: 12 }} />
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
                      background: '#af2896',
                      color: '#fff',
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
                    Nenhuma observação ainda. As anotações são salvas junto com a faixa.
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
