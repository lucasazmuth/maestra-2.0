import { FC, memo } from 'react';

import { extractYouTubeId } from '@maestra/core/wizard/youtube';
import { FiPlay } from 'react-icons/fi';

// Player de vídeo do YouTube, em proporção 16:9.
//
// Usa `youtube-nocookie.com` (domínio sem cookies de rastreamento até o play) e os mesmos
// parâmetros que as cópias inline já espalhadas pelo projeto — este componente nasceu para
// centralizá-las.
//
// TODO: migrar as três cópias inline que ainda existem, num PR próprio:
//   • src/pages/Landing/index.tsx:127          (HERO_VIDEO_ID)
//   • src/pages/Landing2/index.tsx:169         (HERO_VIDEO_ID)
//   • src/pages/ArtistCreate/DiagnosticReport.tsx:726 (CTA_VIDEO_ID)
// A do DiagnosticReport carrega `data-noexport="1"`, porque a árvore é capturada estaticamente
// para o PDF e um iframe sairia como retângulo vazio — quem migrar precisa repassar esse atributo.
// As duas da landing têm SCSS module próprio; migrar exige cuidado com especificidade.
// (Elas hoje divergem: a landing aponta para um vídeo e o comentário do diagnóstico afirma ser
// "o mesmo da landing", o que deixou de ser verdade. Centralizar resolve.)

export const YouTubeEmbed: FC<{
  /** URL completa ou id. Vazio ou irreconhecível → espaço reservado. */
  src?: string;
  /** Vai para o `title` do iframe: é o que um leitor de tela anuncia. */
  title: string;
  /** Classe do quadro externo. O componente só garante a proporção e o iframe. */
  className?: string;
  /** Texto do espaço reservado, quando não há vídeo. */
  emptyLabel?: string;
}> = memo(({ src, title, className, emptyLabel = 'Vídeo em breve' }) => {
  const id = extractYouTubeId(src);

  return (
    <div className={`yt-embed${className ? ` ${className}` : ''}`}>
      {id ? (
        <iframe
          className='yt-embed-player'
          src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`}
          title={title}
          allow='accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
          allowFullScreen
          loading='lazy'
        />
      ) : (
        <div className='yt-embed-empty'>
          <span className='yt-embed-play' aria-hidden><FiPlay size={20} /></span>
          <p>{emptyLabel}</p>
        </div>
      )}
    </div>
  );
});

YouTubeEmbed.displayName = 'YouTubeEmbed';

export default YouTubeEmbed;
