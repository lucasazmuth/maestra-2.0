import { FC, useEffect, useState } from 'react';
import { FiDownload, FiShare, FiX } from 'react-icons/fi';

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
  if (!visible) return null;

  return (
    <aside className='pwa-install-banner' role='status' aria-live='polite'>
      <div className='pwa-install-icon' aria-hidden='true'>
        {ios ? <FiShare size={20} /> : <FiDownload size={20} />}
      </div>
      <div className='pwa-install-copy'>
        <strong>Leve a Maestra com você</strong>
        <span>{ios ? 'Toque em Compartilhar e depois em “Adicionar à Tela de Início”.' : 'Instale o app para abrir mais rápido pelo celular ou computador.'}</span>
      </div>
      {!ios && <button className='pwa-install-action' onClick={install}>Instalar</button>}
      <button className='pwa-install-close' onClick={dismiss} aria-label='Fechar aviso' title='Fechar'>
        <FiX size={18} />
      </button>
    </aside>
  );
};
