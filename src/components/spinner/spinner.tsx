import { FC, memo } from 'react';
import './spinner.scss';
import maestraManagerMark from '../../assets/maestra-manager-mark.svg';

// `section` e `global` são flags (altura reduzida / tela cheia). `section` era tipada como
// string mas sempre usada como booleana — nenhum uso passava texto.
const Spin: FC<{ section?: boolean; global?: boolean }> = (props) => (
  <div
    className={`spinner-container ${props.section ? 'section' : ''} ${props.global ? 'global' : ''}`}
    role='status'
    aria-label='Carregando'
  >
    <div className='maestra-loader-mark' aria-hidden='true'>
      <img src={maestraManagerMark} alt='' />
    </div>
  </div>
);

export const Spinner: FC<{ loading: boolean; section?: boolean; global?: boolean; children?: any }> = memo((props) => {
  const { loading, section, global, children } = props;
  return loading ? <Spin section={section} global={global} /> : children;
});

Spinner.displayName = 'Spinner';
