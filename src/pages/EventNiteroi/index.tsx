import { FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCalendar, FiClock, FiMapPin, FiTag, FiCopy, FiCheck, FiArrowRight } from 'react-icons/fi';

import { Header, Footer } from '../Landing';
import { useAppSelector } from '../../store/store';
import anitaPhoto from '../../assets/anita.jpg';
import realStar from '../../assets/feature-real.png';
import styles from './EventNiteroi.module.scss';

// Landing dedicada do Workshop da Anita Carvalho (Niterói Música), acessada pelo QR do cartaz.
// Pública (sem auth) — reusa Header/Footer da Landing. HOOK PRINCIPAL: o Diagnóstico REAL GRÁTIS
// (isca pra atrair os artistas do evento). O cupom NITEROI50 (50% no desbloqueio do plano) entra
// como BÔNUS pra quem depois quiser o plano completo, com um cronômetro de urgência.
const COUPON = 'NITEROI50';
// Prazo da oferta = ends_at do cupom no banco: 13/07/2026 23:59 BRT (= 14/07 02:59 UTC).
const OFFER_ENDS_AT = Date.parse('2026-07-14T02:59:00Z');

const EVENT_META = [
  { icon: <FiCalendar />, label: '07 de julho · terça' },
  { icon: <FiClock />, label: '19h' },
  { icon: <FiMapPin />, label: 'Solar do Jambeiro · Niterói' },
  { icon: <FiTag />, label: 'Evento gratuito' },
];

const STEPS = [
  { n: '01', title: 'Rode seu Diagnóstico REAL', body: 'Crie a conta, busca o artista no Spotify e a Maestra já traz sua fase de carreira com dados reais. De graça.' },
  { n: '02', title: 'Veja onde você está', body: 'Seu perfil entre os 16, o Índice REAL (alcance, receita, audiência e legitimidade) e o que destrava o próximo nível.' },
  { n: '03', title: 'Bônus: 50% no plano', body: `Gostou? Use ${COUPON} no desbloqueio e leve o planejamento estratégico + plano de ação com 50% OFF.` },
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
    document.title = 'Diagnóstico REAL grátis · Workshop Anita Carvalho · Maestra';
    window.scrollTo(0, 0);
  }, []);

  // Cronômetro: 1 tick por segundo (mesmo padrão da tela de Payment).
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const t = remaining(now);
  const expired = t.s <= 0;

  // Leva o artista direto pro Diagnóstico REAL grátis: logado → criar artista; senão → cadastro.
  const startDiagnostic = () => navigate(loggedIn ? '/criar-artista' : '/signup');

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
        {/* ─── HERO: Diagnóstico REAL grátis (isca) ─── */}
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>Workshop · Niterói Música</p>
            <h1 className={styles.title}>
              Descubra onde sua carreira <span>REALmente</span> está.
            </h1>
            <p className={styles.subtitle}>
              Faça o <strong>Diagnóstico REAL</strong> da sua carreira, de graça e sem cartão. A Maestra
              cruza seus dados do Spotify e das redes e te mostra sua fase de carreira, com o método
              da Anita Carvalho.
            </p>
            <div className={styles.heroCta}>
              <button className={styles.ctaPrimary} onClick={startDiagnostic}>
                Fazer meu diagnóstico grátis <FiArrowRight />
              </button>
              <button className={styles.ctaGhost} onClick={() => navigate('/login')}>Já tenho conta</button>
            </div>
            <ul className={styles.metaRow}>
              {EVENT_META.map((m) => (
                <li key={m.label} className={styles.metaChip}>
                  <span className={styles.metaIcon}>{m.icon}</span>
                  {m.label}
                </li>
              ))}
            </ul>
          </div>
          {/* Sparkle 3D do Diagnóstico REAL (tintado pro roxo da marca) — reforça o hook do grátis. */}
          <div className={styles.heroGlyph} aria-hidden>
            <img src={realStar} alt="" />
          </div>
        </section>

        {/* ─── BÔNUS: cupom 50% no plano completo ─── */}
        <section className={styles.offer}>
          <span className={styles.offerGlow} aria-hidden />
          <p className={styles.offerBadge}>Bônus de quem veio ao workshop</p>
          <h2 className={styles.offerTitle}><span>50% OFF</span> no plano completo</h2>
          <p className={styles.offerSub}>
            Depois do diagnóstico grátis, desbloqueie o planejamento estratégico e o plano de ação
            pela metade do preço.
          </p>

          <div className={styles.couponRow}>
            <button className={styles.couponCode} onClick={copyCode} title="Copiar código">
              <span>{COUPON}</span>
              {copied ? <FiCheck /> : <FiCopy />}
            </button>
            <span className={styles.couponHint}>{copied ? 'Código copiado!' : 'Toque pra copiar'}</span>
          </div>

          {expired ? (
            <p className={styles.timerExpired}>Bônus encerrado, mas o Diagnóstico REAL continua grátis.</p>
          ) : (
            <div className={styles.timer} role="timer" aria-label="Tempo restante do bônus">
              <span className={styles.timerLabel}>O bônus encerra em</span>
              <div className={styles.timerBoxes}>
                <TimerBox v={t.d} l="dias" />
                <TimerBox v={t.h} l="horas" />
                <TimerBox v={t.m} l="min" />
                <TimerBox v={t.sec} l="seg" />
              </div>
            </div>
          )}

          <p className={styles.ctaMicro}>Use <strong>{COUPON}</strong> no desbloqueio do perfil.</p>
        </section>

        {/* ─── COMO FUNCIONA ─── */}
        <section className={styles.how}>
          <h2 className={styles.sectionTitle}>Como funciona</h2>
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
          <div className={styles.aboutGrid}>
            <figure className={styles.aboutPhoto}>
              <img src={anitaPhoto} alt="Anita Carvalho" />
              <figcaption>Anita Carvalho · 30 anos de mercado</figcaption>
            </figure>
            <div className={styles.aboutText}>
              <p className={styles.aboutBody}>
                O Workshop <strong>Cultura, Mercado e Carreira na Música</strong> é uma oportunidade pra pensar
                sua carreira de forma estratégica, entender melhor o mercado e fortalecer seus projetos.
              </p>
              <p className={styles.aboutBody}>
                O encontro é conduzido por <strong>Anita Carvalho</strong>, consultora com mais de 30 anos de
                experiência e responsável por mais de 300 projetos ao lado de grandes nomes da música brasileira.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default EventNiteroi;
