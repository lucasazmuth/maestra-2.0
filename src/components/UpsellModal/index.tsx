import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from 'antd';
import { FiCheck } from 'react-icons/fi';
import { UpsellContext, UPSELL_CONFIG } from './config';
import styles from './UpsellModal.module.scss';

interface UpsellModalProps {
  open: boolean;
  context: UpsellContext;
  onClose: () => void;
  // Quando o usuário JÁ é assinante e atingiu o teto de perfis do plano, a mensagem
  // muda: não é "assine o Pro", e sim um aviso de limite máximo atingido.
  isPro?: boolean;
  limit?: number;
}

export const UpsellModal: FC<UpsellModalProps> = ({
  open,
  context,
  onClose,
  isPro = false,
  limit,
}) => {
  const navigate = useNavigate();
  const config = UPSELL_CONFIG[context];
  const Icon = config.icon;

  // Assinante ATIVO que atingiu o teto de perfis do plano (10): é um limite fixo,
  // não há add-on para comprar — apenas informa, sem CTA de venda.
  const proAtLimit = isPro && context === 'artist-limit';

  const handlePrimary = () => {
    onClose();
    navigate('/assinatura');
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      className={styles.modal}
      width={420}
    >
      <div className={styles.header}>
        <Icon className={styles.icon} />
        <h2 className={styles.title}>
          {proAtLimit ? 'Limite de perfis atingido' : config.title}
        </h2>
      </div>
      <p className={styles.description}>
        {proAtLimit
          ? `Você atingiu o máximo de ${limit} perfis do seu plano.`
          : config.description}
      </p>
      {!proAtLimit && (
        <>
          <ul className={styles.benefits}>
            {config.benefits.map((b, i) => (
              <li key={i}>
                <FiCheck className={styles.checkIcon} />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <div className={styles.price}>
            <span className={styles.priceValue}>R$ 39,90</span>
            <span className={styles.pricePeriod}>/mês</span>
          </div>
        </>
      )}
      <div className={styles.actions}>
        {proAtLimit ? (
          <button className={styles.ctaPrimary} onClick={onClose}>
            Entendi
          </button>
        ) : (
          <>
            <button className={styles.ctaPrimary} onClick={handlePrimary}>
              Assinar Maestra Pro
            </button>
            <button className={styles.ctaGhost} onClick={onClose}>
              Agora não
            </button>
          </>
        )}
      </div>
    </Modal>
  );
};
