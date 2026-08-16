import { FC, useEffect, useState } from 'react';
import { FiDownload, FiShare, FiX } from 'react-icons/fi';
import { message } from 'antd';
import { useAppSelector } from '../../store/store';
import { enableWebPush, hasWebPushSubscription, isWebPushSupported } from '../../services/pushNotifications';

import './styles.scss';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISSED_KEY = 'maestra-pwa-install-dismissed-at';
const DISMISS_DAYS = 14;

const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

const isIOS = (): boolean => /iphone|ipad|ipod/i.test(navigator.userAgent);

const wasDismissedRecently = (): boolean => {
  const value = localStorage.getItem(DISMISSED_KEY);
  return !!value && Date.now() - Number(value) < DISMISS_DAYS * 24 * 60 * 60 * 1000;
};

export interface PwaInstallState {
  visible: boolean;
  ios: boolean;
  install: () => Promise<void>;
  dismiss: () => void;
}

export const usePwaInstall = (): PwaInstallState => {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissedRecently()) return undefined;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    if (isIOS()) setVisible(true);

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
    setVisible(false);
  };

  return { visible, ios: isIOS() && !promptEvent, install, dismiss };
};

export const PwaInstallBanner: FC = () => {
  const { visible, ios, install, dismiss } = usePwaInstall();
  const userId = useAppSelector((state) => state.auth.user?.id);
  const [pushAvailable, setPushAvailable] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!userId || !isWebPushSupported() || Notification.permission === 'denied') {
      setPushAvailable(false);
      return () => { alive = false; };
    }
    hasWebPushSubscription().then((subscribed) => {
      if (alive) setPushAvailable(!subscribed);
    }).catch(() => { if (alive) setPushAvailable(false); });
    return () => { alive = false; };
  }, [userId]);

  const activatePush = async () => {
    if (!userId) return;
    setPushBusy(true);
    try {
      await enableWebPush();
      setPushAvailable(false);
      message.success('Avisos ativados neste dispositivo.');
    } catch (error) {
      if ((error as Error)?.message !== 'push_permission_denied') {
        message.error('Não foi possível ativar os avisos neste dispositivo.');
      }
    } finally {
      setPushBusy(false);
    }
  };

  if (!visible && !pushAvailable) return null;
  const showInstall = visible;

  return (
    <aside className='pwa-install-banner' role='status' aria-live='polite'>
      <div className='pwa-install-icon' aria-hidden='true'>
        {showInstall && ios ? <FiShare size={20} /> : <FiDownload size={20} />}
      </div>
      <div className='pwa-install-copy'>
        <strong>{pushAvailable && !showInstall ? 'Receba avisos da Maestra' : 'Leve a Maestra com você'}</strong>
        <span>{pushAvailable && !showInstall ? 'Ative as notificações para receber lembretes mesmo quando o app estiver fechado.' : ios ? 'Toque em Compartilhar e depois em “Adicionar à Tela de Início”.' : 'Instale o app para abrir mais rápido pelo celular ou computador.'}</span>
      </div>
      <div className='pwa-install-actions'>
        {!ios && showInstall && <button className='pwa-install-action' onClick={install}>Instalar</button>}
        {pushAvailable && <button className='pwa-install-action' onClick={activatePush} disabled={pushBusy}>{pushBusy ? 'Ativando...' : 'Ativar avisos'}</button>}
      </div>
      <button className='pwa-install-close' onClick={dismiss} aria-label='Fechar aviso' title='Fechar'>
        <FiX size={18} />
      </button>
    </aside>
  );
};
