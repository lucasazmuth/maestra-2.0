import { ChangeEvent, FC, ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Popconfirm, message } from 'antd';
import { FiFileText, FiShield, FiLifeBuoy, FiExternalLink, FiChevronRight, FiCamera, FiClock } from 'react-icons/fi';
import { EditIcon } from '../../components/Icons/system';

import { supabase } from '../../lib/supabase';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { cancelSubscription } from '../../store/slices/subscription';
import { ARTISTS_DEFAULT_IMAGE } from '../../constants/spotify';
import SubscriptionManagement from './SubscriptionManagement';

const Settings: FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  // Estado da assinatura (o SubscriptionManagement abaixo já busca no mount).
  const {
    status: subStatus,
    asaasCustomerId,
    asaasSubscriptionId,
  } = useAppSelector((s) => s.subscription);

  const meta = (user?.user_metadata || {}) as Record<string, any>;
  const savedName = meta.full_name || meta.name || '';
  const savedAvatar = meta.avatar_url || meta.picture || ARTISTS_DEFAULT_IMAGE;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState<string>(savedName);
  const [avatar, setAvatar] = useState<string>(savedAvatar);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const startEditing = () => {
    setName(savedName);
    setAvatar(savedAvatar);
    setEditing(true);
  };

  // Upload da foto pro Storage ('avatars'); guarda só a URL pública até o usuário salvar.
  const onPickAvatar = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatar(data.publicUrl);
    } catch (err: any) {
      message.error(err?.message || 'Não foi possível enviar a imagem.');
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: name, avatar_url: avatar } });
      if (error) throw error;
      message.success('Perfil atualizado');
      setEditing(false);
    } catch (e: any) {
      message.error(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  // Links institucionais (ajuste as URLs/e-mail reais da plataforma).
  const SUPPORT_EMAIL = 'suporte@maestramanager.com';
  const supportLinks: { label: string; icon: ReactNode; to?: string; href?: string }[] = [
    { label: 'Termos de uso', icon: <FiFileText size={16} />, to: '/legal/termos' },
    { label: 'Política de privacidade', icon: <FiShield size={16} />, to: '/legal/privacidade' },
    { label: 'Falar com o suporte', icon: <FiLifeBuoy size={16} />, href: `mailto:${SUPPORT_EMAIL}` },
  ];

  // Assinatura que ainda gera cobrança recorrente na Asaas (precisa ser encerrada junto).
  const hasBillableSubscription = subStatus === 'active' || subStatus === 'overdue' || subStatus === 'pending';
  const [deleting, setDeleting] = useState(false);

  // Cancelar cadastro: 1) encerra a assinatura na Asaas (se houver) pra não seguir cobrando;
  // 2) grava o pedido em account_deletion_requests (data + contexto, p/ auditoria LGPD);
  // 3) sem endpoint self-service de exclusão, o pedido segue pro suporte por e-mail.
  const requestAccountDeletion = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      let subscriptionCancelled = false;
      if (hasBillableSubscription) {
        try {
          await dispatch(cancelSubscription()).unwrap();
          subscriptionCancelled = true;
          message.success('Assinatura cancelada.');
        } catch {
          message.error(
            'Não consegui cancelar sua assinatura automaticamente. Cancele a assinatura (acima) antes de cancelar o cadastro.'
          );
          return;
        }
      }

      // Trilha de auditoria — não bloqueia o pedido se falhar, mas fica no console.
      const { error: auditError } = await supabase.from('account_deletion_requests').insert({
        user_id: user.id,
        email: user.email,
        subscription_status: subStatus,
        asaas_customer_id: asaasCustomerId,
        asaas_subscription_id: asaasSubscriptionId,
        subscription_cancelled: subscriptionCancelled,
      });
      if (auditError) console.error('Falha ao registrar pedido de cancelamento:', auditError);

      message.success('Pedido de cancelamento registrado.');
      const subject = encodeURIComponent('Cancelamento de cadastro');
      const body = encodeURIComponent(`Solicito o cancelamento do meu cadastro na Maestra Manager (${user.email || ''}).`);
      window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 640 }}>
      <h1 style={{ fontFamily: 'SpotifyMixUITitle', fontWeight: 800, fontSize: 32, color: '#fff', margin: '0 0 24px' }}>
        Configurações
      </h1>

      <section style={{ background: '#181818', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>Perfil</h2>
          {!editing && (
            <button
              onClick={startEditing}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', borderRadius: 9999, padding: '7px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
            >
              <EditIcon size={16} /> Editar
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: editing ? 18 : 0 }}>
          {editing ? (
            <label style={{ position: 'relative', width: 64, height: 64, cursor: uploading ? 'wait' : 'pointer', flexShrink: 0 }}>
              <img src={avatar} alt='avatar' style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', opacity: uploading ? 0.5 : 1 }} />
              <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'rgba(0,0,0,0.45)', color: '#fff' }}>
                <FiCamera size={18} />
              </span>
              <input type='file' accept='image/*' onChange={onPickAvatar} style={{ display: 'none' }} disabled={uploading} />
            </label>
          ) : (
            <img src={savedAvatar} alt='avatar' style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
          )}
          <div>
            {!editing && <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{savedName || 'Sem nome'}</div>}
            <div style={{ color: '#b3b3b3', fontSize: 13 }}>{user?.email}</div>
            {editing && <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>Toque na foto para trocar</div>}
          </div>
        </div>

        {editing && (
          <>
            <label style={{ color: '#b3b3b3', fontSize: 13 }}>Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder='Seu nome' style={{ marginTop: 6 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                onClick={saveProfile}
                disabled={saving || uploading}
                style={{ background: '#af2896', border: 'none', color: '#fff', borderRadius: 9999, padding: '8px 20px', cursor: 'pointer', fontWeight: 700, opacity: saving || uploading ? 0.6 : 1 }}
              >
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#b3b3b3', borderRadius: 9999, padding: '8px 20px', cursor: 'pointer', fontWeight: 700 }}
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </section>

      <SubscriptionManagement />

      {/* Atalho para o histórico de pagamentos (página dedicada) */}
      <section style={{ background: '#181818', borderRadius: 12, padding: '8px 20px', marginTop: 20 }}>
        <div
          role='button'
          tabIndex={0}
          onClick={() => navigate('/pagamentos')}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/pagamentos')}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', color: '#fff', fontSize: 14, cursor: 'pointer' }}
        >
          <span style={{ color: '#8a8a8a', display: 'flex' }}><FiClock size={16} /></span>
          <span style={{ flex: 1 }}>Histórico de pagamentos</span>
          <FiChevronRight size={16} color='#6b7280' />
        </div>
      </section>

      {/* Suporte e termos */}
      <section style={{ background: '#181818', borderRadius: 12, padding: '8px 20px', marginTop: 20 }}>
        <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '12px 0 4px' }}>Suporte e termos</h2>
        {supportLinks.map((l, i) => {
          const rowStyle = {
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 0',
            color: '#fff',
            textDecoration: 'none',
            fontSize: 14,
            cursor: 'pointer',
            borderTop: i ? '1px solid #262626' : 'none',
          } as const;
          const inner = (
            <>
              <span style={{ color: '#8a8a8a', display: 'flex' }}>{l.icon}</span>
              <span style={{ flex: 1 }}>{l.label}</span>
              {l.to ? <FiChevronRight size={16} color='#6b7280' /> : <FiExternalLink size={15} color='#6b7280' />}
            </>
          );
          return l.to ? (
            <div key={l.label} role='button' tabIndex={0} style={rowStyle} onClick={() => navigate(l.to!)}>
              {inner}
            </div>
          ) : (
            <a key={l.label} href={l.href} target='_blank' rel='noopener noreferrer' style={rowStyle}>
              {inner}
            </a>
          );
        })}
      </section>

      {/* Conta */}
      <section style={{ background: '#181818', borderRadius: 12, padding: 20, marginTop: 20 }}>
        <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginTop: 0, marginBottom: 6 }}>Conta</h2>
        <p style={{ color: '#8a8a8a', fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }}>
          Cancelar o cadastro encerra sua conta e remove seus dados. Esta ação é permanente e não pode ser desfeita.
        </p>
        <Popconfirm
          title='Cancelar cadastro?'
          description={
            hasBillableSubscription
              ? 'Sua assinatura Maestra PRO será cancelada e sua conta e seus dados serão removidos. Esta ação é permanente.'
              : 'Sua conta e seus dados serão removidos. Esta ação é permanente.'
          }
          okText='Sim, cancelar cadastro'
          okButtonProps={{ danger: true, loading: deleting }}
          cancelText='Voltar'
          onConfirm={requestAccountDeletion}
        >
          <button
            disabled={deleting}
            style={{
              background: 'transparent',
              border: '1px solid #e91429',
              color: '#e91429',
              borderRadius: 9999,
              padding: '9px 18px',
              cursor: deleting ? 'wait' : 'pointer',
              fontWeight: 700,
              fontSize: 14,
              opacity: deleting ? 0.6 : 1,
            }}
          >
            {deleting ? 'Cancelando…' : 'Cancelar cadastro'}
          </button>
        </Popconfirm>
      </section>
    </div>
  );
};

export default Settings;
