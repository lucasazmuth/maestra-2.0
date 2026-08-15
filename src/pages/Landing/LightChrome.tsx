import { FC, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiDownload, FiInstagram, FiShare } from 'react-icons/fi';

import { MaestraBrand } from '../../components/MaestraBrand';
import { usePwaInstall } from '../../components/PwaInstallBanner';
import styles from './Landing.module.scss';

// Cabeçalho e rodapé CLAROS das páginas institucionais (/diagnostico-real, /music-rio-academy).
//
// Eram o chrome da landing e moravam no index dela. Quando a landing mudou pro layout escuro
// (referência Soundbox), essas páginas continuaram claras — herdar o chrome escuro deixaria um
// cabeçalho preto sobre página branca. O par claro mudou pra cá, junto do CSS antigo da landing
// (Landing.module.scss), que hoje só serve a essas páginas.

const NAV = [
  { label: 'Recursos', id: 'recursos' },
  { label: 'Planos', id: 'planos' },
  { label: 'FAQ', id: 'faq' },
];

// Navegação por seção que também funciona fora da landing: se a seção existe na página atual,
// rola até ela; senão volta pra landing pedindo o scroll.
const useSectionNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  return (id: string) => () => {
    if (location.pathname === '/') document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else navigate('/', { state: { scrollTo: id } });
  };
};

// Clique na marca: topo da landing (rola se já estiver nela, senão navega pra home).
const useGoHome = () => {
  const navigate = useNavigate();
  const location = useLocation();
  return (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === '/') window.scrollTo({ top: 0, behavior: 'smooth' });
    else navigate('/');
  };
};

export const Header: FC<{ loggedIn: boolean }> = ({ loggedIn }) => {
  const navigate = useNavigate();
  const goToSection = useSectionNav();
  const goHome = useGoHome();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ''}`}>
      <div className={styles.headerInner}>
        <a className={styles.brand} href="#top" onClick={goHome}>
          <MaestraBrand variant='lockup' tone='dark' className={styles.brandText} />
        </a>
        <nav className={styles.nav}>
          {NAV.map((n) => <button key={n.id} className={styles.navLink} onClick={goToSection(n.id)}>{n.label}</button>)}
        </nav>
        <div className={styles.actions}>
          {loggedIn ? (
            <button className={`${styles.btnPrimary} ${styles.headerCta}`} onClick={() => navigate('/artists')}>Ir pro app</button>
          ) : (
            <>
              <button className={styles.btnLink} onClick={() => navigate('/login')}>Entrar</button>
              <button className={`${styles.btnPrimary} ${styles.headerCta}`} onClick={() => navigate('/signup')}>Começar grátis</button>
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
  const goHome = useGoHome();
  const { visible: pwaVisible, ios: pwaIOS, install: installPwa, dismiss: dismissPwa } = usePwaInstall();
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <a className={styles.brand} href="#top" onClick={goHome}>
              <MaestraBrand variant='lockup' tone='dark' className={styles.brandText} />
            </a>
            <p className={styles.footerTag}>A plataforma que diagnostica, planeja e acompanha a sua carreira na música.</p>
            {pwaVisible && (
              <div className={styles.footerPwa}>
                <div className={styles.footerPwaIcon}>{pwaIOS ? <FiShare size={17} /> : <FiDownload size={17} />}</div>
                <div className={styles.footerPwaCopy}>
                  <strong>Instale a Maestra</strong>
                  <span>{pwaIOS ? 'Compartilhar → Adicionar à Tela de Início' : 'Tenha acesso rápido pelo celular ou computador'}</span>
                </div>
                {!pwaIOS && <button className={styles.footerPwaAction} onClick={installPwa}>Instalar</button>}
                <button className={styles.footerPwaClose} onClick={dismissPwa} aria-label='Fechar aviso de instalação'>×</button>
              </div>
            )}
          </div>
          <div className={styles.footerCols}>
            <div className={styles.footerCol}>
              <span className={styles.footerColTitle}>Produto</span>
              <button className={styles.footerLink} onClick={goToSection('recursos')}>Recursos</button>
              <button className={styles.footerLink} onClick={() => navigate('/diagnostico-real')}>Diagnóstico REAL</button>
              <button className={styles.footerLink} onClick={() => navigate('/music-rio-academy')}>Music Rio Academy</button>
              <button className={styles.footerLink} onClick={goToSection('planos')}>Planos</button>
              <button className={styles.footerLink} onClick={goToSection('faq')}>FAQ</button>
            </div>
            <div className={styles.footerCol}>
              <span className={styles.footerColTitle}>Conta</span>
              <button className={styles.footerLink} onClick={() => navigate('/login')}>Entrar</button>
              <button className={styles.footerLink} onClick={() => navigate('/signup')}>Criar conta</button>
            </div>
            <div className={styles.footerCol}>
              <span className={styles.footerColTitle}>Legal</span>
              <button className={styles.footerLink} onClick={() => navigate('/legal/termos')}>Termos de uso</button>
              <button className={styles.footerLink} onClick={() => navigate('/legal/privacidade')}>Política de privacidade</button>
            </div>
            <div className={styles.footerCol}>
              <span className={styles.footerColTitle}>Social</span>
              <a href="https://www.instagram.com/maestra.manager/" target="_blank" rel="noreferrer" aria-label="Instagram" className={styles.footerSocial}><FiInstagram size={18} /></a>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span className={styles.footerBy}>
            Maestra <span className={styles.footerByDim}>by</span>{' '}
            <button className={styles.footerByLink} onClick={() => { window.scrollTo(0, 0); navigate('/music-rio-academy'); }}>Music Rio Academy</button>
          </span>
          <span>© {new Date().getFullYear()} MUSIC RIO ACADEMY LTDA · CNPJ 22.826.985/0001-41. Todos os direitos reservados.</span>
        </div>
      </div>
    </footer>
  );
};
