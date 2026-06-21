# Requirements Document

## Introduction

Implementação do limite de 10 faixas cadastradas manualmente no catálogo para usuários do plano gratuito. O limite aplica-se exclusivamente a `catalog_items` criados pelo usuário (aba "Cadastrado"), sem afetar o catálogo importado do Spotify (aba "Spotify"). Usuários Pro não possuem limite. A feature inclui contador visual, bloqueio de criação ao atingir o limite, e integração com o `UpsellModal` já existente.

## Glossary

- **Catalog_Page**: Página de catálogo do artista (`src/pages/Catalog/index.tsx`) que exibe duas abas — faixas publicadas no Spotify e faixas cadastradas manualmente.
- **Manual_Track**: Faixa cadastrada manualmente pelo usuário (registro `catalog_items` no Supabase), exibida na aba "Cadastrado (lançamentos)".
- **Track_Counter**: Componente visual que exibe a quantidade de faixas manuais usadas em relação ao limite do plano (ex: "7/10 faixas").
- **Nova_Faixa_Button**: Botão "Nova faixa" no header da aba manual que abre o `TrackModal` para criação de uma nova faixa.
- **useCanAddTrack_Hook**: Hook React que encapsula a lógica de verificação de limite, consumindo `useEntitlements` e a contagem atual de faixas manuais.
- **UpsellModal**: Modal existente (`src/components/UpsellModal`) que exibe oferta de upgrade para o plano Pro quando o usuário atinge um limite.
- **Free_User**: Usuário com plano derivado como `free` pelo `useEntitlements` (status `none`, `cancelled`, ou `pending`; ou `overdue` com grace period expirado).
- **Pro_User**: Usuário com plano derivado como `pro` pelo `useEntitlements` (status `active` ou `overdue` dentro do grace period).

## Requirements

### Requirement 1: Hook useCanAddTrack

**User Story:** Como desenvolvedor, eu quero um hook `useCanAddTrack` que encapsule a lógica de verificação de limite de faixas, para que qualquer componente possa consultar se o usuário pode adicionar faixas sem duplicar lógica.

#### Acceptance Criteria

1. THE useCanAddTrack_Hook SHALL accept a `currentCount` parameter representing the number of existing Manual_Tracks and return an object with properties `canAdd` (boolean), `currentCount` (number), `maxTracks` (number), and `shouldShowUpsell` (boolean).
2. WHEN `currentCount` is less than `maxCatalogTracks` from useEntitlements, THE useCanAddTrack_Hook SHALL return `canAdd: true` and `shouldShowUpsell: false`.
3. WHEN `currentCount` is greater than or equal to `maxCatalogTracks` from useEntitlements, THE useCanAddTrack_Hook SHALL return `canAdd: false` and `shouldShowUpsell: true`.
4. WHILE the derived plan is `pro` (maxCatalogTracks equals Infinity), THE useCanAddTrack_Hook SHALL return `canAdd: true` and `shouldShowUpsell: false` regardless of `currentCount`.
5. THE useCanAddTrack_Hook SHALL derive `maxTracks` exclusively from the `maxCatalogTracks` value provided by `useEntitlements`.

### Requirement 2: Track Counter Display

**User Story:** Como usuário do plano gratuito, eu quero ver um contador "X/10 faixas" no header da aba manual do catálogo, para que eu saiba quantas faixas já usei do meu limite.

#### Acceptance Criteria

1. WHILE the derived plan is `free` and the active tab is "Cadastrado (lançamentos)", THE Catalog_Page SHALL display a Track_Counter in the header area showing the format "{currentCount}/10 faixas".
2. WHILE the derived plan is `pro`, THE Catalog_Page SHALL NOT display the Track_Counter.
3. THE Track_Counter SHALL update its displayed count immediately when a Manual_Track is created or deleted without requiring a page reload.
4. WHEN `currentCount` equals `maxCatalogTracks`, THE Track_Counter SHALL apply a visual warning style (red color) to indicate the limit has been reached.

### Requirement 3: Creation Block at Limit

**User Story:** Como produto, eu quero que usuários gratuitos sejam impedidos de criar a 11ª faixa manual, para que o limite do plano seja respeitado e o upsell seja apresentado.

#### Acceptance Criteria

1. WHEN a Free_User clicks the Nova_Faixa_Button and `currentCount` is greater than or equal to `maxCatalogTracks`, THE Catalog_Page SHALL NOT open the TrackModal.
2. WHEN a Free_User clicks the Nova_Faixa_Button and `currentCount` is greater than or equal to `maxCatalogTracks`, THE Catalog_Page SHALL open the UpsellModal with context `catalog-limit`.
3. WHEN a Pro_User clicks the Nova_Faixa_Button, THE Catalog_Page SHALL open the TrackModal regardless of `currentCount`.

### Requirement 4: Nova Faixa Button Visual State

**User Story:** Como usuário do plano gratuito que atingiu o limite, eu quero que o botão "Nova faixa" esteja visualmente desabilitado, para que eu entenda que não posso criar mais faixas antes de clicar.

#### Acceptance Criteria

1. WHILE `canAdd` from useCanAddTrack_Hook is `false`, THE Nova_Faixa_Button SHALL render with reduced opacity (0.5) and a `not-allowed` cursor style.
2. WHILE `canAdd` from useCanAddTrack_Hook is `true`, THE Nova_Faixa_Button SHALL render with full opacity and a `pointer` cursor style.
3. WHILE `canAdd` from useCanAddTrack_Hook is `false`, THE Nova_Faixa_Button SHALL retain its click handler to trigger the UpsellModal when clicked.

### Requirement 5: UpsellModal Integration

**User Story:** Como usuário do plano gratuito que atingiu o limite de faixas, eu quero ver um modal de upsell com informações sobre o plano Pro, para que eu possa decidir fazer upgrade.

#### Acceptance Criteria

1. WHEN the UpsellModal is triggered by the catalog track limit, THE Catalog_Page SHALL pass `context="catalog-limit"` to the UpsellModal component.
2. WHEN the user clicks "Agora não" in the UpsellModal, THE Catalog_Page SHALL close the modal and return to the catalog view without any state changes.
3. WHEN the user clicks "Assinar Maestra Pro" in the UpsellModal, THE UpsellModal SHALL navigate the user to the `/assinatura` route.

### Requirement 6: PAYWALL_DISABLED Bypass

**User Story:** Como desenvolvedor, eu quero que a variável de ambiente `PAYWALL_DISABLED` desabilite todas as restrições de limite de faixas, para que o desenvolvimento e testes não sejam bloqueados pelo paywall.

#### Acceptance Criteria

1. WHILE PAYWALL_DISABLED is `true`, THE useCanAddTrack_Hook SHALL return `canAdd: true`, `maxTracks: Infinity`, and `shouldShowUpsell: false` for any value of `currentCount`.
2. WHILE PAYWALL_DISABLED is `true`, THE Catalog_Page SHALL NOT display the Track_Counter.
3. WHILE PAYWALL_DISABLED is `true`, THE Nova_Faixa_Button SHALL render with full opacity and pointer cursor.
