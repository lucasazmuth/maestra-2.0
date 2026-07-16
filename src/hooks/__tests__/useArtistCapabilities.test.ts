/**
 * Unit tests for deriveArtistCapabilities.
 * Modelo: operação (catálogo/agenda/equipe) por access_levels do membro; planejamento/tarefas por
 * (dono ou membro com nível plan); limite de faixas POR PERFIL (dono PRO → ilimitado).
 */

import { deriveArtistCapabilities } from '../useArtistCapabilities';

describe('deriveArtistCapabilities', () => {
  test('dono de perfil pago SEM PRO: cria plano e edita operação; edições avançadas exigem PRO', () => {
    const c = deriveArtistCapabilities({ isPro: false, isPaid: true, isOwner: true });
    expect(c.canEditCatalog).toBe(true);
    expect(c.canEditAgenda).toBe(true);
    expect(c.canManageTeam).toBe(true);
    expect(c.viewPlanning).toBe(true);
    expect(c.editPlanning).toBe(true); // criar/acompanhar plano: dono já pagou o perfil
    expect(c.manageTasks).toBe(false); // adicionar estratégia/tarefa, refazer diag: exige PRO
    expect(c.useNytaConsultora).toBe(false); // Consultora = PRO da conta
    expect(c.maxCatalogTracks).toBe(10); // dono sem PRO → limite do grátis
  });

  test('dono de perfil pago COM PRO: libera edições avançadas do plano', () => {
    const c = deriveArtistCapabilities({ isPro: true, isPaid: true, isOwner: true });
    expect(c.editPlanning).toBe(true);
    expect(c.manageTasks).toBe(true);
    expect(c.maxCatalogTracks).toBe(Infinity);
  });

  test('colaborador SEM nível em perfil pago: operação somente-leitura', () => {
    const c = deriveArtistCapabilities({ isPro: false, isPaid: true, isOwner: false, accessLevels: [] });
    expect(c.viewPlanning).toBe(true); // pode ver
    expect(c.canEditCatalog).toBe(false);
    expect(c.canEditAgenda).toBe(false);
    expect(c.canManageTeam).toBe(false);
    expect(c.editPlanning).toBe(false);
  });

  test('membro planejamento: vê e edita tarefas existentes com nível "plan"/"full", mesmo sem PRO', () => {
    // Membro com nível 'plan' mas SEM PRO → vê e edita tarefas existentes.
    const planSemPro = deriveArtistCapabilities({ isPro: false, isPaid: true, isOwner: false, accessLevels: ['plan'] });
    expect(planSemPro.viewPlanning).toBe(true);
    expect(planSemPro.editPlanning).toBe(true);
    expect(planSemPro.manageTasks).toBe(false);
    // Membro com nível 'plan' + PRO → também pode criar/gerir estruturas.
    const planComPro = deriveArtistCapabilities({ isPro: true, isPaid: true, isOwner: false, accessLevels: ['plan'] });
    expect(planComPro.editPlanning).toBe(true);
    expect(planComPro.manageTasks).toBe(true);
    // Membro PRO mas SEM nível 'plan'/'full' (só catalog) → não edita planejamento.
    const proSemNivel = deriveArtistCapabilities({ isPro: true, isPaid: true, isOwner: false, accessLevels: ['catalog'] });
    expect(proSemNivel.editPlanning).toBe(false);
    expect(proSemNivel.manageTasks).toBe(false);
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
