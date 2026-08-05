import { FC, ReactNode, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  SystemHomeIcon, PlanoAcaoIcon, CatalogoIcon, AgendaIcon, MoreIcon,
  DiagnosticoIcon, PlanejamentoIcon, EquipeIcon, MarketingIcon,
} from '../../../Icons/system';
import { useAppSelector } from '../../../../store/store';
import { useNytaModal } from '../../../../hooks/useNytaModal';
import { NytaAvatar } from '../../../../pages/Wizard/chat/nytaPersona';

// Navbar inferior (tab bar) do mobile: substitui a sidebar (oculta em telas < 768px).
// Layout: Início · Plano de ação · [Nyta IA] · Agenda · Mais. O centro é o avatar da Nyta (abre o
// modal do assistente). "Mais" (popover) guarda o restante: Catálogo, Diagnóstico REAL, Plano
// estratégico e Equipe.
// Aparece sempre que há um artista no contexto — seja pela rota /artists/:id… ou, em telas
// "globais" (Configurações, Notificações, Assinatura…), pelo artista atual guardado no store.

const matchArtistId = (pathname: string): string | undefined => {
  const m = pathname.match(/^\/artists\/([^/]+)/);
  return m ? m[1] : undefined;
};

// Rotas sem contexto de artista: a lista "Seus artistas" (o seletor) e a área admin.
// Nelas a tab bar não faz sentido, mesmo havendo um artista atual no store.
const isNavExcludedRoute = (pathname: string): boolean =>
  pathname === '/artists' || pathname.startsWith('/admin');

type Item = { icon: ReactNode; label: string; suffix: string };

export const MobileNav: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [t] = useTranslation(['navigation']);
  const [moreOpen, setMoreOpen] = useState(false);
  const { isOpen: nytaOpen } = useNytaModal();
  // Artista pela rota; senão o atual (setado ao visitar qualquer módulo do artista) — assim a
  // navbar segue visível em /settings, /notifications, /assinatura etc.
  const currentArtistId = useAppSelector((s) => s.artists.currentArtistId);
  const artistId = matchArtistId(location.pathname) ?? currentArtistId;

  // Sem artista no contexto, ou numa rota excluída (lista/admin), não há o que navegar por módulo.
  if (!artistId || isNavExcludedRoute(location.pathname)) return null;

  // Atalhos das pontas (mais usados no dia a dia). O centro (Nyta) é renderizado à parte.
  const left: Item[] = [
    { icon: <SystemHomeIcon size={24} />, label: t('Home', { defaultValue: 'Início' }), suffix: '' },
    { icon: <PlanoAcaoIcon size={24} />, label: t('Plan', { defaultValue: 'Plano de ação' }), suffix: 'action-plan' },
  ];
  const right: Item[] = [
    { icon: <AgendaIcon size={24} />, label: t('Agenda', { defaultValue: 'Agenda' }), suffix: 'agenda' },
  ];
  // Restante dos módulos, dentro do "Mais".
  const more: Item[] = [
    { icon: <CatalogoIcon size={22} />, label: t('Catalog', { defaultValue: 'Catálogo' }), suffix: 'catalog' },
    { icon: <DiagnosticoIcon size={22} />, label: t('REAL Diagnostic', { defaultValue: 'Diagnóstico REAL' }), suffix: 'diagnostico' },
    { icon: <PlanejamentoIcon size={22} />, label: t('Planning', { defaultValue: 'Plano estratégico' }), suffix: 'perfil' },
    { icon: <EquipeIcon size={22} />, label: t('Team', { defaultValue: 'Equipe' }), suffix: 'team' },
    { icon: <MarketingIcon size={22} />, label: t('Marketing', { defaultValue: 'Marketing' }), suffix: 'marketing' },
  ];

  const isActive = (suffix: string) =>
    suffix === ''
      ? location.pathname === `/artists/${artistId}`
      : location.pathname.startsWith(`/artists/${artistId}/${suffix}`);
  const moreActive = more.some((m) => isActive(m.suffix));

  const go = (suffix: string) => {
    setMoreOpen(false);
    navigate(`/artists/${artistId}${suffix ? `/${suffix}` : ''}`);
  };

  const goNyta = () => {
    setMoreOpen(false);
    navigate(`/artists/${artistId}/nyta`);
  };

  const renderItem = (it: Item) => {
    const active = isActive(it.suffix);
    return (
      <button
        key={it.suffix || 'home'}
        className={`mobile-nav-item${active ? ' mobile-nav-item--active' : ''}`}
        aria-current={active ? 'page' : undefined}
        onClick={() => go(it.suffix)}
      >
        <span className='mobile-nav-icon'>{it.icon}</span>
        <span className='mobile-nav-label'>{it.label}</span>
      </button>
    );
  };

  return (
    <>
      {/* Menu "Mais" */}
      {moreOpen && <div className='mobile-more-backdrop' onClick={() => setMoreOpen(false)} />}
      {moreOpen && (
        <div className='mobile-more-sheet' role='menu'>
          <div className='mobile-more-handle' aria-hidden />
          {more.map((m) => (
            <button
              key={m.suffix}
              className={`mobile-more-item${isActive(m.suffix) ? ' mobile-more-item--active' : ''}`}
              onClick={() => go(m.suffix)}
            >
              <span className='mobile-more-ic'>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      )}

      <nav className='mobile-nav' aria-label='Navegação'>
        {left.map(renderItem)}

        {/* Nyta IA — centro da barra: o avatar abre o modal do assistente. */}
        <button
          className={`mobile-nav-item mobile-nav-item--nyta${nytaOpen || location.pathname.endsWith('/nyta') ? ' mobile-nav-item--active' : ''}`}
          aria-label='Nyta IA'
          onClick={goNyta}
        >
          <span className='mobile-nav-nyta-avatar'><NytaAvatar size={30} /></span>
          <span className='mobile-nav-label'>Nyta</span>
        </button>

        {right.map(renderItem)}

        {/* Mais — abre o popover com os módulos restantes */}
        <button
          className={`mobile-nav-item${moreOpen || moreActive ? ' mobile-nav-item--active' : ''}`}
          aria-haspopup='menu'
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((o) => !o)}
        >
          <span className='mobile-nav-icon'><MoreIcon size={24} /></span>
          <span className='mobile-nav-label'>{t('More', { defaultValue: 'Mais' })}</span>
        </button>
      </nav>
    </>
  );
};

export default MobileNav;
