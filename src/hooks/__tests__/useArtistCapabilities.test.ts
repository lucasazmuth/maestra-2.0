/**
 * Unit tests for deriveArtistCapabilities — a matriz de capacidades por
 * (conta isPro × perfil pago × papel dono/colaborador) do novo modelo de receita.
 */

import { deriveArtistCapabilities } from '../useArtistCapabilities';

const M = 10; // maxCatalogTracks qualquer

describe('deriveArtistCapabilities', () => {
  test('dono de perfil pago SEM PRO: edita plano/catálogo, mas tarefas e Consultora travadas', () => {
    const c = deriveArtistCapabilities({ isPro: false, isPaid: true, isOwner: true, maxCatalogTracks: M });
    expect(c.canEdit).toBe(true);
    expect(c.viewPlanning).toBe(true);
    expect(c.editPlanning).toBe(true);
    expect(c.useNytaMaestra).toBe(true);
    expect(c.manageTasks).toBe(false); // tarefas = PRO, até pro dono
    expect(c.useNytaConsultora).toBe(false); // Consultora = PRO
  });

  test('colaborador SEM PRO em perfil pago: tudo somente-leitura', () => {
    const c = deriveArtistCapabilities({ isPro: false, isPaid: true, isOwner: false, maxCatalogTracks: M });
    expect(c.viewPlanning).toBe(true); // pode ver
    expect(c.canEdit).toBe(false);
    expect(c.editPlanning).toBe(false);
    expect(c.useNytaMaestra).toBe(false);
    expect(c.manageTasks).toBe(false);
    expect(c.useNytaConsultora).toBe(false);
  });

  test('colaborador COM PRO em perfil pago: edita e usa Nyta', () => {
    const c = deriveArtistCapabilities({ isPro: true, isPaid: true, isOwner: false, maxCatalogTracks: Infinity });
    expect(c.canEdit).toBe(true);
    expect(c.editPlanning).toBe(true);
    expect(c.manageTasks).toBe(true);
    expect(c.useNytaConsultora).toBe(true);
  });

  test('perfil pendente (não pago): planejamento e tarefas indisponíveis', () => {
    const c = deriveArtistCapabilities({ isPro: true, isPaid: false, isOwner: true, maxCatalogTracks: M });
    expect(c.viewPlanning).toBe(false);
    expect(c.editPlanning).toBe(false);
    expect(c.manageTasks).toBe(false);
    expect(c.useNytaMaestra).toBe(false);
  });
});
