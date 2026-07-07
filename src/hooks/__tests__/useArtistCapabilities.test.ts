/**
 * Unit tests for deriveArtistCapabilities.
 * Modelo: operação (catálogo/agenda/equipe) por access_levels do membro; planejamento/tarefas por
 * (dono ou PRO); limite de faixas POR PERFIL (dono PRO → ilimitado).
 */

import { deriveArtistCapabilities } from '../useArtistCapabilities';

describe('deriveArtistCapabilities', () => {
  test('dono de perfil pago SEM PRO: edita operação e plano; tarefas/Consultora seguem regra', () => {
    const c = deriveArtistCapabilities({ isPro: false, isPaid: true, isOwner: true });
    expect(c.canEditCatalog).toBe(true);
    expect(c.canEditAgenda).toBe(true);
    expect(c.canManageTeam).toBe(true);
    expect(c.viewPlanning).toBe(true);
    expect(c.editPlanning).toBe(true);
    expect(c.manageTasks).toBe(true);
    expect(c.useNytaMaestra).toBe(true);
    expect(c.useNytaConsultora).toBe(false); // Consultora = PRO da conta
    expect(c.maxCatalogTracks).toBe(10); // dono sem PRO → limite do grátis
  });

  test('colaborador SEM nível em perfil pago: operação somente-leitura', () => {
    const c = deriveArtistCapabilities({ isPro: false, isPaid: true, isOwner: false, accessLevels: [] });
    expect(c.viewPlanning).toBe(true); // pode ver
    expect(c.canEditCatalog).toBe(false);
    expect(c.canEditAgenda).toBe(false);
    expect(c.canManageTeam).toBe(false);
    expect(c.editPlanning).toBe(false);
  });

  test('colaborador com nível "catalog": edita SÓ catálogo (respeita o convite)', () => {
    const c = deriveArtistCapabilities({ isPro: false, isPaid: true, isOwner: false, accessLevels: ['catalog'] });
    expect(c.canEditCatalog).toBe(true);
    expect(c.canEditAgenda).toBe(false);
    expect(c.canManageTeam).toBe(false);
  });

  test('colaborador com "agenda" e "team": agenda + convite, mas não catálogo', () => {
    const c = deriveArtistCapabilities({ isPro: false, isPaid: true, isOwner: false, accessLevels: ['agenda', 'team'] });
    expect(c.canEditAgenda).toBe(true);
    expect(c.canManageTeam).toBe(true);
    expect(c.canEditCatalog).toBe(false);
  });

  test('colaborador com "full": libera toda a operação', () => {
    const c = deriveArtistCapabilities({ isPro: false, isPaid: true, isOwner: false, accessLevels: ['full'] });
    expect(c.canEditCatalog).toBe(true);
    expect(c.canEditAgenda).toBe(true);
    expect(c.canManageTeam).toBe(true);
  });

  test('limite de faixas é do PERFIL: dono PRO libera ilimitado pro colaborador', () => {
    const semDonoPro = deriveArtistCapabilities({ isPro: false, isPaid: true, isOwner: false, accessLevels: ['catalog'], ownerIsPro: false });
    expect(semDonoPro.maxCatalogTracks).toBe(10);
    const comDonoPro = deriveArtistCapabilities({ isPro: false, isPaid: true, isOwner: false, accessLevels: ['catalog'], ownerIsPro: true });
    expect(comDonoPro.maxCatalogTracks).toBe(Infinity);
  });

  test('perfil pendente (não pago): planejamento e tarefas indisponíveis', () => {
    const c = deriveArtistCapabilities({ isPro: true, isPaid: false, isOwner: true });
    expect(c.viewPlanning).toBe(false);
    expect(c.editPlanning).toBe(false);
    expect(c.manageTasks).toBe(false);
    expect(c.useNytaMaestra).toBe(false);
  });
});
