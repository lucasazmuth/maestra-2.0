import { ChangeEvent, FC, ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Popconfirm, message } from 'antd';
import { FiFileText, FiShield, FiLifeBuoy, FiExternalLink, FiChevronRight, FiCamera, FiClock, FiBell, FiStar } from 'react-icons/fi';
import { EditIcon } from '../../components/Icons/system';
import { PlatformReviewModal } from '../../components/PlatformReviewModal';

import { supabase } from '../../lib/supabase';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { authActions } from '../../store/slices/auth';
import { cancelSubscription } from '../../store/slices/subscription';
import { ARTISTS_DEFAULT_IMAGE } from '../../constants/spotify';
import SubscriptionManagement from './SubscriptionManagement';
import { disableWebPush, enableWebPush, hasWebPushSubscription, isWebPushSupported, syncWebPushSubscription } from '../../services/pushNotifications';
import { SUPPORT_EMAIL } from '../../constants/legal';

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
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const supported = isWebPushSupported();
    setPushSupported(supported);
    if (!user?.id || !supported) return () => { alive = false; };
    syncWebPushSubscription(user.id).then((synced) => {
      if (synced) return true;
      return hasWebPushSubscription();
    }).then((enabled) => {
      if (alive) setPushEnabled(enabled);
    }).catch(() => { if (alive) setPushEnabled(false); });
    return () => { alive = false; };
  }, [user?.id]);

  const togglePush = async () => {
    if (!user?.id || pushBusy) return;
    setPushBusy(true);
    try {
      if (pushEnabled) {
        await disableWebPush(user.id);
        setPushEnabled(false);
        message.success('Avisos desativados neste dispositivo.');
      } else {
        await enableWebPush(user.id);
        setPushEnabled(true);
        message.success('Avisos ativados neste dispositivo.');
      }
    } catch (error) {
      if ((error as Error)?.message !== 'push_permission_denied') {
        message.error('Não foi possível alterar os avisos neste dispositivo.');
      }
    } finally {
      setPushBusy(false);
    }
  };

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
  const supportLinks: { label: string; icon: ReactNode; to?: string; href?: string; action?: () => void }[] = [
    { label: 'Avaliar a Maestra', icon: <FiStar size={16} />, action: () => setReviewOpen(true) },
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

      message.success('Pedido de cancelamento registrado. Você será desconectado.');

      // Notifica o suporte SEM navegar o app (location.href para mailto congela a SPA).
      const subject = encodeURIComponent('Cancelamento de cadastro');
      const body = encodeURIComponent(`Solicito o cancelamento do meu cadastro na Maestra (${user.email || ''}).`);
      window.open(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`, '_blank');

      // Conta em processo de exclusão não fica logada: encerra a sessão e volta pro login.
      await dispatch(authActions.signOut());
      navigate('/login', { replace: true });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className='settings-page'>
      <header className='settings-heading'>
        <div>
          <p>CONTA DO USUÁRIO</p>
          <h1>Configurações pessoais</h1>
          <span>Gerencie seus dados, acesso e preferências de uso na Maestra.</span>
        </div>
      </header>

      {/* Duas linhas fixas (cabeçalho + corpo), em vez do antigo truque de flex único com
          h2 { order: -1; margin: auto } — aquilo colocava "Perfil", o avatar e (no modo de
          edição) o campo Nome disputando a MESMA linha, e quebrava de forma estranha em
          telas estreitas (avatar caindo pra baixo, fora do centro). */}
      <section className='settings-profile-card'>
        <div className='settings-profile-header'>
          <h2>Perfil</h2>
          {!editing && (
            <button className='settings-edit-btn' onClick={startEditing}>
              <EditIcon size={16} /> Editar
            </button>
          )}
        </div>

        <div className='settings-profile-body'>
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
            {!editing && <div className='settings-profile-name'>{savedName || 'Sem nome'}</div>}
            <div className='settings-profile-email'>{user?.email}</div>
            {editing && <div className='settings-profile-hint'>Toque na foto para trocar</div>}
          </div>
        </div>

        {editing && (
          <div className='settings-profile-form'>
            <div className='settings-profile-field'>
              <label>Nome</label>
              {/* className settings-name-input: o Input do antd nasce escuro em todo o app
                  (ConfigProvider usa theme.darkAlgorithm globalmente) — precisa de override
                  pontual pra combinar com o card claro. Ver regra em gsap-reference.css. */}
              <Input
                className='settings-name-input'
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='Seu nome'
              />
            </div>
            <div className='settings-profile-actions'>
              <button
                className='settings-save-btn'
                onClick={saveProfile}
                disabled={saving || uploading}
              >
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
              <button
                className='settings-cancel-btn'
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>

      <section className='settings-notification-card'>
        <div className='settings-notification-row'>
          <span className='settings-notification-icon' aria-hidden><FiBell size={20} /></span>
          <div className='settings-notification-copy'>
            <h2>Notificações no dispositivo</h2>
            <p>Receba lembretes da Maestra mesmo quando o app estiver fechado.</p>
          </div>
          {pushSupported && (
            <button
              type='button'
              role='switch'
              aria-checked={pushEnabled}
              aria-label='Notificações no dispositivo'
              onClick={togglePush}
              disabled={pushBusy}
              className={`settings-switch ${pushEnabled ? 'settings-switch-on' : ''}`}
            >
              <span className='settings-switch-thumb' />
            </button>
          )}
        </div>
        {!pushSupported && (
          <p className='settings-notification-note'>
            Seu navegador não oferece notificações push para este dispositivo.
          </p>
        )}
        {pushSupported && Notification.permission === 'denied' && (
          <p className='settings-notification-warn'>
            As notificações foram bloqueadas no navegador. Reative-as nas permissões do site.
          </p>
        )}
      </section>

      <SubscriptionManagement />

      {/* Atalho para o histórico de pagamentos (página dedicada) */}
      <section className='settings-link-card'>
        <div
          role='button'
          tabIndex={0}
          className='settings-row'
          onClick={() => navigate('/pagamentos')}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/pagamentos')}
        >
          <span className='settings-row-icon' aria-hidden><FiClock size={16} /></span>
          <span className='settings-row-label'>Histórico de pagamentos</span>
          <FiChevronRight size={16} className='settings-row-chevron' />
        </div>
      </section>

      {/* Suporte e termos */}
      <section className='settings-support-card'>
        <h2>Suporte e termos</h2>
        {supportLinks.map((l) => {
          const inner = (
            <>
              <span className='settings-row-icon' aria-hidden>{l.icon}</span>
              <span className='settings-row-label'>{l.label}</span>
              {l.href ? <FiExternalLink size={15} className='settings-row-chevron' /> : <FiChevronRight size={16} className='settings-row-chevron' />}
            </>
          );
          return l.to || l.action ? (
            <div
              key={l.label}
              role='button'
              tabIndex={0}
              className='settings-row'
              onClick={() => l.action ? l.action() : navigate(l.to!)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                l.action ? l.action() : navigate(l.to!);
              }}
            >
              {inner}
            </div>
          ) : (
            <a key={l.label} href={l.href} target='_blank' rel='noopener noreferrer' className='settings-row'>
              {inner}
            </a>
          );
        })}
      </section>

      {/* Conta */}
      <section className='settings-danger-card'>
        <h2>Conta</h2>
        <p>
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
          <button className='settings-danger-btn' disabled={deleting}>
            {deleting ? 'Cancelando…' : 'Cancelar cadastro'}
          </button>
        </Popconfirm>
      </section>
      <PlatformReviewModal open={reviewOpen} onClose={() => setReviewOpen(false)} />
    </div>
  );
};

export default Settings;
