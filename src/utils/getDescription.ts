import type { Album } from '@maestra/core/interfaces/albums';
import type { Artist } from '@maestra/core/interfaces/artist';
import type { Playlist } from '@maestra/core/interfaces/playlists';
import { Track } from '@maestra/core/interfaces/track';

export const removeHtmlTags = (html: string) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

export const getItemDescription = (item: Playlist | Album | Artist | Track) => {
  if (item.type === 'playlist') {
    return getPlaylistDescription(item);
  }
  if (item.type === 'album') {
    return getAlbumDescription(item);
  }
  if (item.type === 'artist') {
    return item.genres?.slice(0, 2).join(', ') ?? '';
  }
  return '';
};

export const getPlaylistDescription = (item: Playlist | Album | Artist | Track) => {
  if (item.type === 'playlist') {
    return removeHtmlTags(item.description || '');
  }
  return '';
};

export const getAlbumDescription = (item: Playlist | Album | Artist | Track) => {
  if (item.type === 'album') {
    const year = item.release_date.split('-')[0];
    const type = item.album_type === 'album' ? 'Album' : 'Single';
    return `${year} • ${type}`;
  }
  return '';
};
