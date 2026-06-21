# Requirements Document

## Introduction

Este documento especifica os requisitos para implementação de regras de visibilidade baseadas em assinatura na plataforma Maestra, vinculadas ao conceito de titularidade vs. membros de perfil. Atualmente, o hook `useEntitlements` verifica apenas a assinatura do usuário logado para determinar acesso aos módulos premium. A nova lógica precisa tornar-se ciente do contexto: quando o usuário acessa um perfil onde é titular (owner), sua própria assinatura é verificada; quando acessa um perfil onde é membro convidado, a assinatura do titular daquele perfil é que determina o acesso. Dessa forma, membros convidados de um titular com assinatura ativa recebem acesso gratuito aos módulos daquele perfil, sem necessitar de assinatura própria.

## Glossary

- **Titular**: Usuário que criou um perfil de artista (campo `user_id` na tabela `artists`). Responsável por manter uma assinatura ativa para que o perfil tenha acesso completo
- **Membro**: Usuário convidado para participar de um perfil de artista via tabela `artist_members`, com status `active` e campo `role` igual a `member` no objeto Artist retornado
- **Perfil_Artista**: Registro na tabela `artists` representando um artista gerenciado na plataforma, contendo `user_id` do titular
- **Assinatura_Titular**: Estado da assinatura do usuário que é titular de um perfil específico, armazenado na tabela de assinaturas Asaas com `user_id` correspondente ao `artists.user_id`
- **Context_Aware_Entitlements**: Nova versão do hook de entitlements que considera o contexto do perfil ativo (titular ou membro) para determinar permissões de acesso
- **Perfil_Ativo**: Perfil de artista atualmente selecionado/visualizado pelo usuário na sessão
- **Módulos_Premium**: Funcionalidades da plataforma que requerem assinatura ativa: Plano de Ação (planning), Catálogo completo, Agenda, Equipe (team), Nyta
- **Access_Level**: Permissões granulares atribuídas a um membro: `plan`, `team`, `finance`, `catalog`, `agenda`, `releases`, `full`
- **Owner_Subscription_Status**: Serviço que consulta o status da assinatura do titular de um perfil a partir do `user_id` do titular

## Requirements

### Requirement 1: Detecção de Contexto — Titular vs. Membro

**User Story:** Como desenvolvedor, eu quero que o sistema identifique se o usuário logado é titular ou membro do perfil ativo, para que a lógica de acesso possa consultar a assinatura correta.

#### Acceptance Criteria

1. WHEN o usuário navega para um Perfil_Artista onde o campo `role` é `owner`, THE Context_Aware_Entitlements SHALL identificar o contexto como "titular" e derivar permissões a partir da assinatura do próprio usuário logado (status e gracePeriodEndsAt do Redux subscription state)
2. WHEN o usuário navega para um Perfil_Artista onde o campo `role` é `member`, THE Context_Aware_Entitlements SHALL identificar o contexto como "membro", buscar a assinatura do dono daquele perfil (identificado pelo campo `user_id` do Artist), e derivar permissões a partir do status dessa assinatura
3. WHEN o Perfil_Ativo muda (usuário alterna entre perfis na listagem), THE Context_Aware_Entitlements SHALL reavaliar o contexto e recalcular as permissões de forma síncrona com a mudança de estado no Redux, sem necessitar reload da página
4. THE Context_Aware_Entitlements SHALL expor o campo `role` atual (`owner` | `member`) e um campo `loading` (boolean) para que componentes de UI possam adaptar seu comportamento conforme o contexto e o estado de carregamento
5. IF o campo `role` do Perfil_Artista ativo for `undefined` ou nulo, THEN THE Context_Aware_Entitlements SHALL tratar o contexto como "titular" por padrão (fallback para a assinatura do usuário logado)
6. IF a busca da assinatura do titular falhar (erro de rede ou resposta inválida) quando o contexto é "membro", THEN THE Context_Aware_Entitlements SHALL derivar permissões como plano `free` (sem acesso a features Pro) e expor um campo de erro indicando a falha na obtenção da assinatura do titular
7. WHILE a assinatura do titular estiver sendo carregada em contexto "membro", THE Context_Aware_Entitlements SHALL expor `loading: true` e derivar permissões como plano `free` até que o carregamento complete com sucesso

### Requirement 2: Consulta da Assinatura do Titular para Membros

**User Story:** Como membro de um perfil de artista, eu quero que o sistema verifique a assinatura do titular daquele perfil, para que eu tenha acesso aos módulos premium cobertos pela assinatura do titular.

#### Acceptance Criteria

1. WHEN o contexto é identificado como "membro", THE Owner_Subscription_Status SHALL consultar o status da assinatura do titular utilizando o `user_id` do Perfil_Artista (campo `artists.user_id`) na tabela `asaas_subscriptions`, com timeout de 10 segundos para a query
2. WHEN a Assinatura_Titular possui status `active`, THE Context_Aware_Entitlements SHALL derivar o plano como `pro` para o membro no contexto daquele perfil
3. WHILE a Assinatura_Titular possui status `overdue` e o timestamp atual é anterior ao campo `grace_period_ends_at` da assinatura, THE Context_Aware_Entitlements SHALL derivar o plano como `pro` para o membro no contexto daquele perfil
4. WHEN a Assinatura_Titular possui status `none`, `pending`, `cancelled`, ou `overdue` com timestamp atual igual ou posterior ao `grace_period_ends_at`, THE Context_Aware_Entitlements SHALL derivar o plano como `free` para o membro no contexto daquele perfil
5. IF a Assinatura_Titular possui status `overdue` e o campo `grace_period_ends_at` é `null`, THEN THE Context_Aware_Entitlements SHALL derivar o plano como `free` para o membro no contexto daquele perfil
6. IF a consulta da Assinatura_Titular falhar por erro de rede ou timeout (10 segundos), THEN THE Context_Aware_Entitlements SHALL utilizar o último status conhecido em cache local por até 10 minutos; IF o cache esteja expirado ou indisponível, THEN THE Context_Aware_Entitlements SHALL derivar o plano como `free` e exibir uma mensagem inline na área de conteúdo do perfil indicando que a verificação de assinatura está temporariamente indisponível

### Requirement 3: Acesso de Membros Limitado pelos Access Levels

**User Story:** Como titular de um perfil, eu quero que os membros que convido tenham acesso apenas aos módulos que eu permiti via access_levels, para que eu mantenha controle granular sobre o que cada membro pode ver.

#### Acceptance Criteria

1. WHILE o contexto é "membro" e a Assinatura_Titular está ativa, THE Context_Aware_Entitlements SHALL conceder acesso a um módulo premium somente se o Access_Level correspondente estiver presente no array `access_levels` do membro, considerando o mapeamento: 'plan'→planning, 'team'→team, 'catalog'→catalog, 'agenda'→agenda, 'full'→todos os módulos premium do perfil
2. WHEN um Membro possui `access_levels` contendo `full`, THE Context_Aware_Entitlements SHALL conceder acesso a todos os módulos premium habilitados pela assinatura do titular (planning, team, catalog, agenda, nyta), independentemente de outros valores presentes no array
3. WHEN um Membro possui `access_levels` contendo `plan`, THE Context_Aware_Entitlements SHALL conceder acesso ao módulo Plano de Ação (planning) naquele perfil
4. WHEN um Membro possui `access_levels` contendo `team`, THE Context_Aware_Entitlements SHALL conceder acesso ao módulo Equipe naquele perfil
5. WHEN um Membro possui `access_levels` contendo `catalog`, THE Context_Aware_Entitlements SHALL conceder acesso ao módulo Catálogo completo naquele perfil
6. WHEN um Membro possui `access_levels` contendo `agenda`, THE Context_Aware_Entitlements SHALL conceder acesso ao módulo Agenda naquele perfil
7. WHILE o contexto é "membro" e a Assinatura_Titular não está ativa (status diferente de 'active' e fora do grace period), THE Context_Aware_Entitlements SHALL negar acesso a todos os módulos premium e retornar entitlements equivalentes ao plano free, independentemente dos access_levels configurados
8. IF o array `access_levels` de um Membro estiver vazio, THEN THE Context_Aware_Entitlements SHALL negar acesso a todos os módulos premium, concedendo apenas acesso ao Dashboard (módulo base não-premium)
9. IF um Membro possui em `access_levels` um valor que não possui módulo correspondente implementado (ex: 'finance', 'releases'), THEN THE Context_Aware_Entitlements SHALL ignorar esse valor sem erro e conceder acesso apenas aos módulos cujos access_levels válidos estejam presentes no array

### Requirement 4: Titular sem Assinatura — Impacto nos Membros

**User Story:** Como membro de um perfil, eu quero saber quando o titular não possui assinatura ativa, para que eu entenda por que perdi acesso aos módulos daquele perfil.

#### Acceptance Criteria

1. WHEN o contexto é "membro" e a Assinatura_Titular não está ativa e o membro tenta acessar um módulo premium, THE Application SHALL exibir a LockedFeature_Component com o título e ícone do módulo correspondente mantidos, a lista de benefícios substituída por uma mensagem informativa indicando que o acesso àquele módulo depende da assinatura ativa do titular do perfil, e o botão CTA "Assinar Maestra Pro" substituído por um texto não-acionável informando que o titular precisa ativar a assinatura
2. WHILE o contexto é "membro" e a Assinatura_Titular não está ativa, THE Application SHALL manter acessíveis as rotas de nível gratuito (listagem de artistas, dashboard básico do perfil, informações do perfil) e a navegação geral pela sidebar sem bloqueio
3. WHILE o contexto é "membro" e a Assinatura_Titular não está ativa, THE Sidebar SHALL exibir ícones de cadeado nos itens de menu dos módulos premium com tooltip indicando que o acesso depende da assinatura do titular
4. IF o contexto é "membro" e a Assinatura_Titular muda de ativa para inativa durante a sessão (detectada na próxima verificação de cache dentro de 5 minutos), THEN THE Application SHALL atualizar a interface do membro para refletir a perda de acesso aos módulos premium sem necessitar reload da página

### Requirement 5: Titular com Perfil Próprio — Exigência de Assinatura Própria

**User Story:** Como usuário que é membro em um perfil alheio, eu quero que ao criar meu próprio perfil de artista a assinatura exigida seja a minha, para que fique claro que cada titular precisa de sua própria assinatura.

#### Acceptance Criteria

1. WHEN um usuário que é membro em perfis alheios cria seu próprio Perfil_Artista (tornando-se titular), THE Context_Aware_Entitlements SHALL derivar o plano como `free` para aquele novo perfil até que o próprio usuário possua uma assinatura com status `active`
2. WHEN o usuário alterna do perfil onde é membro (role `member`) para o perfil onde é titular (role `owner`), THE Context_Aware_Entitlements SHALL recalcular as permissões utilizando exclusivamente a assinatura pessoal do usuário logado, sem reutilizar o status de assinatura do titular do perfil anterior
3. IF um usuário possui assinatura pessoal inativa e é membro de um perfil cujo titular possui assinatura ativa, THEN THE Context_Aware_Entitlements SHALL derivar o plano como `pro` no contexto do perfil onde é membro e como `free` no contexto do perfil onde é titular
4. THE Context_Aware_Entitlements SHALL avaliar o status de assinatura de forma isolada por Perfil_Ativo, garantindo que o resultado de permissões de um perfil não influencie o cálculo de permissões de outro perfil na mesma sessão do usuário

### Requirement 6: Cache e Performance da Consulta de Assinatura do Titular

**User Story:** Como desenvolvedor, eu quero que a consulta da assinatura do titular seja performática e não impacte a experiência do membro, para que a navegação permaneça fluida.

#### Acceptance Criteria

1. WHEN o Context_Aware_Entitlements consulta a Assinatura_Titular, THE Owner_Subscription_Status SHALL armazenar o resultado em cache local indexado pelo `user_id` do titular, com TTL de 5 minutos, de modo que consultas subsequentes para o mesmo titular dentro do TTL sejam servidas a partir do cache sem chamada à Edge Function
2. WHEN o cache da Assinatura_Titular expira, THE Owner_Subscription_Status SHALL continuar servindo o valor em cache (stale) ao membro enquanto realiza uma nova consulta em background, atualizando o cache somente após resposta bem-sucedida da Edge Function, sem bloquear nem re-renderizar a interface até que o novo valor difira do anterior
3. WHEN o Perfil_Ativo muda, THE Owner_Subscription_Status SHALL invalidar o cache do titular anterior, iniciar a consulta do novo titular, e enquanto a resposta não chegar (máximo 10 segundos de timeout), manter o último plano derivado do perfil anterior visível sem bloquear a navegação do membro
4. IF a variável de ambiente `REACT_APP_DISABLE_PAYWALL` estiver definida como `true`, THEN THE Context_Aware_Entitlements SHALL retornar plano `pro` com todos os módulos desbloqueados independentemente do contexto titular/membro, sem realizar qualquer consulta de assinatura ou cache
5. IF a consulta em background da Assinatura_Titular falhar (erro de rede, timeout de 10 segundos, ou resposta inválida), THEN THE Owner_Subscription_Status SHALL manter o valor stale em cache por até 10 minutos desde a última resposta bem-sucedida e, caso esse período seja excedido, derivar o plano como `free` e sinalizar estado de indisponibilidade ao Context_Aware_Entitlements

### Requirement 7: Indicadores Visuais para Membros

**User Story:** Como membro de um perfil, eu quero identificar visualmente que estou acessando módulos cobertos pela assinatura do titular, para que eu tenha clareza sobre minha relação com aquele perfil.

#### Acceptance Criteria

1. WHILE artist.role é "member" e a assinatura do titular (owner do artist) está com status "active", THE ArtistSidebar SHALL exibir um badge textual "Equipe" ao lado do nome do perfil ativo na área de cabeçalho, indicando que o acesso é concedido via titular
2. WHILE artist.role é "member" e a assinatura do titular está com status "active", THE ArtistSidebar SHALL exibir os itens de menu dos módulos permitidos pelo access_levels do membro sem ícone de cadeado, mantendo apenas o ícone padrão do módulo
3. WHILE artist.role é "member" e a assinatura do titular não está com status "active" (status "none", "cancelled", ou "overdue" com Grace_Period expirado), THE ArtistSidebar SHALL exibir ícone de cadeado (Lock icon, 14px, cor zinc-500) ao lado de cada item de menu premium (Plano de Ação, Equipe, Lançamentos) com tooltip de texto "Assinatura do titular inativa" ao hover
4. WHILE artist.role é "owner" e a assinatura pessoal está com status "active", THE ArtistSidebar SHALL renderizar os itens de menu sem indicadores adicionais de membro (sem badge "Equipe", comportamento atual preservado)
5. IF artist.role é "member" e a assinatura do titular não está com status "active" e o membro clica em um item de menu com cadeado, THEN THE ArtistSidebar SHALL permitir a navegação normalmente (o RequireFeature_Component é responsável pelo bloqueio efetivo na rota de destino)

### Requirement 8: Integridade de Dados — Consistência entre Contextos

**User Story:** Como desenvolvedor, eu quero garantir que a troca de contexto entre perfis não cause estados inconsistentes, para que o usuário sempre veja permissões corretas.

#### Acceptance Criteria

1. WHEN o usuário troca de Perfil_Ativo (de titular para membro ou vice-versa), THE Context_Aware_Entitlements SHALL limpar o estado de permissões anterior (role e accessLevels do perfil anterior) e recalcular completamente com base no novo contexto em no máximo 2 segundos antes de renderizar módulos protegidos
2. WHEN o Context_Aware_Entitlements está em processo de consulta da Assinatura_Titular (estado loading), THE Application SHALL exibir um indicador de carregamento (skeleton ou spinner) nos componentes protegidos ao invés de negar acesso, até que a consulta conclua ou atinja um timeout de 10 segundos
3. IF a consulta da Assinatura_Titular falhar ou exceder o timeout de 10 segundos, THEN THE Application SHALL exibir uma mensagem de erro indicando falha na verificação de permissões e oferecer opção de tentar novamente, sem conceder nem revogar acesso
4. IF o usuário for removido da lista de membros de um perfil durante uma sessão ativa, THEN THE Context_Aware_Entitlements SHALL detectar a remoção na próxima verificação de permissões (dentro de 5 minutos via cache TTL de teamMembers) e revogar o acesso ao perfil, redirecionando o usuário para a lista de perfis com mensagem informando que o acesso ao perfil foi revogado
5. WHILE o usuário estiver com role igual a "member" no perfil ativo, THE Context_Aware_Entitlements SHALL ocultar e bloquear as ações administrativas exclusivas do titular: convidar membros, remover membros, alterar access_levels de membros e excluir o perfil
