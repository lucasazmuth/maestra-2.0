import { FC, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiDownload, FiInstagram, FiMail, FiShare, FiYoutube } from 'react-icons/fi';

import { MaestraBrand } from '../../components/MaestraBrand';
import { usePwaInstall } from '../../components/PwaInstallBanner';
import styles from './Home.module.scss';

// Cabeçalho e rodapé da landing e das páginas que nascem dela (hoje /sobre). Ficam aqui porque
// a navegação precisa funcionar dos dois lados: os itens de seção rolam a página quando já se
// está na landing e voltam pra ela pedindo o scroll quando não se está.
//
// Serve a landing, /sobre, /diagnostico-real e /music-rio-academy. Só a landing do workshop
// (/eventos/niteroi) segue com o ./LightChrome.tsx, que tem outro conjunto de links.

// Só âncoras: o menu do topo leva a áreas da própria landing, então cada item rola a página em
// vez de trocar de rota. "Sobre" saiu daqui por isso — ele é página, e vive no rodapé.
const NAV = [
  { label: 'Recursos', id: 'recursos' },
  { label: 'Nyta IA', id: 'nyta' },
  { label: 'Planos', id: 'planos' },
  { label: 'FAQ', id: 'faq' },
  { label: 'Download', id: 'download' },
];

// O Feather não traz TikTok nem WhatsApp; os dois vêm como path, no mesmo traço dos outros.
const TikTokIcon: FC = () => (
  <svg viewBox='0 0 24 24' width='18' height='18' fill='currentColor' aria-hidden focusable='false'>
    <path d='M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 1 1 .77-5.06v-3.1a5.66 5.66 0 0 0-.77-.05A5.66 5.66 0 1 0 15.54 15.4V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.29 4.29 0 0 1-3.24-1.48z' />
  </svg>
);

const WhatsAppIcon: FC = () => (
  <svg viewBox='0 0 24 24' width='18' height='18' fill='currentColor' aria-hidden focusable='false'>
    <path d='M12.04 2a9.9 9.9 0 0 0-8.5 14.95L2 22l5.2-1.5A9.9 9.9 0 1 0 12.04 2zm0 1.8a8.1 8.1 0 1 1-4.1 15.08l-.3-.17-3.08.89.9-3-.2-.31A8.1 8.1 0 0 1 12.04 3.8zm-3.2 4.06c-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.02s.87 2.34.99 2.5c.12.16 1.7 2.72 4.15 3.7 2.03.82 2.45.66 2.9.62.44-.04 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.42-1.34-1.66-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.19-.46-.39-.4-.54-.41h-.46z' />
  </svg>
);

// Perfis oficiais da Maestra (o WhatsApp usa o formato wa.me, que abre o app ou o web).
const SOCIALS = [
  { label: 'Instagram', href: 'https://www.instagram.com/maestra.manager/', icon: <FiInstagram size={18} /> },
  { label: 'YouTube', href: 'https://www.youtube.com/@maestra.manager', icon: <FiYoutube size={18} /> },
  { label: 'TikTok', href: 'https://www.tiktok.com/@maestra.manager', icon: <TikTokIcon /> },
  { label: 'WhatsApp', href: 'https://wa.me/5521976799158', icon: <WhatsAppIcon /> },
  { label: 'E-mail', href: 'mailto:maestra@musicrioacademy.com.br', icon: <FiMail size={18} /> },
];

export const useSectionNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  return (id: string) => () => {
    if (location.pathname === '/') document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else navigate('/', { state: { scrollTo: id } });
  };
};

export const Header: FC<{ loggedIn: boolean }> = ({ loggedIn }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const goToSection = useSectionNav();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  const goHome = (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === '/') window.scrollTo({ top: 0, behavior: 'smooth' });
    else navigate('/');
  };

  return (
    <header className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}>
      <div className={styles.shell}>
        <a className={styles.brand} href='#top' onClick={goHome}>
          <MaestraBrand variant='lockup' tone='dark' className={styles.brandMark} />
        </a>
        <nav className={styles.navLinks}>
          {NAV.map((n) => <button key={n.id} onClick={goToSection(n.id)}>{n.label}</button>)}
        </nav>
        <div className={styles.navActions}>
          {loggedIn ? (
            <button className={styles.btnNeon} onClick={() => navigate('/artists')}>Ir pro app</button>
          ) : (
            <>
              <button className={styles.navEntrar} onClick={() => navigate('/login')}>Entrar</button>
              <button className={styles.btnNeon} onClick={() => navigate('/signup')}>Começar grátis</button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export const Footer: FC = () => {
  const navigate = useNavigate();
  const goToSection = useSectionNav();
  const { visible: pwaVisible, ios: pwaIOS, install: installPwa, dismiss: dismissPwa } = usePwaInstall();

  return (
    <footer className={styles.footer}>
      <div className={`${styles.shell} ${styles.footerGrid}`}>
        <div className={styles.footerBrand}>
          <MaestraBrand variant='lockup' tone='dark' className={styles.brandMark} />
          <p>A plataforma que diagnostica, planeja e acompanha a sua carreira na música.</p>
          <div className={styles.footerSocials}>
            {SOCIALS.map((sc) => (
              <a
                key={sc.label}
                className={styles.footerSocial}
                href={sc.href}
                target={sc.href.startsWith('mailto:') ? undefined : '_blank'}
                rel='noreferrer'
                aria-label={sc.label}
                title={sc.label}
              >
                {sc.icon}
              </a>
            ))}
          </div>
          {pwaVisible && (
            <div className={styles.footerPwa}>
              <span className={styles.footerPwaIcon}>{pwaIOS ? <FiShare size={16} /> : <FiDownload size={16} />}</span>
              <span className={styles.footerPwaCopy}>
                <strong>Instale a Maestra</strong>
                <span>{pwaIOS ? 'Compartilhar → Adicionar à Tela de Início' : 'Acesso rápido pelo celular ou computador'}</span>
              </span>
              {!pwaIOS && <button className={styles.footerPwaAction} onClick={installPwa}>Instalar</button>}
              <button className={styles.footerPwaClose} onClick={dismissPwa} aria-label='Fechar aviso de instalação'>×</button>
            </div>
          )}
        </div>
        <div className={styles.footerCol}>
          <h4>Produto</h4>
          <button onClick={goToSection('recursos')}>Recursos</button>
          <button onClick={() => navigate('/diagnostico-real')}>Diagnóstico REAL</button>
          <button onClick={goToSection('planos')}>Planos</button>
          <button onClick={goToSection('faq')}>FAQ</button>
        </div>
        <div className={styles.footerCol}>
          <h4>A Maestra</h4>
          <button onClick={() => navigate('/sobre')}>Sobre</button>
          <button onClick={() => navigate('/music-rio-academy')}>Music Rio Academy</button>
        </div>
        <div className={styles.footerCol}>
          <h4>Conta</h4>
          <button onClick={() => navigate('/login')}>Entrar</button>
          <button onClick={() => navigate('/signup')}>Criar conta</button>
        </div>
        <div className={styles.footerCol}>
          <h4>Legal</h4>
          <button onClick={() => navigate('/legal/termos')}>Termos de uso</button>
          <button onClick={() => navigate('/legal/privacidade')}>Política de privacidade</button>
        </div>
      </div>
      <div className={`${styles.shell} ${styles.footerBottom}`}>
        <span>
          Maestra <em>by</em>{' '}
          <button onClick={() => { window.scrollTo(0, 0); navigate('/music-rio-academy'); }}>Music Rio Academy</button>
        </span>
        <span>© {new Date().getFullYear()} MUSIC RIO ACADEMY LTDA · CNPJ 22.826.985/0001-41. Todos os direitos reservados.</span>
      </div>
    </footer>
  );
};
