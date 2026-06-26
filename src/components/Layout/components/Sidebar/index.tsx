import { FC, Fragment, memo, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiLock, FiDatabase, FiChevronLeft } from 'react-icons/fi';
import {
  DashboardIcon,
  DiagnosticoIcon,
  PlanejamentoIcon,
  PlanoAcaoIcon,
  CatalogoIcon,
  AgendaIcon,
  EquipeIcon,
  ArtistasIcon,
  nytaAvatar,
} from '../../../Icons/system';

import { useAppSelector } from '../../../../store/store';
import { useArtistCapabilities } from '../../../../hooks/useArtistCapabilities';
import { useNytaModal } from '../../../../hooks/useNytaModal';
import { ARTISTS_DEFAULT_IMAGE } from '../../../../constants/spotify';
import { supabase } from '../../../../lib/supabase';

const matchArtistId = (pathname: string): string | undefined => {
  const m = pathname.match(/^\/artists\/([^/]+)/);
  return m ? m[1] : undefined;
};

const NavItem: FC<{
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  locked?: boolean;
  onClick: () => void;
}> = ({ icon, label, active, collapsed, locked, onClick }) => (
  <button
    onClick={onClick}
    title={collapsed ? label : undefined}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      width: '100%',
      padding: collapsed ? '10px' : '8px 12px',
      justifyContent: collapsed ? 'center' : 'flex-start',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      borderRadius: 6,
      color: active ? '#fff' : '#b3b3b3',
      fontWeight: active ? 700 : 500,
      fontSize: 14,
      transition: 'color .2s, background-color .2s',
    }}
    onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
    onMouseLeave={(e) => (e.currentTarget.style.color = active ? '#fff' : '#b3b3b3')}
  >
    <span style={{ fontSize: 20, display: 'flex' }}>{icon}</span>
    {!collapsed && <span>{label}</span>}
    {!collapsed && locked && (
      <FiLock style={{ fontSize: 12, color: '#b3b3b3', marginLeft: 'auto' }} />
    )}
  </button>
);

export const Sidebar: FC<{ collapsed?: boolean; hasBanner?: boolean }> = memo(({ collapsed, hasBanner }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [t] = useTranslation(['navigation']);

  const artists = useAppSelector((s) => s.artists.items);
  const user = useAppSelector((s) => s.auth.user);
  const artistId = matchArtistId(location.pathname);
  const currentArtist = artists.find((a) => a.id === artistId);
  // Plano de Ação e Equipe ficam travados até o perfil ser pago (cobrança única R$199,90).
  const { viewPlanning } = useArtistCapabilities(currentArtist);
  const { open: openNyta } = useNytaModal(); // item "Nyta IA" abre o modal do assistente

  // Check admin status
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!user) return;
    // Checa app_metadata no JWT (instantâneo)
    const appMeta = user.app_metadata || {};
    if (appMeta.is_platform_admin) {
      setIsAdmin(true);
      return;
    }
    // Fallback: tabela
    supabase
      .from('platform_admins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const isActive = (suffix: string) => {
    if (suffix === '') return location.pathname === `/artists/${artistId}`;
    return location.pathname.startsWith(`/artists/${artistId}/${suffix}`);
  };

  // Os 7 produtos agrupados por propósito (mapa do sistema): CRESCIMENTO (o ciclo REAL →
  // Planejamento → Plano de Ação) e OPERAÇÃO (dia a dia). "Planejamento" é o antigo "Perfil"
  // (a rota /perfil é o dossiê do plano). Nyta é renderizada à parte (abre o modal).
  const groups: { label: string | null; items: { icon: React.ReactNode; label: string; suffix: string; locked: boolean }[] }[] = [
    {
      label: null,
      items: [{ icon: <DashboardIcon />, label: t('Dashboard', { defaultValue: 'Dashboard' }), suffix: '', locked: false }],
    },
    {
      label: t('Growth', { defaultValue: 'Crescimento' }),
      items: [
        { icon: <DiagnosticoIcon />, label: t('REAL Diagnostic', { defaultValue: 'Diagnóstico REAL' }), suffix: 'diagnostico', locked: false },
        { icon: <PlanejamentoIcon />, label: t('Planning', { defaultValue: 'Planejamento' }), suffix: 'perfil', locked: !viewPlanning },
        { icon: <PlanoAcaoIcon />, label: t('Action Plan', { defaultValue: 'Plano de Ação' }), suffix: 'action-plan', locked: !viewPlanning },
      ],
    },
    {
      label: t('Operations', { defaultValue: 'Operação' }),
      items: [
        { icon: <CatalogoIcon />, label: t('Catalog', { defaultValue: 'Catálogo' }), suffix: 'catalog', locked: false },
        { icon: <AgendaIcon />, label: t('Agenda', { defaultValue: 'Agenda' }), suffix: 'agenda', locked: false },
        { icon: <EquipeIcon />, label: t('Team', { defaultValue: 'Equipe' }), suffix: 'team', locked: !viewPlanning },
      ],
    },
  ];

  return (
    <div
      style={{
        background: '#121212',
        borderRadius: 8,
        height: hasBanner ? 'calc(100vh - 86px - 64px)' : 'calc(100vh - 86px)',
        overflowY: 'auto',
        padding: collapsed ? '12px 6px' : 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {!collapsed && (
        <div
          style={{
            fontFamily: 'SpotifyMixUITitle',
            fontWeight: 800,
            fontSize: 22,
            color: '#fff',
            padding: '4px 8px 16px',
            letterSpacing: 0.3,
          }}
        >
          Maestra Manager
        </div>
      )}

      {artistId && currentArtist ? (
        <>
          <NavItem
            icon={<FiChevronLeft />}
            label={t('Artists', { defaultValue: 'Artistas' })}
            collapsed={collapsed}
            onClick={() => navigate('/artists')}
          />
          {!collapsed && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 8px',
                marginBottom: 6,
              }}
            >
              <img
                src={currentArtist.content?.spotifyProfile?.image || ARTISTS_DEFAULT_IMAGE}
                alt={currentArtist.name}
                style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
              />
              <div style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 14,
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                  }}
                >
                  {currentArtist.name}
                </div>
                {currentArtist.content?.spotifyProfile?.followers != null && (
                  <div style={{ color: '#b3b3b3', fontSize: 12 }}>
                    {currentArtist.content.spotifyProfile.followers.toLocaleString('pt-BR')}{' '}
                    {t('followers', { defaultValue: 'seguidores' })}
                  </div>
                )}
              </div>
            </div>
          )}
          <div style={{ height: 1, background: '#282828', margin: '4px 8px 8px' }} />
          {groups.map((g, gi) => (
            <Fragment key={g.label || `g${gi}`}>
              {g.label && (collapsed
                ? gi > 0 && <div style={{ height: 1, background: '#282828', margin: '6px 8px' }} />
                : <div style={{ color: '#6f6f78', fontSize: 11, padding: '10px 12px 4px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{g.label}</div>
              )}
              {g.items.map((m) => (
                <NavItem
                  key={m.suffix || 'dashboard'}
                  icon={m.icon}
                  label={m.label}
                  collapsed={collapsed}
                  active={isActive(m.suffix)}
                  locked={m.locked}
                  onClick={() => navigate(`/artists/${artistId}${m.suffix ? `/${m.suffix}` : ''}`)}
                />
              ))}
            </Fragment>
          ))}
          {/* Assistente — Nyta abre o modal (mesmo do botão flutuante do header) */}
          {!collapsed
            ? <div style={{ color: '#6f6f78', fontSize: 11, padding: '10px 12px 4px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('Assistant', { defaultValue: 'Assistente' })}</div>
            : <div style={{ height: 1, background: '#282828', margin: '6px 8px' }} />
          }
          <NavItem icon={<img src={nytaAvatar} alt="Nyta" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} />} label={t('Nyta AI', { defaultValue: 'Nyta IA' })} collapsed={collapsed} onClick={openNyta} />
        </>
      ) : (
        <>
          <NavItem
            icon={<ArtistasIcon />}
            label={t('Artists', { defaultValue: 'Artistas' })}
            collapsed={collapsed}
            active={location.pathname === '/artists'}
            onClick={() => navigate('/artists')}
          />
          <div style={{ height: 1, background: '#282828', margin: '8px' }} />
          {!collapsed && (
            <div style={{ color: '#b3b3b3', fontSize: 12, padding: '4px 12px', fontWeight: 700 }}>
              {t('Your artists', { defaultValue: 'SEUS ARTISTAS' })}
            </div>
          )}
          {artists.map((a) => (
            <NavItem
              key={a.id}
              collapsed={collapsed}
              active={artistId === a.id}
              icon={
                <img
                  src={a.content?.spotifyProfile?.image || ARTISTS_DEFAULT_IMAGE}
                  alt={a.name}
                  style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }}
                />
              }
              label={a.name}
              onClick={() => navigate(`/artists/${a.id}`)}
            />
          ))}
          <NavItem
            icon={<FiPlus />}
            label={t('Create artist', { defaultValue: 'Criar artista' })}
            collapsed={collapsed}
            onClick={() => navigate('/artists?create=1')}
          />
        </>
      )}

      {/* Admin section */}
      {isAdmin && (
        <>
          <div style={{ flex: 1 }} />
          <div style={{ height: 1, background: '#282828', margin: '8px' }} />
          {!collapsed && (
            <div style={{ color: '#b3b3b3', fontSize: 12, padding: '4px 12px', fontWeight: 700 }}>
              ADMIN
            </div>
          )}
          <NavItem
            icon={<FiDatabase />}
            label="Base de Conhecimento"
            collapsed={collapsed}
            active={location.pathname === '/admin/knowledge-base'}
            onClick={() => navigate('/admin/knowledge-base')}
          />
        </>
      )}
    </div>
  );
});

Sidebar.displayName = 'Sidebar';
