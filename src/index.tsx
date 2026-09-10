import ReactDOM from 'react-dom/client';

// ⚠️ AS MENSAGENS DO ANTD SÓ APARECEM COM ISTO, e a falta dele não dava erro nenhum.
//
// `message.warning(...)`, `notification.*` e `Modal.confirm` são funções ESTÁTICAS: montam a
// própria árvore com `ReactDOM.render`, que o React 19 removeu. Sem o remendo oficial elas
// passam a não fazer NADA — não lançam, não avisam, e a única pista é uma linha no console a
// dizer que o antd v5 suporta React 16 a 18. O app inteiro ficou assim: cada "Não consegui
// salvar" e cada "Aguarde para criar outro perfil" era escrito para ninguém.
//
// Tem de ser importado antes de qualquer tela que chame essas funções.
import '@ant-design/v5-patch-for-react-19';

import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import './index.css';
// Registra a rota da web no nucleo. Precisa vir antes das telas que a consultam.
import './nucleo/rotaWeb';
import App from './App';
import AppErrorBoundary, { ehErroDeChunk, tentarRecarregarUmaVez, limparMarcaDeReload } from './components/AppErrorBoundary';
import reportWebVitals from './reportWebVitals';
import registerServiceWorker from './serviceWorkerRegistration';

import '@maestra/core/i18n';

// Locale PT-BR para datas (Agenda, etc.)
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import customParseFormat from 'dayjs/plugin/customParseFormat';

import TimeAgo from 'javascript-time-ago';
import pt from 'javascript-time-ago/locale/pt';
import en from 'javascript-time-ago/locale/en';
import es from 'javascript-time-ago/locale/es-AR';

dayjs.extend(customParseFormat);
dayjs.locale('pt-br');

TimeAgo.addDefaultLocale(pt);
TimeAgo.addLocale(en);
TimeAgo.addLocale(es);

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
// NOTE: StrictMode is intentionally disabled. In dev it double-invokes every effect, which
// fires every Spotify API request twice and was a major contributor to hitting Spotify's
// (tightened, Feb-2026) rate limits — half the calls on the Home/Artist/Album pages were
// duplicates. Re-enable (<React.StrictMode>) if you need its checks and can tolerate 2x calls.
// Chegou ate aqui: o bundle carregou inteiro. Libera a proxima tentativa de reload automatico.
limparMarcaDeReload();

// Import dinamico que falha FORA do render (dentro de um efeito, de um handler, de um prefetch
// do router) nao passa pelo error boundary — vira uma promise rejeitada e a navegacao
// simplesmente nao acontece. Mesmo diagnostico, mesma cura.
window.addEventListener('unhandledrejection', (evento) => {
  if (ehErroDeChunk(evento.reason)) tentarRecarregarUmaVez();
});

root.render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
registerServiceWorker();
