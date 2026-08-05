import { memo, useEffect, useRef, type FC, type ReactNode, type RefObject, type CSSProperties } from 'react';

import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { MobileNav } from './components/MobileNav';
import { LanguageModal } from '../Modals/LanguageModal';
import { NytaFloatingModal } from '../nyta/NytaFloatingModal';
import { StatusBanner, useStatusBanner } from '../AnnouncementBanner';
import { useLocalPlayerStore } from '../../stores/localPlayerStore';
import { LocalPlayerBar } from '../LocalPlayerBar';

import { useAppDispatch, useAppSelector } from '../../store/store';
import { uiActions } from '../../store/slices/ui';
import { authActions } from '../../store/slices/auth';
import { fetchSubscriptionStatus, fetchPlanConfig } from '../../store/slices/subscription';
import { PAYWALL_DISABLED } from '../../constants/maestra';
import useIsMobile from '../../utils/isMobile';
import { useWizardPanelStore } from '../../stores/wizardPanelStore';
import { useNytaModal } from '../../hooks/useNytaModal';
import { ArtifactsPanel } from '../../pages/Wizard/ArtifactsPanel';
import { enableWebPush, hasWebPushSubscription, isWebPushSupported, syncWebPushSubscription } from '../../services/pushNotifications';
import { ARTISTS_DEFAULT_IMAGE } from '../../constants/spotify';
import { SearchIcon } from '../Icons';
import { FiArrowRight } from 'react-icons/fi';
import {
  AgendaIcon,
  CatalogoIcon,
  DashboardIcon,
  DiagnosticoIcon,
  EquipeIcon,
  MarketingIcon,
  NotificationIcon,
  PlanejamentoIcon,
  PlanoAcaoIcon,
  SystemHomeIcon,
} from '../Icons/system';
import { NytaAvatar } from '../../pages/Wizard/chat/nytaPersona';
import { useArtistCapabilities } from '../../hooks/useArtistCapabilities';
import { useJourneyState } from '../../hooks/useJourneyState';

export interface LayoutContext {
  container: RefObject<HTMLDivElement | null>;
}

const SUPPORT_EMAIL = 'maestra@musicrioacademy.com.br';

const REAL_CAREER_STAGES = [
  'Beginner',
  'Cult',
  'Paradox',
  'Moneymaker',
  'Influencer',
  'Bet',
  'Outlier',
  'Rising',
  'Hype',
  'Potential',
  'Digital',
  'Analog',
  'Underpaid',
  'Spotlight',
  'Hit',
  'Icon',
] as const;

const pathArtistId = (pathname: string): string | undefined =>
  /^\/artists\/([^/]+)/.exec(pathname)?.[1];

const firstInitials = (value?: string | null) =>
  (value || 'Maestra')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

const ProfileMenuButton: FC<{
  active: boolean;
  icon: ReactNode;
  label: ReactNode;
  locked?: boolean;
  onClick: () => void;
}> = ({ active, icon, label, locked, onClick }) => (
  <button type='button' className={active ? 'profile-current' : ''} onClick={onClick} title={locked ? 'Bloqueado' : undefined}>
    <i />
    <span className='menu-icon'>{icon}</span>
    {typeof label === 'string' ? label : <span className='menu-text'>{label}</span>}
  </button>
);

export const AppLayout: FC = memo(() => {
  const dispatch = useAppDispatch();
  const container = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const rawBannerKind = useStatusBanner();
  const location = useLocation();
  const navigate = useNavigate();
  const { isOpen: nytaOpen, open: openNyta } = useNytaModal();

  // O conteúdo rola dentro de .Main-section (não no body). Como o layout permanece
  // montado entre as rotas, sem este reset a nova tela herdava a posição da anterior.
  useEffect(() => {
    const page = container.current;
    page?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.search]);

  // Com o player do catálogo aberto, ele ASSUME o lugar do banner no rodapé — então o banner some
  // enquanto o player está no ar. Sem depender de `isMobile` (o breakpoint do JS ≠ do CSS deixava
  // o banner visível numa faixa de largura, e o player sobrepunha em vez de substituir).
  const playerOpen = useLocalPlayerStore((s) => s.open);
  const playerTracks = useLocalPlayerStore((s) => s.tracks);
  const playerCurrentId = useLocalPlayerStore((s) => s.currentId);
  const setPlayerOpen = useLocalPlayerStore((s) => s.setOpen);
  const setPlayerCurrentId = useLocalPlayerStore((s) => s.setCurrentId);
  // A lista inicial de perfis não tem contexto de reprodução. No mobile, a Nyta ocupa a tela
  // inteira; manter o player visível por cima dela quebraria esse fluxo. Nas demais telas o player
  // continua global e o áudio segue tocando durante a navegação.
  // A lista global de perfis não tem contexto de reprodução. Normalize a barra final
  // para manter a regra válida tanto em /artists quanto em /artists/.
  const isArtistsList = location.pathname.replace(/\/+$/, '') === '/artists';
  const playerHidden = isArtistsList || (isMobile && nytaOpen);
  const playerVisible = playerOpen && !playerHidden;
  // No mobile o banner promocional ("Assine o Maestra Pro") toma espaço demais e não é crítico —
  // escondemos só ele. Os avisos de pagamento (grace/pending) continuam aparecendo no mobile.
  const bannerKind = playerVisible
    ? null
    : rawBannerKind === 'promo' && isMobile
    ? null
    : rawBannerKind;
  const userId = useAppSelector((s) => s.auth.user?.id);
  const user = useAppSelector((s) => s.auth.user);
  const artists = useAppSelector((s) => s.artists.items);
  const routeArtistId = pathArtistId(location.pathname);
  const currentArtist = routeArtistId ? artists.find((artist) => artist.id === routeArtistId) : undefined;
  const isNytaPage = location.pathname.endsWith('/nyta');
  const isNotificationsPage = location.pathname === '/notifications';
  const openNytaPage = () => routeArtistId ? navigate(`/artists/${routeArtistId}/nyta`) : openNyta();
  const { viewPlanning } = useArtistCapabilities(currentArtist);
  const journey = useJourneyState(currentArtist);
  const currentArtistImage = currentArtist?.content?.spotifyProfile?.image || ARTISTS_DEFAULT_IMAGE;
  const realStage = currentArtist?.content?.realIndex?.profile?.name;
  // O REAL usa índice zero-based: Beginner = 0 e Icon = 15, como na referência visual.
  // O arco percorre o intervalo completo entre a primeira e a última das 16 fases.
  const realStageIndex = realStage ? Math.max(0, REAL_CAREER_STAGES.indexOf(realStage as typeof REAL_CAREER_STAGES[number])) : 0;
  const realStageProgress = realStage ? `${(realStageIndex / (REAL_CAREER_STAGES.length - 1)) * 100}%` : '0%';

  // Solicita push automaticamente na primeira entrada autenticada. O navegador
  // pode bloquear pedidos sem gesto do usuário; nesse caso, Configurações é o
  // fallback oficial para ativar manualmente.
  useEffect(() => {
    if (!userId || !isWebPushSupported()) return undefined;

    const timer = window.setTimeout(() => {
      syncWebPushSubscription(userId)
        .then((synced) => {
          if (synced || Notification.permission !== 'default') return undefined;
          const promptKey = `maestra-push-prompted:${userId}`;
          if (localStorage.getItem(promptKey)) return undefined;
          localStorage.setItem(promptKey, '1');
          return hasWebPushSubscription().then((enabled) => {
            if (!enabled) return enableWebPush(userId).catch(() => undefined);
            return undefined;
          });
        })
        .catch(() => undefined);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [userId]);
  // Coluna de resultados do Planejamento Estratégico (publicada pelo Wizard via store global):
  // aparece como 3ª coluna, irmã da navbar e da página, só enquanto o wizard está montado.
  const wizardPanel = useWizardPanelStore();
  const showWizardPanel = wizardPanel.active && wizardPanel.open && !isMobile;
  // No mobile a sidebar é oculta; uma tab bar no rodapé (in-flow, abaixo do banner) navega entre os
  // módulos do artista. Reserva a altura dela (56px) no mobile, somada à do banner quando houver.
  // A tab bar aparece nas rotas de artista E nas telas globais (Configurações, Notificações,
  // Assinatura…) quando há um artista atual no store — o mesmo critério do MobileNav. Excluímos a
  // lista "Seus artistas" e a área admin. Mantém a reserva de espaço (padding-bottom) em sincronia
  // com o que o MobileNav de fato renderiza, senão o conteúdo ficaria atrás da barra.
  const currentArtistId = useAppSelector((s) => s.artists.currentArtistId);
  const navExcluded = isArtistsList || location.pathname.startsWith('/admin');
  const hasMobileNav = !!(routeArtistId ?? currentArtistId) && !navExcluded;
  // No mobile, o Planejamento Estratégico (wizard) vira "tela cheia": escondemos o topbar do app
  // pra o chat ocupar toda a altura (o wizard já tem cabeçalho próprio com título e "Salvar e sair").
  const isWizardChat = /^\/artists\/[^/]+\/wizard/.test(location.pathname);
  const hideTopbar = isMobile && isWizardChat;
  // A navbar mobile é uma barra fixa SOBREPOSTA (o conteúdo passa por baixo dela, via padding-bottom
  // da .Main-section, e aparece atrás do gradiente translúcido). Por isso NÃO reservamos altura pra
  // ela aqui — só pro banner de pagamento, que é uma barra sólida. Reserva do banner é justa por
  // viewport (desktop ~1 linha = 76px; mobile 2 linhas = 84px).
  // Reserva a altura do rodapé pro conteúdo não colar no card. Com o player no lugar do banner
  // (desktop), reserva o mesmo espaço (76px) — senão o player fica sem respiro no topo.
  const bottomReserve = bannerKind ? (isMobile ? 84 : 76) : playerVisible && !isMobile ? 76 : 0;

  // Entrar numa das exceções deve fechar o player, não apenas escondê-lo: desmontar o áudio
  // interrompe a reprodução e evita que ela continue tocando sem um controle visível.
  useEffect(() => {
    if (playerOpen && playerHidden) {
      setPlayerOpen(false);
      setPlayerCurrentId(null);
    }
  }, [playerHidden, playerOpen, setPlayerCurrentId, setPlayerOpen]);

  // Carrega o status da assinatura uma vez ao autenticar, de forma global —
  // assim o banner e (futuramente) os entitlements refletem a realidade sem
  // depender de qual rota está montada nem de um refresh do navegador.
  useEffect(() => {
    if (userId && !PAYWALL_DISABLED) {
      dispatch(fetchSubscriptionStatus());
    }
  }, [userId, dispatch]);

  // Preços do produto (config dinâmica) — carregados uma vez pra alimentar os
  // upsells/paywalls do app (Dashboard, LockedFeature, banners) sem hardcode.
  useEffect(() => {
    dispatch(fetchPlanConfig());
  }, [dispatch]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 950) dispatch(uiActions.collapseLibrary());
      else dispatch(uiActions.openLibrary());
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [dispatch]);

  const isActive = (suffix: string) => {
    if (!routeArtistId) return false;
    if (suffix === '') return location.pathname === `/artists/${routeArtistId}`;
    return location.pathname.startsWith(`/artists/${routeArtistId}/${suffix}`);
  };

  const goArtist = (suffix: string) => {
    if (!routeArtistId) return;
    navigate(`/artists/${routeArtistId}${suffix ? `/${suffix}` : ''}`);
  };

  const planningTo = journey.hasPlan ? 'perfil' : 'wizard';
  const actionUnlocked = viewPlanning && journey.hasPlan;
  const userMetadata = (user?.user_metadata || {}) as Record<string, any>;
  const displayName = userMetadata.full_name || userMetadata.name || user?.email || 'Usuário';
  const userAvatar = userMetadata.avatar_url || userMetadata.picture || ARTISTS_DEFAULT_IMAGE;
  const topNavigation = (home = false) => (
    <header className='top-navigation'>
      <a className='constructor' href='/artists' onClick={(event) => {
        event.preventDefault();
        navigate('/artists');
      }}>
        <span className='brand-logo-mark' aria-hidden='true' />
        Maestra
      </a>
      {home && (
        <nav className='site-links'>
          <a href='#board'>Baixar App</a>
          <a href='#board'>Planos</a>
          <a href='#board'>Suporte</a>
        </nav>
      )}
      <label className='global-search'>
        <span className='global-search-icon' aria-hidden='true'><SearchIcon size={18} /></span>
        <input placeholder={home ? 'Buscar perfil ou artista' : 'Pesquisar na Maestra'} aria-label='Busca global' />
        <span className='global-search-arrow' aria-hidden='true'><FiArrowRight size={18} /></span>
      </label>
      <div className='account'>
        <span className='account-icon'>
          <img src={userAvatar} alt='' />
        </span>
        <strong>{displayName}</strong>
      </div>
      {routeArtistId && (
        <button className='round-control header-nyta-action' aria-label='Abrir Nyta IA' type='button' onClick={openNytaPage}>
          <NytaAvatar size={34} />
        </button>
      )}
      {home && (
        <button className='round-control' aria-label='Configurações' type='button' onClick={() => navigate('/settings')}>
          ⚙
        </button>
      )}
      <button className='round-control notification' aria-label='Notificações' type='button' onClick={() => navigate('/notifications')}>
        <NotificationIcon size={19} />
      </button>
    </header>
  );

  return (
    <>
      <LanguageModal />

      <main className={`task-app${bannerKind ? ' has-bottom-banner' : ''}${hasMobileNav ? ' has-mobile-nav' : ''}${hideTopbar ? ' topbar-hidden' : ''}`}>
        {isArtistsList ? (
          <section className='profile-home page-view'>
            {!hideTopbar && topNavigation(true)}
            <Outlet context={{ container } satisfies LayoutContext} />
          </section>
        ) : (
          <>
        {!hideTopbar && topNavigation(false)}
        <div
          className={`app-layout${showWizardPanel || isNytaPage || isNotificationsPage ? ' module-layout' : ''}`}
          style={{ bottom: bottomReserve ? `${bottomReserve}px` : 0 }}
        >
          <aside className='app-rail' aria-label='Atalhos'>
            <div className='rail-actions'>
              <button type='button' aria-label='Tela inicial' onClick={() => navigate('/artists')}>
                <SystemHomeIcon size={20} />
              </button>
              <button type='button' className={location.pathname === '/notifications' ? 'rail-active rail-notification' : 'rail-notification'} aria-label='Notificações' onClick={() => navigate('/notifications')}>
                <NotificationIcon size={19} />
              </button>
              <button type='button' className={`rail-nyta${isNytaPage ? ' rail-active' : ''}`} aria-label='Abrir Nyta IA' onClick={openNytaPage}>
                <b>Nyta IA</b>
              </button>
            </div>

            <div className='rail-people'>
              {artists.slice(0, 4).map((artist) => (
                artist.content?.spotifyProfile?.image
                  ? <span key={artist.id} className={`avatar avatar-big avatar-image${artist.id === currentArtist?.id ? ' avatar-current' : ''}`} role='button' aria-current={artist.id === currentArtist?.id ? 'page' : undefined} aria-label={artist.id === currentArtist?.id ? `${artist.name}, perfil selecionado` : `Abrir perfil de ${artist.name}`} tabIndex={0} onClick={() => navigate(`/artists/${artist.id}`)}><img src={artist.content.spotifyProfile.image} alt={artist.name} /></span>
                  : <span key={artist.id} className={`avatar avatar-big${artist.id === currentArtist?.id ? ' avatar-current' : ''}`} role='button' aria-current={artist.id === currentArtist?.id ? 'page' : undefined} aria-label={artist.id === currentArtist?.id ? `${artist.name}, perfil selecionado` : `Abrir perfil de ${artist.name}`} tabIndex={0} onClick={() => navigate(`/artists/${artist.id}`)}>{firstInitials(artist.name)}</span>
              ))}
              <button type='button'>＋</button>
            </div>
          </aside>

          {currentArtist && !isNytaPage && !isNotificationsPage && (
            <aside className='profile-panel' aria-label='Detalhes do artista'>
              <div
                className='portrait-wrap'
                style={{ '--stage-progress': realStageProgress } as CSSProperties}
              >
                <div
                  className='portrait-stage-ring'
                  aria-label={`Fase ${realStageIndex} de ${REAL_CAREER_STAGES.length}: ${realStage || 'Não definida'}`}
                >
                  <div className='portrait'>
                    <img src={currentArtistImage} alt={currentArtist.name} />
                  </div>
                </div>
                <i>{realStageIndex}</i>
              </div>
              <h1>{currentArtist.name}</h1>
              <p className='profile-stage-label'>Fase atual: <b>{currentArtist.content?.realIndex?.profile?.name || currentArtist.content?.phaseLabel || 'Em construção'}</b></p>

              <div className='profile-menu'>
                <ProfileMenuButton active={isActive('')} icon={<DashboardIcon size={22} />} label='Dashboard' onClick={() => goArtist('')} />
                <ProfileMenuButton active={isActive('diagnostico')} icon={<DiagnosticoIcon size={22} />} label='Diagnóstico Real' onClick={() => goArtist('diagnostico')} />
                <ProfileMenuButton active={isActive('perfil') || isActive('wizard')} icon={<PlanejamentoIcon size={22} />} label='Planejamento' locked={!viewPlanning} onClick={() => goArtist(planningTo)} />
                <ProfileMenuButton active={isActive('action-plan')} icon={<PlanoAcaoIcon size={22} />} label='Plano de Ação' locked={!actionUnlocked} onClick={() => goArtist(actionUnlocked ? 'action-plan' : 'wizard')} />
                <ProfileMenuButton active={isActive('catalog')} icon={<CatalogoIcon size={22} />} label='Catálogo' onClick={() => goArtist('catalog')} />
                <ProfileMenuButton active={isActive('agenda')} icon={<AgendaIcon size={22} />} label='Agenda' onClick={() => goArtist('agenda')} />
                <ProfileMenuButton active={isActive('team')} icon={<EquipeIcon size={22} />} label='Equipe' locked={!viewPlanning} onClick={() => goArtist('team')} />
                <ProfileMenuButton active={isActive('marketing')} icon={<MarketingIcon size={22} />} label={<span>Marketing<small style={{ display: 'block', fontSize: 8 }}>(Em breve)</small></span>} onClick={() => goArtist('marketing')} />
              </div>

              <button type='button' className='social-links' onClick={() => goArtist('diagnostico')}>
                Reportar
              </button>
            </aside>
          )}

          <section className='board-shell' id='board'>
            <div className='Main-section' ref={container}>
              <Outlet context={{ container } satisfies LayoutContext} />
            </div>
          </section>

          {showWizardPanel && (
            <ArtifactsPanel
              draft={wizardPanel.content}
              artistName={wizardPanel.artistName}
              progress={wizardPanel.progress}
              onClose={() => wizardPanel.setOpen(false)}
              onEdit={wizardPanel.persist ?? undefined}
            />
          )}
        </div>
          </>
        )}

        {bannerKind && <StatusBanner kind={bannerKind} />}

        {/* Tab bar do mobile (fixa no rodapé, abaixo do banner). Oculta no desktop via CSS. */}
        <MobileNav />
      </main>

      <NytaFloatingModal />

      {playerVisible && playerCurrentId && playerTracks.length > 0 && (
        <LocalPlayerBar
          tracks={playerTracks}
          currentId={playerCurrentId}
          onChangeTrack={setPlayerCurrentId}
          onTrackClick={() => {
            if (currentArtistId) {
              navigate(`/artists/${currentArtistId}/catalog`, { state: { catalogTab: 'manual' } });
            }
          }}
          onClose={() => {
            setPlayerOpen(false);
            setPlayerCurrentId(null);
          }}
        />
      )}
    </>
  );
});

AppLayout.displayName = 'AppLayout';
