import { memo } from 'react';
import { Dropdown, Space, type MenuProps } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiBell, FiSettings, FiLogOut } from 'react-icons/fi';

import ForwardBackwardsButton from '../Navbar/ForwardBackwardsButton';
import { NytaHeaderButton } from '../../../nyta/NytaHeaderButton';
import { useAppDispatch, useAppSelector } from '../../../../store/store';
import { authActions } from '../../../../store/slices/auth';
import { ARTISTS_DEFAULT_IMAGE } from '../../../../constants/spotify';
import { ReactComponent as MaestraLogo } from '../../../../assets/maestra-logo.svg';

export const Topbar = memo(() => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [t] = useTranslation(['navigation']);

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
      icon: <FiSettings />,
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
          className='maestra-logo-live'
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
        <ForwardBackwardsButton flip />
        <ForwardBackwardsButton flip={false} />
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
          <FiBell size={18} />
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
              style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
            />
          </button>
        </Dropdown>
      </Space>
    </div>
  );
});

Topbar.displayName = 'Topbar';
