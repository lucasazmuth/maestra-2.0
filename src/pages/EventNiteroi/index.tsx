import { FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCalendar, FiClock, FiMapPin, FiTag, FiCopy, FiCheck, FiArrowRight } from 'react-icons/fi';

import { Header, Footer } from '../Landing';
import { useAppSelector } from '../../store/store';
import anitaPhoto from '../../assets/anita.png';
import styles from './EventNiteroi.module.scss';

// Landing dedicada do Workshop da Anita Carvalho (Niterói Música), acessada pelo QR do cartaz.
// Pública (sem auth) — reusa Header/Footer da Landing. Exibe a chamada do evento + o cupom
// NITEROI50 (50% OFF no desbloqueio do perfil) com um cronômetro de urgência.
const COUPON = 'NITEROI50';
// Prazo da oferta = ends_at do cupom no banco: 13/07/2026 23:59 BRT (= 14/07 02:59 UTC).
// Ponto ÚNICO de verdade do timer — trocar aqui se o prazo mudar (e o ends_at no banco junto).
const OFFER_ENDS_AT = Date.parse('2026-07-14T02:59:00Z');

const EVENT_META = [
  { icon: <FiCalendar />, label: '07 de julho · terça' },
  { icon: <FiClock />, label: '19h' },
  { icon: <FiMapPin />, label: 'Solar do Jambeiro · Niterói' },
  { icon: <FiTag />, label: 'Evento gratuito' },
];

const STEPS = [
  { n: '01', title: 'Crie sua conta grátis', body: 'Leva menos de um minuto — só e-mail e senha.' },
  { n: '02', title: 'Monte o perfil do artista', body: 'Busca no Spotify e a Maestra já traz o Diagnóstico REAL com dados reais.' },
  { n: '03', title: 'Aplique o cupom no desbloqueio', body: `No desbloqueio do perfil, use ${COUPON} e leve 50% OFF.` },
];

function remaining(nowMs: number) {
  const s = Math.max(0, Math.floor((OFFER_ENDS_AT - nowMs) / 1000));
  return { s, d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), sec: s % 60 };
}

const TimerBox: FC<{ v: number; l: string }> = ({ v, l }) => (
  <div className={styles.timerBox}>
    <span className={styles.timerVal}>{String(v).padStart(2, '0')}</span>
    <span className={styles.timerUnit}>{l}</span>
  </div>
);

const EventNiteroi: FC = () => {
  const navigate = useNavigate();
  const loggedIn = useAppSelector((s) => !!s.auth.user);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.title = 'Workshop Anita Carvalho · Niterói Música · Maestra Manager';
    window.scrollTo(0, 0);
  }, []);

  // Cronômetro: 1 tick por segundo (mesmo padrão da tela de Payment).
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const t = remaining(now);
  const expired = t.s <= 0;

  const copyCode = async () => {
    // Clipboard API moderna; com fallback legado (execCommand) pros webviews de app
    // (Instagram/WhatsApp) que costumam bloquear a Clipboard API — o público vem do QR.
    let ok = false;
    try {
      await navigator.clipboard.writeText(COUPON);
      ok = true;
    } catch { /* tenta o fallback abaixo */ }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = COUPON;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch { /* sem clipboard — o código fica visível na tela mesmo assim */ }
    }
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className={styles.page}>
      <Header loggedIn={loggedIn} />

      <main className={styles.main}>
        {/* ─── HERO ─── */}
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>Workshop · Niterói Música</p>
            <h1 className={styles.title}>
              Você veio aprender com a <span>Anita</span>. Agora leve o método pra dentro da sua carreira.
            </h1>
            <p className={styles.subtitle}>
              A Maestra Manager transforma a metodologia da Anita Carvalho em um plano real pra sua
              carreira: diagnóstico com dados reais, planejamento estratégico e plano de ação.
            </p>
            <ul className={styles.metaRow}>
              {EVENT_META.map((m) => (
                <li key={m.label} className={styles.metaChip}>
                  <span className={styles.metaIcon}>{m.icon}</span>
                  {m.label}
                </li>
              ))}
            </ul>
          </div>
          <figure className={styles.heroPhoto}>
            <img src={anitaPhoto} alt="Anita Carvalho" />
            <figcaption>Anita Carvalho · 30 anos de mercado</figcaption>
          </figure>
        </section>

        {/* ─── OFERTA ─── */}
        <section className={styles.offer}>
          <span className={styles.offerGlow} aria-hidden />
          <p className={styles.offerBadge}>Oferta de quem esteve no workshop</p>
          <h2 className={styles.offerTitle}><span>50% OFF</span> no seu primeiro perfil</h2>
          <p className={styles.offerSub}>
            Desbloqueie o Diagnóstico REAL e o planejamento estratégico de um artista pela metade do preço.
          </p>

          <div className={styles.couponRow}>
            <button className={styles.couponCode} onClick={copyCode} title="Copiar código">
              <span>{COUPON}</span>
              {copied ? <FiCheck /> : <FiCopy />}
            </button>
            <span className={styles.couponHint}>{copied ? 'Código copiado!' : 'Toque pra copiar'}</span>
          </div>

          {expired ? (
            <p className={styles.timerExpired}>Oferta encerrada — mas você ainda pode começar seu diagnóstico.</p>
          ) : (
            <div className={styles.timer} role="timer" aria-label="Tempo restante da oferta">
              <span className={styles.timerLabel}>A oferta encerra em</span>
              <div className={styles.timerBoxes}>
                <TimerBox v={t.d} l="dias" />
                <TimerBox v={t.h} l="horas" />
                <TimerBox v={t.m} l="min" />
                <TimerBox v={t.sec} l="seg" />
              </div>
            </div>
          )}

          <div className={styles.ctaRow}>
            <button className={styles.ctaPrimary} onClick={() => navigate('/signup')}>
              Criar conta grátis <FiArrowRight />
            </button>
            <button className={styles.ctaGhost} onClick={() => navigate('/login')}>Já tenho conta</button>
          </div>
          <p className={styles.ctaMicro}>Use o código <strong>{COUPON}</strong> no desbloqueio do perfil.</p>
        </section>

        {/* ─── COMO FUNCIONA ─── */}
        <section className={styles.how}>
          <h2 className={styles.sectionTitle}>Como usar seu desconto</h2>
          <div className={styles.steps}>
            {STEPS.map((s) => (
              <div key={s.n} className={styles.step}>
                <span className={styles.stepNum}>{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── SOBRE ─── */}
        <section className={styles.about}>
          <h2 className={styles.sectionTitle}>Sobre o encontro</h2>
          <p className={styles.aboutBody}>
            O Workshop <strong>Cultura, Mercado e Carreira na Música</strong> é uma oportunidade pra pensar
            sua carreira de forma estratégica, entender melhor o mercado e fortalecer seus projetos.
          </p>
          <p className={styles.aboutBody}>
            O encontro é conduzido por <strong>Anita Carvalho</strong>, consultora com mais de 30 anos de
            experiência e responsável por mais de 300 projetos ao lado de Diogo Nogueira, Ivan Lins, Barão
            Vermelho, Paula Lima, Jorge Aragão e Jorge Vercillo, entre outros grandes nomes da música brasileira.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default EventNiteroi;
