import { FC, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiDownload, FiInstagram, FiShare } from 'react-icons/fi';

import { MaestraBrand } from '../../components/MaestraBrand';
import { usePwaInstall } from '../../components/PwaInstallBanner';
import styles from './Home.module.scss';

// Cabeçalho e rodapé da landing e das páginas que nascem dela (hoje /sobre). Ficam aqui porque
// a navegação precisa funcionar dos dois lados: os itens de seção rolam a página quando já se
// está na landing e voltam pra ela pedindo o scroll quando não se está.
//
// As páginas institucionais mais antigas (/diagnostico-real, /music-rio-academy e a landing do
// workshop) ainda usam ./LightChrome.tsx, que tem a mesma cara mas outro conjunto de links.

// Só âncoras: o menu do topo leva a áreas da própria landing, então cada item rola a página em
// vez de trocar de rota. "Sobre" saiu daqui por isso — ele é página, e vive no rodapé.
const NAV = [
  { label: 'Recursos', id: 'recursos' },
  { label: 'Nyta IA', id: 'nyta' },
  { label: 'Planos', id: 'planos' },
  { label: 'FAQ', id: 'faq' },
  { label: 'Download', id: 'download' },
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
          <a href='https://www.instagram.com/maestra.manager/' target='_blank' rel='noreferrer' aria-label='Instagram' className={styles.footerSocial}>
            <FiInstagram size={18} />
          </a>
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
