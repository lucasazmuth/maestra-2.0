import { FC, memo, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FiGrid,
  FiCalendar,
  FiMusic,
  FiUser,
  FiUsers,
  FiCheckSquare,
  FiChevronLeft,
  FiPlus,
  FiLock,
  FiDatabase,
} from 'react-icons/fi';

import { useAppSelector } from '../../../../store/store';
import { useArtistCapabilities } from '../../../../hooks/useArtistCapabilities';
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

  // O wizard ("Planejamento Estratégico") e o antigo "Perfil" não são itens de navbar:
  // o wizard é acessado via criação de artista e "Avançar de fase"; o Perfil virou a home (Dashboard).
  const modules = [
    { icon: <FiGrid />, label: t('Dashboard', { defaultValue: 'Dashboard' }), suffix: '', locked: false },
    { icon: <FiUser />, label: t('Profile', { defaultValue: 'Perfil' }), suffix: 'perfil', locked: !viewPlanning },
    {
      icon: <FiCheckSquare />,
      label: t('Action Plan', { defaultValue: 'Plano de Ação' }),
      suffix: 'action-plan',
      locked: !viewPlanning,
    },
    { icon: <FiMusic />, label: t('Catalog', { defaultValue: 'Catálogo' }), suffix: 'catalog', locked: false },
    { icon: <FiCalendar />, label: t('Agenda', { defaultValue: 'Agenda' }), suffix: 'agenda', locked: false },
    // Equipe fica só no menu web/tablet (sidebar); no mobile o acesso é pelo Acesso rápido do Dashboard.
    { icon: <FiUsers />, label: t('Team', { defaultValue: 'Equipe' }), suffix: 'team', locked: !viewPlanning },
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
          {modules.map((m) => (
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
        </>
      ) : (
        <>
          <NavItem
            icon={<FiGrid />}
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
