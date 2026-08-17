import { FC, ReactNode, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FiBarChart2, FiBell, FiDatabase, FiGrid, FiKey, FiLifeBuoy, FiLogOut,
  FiSettings, FiStar, FiTag, FiUsers, FiFilter } from 'react-icons/fi';

import { PerfisIcon } from '../../../Icons/system';
import { useIsPlatformAdmin } from '../../../../hooks/useIsPlatformAdmin';
import { useAppDispatch } from '../../../../store/store';
import { authActions } from '../../../../store/slices/auth';
import styles from './SystemMenu.module.scss';

// Menu do sistema no topo da aplicação. Reúne o que não pertence a um perfil de artista:
// configurações da conta, termos e suporte para todo mundo, e as telas de /admin para quem
// é admin da plataforma.
//
// As telas de /admin só tinham entrada pela sidebar do perfil, que some justamente dentro
// das páginas de admin — trocar de tela exigia voltar a um artista ou digitar a URL.
//
// A parte de admin some para quem não é admin, mas isso é conveniência de navegação: quem
// barra o acesso de fato é o guard de rota, a RLS e a verificação nas edge functions.

interface Item {
  label: string;
  icon: ReactNode;
  path?: string;
  href?: string;
  // Sair da conta não navega — só ele usa isto. Os demais itens vão por path/href.
  action?: () => void;
}

const GENERAL: Item[] = [
  // No mobile, páginas sem sidebar/navmenu (ex.: 404) não davam volta para a lista de
  // perfis. O menu do sistema é o único ponto fixo em qualquer tela, então entra aqui.
  { label: 'Perfis', path: '/artists', icon: <PerfisIcon size={20} /> },
  { label: 'Configurações', path: '/settings', icon: <FiSettings /> },
  { label: 'Suporte', path: '/suporte', icon: <FiLifeBuoy /> },
];

const ADMIN: Item[] = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: <FiBarChart2 /> },
  { label: 'Perfis de artistas', path: '/admin/artistas', icon: <FiGrid /> },
  { label: 'Base de Conhecimento', path: '/admin/knowledge-base', icon: <FiDatabase /> },
  { label: 'Cupons', path: '/admin/cupons', icon: <FiTag /> },
  { label: 'Pass Access', path: '/admin/pass-access', icon: <FiKey /> },
  { label: 'Usuários', path: '/admin/usuarios', icon: <FiUsers /> },
  { label: 'CRM', path: '/admin/crm', icon: <FiFilter /> },
  { label: 'Avaliações', path: '/admin/avaliacoes', icon: <FiStar /> },
  { label: 'Enviar push', path: '/admin/push', icon: <FiBell /> },
];

interface Props {
  // No mobile, os mesmos atalhos já moram no "Mais" da tab bar — repetir aqui duplicaria a
  // navegação. Mas em telas sem tab bar (/artists, /admin), este é o único caminho até
  // Configurações/Suporte/Sair, então continua visível ali mesmo no mobile.
  hasMobileNav?: boolean;
}

export const SystemMenu: FC<Props> = ({ hasMobileNav = false }) => {
  const isAdmin = useIsPlatformAdmin();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou no Esc — o painel é flutuante e não tem overlay próprio.
  useEffect(() => {
    if (!open) return;

    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Navegar deve fechar o painel, senão ele fica aberto sobre a tela nova.
  useEffect(() => setOpen(false), [location.pathname]);

  const go = (item: Item) => {
    if (item.action) { item.action(); return; }
    // mailto em nova aba: apontar location.href pra mailto congela a SPA.
    if (item.href) window.open(item.href, '_blank');
    else if (item.path) navigate(item.path);
    setOpen(false);
  };

  const renderItems = (items: Item[]) => (
    <div className={styles.grid}>
      {items.map((item) => {
        const active = !!item.path && location.pathname.startsWith(item.path);
        return (
          <button
            key={item.label}
            type='button'
            role='menuitem'
            className={`${styles.item} ${active ? styles.itemActive : ''}${item.action ? ` ${styles.itemDanger}` : ''}`}
            onClick={() => go(item)}
          >
            <span className={styles.itemIcon} aria-hidden>{item.icon}</span>
            <span className={styles.itemLabel}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );

  // Sair da conta não tinha nenhuma entrada no menu do sistema: só existia lá dentro de
  // Configurações. Entra como o último item da mesma grade dos demais — não é mais um botão
  // separado embaixo, só se distingue pelo tom vermelho no hover (.itemDanger).
  const signOut = async () => {
    setOpen(false);
    await dispatch(authActions.signOut());
    navigate('/login', { replace: true });
  };

  // Uma grade só, sem título separando Geral de Administração — a visibilidade de cada item
  // continua condicionada à mesma regra de antes (isAdmin), só a divisão visual que saiu.
  const allItems: Item[] = [
    ...(isAdmin ? [...GENERAL, ...ADMIN] : GENERAL),
    { label: 'Sair da conta', icon: <FiLogOut />, action: signOut },
  ];

  return (
    <div className={`${styles.wrap} ${hasMobileNav ? styles.hiddenWithTabBar : ''}`} ref={wrapRef}>
      <button
        type='button'
        className={`round-control ${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        aria-label='Menu do sistema'
        aria-haspopup='menu'
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <FiGrid size={23} />
      </button>

      {/* Só aparece (via CSS) no mobile: no desktop o clique fora já fecha o painel, sem
          precisar escurecer a tela — o painel ali é pequeno e ancorado perto do gatilho. */}
      {open && <div className={styles.backdrop} onClick={() => setOpen(false)} />}

      {open && (
        <div className={styles.panel} role='menu'>
          {renderItems(allItems)}
        </div>
      )}
    </div>
  );
};

export default SystemMenu;
