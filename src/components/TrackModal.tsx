import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Input, Tabs, App, Spin, Button, Popconfirm } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { FiUploadCloud, FiMusic, FiTrash2, FiStar, FiPlay, FiPause } from 'react-icons/fi';

import type { CatalogItem, CatalogVersion, MusicGenre } from '@maestra/core/interfaces/maestra';
import { readAudioDuration } from '../lib/audioMeta';
import { tituloDoArquivo as titleFromFileName } from '@maestra/core/services/armazenamento';
import { uploadFile, CATALOG_BUCKET } from '../lib/storage';
import * as catalogDb from '@maestra/core/services/db/catalog';
import modalStyles from './StandardModal.module.scss';
import { CamposDaFicha, CamposDosSplits, UploadField } from './ficha/campos';

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
  // Áudio já escolhido antes de abrir a ficha ("Nova música" começa pelo seletor de arquivos).
  // A ficha abre com o título tirado do nome do arquivo e a V1 já subindo. Só vale na criação.
  initialFile?: File | null;
  // Uma versão anexada aqui já existe no banco antes de "Salvar": quem mostra a lista de
  // versões (o Espaço Jam) precisa saber para se atualizar mesmo se a pessoa cancelar.
  onVersionsChanged?: () => void;
}

const emptyDraft = (): Partial<CatalogItem> => ({
  title: '',
  status: 'composition',
  composition_splits: [],
  recording_splits: [],
});

// O bloco de versões saiu da ficha: uma música deixou de ser "várias gravações alternativas,
// uma delas a boa" e passou a ser UMA montagem, e eleger uma principal entre pistas de um mesmo
// arranjo não quer dizer nada. O componente fica à espera de uma decisão sobre as gravações
// antigas — apagá-lo agora seria deitar fora a única tela que sabe lidar com elas.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const VersionsSection: FC<{
  artistId: string;
  projectId?: string | null;
  author: { id?: string | null; name?: string | null; avatar?: string | null };
  onChanged?: () => void;
  firstFileName?: string | null;
  // URL do arquivo já enviado no cadastro. É o que permite ouvir a V1 antes de a música existir:
  // o upload acontece na hora da escolha, só o registro é que espera o "Salvar".
  firstFileUrl?: string | null;
  uploadingFirst: boolean;
  onPickFirst: (file: File) => void;
  onClearFirst: () => void;
}> = ({ artistId, projectId, author, onChanged, firstFileName, firstFileUrl, uploadingFirst, onPickFirst, onClearFirst }) => {
  const { message } = App.useApp();
  const [versions, setVersions] = useState<CatalogVersion[]>([]);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // Versão em operação (trocando o arquivo ou excluindo): troca as ações pelo indicador.
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Input do "Trocar": um só, apontado para a versão escolhida na hora.
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<CatalogVersion | null>(null);
  // Prévia do áudio na própria ficha: quem acabou de subir um arquivo quer conferir se mandou
  // o certo sem ter que sair pro Espaço Jam. Um <audio> só, reaproveitado a cada versão —
  // tocar uma para a anterior por construção.
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const togglePlay = (id: string, url?: string | null) => {
    const el = audioRef.current;
    if (!el || !url) return;
    if (playingId === id) {
      el.pause();
      return;
    }
    el.src = url;
    setPlayingId(id);
    el.play().catch(() => {
      setPlayingId(null);
      message.error('Não foi possível reproduzir este arquivo');
    });
  };

  // Ao fechar/trocar de música o áudio precisa parar junto — senão ele continua tocando por
  // trás do modal fechado.
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const project = await catalogDb.getCatalogProject(projectId);
      setVersions((project.versions || []).slice().sort((a, b) => b.version_number - a.version_number));
      setPrimaryId(project.primary_version_id || null);
    } catch {
      // A ficha continua editável mesmo se a lista de versões não carregar.
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const add = async (file: File) => {
    if (!projectId) return;
    setAdding(true);
    try {
      const duration = await readAudioDuration(file);
      const uploaded = await uploadFile(CATALOG_BUCKET, `${artistId}/${projectId}/versions`, file);
      const number = versions.length ? Math.max(...versions.map((v) => v.version_number)) + 1 : 1;
      const created = await catalogDb.createCatalogVersion({
        project_id: projectId,
        version_number: number,
        title: titleFromFileName(file.name),
        duration,
        audio_file: uploaded.url,
        audio_file_name: uploaded.name,
        author_id: author.id || null,
        author_name: author.name || null,
        author_avatar: author.avatar || null,
      } as any);
      // createCatalogVersion já aponta a versão com áudio como principal (regra do produto),
      // então não há promoção a fazer aqui.
      void created;
      message.success(`V${number} adicionada`);
      await load();
      onChanged?.();
    } catch (e: any) {
      message.error(e?.message || 'Não foi possível adicionar a versão');
    } finally {
      setAdding(false);
    }
  };

  // Troca o áudio de uma versão que já existe (mesmo registro, arquivo novo).
  const replace = async (version: CatalogVersion, file: File) => {
    setBusyId(version.id);
    try {
      const duration = await readAudioDuration(file);
      const uploaded = await uploadFile(CATALOG_BUCKET, `${artistId}/${projectId}/versions`, file);
      await catalogDb.updateCatalogVersion(version.id, {
        title: titleFromFileName(file.name),
        duration,
        audio_file: uploaded.url,
        audio_file_name: uploaded.name,
      } as Partial<CatalogVersion>);
      if (playingId === version.id) audioRef.current?.pause();
      message.success(`V${version.version_number} atualizada`);
      await load();
      onChanged?.();
    } catch (e: any) {
      message.error(e?.message || 'Não foi possível trocar o arquivo');
    } finally {
      setBusyId(null);
    }
  };

  // Promove a versão a principal: é ela que toca na lista de músicas, no Dashboard e no player.
  const promote = async (version: CatalogVersion) => {
    if (!projectId || version.id === primaryId) return;
    setBusyId(version.id);
    try {
      await catalogDb.setPrimaryVersion(projectId, version.id);
      message.success(`V${version.version_number} agora é a versão principal`);
      await load();
      onChanged?.();
    } catch (e: any) {
      message.error(e?.message || 'Não foi possível trocar a versão principal');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (version: CatalogVersion) => {
    setBusyId(version.id);
    try {
      await catalogDb.deleteCatalogVersion(version.id);
      if (playingId === version.id) audioRef.current?.pause();
      message.success(`V${version.version_number} excluída`);
      await load();
      onChanged?.();
    } catch (e: any) {
      message.error(e?.message || 'Não foi possível excluir a versão');
    } finally {
      setBusyId(null);
    }
  };

  // Uma linha de versão. É o MESMO desenho nos dois modos — no cadastro ela representa a V1
  // que ainda não existe no banco, na edição cada versão gravada. Antes o cadastro mostrava um
  // cartão de upload completamente diferente, sem play.
  const row = (opts: {
    id: string;
    number: number;
    title: string;
    duration?: string | null;
    url?: string | null;
    primary?: boolean;
    busy?: boolean;
    // Ausente quando não há o que promover (no cadastro só existe a V1, que já é a principal).
    onPrimary?: () => void;
    onReplace: () => void;
    onDelete: () => void;
  }) => (
    <div key={opts.id} className={modalStyles.versionsRow}>
      <button
        type='button'
        className={`${modalStyles.versionsPlay}${playingId === opts.id ? ` ${modalStyles.versionsPlayOn}` : ''}`}
        disabled={!opts.url}
        aria-label={playingId === opts.id ? 'Pausar' : `Ouvir V${opts.number}`}
        title={opts.url
          ? (playingId === opts.id ? 'Pausar' : 'Ouvir esta versão')
          : 'Esta versão não tem áudio'}
        onClick={() => togglePlay(opts.id, opts.url)}
      >
        {playingId === opts.id ? <FiPause size={12} /> : <FiPlay size={12} />}
      </button>
      <em>V{opts.number}</em>
      <strong>{opts.title}</strong>
      {opts.duration && <small>{opts.duration}</small>}
      {/* Estrela cheia = já é a principal; vazia = clique para promover. É a versão principal que
          toca na lista de músicas, no Dashboard e no player. Sem `onPrimary` (cadastro) ela vira
          só o selo, porque não há outra versão para escolher. */}
      {opts.onPrimary ? (
        <button
          type='button'
          className={`${modalStyles.primaryStar}${opts.primary ? ` ${modalStyles.primaryStarOn}` : ''}`}
          aria-pressed={!!opts.primary}
          disabled={opts.primary}
          title={opts.primary ? 'Esta é a versão principal' : 'Tornar esta a versão principal'}
          aria-label={opts.primary ? 'Versão principal' : `Tornar V${opts.number} a versão principal`}
          onClick={opts.onPrimary}
        >
          <FiStar size={15} />
        </button>
      ) : opts.primary && (
        <i className={modalStyles.versionsPrimary} title='Versão principal'><FiStar /></i>
      )}
      <span className={modalStyles.versionsRowActions}>
        {opts.busy ? (
          <Spin indicator={<LoadingOutlined style={{ fontSize: 14, color: '#3361ff' }} spin />} />
        ) : (
          <>
            <button type='button' className={modalStyles.versionsSwap} onClick={opts.onReplace} title='Trocar o arquivo'>
              Trocar
            </button>
            <Popconfirm
              title='Excluir esta versão?'
              description='O arquivo deixa de aparecer no Espaço Jam.'
              okText='Excluir'
              cancelText='Cancelar'
              okButtonProps={{ danger: true }}
              placement='topRight'
              onConfirm={opts.onDelete}
            >
              <button type='button' className={modalStyles.versionsRemove} aria-label='Excluir versão' title='Excluir versão'>
                <FiTrash2 size={13} />
              </button>
            </Popconfirm>
          </>
        )}
      </span>
    </div>
  );

  // Cadastro: a música ainda não existe, então há no máximo a V1 do rascunho.
  if (!projectId) {
    return (
      <div className={modalStyles.field}>
        <span>Versões</span>
        {firstFileName && !uploadingFirst ? (
          <div className={modalStyles.versionsBox}>
            {row({
              id: 'first',
              number: 1,
              title: firstFileName,
              url: firstFileUrl,
              primary: true,
              onReplace: () => inputRef.current?.click(),
              onDelete: onClearFirst,
            })}
            <input
              ref={inputRef}
              type='file'
              accept='audio/*'
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPickFirst(f); }}
            />
            <audio
              ref={audioRef}
              preload='none'
              onEnded={() => setPlayingId(null)}
              onPause={() => setPlayingId(null)}
              onError={() => setPlayingId(null)}
            />
          </div>
        ) : (
          <UploadField
            accept='audio/*'
            hint='Vira a primeira versão (V1) da música'
            uploading={uploadingFirst}
            hasValue={false}
            fileName={firstFileName}
            thumb={<FiMusic size={18} />}
            onFile={onPickFirst}
            onClear={onClearFirst}
          />
        )}
      </div>
    );
  }

  return (
    <div className={modalStyles.field}>
      <span>Versões</span>
      <div className={modalStyles.versionsBox}>
        {versions.length ? versions.map((version) => row({
          id: version.id,
          number: version.version_number,
          title: version.title || `Versão ${version.version_number}`,
          duration: version.duration,
          url: version.audio_file,
          primary: version.id === primaryId,
          busy: busyId === version.id,
          onPrimary: () => { void promote(version); },
          onReplace: () => { replaceTargetRef.current = version; replaceRef.current?.click(); },
          onDelete: () => { void remove(version); },
        })) : (
          <p className={modalStyles.versionsEmpty}>Nenhuma gravação enviada ainda.</p>
        )}
        <button
          type='button'
          className={modalStyles.versionsAdd}
          disabled={adding}
          onClick={() => inputRef.current?.click()}
        >
          {/* Mesmo indicador da caixa de upload logo acima. O <Spin> sem indicator herda o
              colorPrimary do ConfigProvider (que ainda roda no darkAlgorithm): saíam os pontinhos
              roxos do tema antigo no meio do modal claro. */}
          {adding
            ? <Spin indicator={<LoadingOutlined style={{ fontSize: 15, color: '#3361ff' }} spin />} />
            : <FiUploadCloud size={15} />}
          {adding ? 'Enviando…' : 'Adicionar versão'}
        </button>
        <input
          ref={inputRef}
          type='file'
          accept='audio/*'
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void add(f); }}
        />
        <input
          ref={replaceRef}
          type='file'
          accept='audio/*'
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            const target = replaceTargetRef.current;
            replaceTargetRef.current = null;
            if (f && target) void replace(target, f);
          }}
        />
        <audio
          ref={audioRef}
          preload='none'
          onEnded={() => setPlayingId(null)}
          onPause={() => setPlayingId(null)}
          onError={() => setPlayingId(null)}
        />
      </div>
    </div>
  );
};

export const TrackModal: FC<Props> = ({ open, artistId, item, genres, assigneeOptions, currentUserName, currentUserId, currentUserAvatar, onClose, onSaved, onDelete, onVersionsChanged, initialFile }) => {
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

  useEffect(() => {
    if (open) setDraft(item ? { ...item } : emptyDraft());
  }, [open, item]);

  const set = (patch: Partial<CatalogItem>) => setDraft((d) => ({ ...d, ...patch }));

  const handleUpload = async (kind: 'cover' | 'audio', file: File) => {
    setUploading(kind);
    try {
      // A duração sai do próprio arquivo — o campo some da ficha e ninguém a digita mais.
      const duration = kind === 'audio' ? await readAudioDuration(file) : null;
      const res = await uploadFile(CATALOG_BUCKET, `${artistId}/${kind}`, file);
      if (kind === 'cover') set({ cover_image: res.url, cover_image_name: res.name });
      else set({ audio_file: res.url, audio_file_name: res.name, duration: duration || draft.duration || null });
    } catch (e: any) {
      message.error(e?.message || 'Falha no upload');
    } finally {
      setUploading(null);
    }
  };

  // "Nova música" começa pelo arquivo: a ficha já abre com o título tirado do nome do arquivo e
  // a V1 subindo, para não obrigar a redigitar o que o arquivo já diz. Roda depois do efeito de
  // reset acima (ordem de declaração), então não é sobrescrito pelo rascunho vazio.
  useEffect(() => {
    if (!open || item || !initialFile) return;
    setDraft({ ...emptyDraft(), title: titleFromFileName(initialFile.name) });
    void handleUpload('audio', initialFile);
    // handleUpload é recriado a cada render; depender dele reenviaria o arquivo em loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item, initialFile]);

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
        details: draft.details || null,
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
            <i className={modalStyles.titleDot} aria-hidden />
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
              <CamposDaFicha
                draft={draft}
                set={set}
                genres={genres}
                assigneeOptions={assigneeOptions}
                uploading={uploading}
                aoEnviarCapa={(f) => handleUpload('cover', f)}
                versionId={item?.version_id}
              />
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
            children: <CamposDosSplits draft={draft} set={set} />,
          },
        ]}
      />
    </Modal>
  );
};

export default TrackModal;
