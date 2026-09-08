import { FC, ReactNode, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FiBarChart2, FiBell, FiDatabase, FiGrid, FiKey, FiLifeBuoy, FiLogOut,
  FiSettings, FiShield, FiStar, FiTag, FiUsers, FiFilter } from 'react-icons/fi';

import { PerfisIcon } from '../../../Icons/system';
import { useIsPlatformAdmin } from '@maestra/core/hooks/useIsPlatformAdmin';
import { useAdminRole, type ModuloAdmin } from '@maestra/core/hooks/useAdminRole';
import { useAppDispatch, useAppSelector } from '@maestra/core/store/store';
import { authActions } from '@maestra/core/store/slices/auth';
import { ARTISTS_DEFAULT_IMAGE } from '@maestra/core/constants/spotify';
import styles from './SystemMenu.module.scss';

// Menu do sistema no topo da aplicação. Reúne o que não pertence a um perfil de artista:
// configurações da conta, termos e suporte para todo mundo, e as telas de /admin para quem
// é admin da plataforma.
//
// As telas de /admin só tinham entrada pela sidebar do perfil, que some justamente dentro
// das páginas de admin — trocar de tela exigia voltar a um artista ou digitar a URL.
//
// A parte de admin some para quem não é admin, mas isso é conveniência de navegação: quem
// barra o acesso de fato é o guard de rota, a RLS e a verificação nas edge functions.

interface Item {
  label: string;
  icon: ReactNode;
  path?: string;
  href?: string;
  // Sair da conta não navega — só ele usa isto. Os demais itens vão por path/href.
  action?: () => void;
}

// O que aparece para todo mundo, DEPOIS de "Trocar perfil" — que é montado dentro do
// componente porque depende do artista aberto (ver `trocarDePerfil`).
const GENERAL: Item[] = [
  { label: 'Configurações', path: '/settings', icon: <FiSettings /> },
  { label: 'Suporte', path: '/suporte', icon: <FiLifeBuoy /> },
];

const matchArtistId = (pathname: string): string | undefined => {
  const m = pathname.match(/^\/artists\/([^/]+)/);
  return m ? m[1] : undefined;
};

// Cada item carrega o modulo que ele exige. O menu mostra so o que a pessoa alcanca — e isso e
// conveniencia de navegacao, nao seguranca: quem barra e a RLS e os porteiros de rota.
const ADMIN: (Item & { modulo?: ModuloAdmin; somenteAdminPleno?: boolean })[] = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: <FiBarChart2 />, modulo: 'dashboard' },
  { label: 'Perfis de artistas', path: '/admin/artistas', icon: <FiGrid />, modulo: 'artistas' },
  { label: 'Base de Conhecimento', path: '/admin/knowledge-base', icon: <FiDatabase />, modulo: 'knowledge-base' },
  { label: 'Cupons', path: '/admin/cupons', icon: <FiTag />, modulo: 'cupons' },
  { label: 'Pass Access', path: '/admin/pass-access', icon: <FiKey />, modulo: 'pass-access' },
  { label: 'Usuários', path: '/admin/usuarios', icon: <FiUsers />, modulo: 'usuarios' },
  { label: 'CRM de vendas', path: '/admin/vendas', icon: <FiFilter />, modulo: 'vendas' },
  { label: 'Avaliações', path: '/admin/avaliacoes', icon: <FiStar />, modulo: 'avaliacoes' },
  { label: 'Enviar push', path: '/admin/push', icon: <FiBell />, modulo: 'push' },
  // Conceder acesso e so de admin pleno: fosse concedivel, quem recebesse poderia se dar tudo.
  { label: 'Acessos', path: '/admin/acessos', icon: <FiShield />, somenteAdminPleno: true },
];

export const SystemMenu: FC = () => {
  const isAdmin = useIsPlatformAdmin();
  const { ehAdminPleno, podeAcessar } = useAdminRole();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Qual perfil está aberto. Pela rota primeiro — é ela que manda quando se está dentro de um
  // artista — e, nas telas que não têm artista na URL (Configurações, Notificações), pelo
  // último aberto, que é o mesmo critério da barra de abas do mobile.
  const artists = useAppSelector((s) => s.artists.items);
  const currentArtistId = useAppSelector((s) => s.artists.currentArtistId);
  const routeId = matchArtistId(location.pathname);
  const artist =
    artists.find((a) => a.id === routeId) ?? artists.find((a) => a.id === currentArtistId);

  // Fecha ao clicar fora ou no Esc — o painel é flutuante e não tem overlay próprio.
  useEffect(() => {
    if (!open) return;

    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Navegar deve fechar o painel, senão ele fica aberto sobre a tela nova.
  useEffect(() => setOpen(false), [location.pathname]);

  const go = (item: Item) => {
    if (item.action) { item.action(); return; }
    // mailto em nova aba: apontar location.href pra mailto congela a SPA.
    if (item.href) window.open(item.href, '_blank');
    else if (item.path) navigate(item.path);
    setOpen(false);
  };

  // '/artists' é um caso especial: TODA página de um artista é '/artists/:id/...', então um
  // startsWith('/artists') marcaria "Perfis" como ativo em qualquer perfil aberto — não só na
  // lista. Só a lista em si (rota exata) deve acender esse item.
  const isItemActive = (path: string) =>
    path === '/artists' ? location.pathname === '/artists' : location.pathname.startsWith(path);

  const renderItems = (items: Item[]) => (
    <div className={styles.grid}>
      {items.map((item) => {
        const active = !!item.path && isItemActive(item.path);
        return (
          <button
            key={item.label}
            type='button'
            role='menuitem'
            className={`${styles.item} ${active ? styles.itemActive : ''}${item.action ? ` ${styles.itemDanger}` : ''}`}
            onClick={() => go(item)}
          >
            <span className={styles.itemIcon} aria-hidden>{item.icon}</span>
            <span className={styles.itemLabel}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );

  // Sair da conta não tinha nenhuma entrada no menu do sistema: só existia lá dentro de
  // Configurações. Entra como o último item da mesma grade dos demais — não é mais um botão
  // separado embaixo, só se distingue pelo tom vermelho no hover (.itemDanger).
  const signOut = async () => {
    setOpen(false);
    await dispatch(authActions.signOut());
    navigate('/login', { replace: true });
  };

  // O primeiro item diz "Trocar perfil", e não "Perfis": quem está dentro de um artista não vai
  // ali para ver uma lista, vai para SAIR deste e entrar noutro. E o ícone é a FOTO do perfil
  // aberto — o menu passa a dizer de quem é a sessão antes mesmo de ser clicado. É o mesmo item
  // do app nativo (`itensDoSistema`, em casca/marca/MenuDoSistema.tsx).
  //
  // Ele some NA lista de perfis: ali o item só fecharia o menu e deixaria a pessoa onde já
  // estava. Um item que não leva a lugar nenhum ensina a desconfiar do menu.
  //
  // Fora dali ele não é dispensável: em páginas sem sidebar nem tab bar (a 404, por exemplo)
  // este menu é o único ponto fixo da tela, e sem este item não haveria volta para a lista.
  const naListaDePerfis = location.pathname === '/artists';
  const trocarDePerfil: Item[] = naListaDePerfis
    ? []
    : [{
        label: 'Trocar perfil',
        path: '/artists',
        icon: artist
          ? (
            <img
              className={styles.itemAvatar}
              src={artist.content?.spotifyProfile?.image || ARTISTS_DEFAULT_IMAGE}
              alt=''
            />
          )
          : <PerfisIcon size={20} />,
      }];

  // Uma grade só, sem título separando Geral de Administração — a visibilidade de cada item
  // continua condicionada à mesma regra de antes (isAdmin), só a divisão visual que saiu.
  const allItems: Item[] = [
    ...trocarDePerfil,
    ...(isAdmin
      ? [
          ...GENERAL,
          ...ADMIN.filter((i) =>
            i.somenteAdminPleno ? ehAdminPleno : i.modulo && podeAcessar(i.modulo)
          ),
        ]
      : GENERAL),
    { label: 'Sair da conta', icon: <FiLogOut />, action: signOut },
  ];

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type='button'
        className={`round-control ${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        aria-label='Menu do sistema'
        aria-haspopup='menu'
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <FiGrid size={23} />
      </button>

      {/* Só aparece (via CSS) no mobile: no desktop o clique fora já fecha o painel, sem
          precisar escurecer a tela — o painel ali é pequeno e ancorado perto do gatilho. */}
      {open && <div className={styles.backdrop} onClick={() => setOpen(false)} />}

      {open && (
        <div className={styles.panel} role='menu'>
          {renderItems(allItems)}
        </div>
      )}
    </div>
  );
};

export default SystemMenu;
