import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAlertCircle } from 'react-icons/fi';

import { useAppDispatch } from '../../store/store';
import { authActions } from '../../store/slices/auth';
import { MaestraBrand } from '../../components/MaestraBrand';
import { SUPPORT_EMAIL } from '../../constants/legal';
import styles from './Consent.module.scss';

// Conta bloqueada por declaração de menoridade.
//
// Nada foi apagado: a conta fica em revisão manual. A decisão foi essa justamente porque um erro
// de digitação na data de nascimento não pode custar os dados de alguém — se a pessoa tem 18 anos
// e digitou o ano errado, o caminho de volta existe e está escrito aqui.
const Blocked: FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const sair = async () => {
    await dispatch(authActions.signOut());
    navigate('/login', { replace: true });
  };

  const assunto = encodeURIComponent('Revisão de conta bloqueada por idade');

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <MaestraBrand variant='lockup' tone='dark' className={styles.brand} />

        <div className={styles.blockedIcon}>
          <FiAlertCircle size={22} />
        </div>

        <p className={styles.eyebrow}>Conta em revisão</p>
        <h1 className={styles.title}>Seu acesso está temporariamente bloqueado</h1>
        <p className={styles.lead}>
          A Maestra é destinada a maiores de 18 anos, e a data de nascimento informada indica idade
          inferior. Seu acesso foi suspenso enquanto revisamos o cadastro.
        </p>

        <div className={styles.blockedBox}>
          <strong>Seus dados continuam guardados</strong>
          Nada foi apagado. Se houve engano ao informar a data, escreva para{' '}
          <a href={`mailto:${SUPPORT_EMAIL}?subject=${assunto}`}>{SUPPORT_EMAIL}</a> e nós corrigimos.
          Esse é também o canal do Encarregado pelo tratamento de dados, por onde você pode pedir a
          exclusão da conta a qualquer momento.
        </div>

        <button type='button' className={styles.signOut} onClick={sair}>
          Sair da conta
        </button>
      </div>
    </div>
  );
};

export default Blocked;
