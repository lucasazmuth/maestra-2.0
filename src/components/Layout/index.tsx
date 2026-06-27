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

import { useAppDispatch, useAppSelector } from '../../store/store';
import { getLibraryCollapsed, uiActions } from '../../store/slices/ui';
import { fetchSubscriptionStatus } from '../../store/slices/subscription';
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
  const bannerKind = useStatusBanner();
  const userId = useAppSelector((s) => s.auth.user?.id);
  // Coluna de resultados do Planejamento Estratégico (publicada pelo Wizard via store global):
  // aparece como 3ª coluna, irmã da navbar e da página, só enquanto o wizard está montado.
  const wizardPanel = useWizardPanelStore();
  const showWizardPanel = wizardPanel.active && wizardPanel.open && !isMobile;
  // No mobile a sidebar é oculta; uma tab bar no rodapé (in-flow, abaixo do banner) navega entre os
  // módulos do artista. Reserva a altura dela (56px) no mobile, somada à do banner quando houver.
  const location = useLocation();
  const hasMobileNav = /^\/artists\/[^/]+/.test(location.pathname);
  // Reserva do banner é justa por viewport (desktop ~1 linha = 78px; mobile 2 linhas = 92px) pra
  // não sobrar espaço preto abaixo dele. No mobile soma a tab bar (56px).
  const bottomReserve = (bannerKind ? (isMobile ? 84 : 76) : 0) + (isMobile && hasMobileNav ? 86 : 0);

  // Carrega o status da assinatura uma vez ao autenticar, de forma global —
  // assim o banner e (futuramente) os entitlements refletem a realidade sem
  // depender de qual rota está montada nem de um refresh do navegador.
  useEffect(() => {
    if (userId && !PAYWALL_DISABLED) {
      dispatch(fetchSubscriptionStatus());
    }
  }, [userId, dispatch]);

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

      <div className={`main-container${bannerKind ? ' has-bottom-banner' : ''}${hasMobileNav ? ' has-mobile-nav' : ''}`}>
        <Row
          wrap
          justify='end'
          gutter={[8, 8]}
          style={{ overflow: 'hidden', height: bottomReserve ? `calc(100% - ${bottomReserve}px)` : '100%' }}
        >
          <Col span={24}>
            <Topbar />
          </Col>

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
