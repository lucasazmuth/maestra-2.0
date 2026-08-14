import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { App, Button, Input, Modal, Popconfirm, Spin, Tooltip } from 'antd';
import { FiMusic, FiStar, FiTrash2, FiUploadCloud } from 'react-icons/fi';

import { readAudioDuration, titleFromFileName } from '../lib/audioMeta';
import { uploadFile, CATALOG_BUCKET } from '../lib/storage';
import * as catalogDb from '../services/db/catalog';
import type { CatalogVersion } from '../interfaces/maestra';
import modalStyles from './StandardModal.module.scss';

// Modal da VERSÃO (a gravação), irmão do TrackModal — que cuida da MÚSICA.
//
// A versão é só isto: um nome que a equipe reconheça ("guia vocal", "mix v2"), o arquivo e a
// marca de qual é a principal. Etapa e Status saíram: status é da MÚSICA (e já se edita na
// ficha dela), e etapa dizia a mesma coisa que o título diria melhor — o nome livre descreve a
// gravação com mais precisão do que uma lista fechada.
//
// Serve pra enviar versão nova e pra editar: a diferença é existir ou não `version`.


interface Props {
  open: boolean;
  artistId: string;
  projectId: string;
  projectTitle: string;
  version?: CatalogVersion | null;
  nextVersionNumber?: number;
  // Arquivo já escolhido antes de abrir o modal (fluxo do botão Upload): o modal abre
  // preenchido e a pessoa só confirma.
  initialFile?: File | null;
  // Já é a versão principal do projeto? Esconde a ação de tornar principal.
  isPrimary?: boolean;
  inherit?: { bpm?: string | null; key?: string | null; genre?: string | null };
  author?: { id?: string | null; name?: string | null; avatar?: string | null };
  onClose: () => void;
  onSaved: () => unknown | Promise<unknown>;
  onDeleted?: () => unknown | Promise<unknown>;
}

export const VersionModal: FC<Props> = ({
  open, artistId, projectId, projectTitle, version, nextVersionNumber = 1, isPrimary,
  initialFile, inherit, author, onClose, onSaved, onDeleted,
}) => {
  const { message } = App.useApp();
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const editing = Boolean(version);

  const pickFile = useCallback(async (chosen: File) => {
    setFile(chosen);
    const detected = await readAudioDuration(chosen);
    if (detected) setDuration(detected);
  }, []);

  // Recarrega ao abrir, senão a versão anterior "vaza" para a próxima. Quando o arquivo veio
  // de fora (botão Upload), o formulário já nasce preenchido: título vem do nome do arquivo e
  // a duração é lida do áudio.
  useEffect(() => {
    if (!open) return;
    setFile(null);
    if (initialFile && !version) {
      setTitle(titleFromFileName(initialFile.name));
      setDuration('');
      void pickFile(initialFile);
      return;
    }
    setTitle(version?.title || '');
    setDuration(version?.duration || '');
  }, [open, version, initialFile, pickFile]);

  const handleSave = async () => {
    if (!title.trim()) {
      message.warning('Dê um nome à versão (ex.: guia vocal, mix v2).');
      return;
    }
    setSaving(true);
    try {
      const uploaded = file
        ? await uploadFile(CATALOG_BUCKET, `${artistId}/${projectId}/versions`, file)
        : null;

      if (version) {
        await catalogDb.updateCatalogVersion(version.id, {
          title: title.trim(),
          duration: duration.trim() || null,
          // Sem arquivo novo, o áudio atual permanece — substituir é opcional.
          ...(uploaded ? { audio_file: uploaded.url, audio_file_name: uploaded.name } : {}),
        });
      } else {
        await catalogDb.createCatalogVersion({
          project_id: projectId,
          version_number: nextVersionNumber,
          title: title.trim(),
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

  // Favoritar é uma decisão à parte de salvar: acontece na hora e não depende do formulário.
  // Clicar de novo desmarca — a música fica sem versão principal até outra ser escolhida.
  const togglePrimary = async () => {
    if (!version) return;
    setPromoting(true);
    try {
      await catalogDb.setPrimaryVersion(projectId, isPrimary ? null : version.id);
      message.success(isPrimary
        ? `V${version.version_number} não é mais a versão principal`
        : `V${version.version_number} agora é a versão principal`);
      await onSaved();
    } catch (e: any) {
      message.error(e?.message || 'Não foi possível definir como principal');
    } finally {
      setPromoting(false);
    }
  };

  const remove = async () => {
    if (!version) return;
    setRemoving(true);
    try {
      await catalogDb.deleteCatalogVersion(version.id);
      message.success(`V${version.version_number} excluída`);
      await (onDeleted ? onDeleted() : onSaved());
      onClose();
    } catch (e: any) {
      message.error(e?.message || 'Não foi possível excluir a versão');
    } finally {
      setRemoving(false);
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
            <i className={modalStyles.titleDot} aria-hidden />
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
          {/* Excluir fica na ponta oposta de Salvar: é a acão de onde não se volta. */}
          {editing && (
            <Popconfirm
              title='Excluir esta versão?'
              description='O áudio e os comentários dela saem do Espaço JAM.'
              okText='Excluir'
              cancelText='Cancelar'
              okButtonProps={{ danger: true, loading: removing }}
              onConfirm={remove}
            >
              <Button type='text' danger icon={<FiTrash2 />} className={modalStyles.dangerButton}>
                Excluir
              </Button>
            </Popconfirm>
          )}
          <div className={modalStyles.footerActions}>
            {/* Mesma estrela da lista de versões, ao lado de Salvar: cheia quando é a principal,
                vazia quando não é, e clicar alterna nos dois sentidos. O rótulo vive no tooltip
                — o ícone sozinho já diz o estado. */}
            {editing && (
              <Tooltip title={isPrimary ? 'Desmarcar como principal' : 'Tornar principal'}>
                <button
                  type='button'
                  className={`${modalStyles.primaryStar} ${isPrimary ? modalStyles.primaryStarOn : ''}`}
                  disabled={promoting}
                  onClick={togglePrimary}
                  aria-pressed={isPrimary}
                  aria-label={isPrimary ? 'Desmarcar como versão principal' : 'Tornar versão principal'}
                >
                  {promoting ? <Spin size='small' /> : <FiStar />}
                </button>
              </Tooltip>
            )}
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
            <span>Título da versão *</span>
            <Input
              value={title}
              placeholder='Ex.: guia vocal, mix v2'
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className={modalStyles.field}>
            {/* Somente leitura: vem do próprio arquivo assim que ele é escolhido. */}
            <span>Duração</span>
            <Input
              value={duration}
              readOnly
              placeholder={file ? 'Lendo do arquivo…' : 'Ao anexar o áudio'}
            />
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
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickFile(f); }}
          />
        </label>
      </div>
    </Modal>
  );
};

export default VersionModal;
