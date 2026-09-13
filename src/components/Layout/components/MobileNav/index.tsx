import { FC, ReactNode, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  PlanoAcaoIcon, CatalogoIcon, AgendaIcon, MoreIcon,
  DiagnosticoIcon, PlanejamentoIcon, EquipeIcon, MarketingIcon,
} from '../../../Icons/system';
import { useAppSelector } from '@maestra/core/store/store';
import { ARTISTS_DEFAULT_IMAGE } from '@maestra/core/constants/spotify';

// Navbar inferior (tab bar) do mobile: substitui a sidebar (oculta em telas < 768px).
// Layout da referência (gsap-app): [avatar do perfil] · Plano · Músicas · Agenda · Mais. A
// primeira célula é a foto do artista selecionado, que leva pra home dele — no lugar de um ícone
// de casa, ela também diz DE QUEM é a tela. "Mais" (popover) guarda o que sobrou dos módulos:
// Diagnóstico REAL, Plano estratégico, Equipe e Marketing.
//
// Perfis, Configurações e Suporte NÃO moram aqui. Eles já moraram, e o botão de grade do header
// sumia no mobile para não duplicar a navegação — só que isso misturava duas coisas de naturezas
// diferentes no mesmo painel: os módulos DESTE perfil e os atalhos da conta, que não pertencem a
// perfil nenhum. Hoje a conta fica só no menu do sistema, que aparece em qualquer largura. É a
// divisão do app nativo (`casca/BarraDeAbas.tsx` e `casca/marca/MenuDoSistema.tsx`).
// A Nyta NÃO mora aqui: o atalho dela é o botão roxo do cabeçalho (.header-nyta-action).
// Aparece sempre que há um artista no contexto — seja pela rota /artists/:id… ou, em telas
// "globais" (Configurações, Notificações, Assinatura…), pelo artista atual guardado no store.

const matchArtistId = (pathname: string): string | undefined => {
  const m = pathname.match(/^\/artists\/([^/]+)/);
  return m ? m[1] : undefined;
};

/**
 * A TAB BAR EXISTE DENTRO DE UM PERFIL, E SÓ AÍ.
 *
 * ⚠️ A REGRA ERA UMA LISTA DE EXCEÇÕES, E ESTAVA DO AVESSO. Ela dizia "aparece sempre que houver
 * um artista atual no store, MENOS em…", e a lista foi crescendo uma tela de cada vez: primeiro
 * a lista de perfis e o admin, depois os planos, depois as configurações. Cada tela global nova
 * nascia com uma barra que não lhe servia, e só se descobria quando alguém olhava para o
 * telemóvel. Ainda faltavam três — `/suporte`, `/pagamentos` e `/pagamento`.
 *
 * Invertida, a regra diz o que a barra É: ela navega entre os MÓDULOS DE UM PERFIL, então só faz
 * sentido onde há um perfil na ROTA. Onde se fala da conta — planos, configurações, suporte,
 * notificações, pagamentos — não há módulo para navegar, e a barra some sem precisar de ser
 * lembrada. A próxima tela global nasce certa.
 *
 * O artista tem de vir da rota, e não do store: era o `?? currentArtistId` que fazia a barra
 * seguir a pessoa para fora do perfil.
 *
 * É a mesma divisão do app nativo, onde as abas vivem dentro de `artista/[id]` e as telas da
 * conta são empurradas por cima, com um cabeçalho de voltar e sem abas.
 *
 * O chat da Nyta fica de fora por outro motivo, que é dele: ver `isImmersiveRoute`.
 *
 * Lida pelo `MobileNav` e pelo `Layout`: os dois PRECISAM concordar, senão o app reserva no
 * rodapé um espaço para uma barra que não é renderizada.
 */
export const temTabBar = (pathname: string): boolean =>
  !!matchArtistId(pathname) && !isImmersiveRoute(pathname);

/**
 * Telas que tomam a tela inteira: sem a barra da Maestra em cima e sem a tab bar embaixo.
 *
 * Só o chat da Nyta, por ora. Ele é uma conversa que se lê e se escreve, e as duas barras
 * roubavam a altura justamente do que importa ali. Sair é pelo botão de voltar da própria faixa
 * do chat — que passa a ser a única do topo.
 *
 * Separado do `temTabBar` acima porque as duas regras dizem coisas diferentes: aquela é "há um
 * perfil na rota", esta é "há, e é só disto que a tela trata".
 */
export const isImmersiveRoute = (pathname: string): boolean =>
  /^\/artists\/[^/]+\/nyta$/.test(pathname);

type Item = { icon: ReactNode; label: string; suffix: string };
export const MobileNav: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [t] = useTranslation(['navigation']);
  const [moreOpen, setMoreOpen] = useState(false);
  // O artista sai da ROTA. O `?? currentArtistId` que havia aqui era o que fazia a barra seguir a
  // pessoa para fora do perfil, até às telas da conta — ver `temTabBar`.
  const artistId = matchArtistId(location.pathname);
  const artists = useAppSelector((s) => s.artists.items);
  const artist = artists.find((a) => a.id === artistId);

  if (!temTabBar(location.pathname)) return null;

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
  // Perfis, Configurações e Suporte NÃO entram aqui: eles moram no menu do sistema, no botão de
  // grade do header, que agora aparece em qualquer largura. Eles já viveram nos dois lugares, e
  // aí o "Mais" misturava duas coisas diferentes — os módulos DESTE perfil e os atalhos da
  // conta, que não pertencem a perfil nenhum. É a mesma divisão do app nativo (ver
  // `BarraDeAbas.tsx` e `MenuDoSistema.tsx`).

  const isActive = (suffix: string) =>
    suffix === ''
      ? location.pathname === `/artists/${artistId}`
      : location.pathname.startsWith(`/artists/${artistId}/${suffix}`);
  const moreActive = more.some((m) => isActive(m.suffix));

  const go = (suffix: string) => {
    setMoreOpen(false);
    navigate(`/artists/${artistId}${suffix ? `/${suffix}` : ''}`);
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
          {/* Os módulos deste perfil que não couberam na barra, numa grade só. */}
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
