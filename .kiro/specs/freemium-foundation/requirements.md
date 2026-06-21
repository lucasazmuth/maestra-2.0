# Requirements Document

## Introduction

Transformação do modelo de acesso da plataforma Maestra de um modelo 100% subscription-gated (onde todas as funcionalidades exigem assinatura ativa) para um modelo freemium, onde funcionalidades básicas são gratuitas e módulos premium exibem telas de upsell em vez de redirecionamentos bloqueantes. A Fase 1 estabelece a fundação: hook de entitlements, reestruturação de rotas, componentes de upsell e limites do plano gratuito.

## Glossary

- **Entitlements_Hook**: Hook React (`useEntitlements`) que centraliza a lógica de derivação do plano do usuário e seus limites a partir do estado da assinatura Redux
- **Subscription_State**: Estado Redux gerenciado pelo slice `subscription`, contendo `status` (`active` | `overdue` | `cancelled` | `pending` | `none`) e `gracePeriodEndsAt`
- **Plan**: Classificação binária do plano do usuário: `free` ou `pro`
- **Feature_Gate**: Mecanismo que controla acesso a funcionalidades específicas com base no plano do usuário
- **RequireFeature_Component**: Componente React wrapper que renderiza conteúdo bloqueado (tela de upsell) ou o conteúdo da rota com base no entitlement da feature
- **LockedFeature_Component**: Componente de página completa exibido quando um usuário free tenta acessar um módulo premium
- **UpsellModal_Component**: Modal reutilizável exibido quando o usuário atinge limites do plano free (ex: 2º artista, 11ª faixa)
- **Grace_Period**: Período de 72 horas após vencimento de pagamento durante o qual o acesso Pro é mantido
- **Free_User**: Usuário cujo `Plan` é `free` (sem assinatura ativa ou fora do período de graça)
- **Pro_User**: Usuário cujo `Plan` é `pro` (assinatura `active` ou `overdue` dentro do período de graça)
- **Dashboard_Empty_State**: Estado visual de cards de planejamento no dashboard que exibe CTA de upgrade em vez de conteúdo funcional para usuários free

## Requirements

### Requirement 1: Entitlements Hook — Fonte Única de Verdade

**User Story:** Como desenvolvedor, eu quero um hook centralizado que derive o plano e os limites do usuário a partir do estado de assinatura, para que toda a lógica de controle de acesso seja consistente e fácil de manter.

#### Acceptance Criteria

1. THE Entitlements_Hook SHALL derive the Plan as `pro` WHEN the Subscription_State status is `active`
2. THE Entitlements_Hook SHALL derive the Plan as `pro` WHILE the Subscription_State status is `overdue` and the current time is before the Grace_Period end
3. THE Entitlements_Hook SHALL derive the Plan as `free` WHEN the Subscription_State status is `none`, `pending`, `cancelled`, or `overdue` with expired Grace_Period
4. WHEN the environment variable `REACT_APP_DISABLE_PAYWALL` is set to `true`, THE Entitlements_Hook SHALL return Plan as `pro` with all features unlocked
5. THE Entitlements_Hook SHALL expose `maxArtists` as `1` for Plan `free` and `Infinity` for Plan `pro`
6. THE Entitlements_Hook SHALL expose `maxCatalogTracks` as `10` for Plan `free` and `Infinity` for Plan `pro`
7. THE Entitlements_Hook SHALL expose `team` as `false` for Plan `free` and `true` for Plan `pro`
8. THE Entitlements_Hook SHALL expose `planning` as `false` for Plan `free` and `true` for Plan `pro`
9. THE Entitlements_Hook SHALL expose `nyta` as `false` for Plan `free` and `true` for Plan `pro`

### Requirement 2: Reestruturação de Rotas — Acesso Livre ao Core

**User Story:** Como usuário free, eu quero acessar meu dashboard, catálogo e agenda sem ser redirecionado para a página de assinatura, para que eu possa experimentar a plataforma e entender seu valor.

#### Acceptance Criteria

1. WHEN a Free_User navigates to `/artists`, THE Application SHALL render the artists listing page without requiring an active subscription
2. WHEN a Free_User navigates to `/artists/:id` (dashboard), THE Application SHALL render the dashboard without requiring onboarding completion
3. WHEN a Free_User navigates to `/artists/:id/catalog`, THE Application SHALL render the catalog page without subscription gating
4. WHEN a Free_User navigates to `/artists/:id/agenda`, THE Application SHALL render the agenda page without subscription gating
5. WHEN a Free_User navigates to `/artists/:id/wizard`, THE RequireFeature_Component SHALL render the LockedFeature_Component with planning context
6. WHEN a Free_User navigates to `/artists/:id/action-plan`, THE RequireFeature_Component SHALL render the LockedFeature_Component with planning context
7. WHEN a Free_User navigates to `/artists/:id/team`, THE RequireFeature_Component SHALL render the LockedFeature_Component with team context
8. WHEN a Pro_User navigates to any route, THE Application SHALL render the route content without restriction

### Requirement 3: RequireFeature Gate Component

**User Story:** Como desenvolvedor, eu quero um componente wrapper reutilizável que controle acesso por feature, para que eu possa declarativamente proteger rotas premium sem lógica duplicada.

#### Acceptance Criteria

1. WHEN a user with the required feature entitlement accesses a wrapped route, THE RequireFeature_Component SHALL render the child route content
2. WHEN a user without the required feature entitlement accesses a wrapped route, THE RequireFeature_Component SHALL render the LockedFeature_Component with the appropriate feature context
3. THE RequireFeature_Component SHALL accept a `feature` prop that maps to an Entitlements_Hook boolean field (`planning`, `team`, `nyta`)
4. THE RequireFeature_Component SHALL re-evaluate access when the Subscription_State changes without requiring page reload

### Requirement 4: LockedFeature Component — Tela de Upsell por Módulo

**User Story:** Como usuário free, eu quero ver uma tela informativa atraente quando tento acessar um módulo premium, para que eu entenda o valor do recurso e saiba como obter acesso.

#### Acceptance Criteria

1. THE LockedFeature_Component SHALL display a hero section with a gradient background and the module icon
2. THE LockedFeature_Component SHALL display three benefit bullets specific to the locked module context
3. THE LockedFeature_Component SHALL display a CTA button labeled "Assinar Maestra Pro" that navigates to `/assinatura`
4. THE LockedFeature_Component SHALL render responsively on both desktop and mobile viewports
5. THE LockedFeature_Component SHALL accept a `feature` prop to determine which module context (benefits, icon) to display

### Requirement 5: UpsellModal Component — Modal de Limite Atingido

**User Story:** Como usuário free, eu quero ser informado por um modal quando atinjo um limite do plano (segundo artista, 11ª faixa), para que eu entenda a restrição e possa decidir fazer upgrade.

#### Acceptance Criteria

1. WHEN a Free_User attempts to create a second artist, THE UpsellModal_Component SHALL display with artist-limit context
2. WHEN a Free_User attempts to add an 11th catalog track, THE UpsellModal_Component SHALL display with catalog-limit context
3. THE UpsellModal_Component SHALL display the Pro plan price (R$ 49,90/mês) and feature benefits relevant to the trigger context
4. THE UpsellModal_Component SHALL include a CTA button that navigates to `/assinatura`
5. THE UpsellModal_Component SHALL include a dismiss action that closes the modal without navigation
6. THE UpsellModal_Component SHALL be reusable, accepting a `context` prop to customize title, benefits, and icon

### Requirement 6: Limite de Artistas para Usuários Free

**User Story:** Como produto, eu quero limitar usuários free a um único perfil de artista, para que o valor do plano Pro (artistas ilimitados) seja evidente.

#### Acceptance Criteria

1. WHEN a Free_User with zero artists attempts to create an artist, THE Application SHALL allow the creation
2. WHEN a Free_User with one existing artist attempts to create a second artist, THE Application SHALL block the creation and display the UpsellModal_Component
3. WHEN a Pro_User attempts to create any number of artists, THE Application SHALL allow the creation without restriction
4. THE useCanCreateArtist hook SHALL consume the Entitlements_Hook to determine the artist limit instead of using independent subscription logic

### Requirement 7: Dashboard Empty States para Planejamento

**User Story:** Como usuário free, eu quero ver estados informativos nos cards de planejamento do dashboard, para que eu entenda que funcionalidades premium existem sem ser redirecionado para fora.

#### Acceptance Criteria

1. WHEN a Free_User views the dashboard, THE Dashboard SHALL display planning-related cards (estratégias, tarefas, plano de ação) in an empty state with upgrade CTA
2. WHEN a Free_User views the dashboard, THE Dashboard SHALL render non-planning cards (catálogo, agenda) with actual data
3. WHEN a Pro_User views the dashboard, THE Dashboard SHALL render all cards with actual data
4. THE Dashboard_Empty_State SHALL include a brief description of the premium feature and a "Assinar Pro" CTA button

### Requirement 8: Indicadores Visuais de Módulos Premium na Sidebar

**User Story:** Como usuário free, eu quero ver ícones de cadeado nos itens de menu premium na sidebar, para que eu saiba visualmente quais módulos são Pro antes de clicar.

#### Acceptance Criteria

1. WHILE Plan is `free`, THE Sidebar SHALL display a padlock icon next to the menu items for Team, Planning (Wizard/Action Plan), and Nyta
2. WHILE Plan is `pro`, THE Sidebar SHALL display the standard module icons without padlock indicators
3. THE padlock indicator SHALL not prevent navigation to the locked route (o RequireFeature_Component handles the gate)

### Requirement 9: Remoção do SubscriptionGuardWrapper Global

**User Story:** Como desenvolvedor, eu quero remover o wrapper global de guarda de assinatura, para que o modelo freemium funcione corretamente sem bloqueio universal de rotas.

#### Acceptance Criteria

1. THE Application SHALL not use SubscriptionGuardWrapper as a route wrapper for free-tier accessible routes
2. WHEN the SubscriptionGuardWrapper is removed, THE Application SHALL maintain subscription checking via the Entitlements_Hook for premium features only
3. THE useSubscriptionGuard hook SHALL be refactored to consume the Entitlements_Hook for its access computation logic

### Requirement 10: Remoção do RequireOnboarding como Pré-requisito para Dashboard

**User Story:** Como usuário free, eu quero acessar o dashboard diretamente após criar meu perfil de artista, sem ser obrigado a completar o wizard de planejamento estratégico.

#### Acceptance Criteria

1. WHEN a Free_User with an incomplete wizard navigates to the dashboard, THE Application SHALL render the dashboard with planning empty states instead of redirecting to the wizard
2. WHEN a Pro_User with an incomplete wizard navigates to the dashboard, THE Application SHALL render the dashboard normally (wizard completion remains optional)
3. THE RequireOnboarding component SHALL be removed from the route tree wrapping the dashboard, catalog, and agenda routes
