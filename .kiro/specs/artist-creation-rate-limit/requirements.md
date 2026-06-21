# Requirements Document

## Introduction

Este documento define os requisitos para remoção do bloqueio de duplicidade entre usuários na criação de perfis de artista, e a implementação de um rate limit para evitar abuso na geração de perfis e diagnósticos gratuitos em escala.

Atualmente, o sistema impede que um usuário crie um perfil de artista que outro usuário já cadastrou. Como cada perfil é totalmente isolado (dados, conteúdo e pagamento independentes), essa restrição será removida. Em seu lugar, será implementado um mecanismo de rate limit para proteger contra usuários mal-intencionados que possam gerar perfis em massa para obter diagnósticos gratuitos (Índice REAL + Chartmetric).

## Glossary

- **Sistema_De_Criação**: Módulo responsável pelo fluxo de criação de perfis de artista (página /criar-artista e edge function artist-diagnostic)
- **Rate_Limiter**: Componente que controla a frequência e quantidade de perfis que um usuário pode criar em um período de tempo
- **Perfil_Pendente**: Perfil de artista criado mas que ainda não teve o pagamento (R$199,90) confirmado (is_locked = true)
- **Diagnóstico_Gratuito**: Relatório do Índice REAL + dados Chartmetric entregue gratuitamente ao usuário antes do pagamento
- **Cooldown**: Intervalo mínimo de tempo entre criações consecutivas de perfis por um mesmo usuário, que escala progressivamente com base no padrão de exclusões de perfis pendentes (1 exclusão → 10 min, 2–4 → 24h, 5+ → 7 dias)
- **Spotify_Artist_ID**: Identificador único de um artista na plataforma Spotify

## Requirements

### Requirement 1: Remoção do Bloqueio de Duplicidade Entre Usuários

**User Story:** Como usuário, eu quero criar um perfil para qualquer artista do Spotify, mesmo que outro usuário já tenha criado um perfil para o mesmo artista, para que eu tenha meu próprio diagnóstico e gestão independentes.

#### Acceptance Criteria

1. WHEN um usuário seleciona um artista do Spotify que já possui perfil criado por outro usuário, THE Sistema_De_Criação SHALL prosseguir com o fluxo de criação do perfil sem exibir aviso de duplicidade, gerando um perfil isolado com conteúdo JSON independente vinculado ao user_id do usuário corrente
2. WHEN um usuário seleciona um artista do Spotify que o próprio usuário (mesmo user_id) já cadastrou (mesmo spotify_artist_id), THE Sistema_De_Criação SHALL bloquear a criação, exibir mensagem indicando que o usuário já possui esse artista cadastrado, e retornar o usuário ao estado de busca
3. THE Sistema_De_Criação SHALL permitir a existência de múltiplos registros com o mesmo spotify_artist_id na base de dados, desde que pertençam a user_ids distintos
4. IF a verificação de duplicidade para o mesmo usuário falhar por indisponibilidade do serviço de banco de dados, THEN THE Sistema_De_Criação SHALL permitir que o fluxo de criação prossiga e delegar a validação de unicidade à constraint do banco de dados

### Requirement 2: Limite de Perfis Pendentes (Não Pagos)

**User Story:** Como operador da plataforma, eu quero limitar a quantidade de perfis pendentes (não pagos) que um usuário pode ter simultaneamente, para que usuários mal-intencionados não gerem diagnósticos gratuitos em escala.

#### Acceptance Criteria

1. WHILE um usuário possui 3 ou mais Perfis_Pendentes, THE Sistema_De_Criação SHALL impedir o início do fluxo de criação de novo perfil, não apresentando a opção de iniciar a criação
2. IF um usuário submete uma requisição de criação de perfil e a contagem de Perfis_Pendentes do mesmo user_id é igual ou superior a 3, THEN THE Sistema_De_Criação SHALL rejeitar a requisição e exibir mensagem informando que o limite de 3 perfis pendentes foi atingido e orientando o usuário a pagar ou excluir perfis pendentes antes de criar outro
3. WHEN um Perfil_Pendente é pago (is_locked alterado de true para false) ou excluído, THE Rate_Limiter SHALL decrementar a contagem de Perfis_Pendentes do user_id correspondente, permitindo nova criação quando a contagem ficar abaixo de 3
4. THE Rate_Limiter SHALL contar apenas perfis do próprio usuário (user_id) com status is_locked igual a true como Perfis_Pendentes
5. IF a verificação de contagem de Perfis_Pendentes falhar por indisponibilidade do serviço, THEN THE Sistema_De_Criação SHALL bloquear a criação e exibir mensagem indicando erro temporário, solicitando que o usuário tente novamente

### Requirement 3: Cooldown Progressivo por Padrão de Criação e Exclusão

**User Story:** Como operador da plataforma, eu quero impor um cooldown que escala com base no padrão de criação e exclusão de perfis, para que usuários que repetidamente criam e excluem perfis para extrair diagnósticos gratuitos sejam progressivamente bloqueados.

#### Acceptance Criteria

1. WHEN um usuário cria um perfil com sucesso, THE Rate_Limiter SHALL registrar o timestamp da criação associado ao identificador do usuário autenticado
2. THE Rate_Limiter SHALL manter uma contagem de exclusões de perfis realizadas pelo usuário nos últimos 30 dias, incrementando essa contagem cada vez que o usuário exclui um perfil com is_locked igual a true
3. IF o usuário autenticado possui 0 exclusões de perfis pendentes nos últimos 30 dias, THEN THE Sistema_De_Criação SHALL não aplicar Cooldown, permitindo a criação imediata
4. IF o usuário autenticado possui 1 exclusão de perfil pendente nos últimos 30 dias, THEN THE Sistema_De_Criação SHALL aplicar um Cooldown de 10 minutos entre criações consecutivas
5. IF o usuário autenticado possui 2 a 4 exclusões de perfis pendentes nos últimos 30 dias, THEN THE Sistema_De_Criação SHALL aplicar um Cooldown de 24 horas entre criações consecutivas
6. IF o usuário autenticado possui 5 ou mais exclusões de perfis pendentes nos últimos 30 dias, THEN THE Sistema_De_Criação SHALL aplicar um Cooldown de 7 dias entre criações consecutivas
7. WHEN um usuário tenta criar um perfil dentro do período de Cooldown ativo, THE Sistema_De_Criação SHALL exibir mensagem informando o tempo restante (em minutos, horas ou dias conforme aplicável) para a próxima criação permitida
8. THE Rate_Limiter SHALL calcular o Cooldown com base no campo created_at do perfil mais recente do usuário combinado com a contagem de exclusões de perfis pendentes nos últimos 30 dias
9. IF o usuário autenticado não possui nenhum perfil criado anteriormente, THEN THE Sistema_De_Criação SHALL permitir a criação do perfil sem aplicar restrição de Cooldown
10. THE Rate_Limiter SHALL considerar apenas exclusões de perfis que estavam com is_locked igual a true no momento da exclusão (perfis pagos excluídos não contam para o padrão de abuso)

### Requirement 4: Verificação no Backend (Edge Function)

**User Story:** Como operador da plataforma, eu quero que o rate limit seja validado no backend, para que a proteção não possa ser contornada manipulando o frontend.

#### Acceptance Criteria

1. WHEN a edge function `artist-diagnostic` recebe uma requisição de criação, THE Rate_Limiter SHALL verificar a quantidade de Perfis_Pendentes do usuário e, em seguida, verificar o Cooldown do usuário, rejeitando a requisição na primeira violação encontrada
2. IF o usuário possui 3 ou mais Perfis_Pendentes, THEN THE Sistema_De_Criação SHALL retornar erro HTTP 429 com corpo JSON contendo o campo `reason` indicando limite de perfis pendentes e o campo `pending_count` com a quantidade atual
3. IF o tempo decorrido desde a última criação de perfil for inferior ao Cooldown aplicável (10 minutos para 1 exclusão, 24 horas para 2–4 exclusões, ou 7 dias para 5+ exclusões de pendentes nos últimos 30 dias), THEN THE Sistema_De_Criação SHALL retornar erro HTTP 429 com corpo JSON contendo o campo `reason` indicando cooldown ativo, o campo `remaining_seconds` com os segundos restantes, e o campo `deletion_count` com a quantidade de exclusões de pendentes nos últimos 30 dias
4. THE Rate_Limiter SHALL utilizar o user_id extraído do JWT da requisição para identificar o usuário
5. IF a consulta ao banco de dados para verificar as condições de rate limit falhar, THEN THE Sistema_De_Criação SHALL retornar erro HTTP 500 e não prosseguir com a criação do perfil
6. IF o JWT da requisição estiver ausente ou inválido, THEN THE Sistema_De_Criação SHALL retornar erro HTTP 401 sem prosseguir com a verificação de rate limit

### Requirement 5: Feedback Visual no Frontend

**User Story:** Como usuário, eu quero ver mensagens claras quando não posso criar um novo perfil, para que eu entenda o motivo e saiba o que fazer.

#### Acceptance Criteria

1. WHEN o usuário acessa a tela de criação e possui 3 ou mais Perfis_Pendentes, THE Sistema_De_Criação SHALL exibir aviso indicando a quantidade exata de perfis pendentes e orientar o usuário a pagar ou excluir antes de criar outro, desabilitando o campo de busca de artistas
2. WHEN o usuário acessa a tela de criação dentro do período de Cooldown, THE Sistema_De_Criação SHALL exibir aviso com contagem regressiva do tempo restante (em minutos, horas ou dias conforme a duração do cooldown aplicável), atualizando o valor a cada 60 segundos
3. WHEN ambas as restrições se aplicam simultaneamente, THE Sistema_De_Criação SHALL exibir a mensagem da restrição de limite de pendentes (prioridade sobre cooldown) e desabilitar o campo de busca
4. WHEN o período de Cooldown expira enquanto o usuário está na tela de criação, THE Sistema_De_Criação SHALL remover automaticamente o aviso de cooldown e habilitar o campo de busca de artistas sem necessidade de recarregar a página
5. IF a verificação de rate limit no frontend falhar por erro de rede, THEN THE Sistema_De_Criação SHALL exibir mensagem de erro temporário e permitir retry ao clicar em botão de tentar novamente
