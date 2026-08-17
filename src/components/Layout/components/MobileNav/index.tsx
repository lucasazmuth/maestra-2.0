import { FC, ReactNode, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiSettings, FiLifeBuoy } from 'react-icons/fi';
import {
  PlanoAcaoIcon, CatalogoIcon, AgendaIcon, MoreIcon,
  DiagnosticoIcon, PlanejamentoIcon, EquipeIcon, MarketingIcon, PerfisIcon,
} from '../../../Icons/system';
import { useAppSelector } from '../../../../store/store';
import { ARTISTS_DEFAULT_IMAGE } from '../../../../constants/spotify';

// Navbar inferior (tab bar) do mobile: substitui a sidebar (oculta em telas < 768px).
// Layout da referência (gsap-app): [avatar do perfil] · Plano · Músicas · Agenda · Mais. A
// primeira célula é a foto do artista selecionado, que leva pra home dele — no lugar de um ícone
// de casa, ela também diz DE QUEM é a tela. "Mais" (popover) guarda Diagnóstico REAL, Plano
// estratégico, Equipe e Marketing — e, abaixo, Perfis/Configurações/Suporte, que no desktop vivem
// no menu do sistema (o ícone de grade do header). Esse menu some no mobile (ver
// SystemMenu.module.scss) porque os mesmos atalhos já cabem aqui, sem duplicar navegação.
// A Nyta NÃO mora aqui: o atalho dela é o botão roxo do cabeçalho (.header-nyta-action).
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
// Atalhos que não pertencem a um artista (o que no desktop mora no menu do sistema): rota
// absoluta em vez de sufixo dentro de /artists/:id/....
type SystemItem = { icon: ReactNode; label: string; path: string };

export const MobileNav: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [t] = useTranslation(['navigation']);
  const [moreOpen, setMoreOpen] = useState(false);
  // Artista pela rota; senão o atual (setado ao visitar qualquer módulo do artista) — assim a
  // navbar segue visível em /settings, /notifications, /assinatura etc.
  const currentArtistId = useAppSelector((s) => s.artists.currentArtistId);
  const artistId = matchArtistId(location.pathname) ?? currentArtistId;
  const artists = useAppSelector((s) => s.artists.items);
  const artist = artists.find((a) => a.id === artistId);

  // Sem artista no contexto, ou numa rota excluída (lista/admin), não há o que navegar por módulo.
  if (!artistId || isNavExcludedRoute(location.pathname)) return null;

  // Atalhos do dia a dia. A primeira célula (a home do artista) é renderizada à parte: ela é a
  // foto do perfil, não um ícone.
  const tabs: Item[] = [
    { icon: <PlanoAcaoIcon size={24} />, label: t('Plan', { defaultValue: 'Plano' }), suffix: 'action-plan' },
    { icon: <CatalogoIcon size={24} />, label: t('Catalog', { defaultValue: 'Músicas' }), suffix: 'catalog' },
    { icon: <AgendaIcon size={24} />, label: t('Agenda', { defaultValue: 'Agenda' }), suffix: 'agenda' },
  ];
  // Restante dos módulos, dentro do "Mais" (2 por linha, na grade do popover).
  const more: Item[] = [
    { icon: <DiagnosticoIcon size={22} />, label: t('REAL Diagnostic', { defaultValue: 'Diagnóstico REAL' }), suffix: 'diagnostico' },
    { icon: <PlanejamentoIcon size={22} />, label: t('Planning', { defaultValue: 'Plano estratégico' }), suffix: 'perfil' },
    { icon: <EquipeIcon size={22} />, label: t('Team', { defaultValue: 'Equipe' }), suffix: 'team' },
    { icon: <MarketingIcon size={22} />, label: t('Marketing', { defaultValue: 'Marketing' }), suffix: 'marketing' },
  ];
  // Perfis/Configurações/Suporte — no desktop moram no menu do sistema (o ícone de grade do
  // header), que some no mobile porque esses mesmos atalhos já cabem aqui dentro do "Mais".
  const systemItems: SystemItem[] = [
    { icon: <PerfisIcon size={22} />, label: 'Perfis', path: '/artists' },
    { icon: <FiSettings size={22} />, label: 'Configurações', path: '/settings' },
    { icon: <FiLifeBuoy size={22} />, label: 'Suporte', path: '/suporte' },
  ];

  const isActive = (suffix: string) =>
    suffix === ''
      ? location.pathname === `/artists/${artistId}`
      : location.pathname.startsWith(`/artists/${artistId}/${suffix}`);
  const isActivePath = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  const moreActive = more.some((m) => isActive(m.suffix)) || systemItems.some((s) => isActivePath(s.path));

  const go = (suffix: string) => {
    setMoreOpen(false);
    navigate(`/artists/${artistId}${suffix ? `/${suffix}` : ''}`);
  };

  const goPath = (path: string) => {
    setMoreOpen(false);
    navigate(path);
  };

  const renderItem = (it: Item) => {
    // Com o "Mais" aberto ele é quem está em foco: dois itens erguidos (e dois pontinhos azuis)
    // ao mesmo tempo confundem qual é a tela atual.
    const active = !moreOpen && isActive(it.suffix);
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
          {/* Uma grade só: todos os atalhos (módulos do perfil + Perfis/Configurações/Suporte)
              no mesmo grupo, sem título separando. */}
          <div className='mobile-more-group'>
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
            {systemItems.map((s) => (
              <button
                key={s.path}
                className={`mobile-more-item${isActivePath(s.path) ? ' mobile-more-item--active' : ''}`}
                onClick={() => goPath(s.path)}
              >
                <span className='mobile-more-ic'>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <nav className='mobile-nav' aria-label='Navegação'>
        {/* Home do artista: a foto do perfil selecionado no lugar de um ícone de casa — é o
            atalho pra home E o lembrete de qual perfil está aberto (o header no mobile já não
            mostra o nome). */}
        <button
          className={`mobile-nav-item mobile-nav-item--profile${!moreOpen && isActive('') ? ' mobile-nav-item--active' : ''}`}
          aria-current={!moreOpen && isActive('') ? 'page' : undefined}
          aria-label={artist ? `Início de ${artist.name}` : 'Início'}
          onClick={() => go('')}
        >
          <img src={artist?.content?.spotifyProfile?.image || ARTISTS_DEFAULT_IMAGE} alt='' />
        </button>

        {tabs.map(renderItem)}

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
