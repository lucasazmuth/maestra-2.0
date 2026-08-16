import { FC, useEffect, useMemo, useState } from 'react';
import { Button, Input, Modal, Popconfirm, message } from 'antd';
import { FiMail, FiMoreHorizontal, FiPlus, FiTrash2, FiUser } from 'react-icons/fi';

import { useArtist } from '../../hooks/useArtist';
import { useArtistCapabilities } from '../../hooks/useArtistCapabilities';
import { Spinner } from '../../components/spinner/spinner';
import modalStyles from '../../components/StandardModal.module.scss';
import { MVP_ACCESS_LEVEL_OPTIONS } from '../../constants/maestra';
import * as membersDb from '../../services/db/members';
import { useGlobalSearch, normalizar } from '../../stores/globalSearchStore';
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

  // Busca do topo (ver globalSearchStore). Casa por nome e e-mail, que são os dois dados
  // visíveis na linha.
  const termo = useGlobalSearch((st) => st.termo);
  const visiveis = useMemo(() => {
    const q = normalizar(termo);
    if (!q) return members;
    return members.filter((m) =>
      normalizar(m.name || '').includes(q) || normalizar(m.email || '').includes(q)
    );
  }, [members, termo]);

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
  const activeMembers = members.filter((member) => member.status === 'active').length;
  const pendingMembers = members.filter((member) => member.status === 'pending').length;
  const configuredAccesses = members.reduce((total, member) => total + (member.access_levels?.length || 0), 0);

  // 'full' é "todos os módulos", não mais um módulo: marcá-lo limpa os outros, e escolher um
  // módulo desmarca o 'full'. Antes os cinco conviviam na mesma lista e dava para pedir
  // "Músicas + Acesso completo", o que não quer dizer nada.
  const toggleAccessLevel = (
    current: AccessLevel[],
    level: AccessLevel,
    setter: (next: AccessLevel[]) => void
  ) => {
    if (level === 'full') {
      setter(current.includes('full') ? [] : ['full']);
      return;
    }
    const semFull = current.filter((item) => item !== 'full');
    setter(semFull.includes(level) ? semFull.filter((item) => item !== level) : [...semFull, level]);
  };

  // O que cada módulo abre, em uma linha — "Equipe" ou "Plano de ação" sozinhos não dizem se a
  // pessoa só vê ou também mexe.
  const ACCESS_HINTS: Partial<Record<AccessLevel, string>> = {
    plan: 'Ver e editar tarefas e prazos',
    catalog: 'Músicas, versões e Espaço JAM',
    agenda: 'Compromissos e datas',
    team: 'Convidar e remover pessoas',
    full: 'Todos os módulos, inclusive os que entrarem depois',
  };

  const renderAccessOptions = (
    selected: AccessLevel[],
    setter: (next: AccessLevel[]) => void,
    disabled?: boolean,
  ) => {
    const full = selected.includes('full');
    const option = (id: AccessLevel, label: string, destaque?: boolean) => {
      // Com 'full' marcado, os módulos aparecem incluídos (e travados): o acesso já os cobre.
      const active = id === 'full' ? full : full || selected.includes(id);
      return (
        <button
          type='button'
          key={id}
          className={`${active ? styles.permissionActive : styles.permission} ${destaque ? styles.permissionFull : ''}`}
          aria-pressed={active}
          disabled={disabled || (full && id !== 'full')}
          onClick={() => toggleAccessLevel(selected, id, setter)}
        >
          <span className={styles.permissionLabel}>
            {label}
            <small>{ACCESS_HINTS[id]}</small>
          </span>
          <i aria-hidden='true' />
        </button>
      );
    };
    return (
      <div className={styles.permissionGrid}>
        {option('full', 'Acesso completo', true)}
        {MVP_ACCESS_LEVEL_OPTIONS.filter((entry) => entry.id !== 'full').map((entry) => option(entry.id, entry.label))}
      </div>
    );
  };

  const invite = async () => {
    if (!canManageTeam) return;
    if (!email.trim() || !artistId) {
      message.warning('Informe o e-mail');
      return;
    }
    // Convite sem nenhum acesso marcado entra na equipe sem poder abrir nada — provável
    // esquecimento, já que agora dá para desmarcar tudo de uma vez pelo "Acesso completo".
    if (!levels.length) {
      message.warning('Escolha ao menos um módulo que esta pessoa poderá acessar.');
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
          <p className={styles.eyebrow}>Time do artista</p>
          <h1>Equipe</h1>
          <span>Gerencie quem participa da operação e o que cada pessoa pode acessar.</span>
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
          <>
            <section className={styles.summary} aria-label="Resumo da equipe">
              <span><b>{String(activeMembers).padStart(2, '0')}</b>Pessoas ativas</span>
              <span><b>{String(pendingMembers).padStart(2, '0')}</b>Convites pendentes</span>
              <span><b>{String(configuredAccesses).padStart(2, '0')}</b>Acessos configurados</span>
            </section>
            <div className={styles.memberList}>
              <header className={styles.listHeader}>
                <span>Membro</span>
                <span>Acessos</span>
                <span>Status</span>
                <span aria-hidden="true" />
              </header>
            {visiveis.map((member) => (
              <article className={styles.memberCard} key={member.id}>
                <div className={styles.memberCell}>
                  <span className={styles.avatar} aria-hidden="true">{initials(member)}</span>
                  <div className={styles.memberIdentity}>
                    <strong>{member.name || member.email.split('@')[0]}</strong>
                    <span>{member.email}</span>
                  </div>
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
          </>
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
            <span className={modalStyles.title}><i className={modalStyles.titleDot} aria-hidden />{selectedMember?.name || selectedMember?.email}</span>
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
                <strong>O que esta pessoa pode acessar</strong>
                <span>Cada módulo marcado libera ver e editar aquele módulo. Pode marcar mais de um.</span>
              </div>
              {renderAccessOptions(editLevels, setEditLevels, !isOwner)}
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
            <span className={modalStyles.title}><i className={modalStyles.titleDot} aria-hidden />Convidar membro</span>
            <span className={modalStyles.subtitle}>Envie um convite e defina os acessos iniciais.</span>
          </div>
        }
        footer={
          <div className={styles.inviteFooter}>
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
              <strong>O que esta pessoa pode acessar</strong>
              <span>Cada módulo marcado libera ver e editar aquele módulo. Pode marcar mais de um, e dá para alterar depois.</span>
            </div>
            {renderAccessOptions(levels, setLevels)}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Team;
