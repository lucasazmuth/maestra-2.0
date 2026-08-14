import { FC, useEffect, useRef, useState } from 'react';
import { App, Button, Input, Modal, Select } from 'antd';
import { FiMusic, FiUploadCloud } from 'react-icons/fi';

import { CATALOG_STATUS_OPTIONS } from '../constants/maestra';
import { uploadFile, CATALOG_BUCKET } from '../lib/storage';
import * as catalogDb from '../services/db/catalog';
import type { CatalogVersion, CatalogVersionStage } from '../interfaces/maestra';
import modalStyles from './StandardModal.module.scss';

// Modal da VERSÃO (a faixa gravada), irmão do TrackModal — que cuida da MÚSICA.
//
// A separação é a do próprio banco e a que a equipe usa pra conversar: a MÚSICA é a obra
// (título, capa, ISRC, letra, splits) e a VERSÃO é uma gravação dela (guia, mix, master), com
// o áudio e a etapa. Antes tudo vivia numa tela só, e "editar" não deixava claro o que estava
// sendo alterado — o áudio de uma versão específica ou a ficha da música inteira.
//
// Serve tanto pra enviar uma versão nova quanto pra editar uma existente: o que muda é só se
// há `version`.

export const VERSION_STAGES: { value: CatalogVersionStage; label: string }[] = [
  { value: 'guia', label: 'Guia' },
  { value: 'beat', label: 'Beat' },
  { value: 'instrumental', label: 'Instrumental' },
  { value: 'voz', label: 'Voz' },
  { value: 'stems', label: 'Stems' },
  { value: 'mix', label: 'Mixagem' },
  { value: 'master', label: 'Masterização' },
  { value: 'referencia', label: 'Referência' },
];

interface Props {
  open: boolean;
  artistId: string;
  projectId: string;
  projectTitle: string;
  // Presente = edição. Ausente = enviar nova versão.
  version?: CatalogVersion | null;
  // Número da próxima versão, mostrado no cabeçalho ao criar.
  nextVersionNumber?: number;
  // Herdados da música quando a versão nasce, pra não pedir de novo o que já foi informado.
  inherit?: { bpm?: string | null; key?: string | null; genre?: string | null };
  author?: { id?: string | null; name?: string | null; avatar?: string | null };
  onClose: () => void;
  // O retorno é ignorado — só esperamos a recarga terminar antes de fechar.
  onSaved: () => unknown | Promise<unknown>;
}

export const VersionModal: FC<Props> = ({
  open, artistId, projectId, projectTitle, version, nextVersionNumber = 1, inherit, author, onClose, onSaved,
}) => {
  const { message } = App.useApp();
  const [stage, setStage] = useState<CatalogVersionStage>('guia');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('composition');
  const [duration, setDuration] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Recarrega os campos toda vez que o modal abre, senão a versão anterior "vaza" para a próxima.
  useEffect(() => {
    if (!open) return;
    setStage((version?.stage as CatalogVersionStage) || 'guia');
    setTitle(version?.title || '');
    setStatus(version?.status || 'composition');
    setDuration(version?.duration || '');
    setFile(null);
  }, [open, version]);

  const editing = Boolean(version);

  const handleSave = async () => {
    setSaving(true);
    try {
      const uploaded = file
        ? await uploadFile(CATALOG_BUCKET, `${artistId}/${projectId}/versions`, file)
        : null;

      if (version) {
        await catalogDb.updateCatalogVersion(version.id, {
          stage,
          status,
          title: title.trim() || null,
          duration: duration.trim() || null,
          // Sem arquivo novo, o áudio atual permanece — "substituir" é opcional.
          ...(uploaded ? { audio_file: uploaded.url, audio_file_name: uploaded.name } : {}),
        });
      } else {
        await catalogDb.createCatalogVersion({
          project_id: projectId,
          version_number: nextVersionNumber,
          stage,
          status,
          title: title.trim() || null,
          duration: duration.trim() || null,
          audio_file: uploaded?.url || null,
          audio_file_name: uploaded?.name || null,
          bpm: inherit?.bpm ?? null,
          key: inherit?.key ?? null,
          genre: inherit?.genre ?? null,
          author_id: author?.id || null,
          author_name: author?.name || null,
          author_avatar: author?.avatar || null,
        } as any);
      }

      // createCatalogVersion/updateCatalogVersion já promovem a versão com áudio a principal.
      message.success(uploaded
        ? `Versão ${editing ? 'atualizada' : 'enviada'} e definida como principal`
        : `Versão ${editing ? 'atualizada' : 'adicionada'}`);
      await onSaved();
      onClose();
    } catch (e: any) {
      message.error(e?.message || `Não foi possível ${editing ? 'atualizar' : 'adicionar'} a versão`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      centered
      width={520}
      destroyOnHidden
      rootClassName={modalStyles.modal}
      title={
        <div className={modalStyles.heading}>
          <span className={modalStyles.kicker}>Versão</span>
          <span className={modalStyles.title}>
            {editing ? `Editar V${version!.version_number}` : `Nova versão (V${nextVersionNumber})`}
          </span>
          <span className={modalStyles.subtitle}>
            {editing
              ? `Uma gravação de "${projectTitle}". Alterações aqui não mudam a ficha da música.`
              : `Envie uma nova gravação de "${projectTitle}" — a música em si continua a mesma.`}
          </span>
        </div>
      }
      footer={
        <div className={modalStyles.footer}>
          <div className={modalStyles.footerActions}>
            <Button onClick={onClose}>Cancelar</Button>
            <Button type='primary' loading={saving} onClick={handleSave}>
              {editing ? 'Salvar alterações' : 'Enviar versão'}
            </Button>
          </div>
        </div>
      }
    >
      <div className={modalStyles.form}>
        <div className={modalStyles.fieldGrid}>
          <label className={modalStyles.field}>
            <span>Etapa</span>
            <Select value={stage} options={VERSION_STAGES} onChange={setStage} />
          </label>
          <label className={modalStyles.field}>
            <span>Status</span>
            <Select
              value={status}
              options={CATALOG_STATUS_OPTIONS.map((s) => ({ value: s.id, label: s.label }))}
              onChange={setStatus}
            />
          </label>
        </div>

        <div className={modalStyles.fieldGrid}>
          <label className={modalStyles.field}>
            <span>Título da versão (opcional)</span>
            <Input value={title} placeholder='Ex.: guia vocal, mix v2' onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className={modalStyles.field}>
            <span>Duração</span>
            <Input value={duration} placeholder='Ex.: 3:24' onChange={(e) => setDuration(e.target.value)} />
          </label>
        </div>

        <label className={modalStyles.field}>
          <span>{editing ? 'Substituir áudio (opcional)' : 'Áudio da versão'}</span>
          <button type='button' className={modalStyles.uploadBox} onClick={() => fileRef.current?.click()}>
            <i>{file ? <FiMusic size={18} /> : <FiUploadCloud size={18} />}</i>
            <div>
              <strong>{file ? file.name : 'Arraste aqui ou clique para escolher'}</strong>
              <small>
                {version?.audio_file_name && !file
                  ? `Atual: ${version.audio_file_name}`
                  : 'MP3, WAV ou outro formato de áudio'}
              </small>
            </div>
          </button>
          <input
            ref={fileRef}
            type='file'
            accept='audio/*'
            style={{ display: 'none' }}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
      </div>
    </Modal>
  );
};

export default VersionModal;
