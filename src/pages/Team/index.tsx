import { FC, useEffect, useState } from 'react';
import { Button, Input, Modal, Popconfirm, message } from 'antd';
import { FiMail, FiMoreHorizontal, FiPlus, FiTrash2, FiUser } from 'react-icons/fi';

import { useArtist } from '../../hooks/useArtist';
import { useArtistCapabilities } from '../../hooks/useArtistCapabilities';
import { Spinner } from '../../components/spinner/spinner';
import modalStyles from '../../components/StandardModal.module.scss';
import { MVP_ACCESS_LEVEL_OPTIONS } from '../../constants/maestra';
import * as membersDb from '../../services/db/members';
import type { ArtistMember, AccessLevel } from '../../interfaces/maestra';
import styles from './Team.module.scss';

const statusLabel: Record<string, string> = {
  active: 'Ativo',
  pending: 'Pendente',
  rejected: 'Recusado',
};

const initials = (member: ArtistMember) => {
  const source = member.name?.trim() || member.email.split('@')[0] || '?';
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
};

const Team: FC = () => {
  const { artist } = useArtist();
  const artistId = artist?.id;
  const { canManageTeam } = useArtistCapabilities(artist);

  const [members, setMembers] = useState<ArtistMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [levels, setLevels] = useState<AccessLevel[]>(['plan']);
  const [saving, setSaving] = useState(false);

  const [selectedMember, setSelectedMember] = useState<ArtistMember | null>(null);
  const [editName, setEditName] = useState('');
  const [editLevels, setEditLevels] = useState<AccessLevel[]>([]);
  const [editingSaving, setEditingSaving] = useState(false);

  useEffect(() => {
    if (!artistId) return;
    setLoading(true);
    membersDb
      .listMembers(artistId)
      .then(setMembers)
      .catch(() => message.error('Erro ao carregar equipe'))
      .finally(() => setLoading(false));
  }, [artistId]);

  if (!artist) return <Spinner loading>{null as any}</Spinner>;

  // RLS mantém UPDATE/DELETE exclusivos do dono. Membros com permissão de equipe
  // podem convidar, mas não alterar ou remover outras pessoas.
  const isOwner = artist.role !== 'member';

  const toggleAccessLevel = (
    current: AccessLevel[],
    level: AccessLevel,
    setter: (next: AccessLevel[]) => void
  ) => {
    setter(current.includes(level) ? current.filter((item) => item !== level) : [...current, level]);
  };

  const invite = async () => {
    if (!canManageTeam) return;
    if (!email.trim() || !artistId) {
      message.warning('Informe o e-mail');
      return;
    }
    setSaving(true);
    try {
      const member = await membersDb.inviteMember({
        artistId,
        email: email.trim(),
        name: name.trim(),
        accessLevels: levels,
      });
      setMembers((current) => [...current, member]);
      setInviteOpen(false);
      setEmail('');
      setName('');
      setLevels(['plan']);
    } catch (error: any) {
      message.error(error?.message || 'Erro ao convidar');
    } finally {
      setSaving(false);
    }
  };

  const openMember = (member: ArtistMember) => {
    setSelectedMember(member);
    setEditName(member.name || '');
    setEditLevels(member.access_levels || []);
  };

  const saveMember = async () => {
    if (!selectedMember || !isOwner) return;
    setEditingSaving(true);
    try {
      const updated = await membersDb.updateMember(selectedMember.id, {
        name: editName.trim(),
        access_levels: editLevels,
      });
      setMembers((current) => current.map((member) => (member.id === updated.id ? updated : member)));
      setSelectedMember(null);
      message.success('Membro atualizado');
    } catch {
      message.error('Erro ao atualizar membro');
    } finally {
      setEditingSaving(false);
    }
  };

  const removeMember = async () => {
    if (!selectedMember || !isOwner) return;
    try {
      await membersDb.removeMember(selectedMember.id);
      setMembers((current) => current.filter((member) => member.id !== selectedMember.id));
      setSelectedMember(null);
      message.success('Membro removido');
    } catch {
      message.error('Erro ao remover');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Equipe</h1>
          <p>Gerencie quem participa da operação e o que cada pessoa pode acessar.</p>
        </div>
        {canManageTeam && (
          <button type="button" className={styles.inviteButton} onClick={() => setInviteOpen(true)}>
            <FiPlus aria-hidden="true" />
            Convidar membro
          </button>
        )}
      </div>

      <Spinner loading={loading && !members.length}>
        {!members.length ? (
          <div className={styles.empty}>
            <FiUser aria-hidden="true" />
            <strong>Sua equipe começa aqui</strong>
            <span>Convide colaboradores por e-mail e defina os acessos de cada pessoa.</span>
          </div>
        ) : (
          <div className={styles.memberList}>
            {members.map((member) => (
              <article className={styles.memberCard} key={member.id}>
                <span className={styles.avatar} aria-hidden="true">{initials(member)}</span>
                <div className={styles.memberIdentity}>
                  <strong>{member.name || member.email.split('@')[0]}</strong>
                  <span>{member.email}</span>
                </div>
                <div className={styles.accessSummary} aria-label="Acessos concedidos">
                  {(member.access_levels || []).slice(0, 3).map((level) => {
                    const option = MVP_ACCESS_LEVEL_OPTIONS.find((item) => item.id === level);
                    return option ? <span key={level}>{option.label}</span> : null;
                  })}
                  {(member.access_levels?.length || 0) > 3 && (
                    <span>+{(member.access_levels?.length || 0) - 3}</span>
                  )}
                  {!member.access_levels?.length && <span>Sem acessos</span>}
                </div>
                <span className={styles.status} data-status={member.status}>
                  <i aria-hidden="true" />
                  {statusLabel[member.status] || member.status}
                </span>
                <button
                  type="button"
                  className={styles.moreButton}
                  aria-label={`Mais opções de ${member.name || member.email}`}
                  onClick={() => openMember(member)}
                >
                  <FiMoreHorizontal aria-hidden="true" />
                </button>
              </article>
            ))}
          </div>
        )}
      </Spinner>

      <Modal
        open={!!selectedMember}
        onCancel={() => setSelectedMember(null)}
        centered
        width={580}
        destroyOnHidden
        rootClassName={modalStyles.modal}
        title={
          <div className={modalStyles.heading}>
            <span className={modalStyles.kicker}>Membro da equipe</span>
            <span className={modalStyles.title}>{selectedMember?.name || selectedMember?.email}</span>
            <span className={modalStyles.subtitle}>Revise os dados e os acessos desta pessoa.</span>
          </div>
        }
        footer={
          <div className={styles.modalFooter}>
            {isOwner && (
              <Popconfirm
                title="Remover membro?"
                description="Esta pessoa perderá o acesso ao perfil do artista."
                okText="Remover"
                cancelText="Cancelar"
                okButtonProps={{ danger: true }}
                onConfirm={removeMember}
              >
                <Button type="text" danger icon={<FiTrash2 />}>Excluir membro</Button>
              </Popconfirm>
            )}
            <div>
              <Button onClick={() => setSelectedMember(null)}>{isOwner ? 'Cancelar' : 'Fechar'}</Button>
              {isOwner && (
                <Button type="primary" loading={editingSaving} onClick={saveMember}>
                  Salvar alterações
                </Button>
              )}
            </div>
          </div>
        }
      >
        {selectedMember && (
          <div className={styles.modalBody}>
            <div className={styles.memberOverview}>
              <span className={styles.modalAvatar} aria-hidden="true">{initials(selectedMember)}</span>
              <div>
                <span className={styles.status} data-status={selectedMember.status}>
                  <i aria-hidden="true" />
                  {statusLabel[selectedMember.status] || selectedMember.status}
                </span>
                <small>Convidado para este perfil</small>
              </div>
            </div>

            <div className={styles.fieldGrid}>
              <label>
                <span>Nome</span>
                <Input
                  prefix={<FiUser aria-hidden="true" />}
                  value={editName}
                  disabled={!isOwner}
                  placeholder="Nome do membro"
                  onChange={(event) => setEditName(event.target.value)}
                />
              </label>
              <label>
                <span>E-mail</span>
                <Input prefix={<FiMail aria-hidden="true" />} value={selectedMember.email} disabled />
              </label>
            </div>

            <div className={styles.permissionSection}>
              <div>
                <strong>Níveis de acesso</strong>
                <span>Escolha os módulos que esta pessoa poderá utilizar.</span>
              </div>
              <div className={styles.permissionGrid}>
                {MVP_ACCESS_LEVEL_OPTIONS.map((option) => {
                  const active = editLevels.includes(option.id);
                  return (
                    <button
                      type="button"
                      key={option.id}
                      className={active ? styles.permissionActive : styles.permission}
                      aria-pressed={active}
                      disabled={!isOwner}
                      onClick={() => toggleAccessLevel(editLevels, option.id, setEditLevels)}
                    >
                      <span>{option.label}</span>
                      <i aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={inviteOpen}
        onCancel={() => setInviteOpen(false)}
        centered
        width={580}
        destroyOnHidden
        rootClassName={modalStyles.modal}
        title={
          <div className={modalStyles.heading}>
            <span className={modalStyles.kicker}>Equipe</span>
            <span className={modalStyles.title}>Convidar membro</span>
            <span className={modalStyles.subtitle}>Envie um convite e defina os acessos iniciais.</span>
          </div>
        }
        footer={
          <div className={styles.inviteFooter}>
            <Button onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button type="primary" loading={saving} onClick={invite}>
              {saving ? 'Convidando…' : 'Enviar convite'}
            </Button>
          </div>
        }
      >
        <div className={styles.modalBody}>
          <div className={styles.fieldGrid}>
            <label>
              <span>Nome</span>
              <Input
                prefix={<FiUser aria-hidden="true" />}
                placeholder="Nome do convidado"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              <span>E-mail *</span>
              <Input
                prefix={<FiMail aria-hidden="true" />}
                placeholder="nome@exemplo.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          </div>
          <div className={styles.permissionSection}>
            <div>
              <strong>Níveis de acesso</strong>
              <span>Você poderá alterar estes acessos depois.</span>
            </div>
            <div className={styles.permissionGrid}>
              {MVP_ACCESS_LEVEL_OPTIONS.map((option) => {
                const active = levels.includes(option.id);
                return (
                  <button
                    type="button"
                    key={option.id}
                    className={active ? styles.permissionActive : styles.permission}
                    aria-pressed={active}
                    onClick={() => toggleAccessLevel(levels, option.id, setLevels)}
                  >
                    <span>{option.label}</span>
                    <i aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Team;
