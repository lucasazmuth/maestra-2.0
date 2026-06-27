import { memo } from 'react';
import { Dropdown, Space, type MenuProps } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiLogOut } from 'react-icons/fi';
import { NotificationIcon, ConfigIcon } from '../../../Icons/system';

import ForwardBackwardsButton from '../Navbar/ForwardBackwardsButton';
import { NytaHeaderButton } from '../../../nyta/NytaHeaderButton';
import { useAppDispatch, useAppSelector } from '../../../../store/store';
import { authActions } from '../../../../store/slices/auth';
import { ARTISTS_DEFAULT_IMAGE } from '../../../../constants/spotify';
import { ReactComponent as MaestraLogo } from '../../../../assets/maestra-logo.svg';

export const Topbar = memo(() => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [t] = useTranslation(['navigation']);

  // Artista do contexto atual (rota /artists/:id…) — usado no chip do header mobile, pra o usuário
  // sempre saber de quem são os dados que está vendo (no mobile a sidebar com o artista some).
  const artistId = pathname.match(/^\/artists\/([^/]+)/)?.[1];
  const currentArtist = useAppSelector((s) => (artistId ? s.artists.items.find((a) => a.id === artistId) : undefined));

  const user = useAppSelector((s) => s.auth.user);
  const meta = (user?.user_metadata || {}) as Record<string, any>;
  const displayName = meta.full_name || meta.name || user?.email || 'Usuário';
  const avatar = meta.avatar_url || meta.picture || ARTISTS_DEFAULT_IMAGE;

  const items: MenuProps['items'] = [
    {
      key: 'header',
      label: (
        <div style={{ padding: '4px 0' }}>
          <div style={{ color: '#fff', fontWeight: 700 }}>{displayName}</div>
          <div style={{ color: '#b3b3b3', fontSize: 12 }}>{user?.email}</div>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'settings',
      icon: <ConfigIcon size={16} />,
      label: t('Settings', { defaultValue: 'Configurações' }),
      onClick: () => navigate('/settings'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <FiLogOut />,
      label: t('Log out', { defaultValue: 'Sair' }),
      onClick: () => dispatch(authActions.signOut()),
    },
  ];

  return (
    <div
      style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
      }}
    >
      <Space size={8} align='center'>
        <MaestraLogo
          width={36}
          height={36}
          className={`maestra-logo-live topbar-logo${currentArtist ? ' topbar-logo--hide-mobile' : ''}`}
          role='button'
          aria-label='Ir para Seus artistas'
          tabIndex={0}
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/artists')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate('/artists');
            }
          }}
        />
        <span className='topbar-navarrows' style={{ display: 'inline-flex', gap: 8 }}>
          <ForwardBackwardsButton flip />
          <ForwardBackwardsButton flip={false} />
        </span>

        {/* Chip do artista atual — só aparece no mobile (a sidebar com o artista some lá). */}
        {currentArtist && (
          <button
            className='topbar-artist'
            onClick={() => navigate('/artists')}
            title={`${currentArtist.name} — trocar de artista`}
          >
            <img
              src={currentArtist.content?.spotifyProfile?.image || ARTISTS_DEFAULT_IMAGE}
              alt={currentArtist.name}
              style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
            <span className='topbar-artist-name'>{currentArtist.name}</span>
          </button>
        )}
      </Space>

      <Space size={16} align='center'>
        <NytaHeaderButton />

        <button
          onClick={() => navigate('/notifications')}
          title={t('Notifications', { defaultValue: 'Notificações' })}
          style={{
            background: '#000',
            border: 'none',
            cursor: 'pointer',
            color: '#b3b3b3',
            width: 36,
            height: 36,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <NotificationIcon size={22} />
        </button>

        <Dropdown menu={{ items }} trigger={['click']} placement='bottomRight'>
          <button
            style={{
              background: '#000',
              border: 'none',
              cursor: 'pointer',
              padding: 2,
              borderRadius: '50%',
              display: 'flex',
            }}
          >
            <img
              src={avatar}
              alt={displayName}
              style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
            />
          </button>
        </Dropdown>
      </Space>
    </div>
  );
});

Topbar.displayName = 'Topbar';
