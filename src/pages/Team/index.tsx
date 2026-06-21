import { FC, useEffect, useState } from 'react';
import { Modal, Input, Checkbox, message, Popconfirm } from 'antd';
import { FiPlus, FiTrash2 } from 'react-icons/fi';

import { useArtist } from '../../hooks/useArtist';
import { Spinner } from '../../components/spinner/spinner';
import { MVP_ACCESS_LEVEL_OPTIONS, MVP_ACCESS_LEVELS } from '../../constants/maestra';
import * as membersDb from '../../services/db/members';
import type { ArtistMember, AccessLevel } from '../../interfaces/maestra';

const statusLabel: Record<string, { label: string; color: string }> = {
  active: { label: 'Ativo', color: '#af2896' },
  pending: { label: 'Pendente', color: '#f59e0b' },
  rejected: { label: 'Recusado', color: '#e91429' },
};

const Team: FC = () => {
  const { artist } = useArtist();
  const artistId = artist?.id;

  const [members, setMembers] = useState<ArtistMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [levels, setLevels] = useState<AccessLevel[]>(['plan']);
  const [saving, setSaving] = useState(false);

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

  // Só o dono do perfil gerencia colaboradores (compartilhar é benefício do perfil pago).
  const isOwner = artist.role !== 'member';

  const invite = async () => {
    if (!isOwner) return;
    if (!email.trim() || !artistId) {
      message.warning('Informe o e-mail');
      return;
    }
    setSaving(true);
    try {
      const m = await membersDb.inviteMember({ artistId, email: email.trim(), name: name.trim(), accessLevels: levels });
      setMembers((prev) => [...prev, m]);
      setOpen(false);
      setEmail('');
      setName('');
      setLevels(['plan']);
    } catch (e: any) {
      message.error(e?.message || 'Erro ao convidar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await membersDb.removeMember(id);
      setMembers((prev) => prev.filter((m) => m.id !== id));
    } catch {
      message.error('Erro ao remover');
    }
  };

  const toggleLevel = async (m: ArtistMember, level: AccessLevel) => {
    const has = m.access_levels?.includes(level);
    const next = has ? m.access_levels.filter((l) => l !== level) : [...(m.access_levels || []), level];
    try {
      const updated = await membersDb.updateMember(m.id, { access_levels: next });
      setMembers((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
    } catch {
      message.error('Erro ao atualizar permissões');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'SpotifyMixUITitle', fontWeight: 800, fontSize: 32, color: '#fff', margin: 0 }}>
          Equipe
        </h1>
        {isOwner && (
          <button
            onClick={() => setOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#af2896', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: 9999, cursor: 'pointer', fontWeight: 700 }}
          >
            <FiPlus /> Convidar membro
          </button>
        )}
      </div>

      <Spinner loading={loading && !members.length}>
        {!members.length ? (
          <div style={{ color: '#b3b3b3', padding: 32, textAlign: 'center' }}>
            Nenhum membro na equipe. Convide colaboradores por e-mail.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {members.map((m) => {
              const st = statusLabel[m.status] || { label: m.status, color: '#b3b3b3' };
              return (
                <div key={m.id} style={{ background: '#181818', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#fff', fontWeight: 700 }}>{m.name || m.email}</div>
                      <div style={{ color: '#b3b3b3', fontSize: 13 }}>{m.email}</div>
                    </div>
                    <span style={{ color: st.color, fontSize: 12, fontWeight: 700 }}>{st.label}</span>
                    <Popconfirm title='Remover membro?' onConfirm={() => remove(m.id)} okText='Sim' cancelText='Não'>
                      <button style={{ background: 'transparent', border: 'none', color: '#b3b3b3', cursor: 'pointer' }}>
                        <FiTrash2 />
                      </button>
                    </Popconfirm>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    {MVP_ACCESS_LEVEL_OPTIONS.map((opt) => {
                      const active = m.access_levels?.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          onClick={() => toggleLevel(m, opt.id)}
                          style={{
                            background: active ? '#af289622' : 'rgba(255,255,255,0.06)',
                            color: active ? '#af2896' : '#b3b3b3',
                            border: `1px solid ${active ? '#af2896' : 'transparent'}`,
                            borderRadius: 9999,
                            padding: '4px 12px',
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Spinner>

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        centered
        destroyOnClose
        title={<span style={{ color: '#fff', fontWeight: 700 }}>Convidar membro</span>}
        okText={saving ? 'Convidando…' : 'Convidar'}
        onOk={invite}
        okButtonProps={{ loading: saving, style: { background: '#af2896', color: '#fff' } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input placeholder='E-mail *' value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder='Nome (opcional)' value={name} onChange={(e) => setName(e.target.value)} />
          <div>
            <div style={{ color: '#b3b3b3', fontSize: 13, marginBottom: 8 }}>Níveis de acesso</div>
            <Checkbox.Group
              value={levels}
              onChange={(v) => setLevels(v as AccessLevel[])}
              options={MVP_ACCESS_LEVEL_OPTIONS.map((o) => ({ label: MVP_ACCESS_LEVELS[o.id as keyof typeof MVP_ACCESS_LEVELS], value: o.id }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Team;
