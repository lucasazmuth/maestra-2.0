import { FC, ReactNode, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FiBarChart2, FiBell, FiDatabase, FiGrid, FiKey, FiStar, FiTag, FiUsers,
} from 'react-icons/fi';

import { useIsPlatformAdmin } from '../../../../hooks/useIsPlatformAdmin';
import styles from './AdminMenu.module.scss';

// Atalho para as telas de /admin no topo da aplicação. Antes elas só existiam na sidebar
// do perfil, ou seja, sumiam justamente nas páginas de admin — para trocar de tela era
// preciso voltar a um artista ou digitar a URL.
//
// Só aparece para admin, mas isso é conveniência de navegação: o acesso de verdade é
// barrado pelo guard de rota e pela verificação nas edge functions.

const ITEMS: Array<{ label: string; path: string; icon: ReactNode }> = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: <FiBarChart2 /> },
  { label: 'Perfis de artistas', path: '/admin/artistas', icon: <FiGrid /> },
  { label: 'Base de Conhecimento', path: '/admin/knowledge-base', icon: <FiDatabase /> },
  { label: 'Cupons', path: '/admin/cupons', icon: <FiTag /> },
  { label: 'Pass Access', path: '/admin/pass-access', icon: <FiKey /> },
  { label: 'Usuários', path: '/admin/usuarios', icon: <FiUsers /> },
  { label: 'Avaliações', path: '/admin/avaliacoes', icon: <FiStar /> },
  { label: 'Enviar push', path: '/admin/push', icon: <FiBell /> },
];

export const AdminMenu: FC = () => {
  const isAdmin = useIsPlatformAdmin();
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

  if (!isAdmin) return null;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type='button'
        className={`round-control ${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        aria-label='Produtos e administração'
        aria-haspopup='menu'
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <FiGrid size={19} />
      </button>

      {open && (
        <div className={styles.panel} role='menu'>
          <div className={styles.panelTitle}>Administração</div>
          <div className={styles.grid}>
            {ITEMS.map((item) => {
              const active = location.pathname.startsWith(item.path);
              return (
                <button
                  key={item.path}
                  type='button'
                  role='menuitem'
                  className={`${styles.item} ${active ? styles.itemActive : ''}`}
                  onClick={() => navigate(item.path)}
                >
                  <span className={styles.itemIcon} aria-hidden>{item.icon}</span>
                  <span className={styles.itemLabel}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMenu;
