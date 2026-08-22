import { FC } from 'react';
import { FiArrowRight } from 'react-icons/fi';

import { YouTubeEmbed } from '../../components/YouTubeEmbed';
import { NytaAvatar } from './chat/nytaPersona';
import { STEP_LABELS } from './chat/script';
import { VIDEO_CONVITE } from './beatVideos';

// Porta de entrada do Planejamento Estratégico.
//
// Antes esta tela era o `EnhancedEmptyState` (a Nyta dizendo "Oi, [artista]! Bora montar um
// plano?"), o mesmo componente que o Plano de Ação usa quando não há plano. Aquela copy nasceu
// para um convite conversacional, sem vídeo. Com a apresentação da Anita no meio, ela passou a
// brigar com o conteúdo: a Nyta se apresentava e logo abaixo outra pessoa apresentava o método.
//
// Aqui a tela tem UM trabalho: explicar o que a pessoa vai construir antes de ela começar. Por
// isso é componente próprio, e não mais uma variação do empty state — o Plano de Ação continua
// com a saudação da Nyta, que lá é a copy certa.

const WizardIntro: FC<{ artistName: string; onStart: () => void }> = ({ artistName, onStart }) => (
  <div className='wiz-intro'>
    <div className='wiz-intro-content'>
      {/* A Nyta em tamanho discreto: ela é quem conduz a conversa depois daqui, mas quem fala no
          vídeo é a Anita. Grande, o emblema dela disputaria a autoria da apresentação. */}
      <span className='wiz-intro-mark' aria-hidden><NytaAvatar size={40} /></span>

      <p className='wiz-intro-kicker'>Planejamento estratégico</p>
      <h1 className='wiz-intro-title'>
        {artistName ? `Antes de começar, ${artistName}: ` : 'Antes de começar: '}
        <span>veja o caminho completo</span>
      </h1>
      <p className='wiz-intro-lead'>
        Anita Carvalho, fundadora da Maestra, apresenta as {STEP_LABELS.length} etapas que você vai
        percorrer. Depois é só começar: a Nyta pergunta, você responde, e o plano se monta no seu
        ritmo.
      </p>

      <div className='wiz-intro-video'>
        <YouTubeEmbed src={VIDEO_CONVITE} title='Anita Carvalho apresenta o planejamento estratégico' />
      </div>

      {/* As etapas por extenso: dizer "9 etapas" é abstrato, e a lista mostra que o caminho é
          finito e conhecido. É a diferença entre "vai ser longo" e "são estes nove passos". */}
      <ol className='wiz-intro-steps'>
        {STEP_LABELS.map((label, i) => (
          <li key={label}><b>{i + 1}</b>{label}</li>
        ))}
      </ol>

      <button type='button' className='wiz-intro-cta' onClick={onStart}>
        Começar meu planejamento <FiArrowRight size={17} />
      </button>
    </div>
  </div>
);

export default WizardIntro;
