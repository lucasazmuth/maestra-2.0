import { FC } from 'react';
import { FiArrowRight } from 'react-icons/fi';

// Logos oficiais do Gmail e do WhatsApp: mantêm as cores da marca (não viram currentColor
// como os ícones do sistema), porque são marca de terceiro e precisam ser reconhecíveis.
import { ReactComponent as GmailSvg } from '../../assets/icons/gmail.svg';
import { ReactComponent as WhatsappSvg } from '../../assets/icons/whatsapp.svg';
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP, SUPPORT_WHATSAPP_DISPLAY } from '../../constants/legal';
import styles from './Support.module.scss';

// Tela dedicada de suporte, com os dois canais de atendimento.
// Antes o item de suporte disparava um mailto direto, o que só servia para quem tem
// cliente de e-mail configurado — no celular costuma abrir nada.

const Support: FC = () => {
  // Sempre em nova aba: apontar location.href para mailto/wa.me congela a SPA.
  const open = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

  return (
    <div className='settings-page'>
      <header className='settings-heading'>
        <div>
          <p>AJUDA</p>
          <h1>Suporte</h1>
          <span>Fale com a gente pelo canal que preferir. Respondemos em horário comercial.</span>
        </div>
      </header>

      <div className={styles.grid}>
        <button
          type='button'
          className={styles.card}
          onClick={() => open(`mailto:${SUPPORT_EMAIL}?subject=Suporte%20Maestra`)}
        >
          <span className={styles.icon} aria-hidden><GmailSvg width={22} height={22} /></span>
          <h2 className={styles.title}>E-mail</h2>
          <p className={styles.desc}>
            Melhor para dúvidas com detalhes, prints ou algo que precise de registro.
          </p>
          <div className={styles.value}>{SUPPORT_EMAIL}</div>
          <span className={styles.action}>Enviar e-mail <FiArrowRight size={13} /></span>
        </button>

        <button
          type='button'
          className={styles.card}
          onClick={() => open(`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent('Olá! Preciso de ajuda com a Maestra.')}`)}
        >
          <span className={`${styles.icon} ${styles.iconWhatsapp}`} aria-hidden><WhatsappSvg width={22} height={22} /></span>
          <h2 className={styles.title}>WhatsApp</h2>
          <p className={styles.desc}>
            Melhor para resolver rápido, quando você precisa de uma resposta na hora.
          </p>
          <div className={styles.value}>{SUPPORT_WHATSAPP_DISPLAY}</div>
          <span className={styles.action}>Abrir conversa <FiArrowRight size={13} /></span>
        </button>
      </div>

      <p className={styles.note}>
        Para agilizar, conte o que você estava fazendo quando o problema apareceu e, se der,
        mande um print da tela.
      </p>
    </div>
  );
};

export default Support;
