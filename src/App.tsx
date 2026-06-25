/* eslint-disable react-hooks/exhaustive-deps */
import './styles/App.scss';

import i18next from 'i18next';
import { FC, Suspense, lazy, useEffect, useState } from 'react';

import { App as AntdApp, ConfigProvider, theme } from 'antd';
import ptBR from 'antd/locale/pt_BR';
import {
  Navigate,
  Outlet,
  Route,
  BrowserRouter as Router,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom';

import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { persistor, store, useAppDispatch, useAppSelector } from './store/store';
import { authActions } from './store/slices/auth';

import { supabase } from './lib/supabase';
import { Spinner } from './components/spinner/spinner';
import { AppLayout } from './components/Layout';
import { RequireArtistPaid } from './components/RequireArtistPaid';
import { useNytaModalStore } from './stores/nytaModalStore';

// Pages
import Login from './pages/Login';
import Signup from './pages/Signup';
import Welcome from './pages/Welcome';
const Landing = lazy(() => import('./pages/Landing'));
const Page404 = lazy(() => import('./pages/404'));
const Artists = lazy(() => import('./pages/Artists'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const Catalog = lazy(() => import('./pages/Catalog'));
const Agenda = lazy(() => import('./pages/Agenda'));
const Team = lazy(() => import('./pages/Team'));
const Settings = lazy(() => import('./pages/Settings'));
const Legal = lazy(() => import('./pages/Legal'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Wizard = lazy(() => import('./pages/Wizard'));
const ActionPlan = lazy(() => import('./pages/ActionPlan'));
const DiagnosticView = lazy(() => import('./pages/DiagnosticView'));
const AdminKnowledgeBase = lazy(() => import('./pages/Admin/KnowledgeBase'));
const SubscriptionPage = lazy(() => import('./pages/Subscription'));
const SubscriptionSuccessPage = lazy(() => import('./pages/SubscriptionSuccess'));
const PaymentPage = lazy(() => import('./pages/Payment'));
const ArtistCreate = lazy(() => import('./pages/ArtistCreate'));
const ProfileUnlock = lazy(() => import('./pages/ProfileUnlock'));
const Payments = lazy(() => import('./pages/Payments'));

// ---- Auth ----------------------------------------------------------------------------------

const AuthListener: FC = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(authActions.bootstrapSession());

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      dispatch(authActions.setSession({ session: session ?? null }));
    });

    return () => sub.subscription.unsubscribe();
  }, [dispatch]);

  return null;
};

const RequireAuth: FC = () => {
  const user = useAppSelector((s) => s.auth.user);
  const requesting = useAppSelector((s) => s.auth.requesting);

  if (requesting && user === undefined) {
    return <Spinner loading>{null as any}</Spinner>;
  }
  if (!user) return <Navigate to='/login' replace />;
  return <Outlet />;
};

// Admin guard: verifica se o usuário logado é admin.
// Checa app_metadata do JWT (mais rápido) OU a tabela platform_admins (fallback).
const RequireAdmin: FC = () => {
  const user = useAppSelector((s) => s.auth.user);
  const session = useAppSelector((s) => s.auth.session);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;

    // Primeiro: checar app_metadata no JWT (instantâneo, sem query)
    const appMeta = user.app_metadata || {};
    if (appMeta.is_platform_admin) {
      setIsAdmin(true);
      return;
    }

    // Fallback: checar tabela platform_admins
    supabase
      .from('platform_admins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.warn('[RequireAdmin] query error:', error.message);
        setIsAdmin(!!data);
      });
  }, [user, session]);

  if (isAdmin === null) return <Spinner loading>{null as any}</Spinner>;
  if (!isAdmin) return <Navigate to='/artists' replace />;
  return <Outlet />;
};

// ---- Nyta Chat Redirect (legacy route) ---------------------------------------------------

/**
 * Redireciona /artists/:id/nyta para o dashboard do artista e abre o Floating Modal.
 * Envolvido em try/catch para não bloquear o dashboard se o modal falhar ao abrir.
 */
const NytaChatRedirect: FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    navigate(`/artists/${id}`, { replace: true });
    try {
      useNytaModalStore.getState().open();
    } catch (err) {
      console.error('Failed to open Nyta modal after redirect:', err);
    }
  }, [id, navigate]);

  return null;
};

// ---- Routes --------------------------------------------------------------------------------

const PublicOnly: FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAppSelector((s) => s.auth.user);
  if (user) return <Navigate to='/artists' replace />;
  return <>{children}</>;
};

const AppRoutes: FC = () => {
  return (
    <Routes>
      {/* Landing pública (porta de entrada): header/footer próprios, sem AppLayout.
          Renderiza pra todos — o header adapta os CTAs pelo estado de login. */}
      <Route path='/' element={<Landing />} />

      <Route path='/login' element={<PublicOnly><Login /></PublicOnly>} />
      <Route path='/signup' element={<PublicOnly><Signup /></PublicOnly>} />

      {/* Páginas legais (Termos / Privacidade): públicas e standalone — acessíveis da landing
          por quem ainda não tem conta. Conteúdo único em src/constants/legal.ts. */}
      <Route path='/legal/:slug' element={<Legal />} />

      <Route element={<RequireAuth />}>
        {/* Boas-vindas pós-cadastro: autenticada, mas em tela cheia (sem o layout do app). */}
        <Route path='/welcome' element={<Welcome />} />
        {/* Criação de artista: chat full-screen (sem o layout do app). O perfil nasce
            no diagnóstico (não-pago); o pagamento acontece na tela de desbloqueio. */}
        <Route path='/criar-artista' element={<ArtistCreate />} />
        {/* Desbloqueio: diagnóstico salvo + pagamento (tela cheia, perfil ainda não-pago). */}
        <Route path='/artists/:id/desbloquear' element={<ProfileUnlock />} />
        {/* Sucesso da assinatura: tela cheia, centralizada (sem sidebar nem banner) — todo o
            destaque pra confirmação do pagamento. */}
        <Route path='/assinatura/sucesso' element={<SubscriptionSuccessPage />} />

        <Route element={<AppLayout />}>
          <Route path='/artists' element={<Artists />} />

          {/* Tudo do artista exige apenas o perfil PAGO; senão RequireArtistPaid manda pra tela
              de desbloqueio. O Planejamento (Wizard) é OPCIONAL — pago o perfil, o usuário já
              acessa todos os módulos, com ou sem o planejamento concluído. */}
          <Route element={<RequireArtistPaid />}>
            <Route path='/artists/:id/wizard/*' element={<Wizard />} />
            <Route path='/artists/:id' element={<Dashboard />} />
            <Route path='/artists/:id/perfil' element={<Profile />} />
            <Route path='/artists/:id/catalog' element={<Catalog />} />
            <Route path='/artists/:id/agenda' element={<Agenda />} />
            <Route path='/artists/:id/action-plan' element={<ActionPlan />} />
            <Route path='/artists/:id/diagnostico' element={<DiagnosticView />} />
            {/* Refazer diagnóstico (PRO): reaproveita a tela de quiz/diagnóstico em modo "redo" */}
            <Route path='/artists/:id/diagnostico/refazer' element={<ArtistCreate />} />
            <Route path='/artists/:id/team' element={<Team />} />
          </Route>
          {/* /profile foi fundido na home do artista (Dashboard) */}
          <Route path='/artists/:id/profile' element={<Navigate to='..' relative='path' replace />} />

          {/* ── Nyta Chat — redirects to dashboard + opens floating modal ── */}
          <Route path='/artists/:id/nyta' element={<NytaChatRedirect />} />

          {/* ── Rotas sem gate (infra) ── */}
          <Route path='/assinatura' element={<SubscriptionPage />} />
          <Route path='/pagamento' element={<PaymentPage />} />
          <Route path='/notifications' element={<Notifications />} />
          <Route path='/settings' element={<Settings />} />
          <Route path='/pagamentos' element={<Payments />} />
          <Route element={<RequireAdmin />}>
            <Route path='/admin/knowledge-base' element={<AdminKnowledgeBase />} />
          </Route>
          <Route path='*' element={<Page404 />} />
        </Route>
      </Route>
    </Routes>
  );
};

const RootComponent: FC = () => {
  const language = useAppSelector((state) => state.language.language);

  useEffect(() => {
    document.documentElement.setAttribute('lang', language);
    i18next.changeLanguage(language);
  }, [language]);

  return (
    <Router>
      <AuthListener />
      <Suspense fallback={<Spinner loading>{null as any}</Spinner>}>
        <AppRoutes />
      </Suspense>
    </Router>
  );
};

function App() {
  return (
    <ConfigProvider
      locale={ptBR}
      theme={{
        // Tema escuro coerente com o design Spotify/Encore (inputs, selects, modais,
        // drawers, datepickers etc. deixam de renderizar no claro padrão do antd).
        algorithm: theme.darkAlgorithm,
        token: {
          fontFamily: 'SpotifyMixUI',
          colorPrimary: '#af2896',
          colorBgContainer: '#2a2a2a',
          colorBgElevated: '#282828',
          colorBorder: '#3e3e3e',
          colorText: '#ffffff',
          colorTextPlaceholder: '#8a8a8a',
          borderRadius: 8,
        },
      }}
    >
      <AntdApp>
        <Provider store={store}>
          <PersistGate loading={null} persistor={persistor}>
            <RootComponent />
          </PersistGate>
        </Provider>
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
