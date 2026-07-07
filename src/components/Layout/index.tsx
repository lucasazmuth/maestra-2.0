import { memo, useEffect, useRef, useState, type FC, type RefObject } from 'react';

import { Col, Row } from 'antd';
import { Outlet, useLocation } from 'react-router-dom';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import { Topbar } from './components/Topbar';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { LanguageModal } from '../Modals/LanguageModal';
import { NytaFloatingModal } from '../nyta/NytaFloatingModal';
import { StatusBanner, useStatusBanner } from '../AnnouncementBanner';
import { useLocalPlayerStore } from '../../stores/localPlayerStore';

import { useAppDispatch, useAppSelector } from '../../store/store';
import { getLibraryCollapsed, uiActions } from '../../store/slices/ui';
import { fetchSubscriptionStatus, fetchPlanConfig } from '../../store/slices/subscription';
import { PAYWALL_DISABLED } from '../../constants/maestra';
import useIsMobile from '../../utils/isMobile';
import { useWizardPanelStore } from '../../stores/wizardPanelStore';
import { ArtifactsPanel } from '../../pages/Wizard/ArtifactsPanel';

export interface LayoutContext {
  container: RefObject<HTMLDivElement | null>;
}

export const AppLayout: FC = memo(() => {
  const dispatch = useAppDispatch();
  const container = useRef<HTMLDivElement>(null);
  const libraryCollapsed = useAppSelector(getLibraryCollapsed);
  const isMobile = useIsMobile();
  const [isTablet, setIsTablet] = useState(false);
  const rawBannerKind = useStatusBanner();
  // Com o player do catálogo aberto, ele ASSUME o lugar do banner no rodapé — então o banner some
  // enquanto o player está no ar. Sem depender de `isMobile` (o breakpoint do JS ≠ do CSS deixava
  // o banner visível numa faixa de largura, e o player sobrepunha em vez de substituir).
  const playerOpen = useLocalPlayerStore((s) => s.open);
  // No mobile o banner promocional ("Assine o Maestra Pro") toma espaço demais e não é crítico —
  // escondemos só ele. Os avisos de pagamento (grace/pending) continuam aparecendo no mobile.
  const bannerKind = playerOpen
    ? null
    : rawBannerKind === 'promo' && isMobile
    ? null
    : rawBannerKind;
  const userId = useAppSelector((s) => s.auth.user?.id);
  // Coluna de resultados do Planejamento Estratégico (publicada pelo Wizard via store global):
  // aparece como 3ª coluna, irmã da navbar e da página, só enquanto o wizard está montado.
  const wizardPanel = useWizardPanelStore();
  const showWizardPanel = wizardPanel.active && wizardPanel.open && !isMobile;
  // No mobile a sidebar é oculta; uma tab bar no rodapé (in-flow, abaixo do banner) navega entre os
  // módulos do artista. Reserva a altura dela (56px) no mobile, somada à do banner quando houver.
  const location = useLocation();
  // A tab bar aparece nas rotas de artista E nas telas globais (Configurações, Notificações,
  // Assinatura…) quando há um artista atual no store — o mesmo critério do MobileNav. Excluímos a
  // lista "Seus artistas" e a área admin. Mantém a reserva de espaço (padding-bottom) em sincronia
  // com o que o MobileNav de fato renderiza, senão o conteúdo ficaria atrás da barra.
  const currentArtistId = useAppSelector((s) => s.artists.currentArtistId);
  const routeArtistId = /^\/artists\/([^/]+)/.exec(location.pathname)?.[1];
  const navExcluded = location.pathname === '/artists' || location.pathname.startsWith('/admin');
  const hasMobileNav = !!(routeArtistId ?? currentArtistId) && !navExcluded;
  // No mobile, o Planejamento Estratégico (wizard) vira "tela cheia": escondemos o topbar do app
  // pra o chat ocupar toda a altura (o wizard já tem cabeçalho próprio com título e "Salvar e sair").
  const isWizardChat = /^\/artists\/[^/]+\/wizard/.test(location.pathname);
  const hideTopbar = isMobile && isWizardChat;
  // A navbar mobile é uma barra fixa SOBREPOSTA (o conteúdo passa por baixo dela, via padding-bottom
  // da .Main-section, e aparece atrás do gradiente translúcido). Por isso NÃO reservamos altura pra
  // ela aqui — só pro banner de pagamento, que é uma barra sólida. Reserva do banner é justa por
  // viewport (desktop ~1 linha = 76px; mobile 2 linhas = 84px).
  const bottomReserve = bannerKind ? (isMobile ? 84 : 76) : 0;

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
      const vw = window.innerWidth;
      if (vw < 950) {
        dispatch(uiActions.collapseLibrary());
        setIsTablet(true);
      } else {
        // Acompanha o breakpoint: reexpande a sidebar ao voltar para tela larga
        // (sem isto o estado colapsado ficava "grudado" depois de estreitar a janela).
        dispatch(uiActions.openLibrary());
        setIsTablet(false);
      }
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [dispatch]);

  return (
    <>
      <LanguageModal />

      <div className={`main-container${bannerKind ? ' has-bottom-banner' : ''}${hasMobileNav ? ' has-mobile-nav' : ''}${hideTopbar ? ' topbar-hidden' : ''}`}>
        <Row
          wrap
          justify='end'
          gutter={[8, 8]}
          // alignContent flex-start: sem isso, o align-content padrão (stretch) do flex-wrap estica a
          // linha do topbar (56px) pra preencher a altura cheia do Row, criando um vão extra ABAIXO da
          // barra e deixando os ícones "colados no topo". Com flex-start as linhas empacotam sem
          // esticar — o topbar fica nos 56px e o conteúdo preenche o resto.
          style={{ overflow: 'hidden', alignContent: 'flex-start', height: bottomReserve ? `calc(100% - ${bottomReserve}px)` : '100%' }}
        >
          {!hideTopbar && (
            <Col span={24}>
              <Topbar />
            </Col>
          )}

          <Col span={24}>
            {/* navbar + página (grupo redimensionável) e, à direita, a coluna de resultados do
                Planejamento Estratégico — irmã das outras, mesmo container da navbar. */}
            <div style={{ display: 'flex', gap: 8, height: '100%' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <PanelGroup direction='horizontal' autoSaveId='maestra-persistence'>
                  <Panel
                    id='left'
                    order={1}
                    className='mobile-hidden'
                    minSize={isTablet ? 10 : libraryCollapsed ? 7 : 18}
                    maxSize={isTablet ? 12 : libraryCollapsed ? 8 : 26}
                    defaultSize={isTablet ? 10 : libraryCollapsed ? 7 : 20}
                    style={{
                      borderRadius: 8,
                      minWidth: libraryCollapsed ? 85 : 260,
                      maxWidth: libraryCollapsed ? 85 : undefined,
                    }}
                  >
                    <Sidebar collapsed={libraryCollapsed} hasBanner={!!bannerKind} />
                  </Panel>

                  {!isMobile ? <PanelResizeHandle className='resize-handler' /> : null}

                  {/* No mobile a página fica edge-to-edge flat (cantos retos), pra combinar com o
                      banner/nav full-width — sem o degrau "arredondado vs reto". */}
                  <Panel id='center' order={2} style={{ borderRadius: isMobile ? 0 : 8 }}>
                    <div className='Main-section' ref={container}>
                      <Outlet context={{ container } satisfies LayoutContext} />
                    </div>
                  </Panel>
                </PanelGroup>
              </div>

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
          </Col>
        </Row>

        {bannerKind && <StatusBanner kind={bannerKind} />}

        {/* Tab bar do mobile (fixa no rodapé, abaixo do banner). Oculta no desktop via CSS. */}
        <MobileNav />
      </div>

      <NytaFloatingModal />
    </>
  );
});

AppLayout.displayName = 'AppLayout';
