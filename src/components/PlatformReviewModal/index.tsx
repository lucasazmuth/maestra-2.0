import { FC, useEffect, useState } from 'react';
import { Button, Input, Modal, Rate, message } from 'antd';

import { useAppSelector } from '../../store/store';
import { getMyPlatformReview, savePlatformReview } from '../../services/db/platformReviews';
import styles from './PlatformReviewModal.module.scss';

const RATING_LABELS = ['', 'Muito ruim', 'Ruim', 'Regular', 'Boa', 'Excelente'];
const COMMENT_LIMIT = 2000;

interface PlatformReviewModalProps {
  open: boolean;
  onClose: () => void;
}

export const PlatformReviewModal: FC<PlatformReviewModalProps> = ({ open, onClose }) => {
  const user = useAppSelector((state) => state.auth.user);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user?.id) return;

    let alive = true;
    setLoading(true);
    getMyPlatformReview(user.id)
      .then((review) => {
        if (!alive) return;
        setRating(review?.rating || 0);
        setComment(review?.comment || '');
      })
      .catch(() => {
        if (!alive) return;
        setRating(0);
        setComment('');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [open, user?.id]);

  const handleSubmit = async () => {
    if (!user?.id || !rating) return;

    setSaving(true);
    try {
      await savePlatformReview({
        userId: user.id,
        rating,
        comment,
        pagePath: window.location.pathname,
      });
      message.success('Obrigado pela sua avaliação!');
      onClose();
    } catch (error) {
      console.error('[PlatformReviewModal] save error:', error);
      message.error('Não foi possível enviar sua avaliação agora.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={540}
      centered
      destroyOnHidden={false}
      className={styles.modal}
      title={null}
    >
      <header className={styles.header}>
        <span className={styles.kicker}>Sua opinião importa</span>
        <h2>Avalie a Maestra</h2>
        <p>Conte como está sendo sua experiência. Sua avaliação ajuda a gente a evoluir o produto.</p>
      </header>

      <div className={styles.body} aria-busy={loading}>
        <div className={styles.ratingBlock}>
          <p className={styles.question}>Como você avalia sua experiência?</p>
          <Rate
            className={styles.rating}
            value={rating}
            onChange={setRating}
            disabled={loading || saving}
            aria-label="Nota da avaliação"
          />
          <span className={styles.ratingHint}>
            {loading ? 'Carregando sua avaliação…' : RATING_LABELS[rating] || 'Selecione de 1 a 5 estrelas'}
          </span>
        </div>

        <label className={styles.field}>
          <span>Quer contar um pouco mais? <small>(opcional)</small></span>
          <Input.TextArea
            value={comment}
            maxLength={COMMENT_LIMIT}
            placeholder="O que está funcionando bem? O que podemos melhorar?"
            disabled={loading || saving}
            onChange={(event) => setComment(event.target.value)}
          />
          <small className={styles.counter}>{comment.length}/{COMMENT_LIMIT}</small>
        </label>

        <div className={styles.actions}>
          <Button onClick={onClose} disabled={saving}>Agora não</Button>
          <Button type="primary" onClick={handleSubmit} disabled={!rating || loading} loading={saving}>
            Enviar avaliação
          </Button>
        </div>
      </div>
    </Modal>
  );
};
