import { FC } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiGrid, FiCheckSquare, FiMusic, FiCalendar, FiUsers } from 'react-icons/fi';

// Navbar inferior (tab bar) do mobile: substitui a sidebar (oculta em telas < 768px).
// Mesmos módulos da sidebar. Só aparece quando há um artista no contexto (rota /artists/:id…).

const matchArtistId = (pathname: string): string | undefined => {
  const m = pathname.match(/^\/artists\/([^/]+)/);
  return m ? m[1] : undefined;
};

export const MobileNav: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [t] = useTranslation(['navigation']);
  const artistId = matchArtistId(location.pathname);

  // Sem artista no contexto (ex.: lista "Seus artistas") não há o que navegar por módulo.
  if (!artistId) return null;

  const items = [
    { icon: <FiGrid />, label: t('Home', { defaultValue: 'Início' }), suffix: '' },
    { icon: <FiCheckSquare />, label: t('Plan', { defaultValue: 'Plano' }), suffix: 'action-plan' },
    { icon: <FiMusic />, label: t('Catalog', { defaultValue: 'Catálogo' }), suffix: 'catalog' },
    { icon: <FiCalendar />, label: t('Agenda', { defaultValue: 'Agenda' }), suffix: 'agenda' },
    { icon: <FiUsers />, label: t('Team', { defaultValue: 'Equipe' }), suffix: 'team' },
  ];

  const isActive = (suffix: string) =>
    suffix === ''
      ? location.pathname === `/artists/${artistId}`
      : location.pathname.startsWith(`/artists/${artistId}/${suffix}`);

  return (
    <nav className='mobile-nav' aria-label='Navegação'>
      {items.map((it) => {
        const active = isActive(it.suffix);
        return (
          <button
            key={it.suffix || 'home'}
            className={`mobile-nav-item${active ? ' mobile-nav-item--active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => navigate(`/artists/${artistId}${it.suffix ? `/${it.suffix}` : ''}`)}
          >
            <span className='mobile-nav-icon'>{it.icon}</span>
            <span className='mobile-nav-label'>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default MobileNav;
