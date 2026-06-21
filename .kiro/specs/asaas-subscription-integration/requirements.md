# Requirements Document

## Introduction

Este documento especifica os requisitos para migração do sistema de monetização da plataforma Maestra, substituindo o modelo componentizado do Stripe por um plano único de assinatura recorrente via Asaas (gateway brasileiro). O novo modelo simplifica a monetização: o usuário assina um plano único e obtém acesso completo a todos os módulos da plataforma, sem limites de artistas ou componentes adicionais. O pagamento será feito via PIX recorrente.

## Glossary

- **Maestra**: Plataforma de gestão para artistas musicais (frontend React + TypeScript + Redux + Supabase)
- **Asaas**: Gateway de pagamentos brasileiro que suporta assinatura recorrente via PIX, boleto e cartão de crédito
- **Asaas_API**: API REST do Asaas para criação de clientes, cobranças e assinaturas
- **Webhook_Handler**: Edge Function do Supabase responsável por receber e processar notificações de eventos do Asaas
- **Subscription_Service**: Serviço no frontend que gerencia o estado da assinatura do usuário
- **Assinatura_Ativa**: Estado em que o usuário possui uma assinatura com status "ACTIVE" no Asaas e pagamento confirmado
- **Cliente_Asaas**: Registro de cliente criado na API do Asaas, vinculado ao usuário da plataforma
- **Cobrança_PIX**: Cobrança recorrente gerada pelo Asaas com QR Code PIX para pagamento
- **Access_Guard**: Middleware/componente que verifica se o usuário possui assinatura ativa antes de permitir acesso aos módulos

## Requirements

### Requirement 1: Criação de Cliente no Asaas

**User Story:** Como usuário da Maestra, eu quero que meu cadastro seja sincronizado com o Asaas, para que eu possa realizar pagamentos via PIX recorrente.

#### Acceptance Criteria

1. WHEN um usuário inicia o fluxo de assinatura com nome (entre 3 e 150 caracteres), email válido e CPF (11 dígitos) ou CNPJ (14 dígitos) válidos, THE Subscription_Service SHALL criar um Cliente_Asaas via Asaas_API com esses dados dentro de no máximo 30 segundos
2. WHEN o Cliente_Asaas é criado com sucesso, THE Subscription_Service SHALL armazenar o identificador do cliente Asaas (asaas_customer_id) na tabela de assinaturas do usuário
3. WHEN o usuário já possui um asaas_customer_id armazenado na tabela de assinaturas, THE Subscription_Service SHALL reutilizar o cliente existente ao invés de criar um novo
4. IF a chamada à Asaas_API retornar erro de validação, erro de rede ou timeout (superior a 30 segundos), THEN THE Subscription_Service SHALL exibir ao usuário uma mensagem de erro indicando o motivo da falha, preservar os dados inseridos no formulário e registrar o erro nos logs com timestamp e código de resposta da API
5. IF o usuário fornecer nome com menos de 3 caracteres, email em formato inválido ou CPF/CNPJ com dígitos verificadores inválidos, THEN THE Subscription_Service SHALL impedir o envio à Asaas_API e exibir mensagem de erro indicando o campo inválido

### Requirement 2: Criação de Assinatura Recorrente via PIX

**User Story:** Como usuário da Maestra, eu quero assinar o plano via PIX recorrente, para que eu tenha acesso contínuo à plataforma sem precisar pagar manualmente todo mês.

#### Acceptance Criteria

1. WHEN o usuário confirma a assinatura do plano, THE Subscription_Service SHALL criar uma assinatura recorrente no Asaas via Asaas_API com billing_type "PIX" e ciclo mensal, incluindo o valor do plano e os dados do cliente
2. WHEN a assinatura é criada com sucesso no Asaas, THE Subscription_Service SHALL armazenar o identificador da assinatura Asaas (asaas_subscription_id) com status "ACTIVE" na tabela de assinaturas do usuário
3. IF a criação da assinatura no Asaas falhar, THEN THE Subscription_Service SHALL manter o usuário sem assinatura ativa, exibir uma mensagem de erro indicando falha na criação da assinatura, e permitir que o usuário tente novamente
4. WHEN o Subscription_Service recebe uma notificação de nova cobrança PIX gerada pelo Asaas via webhook, THE Subscription_Service SHALL armazenar os dados da cobrança e disponibilizar o QR Code e a chave copia-e-cola ao usuário na interface da plataforma
5. IF o QR Code PIX expirar sem pagamento dentro do prazo de validade definido pelo Asaas, THEN THE Subscription_Service SHALL indicar ao usuário que a cobrança expirou e que uma nova cobrança será gerada no próximo ciclo
6. THE Subscription_Service SHALL utilizar o valor mensal do plano único configurável pelo administrador e armazenado no banco de dados, com valor mínimo de R$ 0,01

### Requirement 3: Processamento de Webhooks do Asaas

**User Story:** Como operador da plataforma, eu quero que mudanças no status dos pagamentos sejam processadas automaticamente, para que o acesso dos usuários seja atualizado em tempo real.

#### Acceptance Criteria

1. WHEN o Asaas envia um webhook com evento "PAYMENT_CONFIRMED" ou "PAYMENT_RECEIVED", THE Webhook_Handler SHALL identificar a assinatura associada pelo identificador presente no payload e atualizar o status da assinatura do usuário para "active" no banco de dados em até 5 segundos após o recebimento
2. WHEN o Asaas envia um webhook com evento "PAYMENT_OVERDUE", THE Webhook_Handler SHALL identificar a assinatura associada pelo identificador presente no payload e atualizar o status da assinatura do usuário para "overdue" no banco de dados em até 5 segundos após o recebimento
3. WHEN o Asaas envia um webhook com evento "SUBSCRIPTION_DELETED" ou "PAYMENT_DELETED", THE Webhook_Handler SHALL identificar a assinatura associada pelo identificador presente no payload e atualizar o status da assinatura do usuário para "cancelled" no banco de dados em até 5 segundos após o recebimento
4. IF o webhook recebido não contiver um token de acesso válido correspondente ao token configurado do Asaas, THEN THE Webhook_Handler SHALL rejeitar a requisição retornando status HTTP 401 sem processar o evento
5. IF o Webhook_Handler receber um evento com payload ausente de campos obrigatórios (identificador do evento, tipo do evento, identificador da assinatura) ou com assinatura não encontrada no banco de dados, THEN THE Webhook_Handler SHALL registrar o erro nos logs incluindo o tipo de falha e o identificador recebido, e retornar status HTTP 200 para evitar reenvios desnecessários
6. IF o Webhook_Handler receber um evento cujo identificador já foi processado anteriormente, THEN THE Webhook_Handler SHALL retornar status HTTP 200 sem alterar o estado da assinatura no banco de dados

### Requirement 4: Controle de Acesso Baseado na Assinatura

**User Story:** Como usuário da Maestra, eu quero que ao pagar minha assinatura eu tenha acesso completo a todos os módulos, para que eu possa gerenciar meus artistas sem restrições.

#### Acceptance Criteria

1. WHILE a assinatura do usuário estiver com status "active", THE Access_Guard SHALL permitir acesso a todos os módulos da plataforma (Planejamento Estratégico, Catálogo, Releases, CRM, Marketing, Agenda, WhatsApp, Chat, AI Chat, Equipe)
2. WHILE a assinatura do usuário estiver com status "active", THE Access_Guard SHALL permitir criação de perfis de artistas sem exibir mensagem de limite e sem impor restrição de quantidade
3. WHILE a assinatura do usuário estiver com status "overdue" ou "cancelled", THE Access_Guard SHALL bloquear acesso aos módulos protegidos e redirecionar o usuário para a tela de renovação/pagamento em até 2 segundos após a tentativa de acesso
4. WHEN um usuário que nunca possuiu assinatura ou cuja assinatura possui status "incomplete" tenta acessar um módulo protegido, THE Access_Guard SHALL exibir mensagem indicando a necessidade de assinar um plano e apresentar um link/botão de direcionamento para a página de assinatura
5. THE Access_Guard SHALL verificar o status da assinatura consultando o banco de dados local, garantindo que o status reflita a última sincronização com o Asaas com defasagem máxima de 5 minutos, sem depender de chamadas síncronas ao Asaas no momento da verificação de acesso
6. IF o Access_Guard não conseguir determinar o status da assinatura do usuário devido a falha na consulta ao banco de dados local, THEN THE Access_Guard SHALL manter o último status conhecido em cache por até 10 minutos e, caso o cache também esteja indisponível, bloquear o acesso aos módulos protegidos e exibir mensagem indicando indisponibilidade temporária com orientação para tentar novamente
7. WHEN o status da assinatura do usuário transiciona de "active" para "overdue" ou "cancelled" durante uma sessão ativa, THE Access_Guard SHALL aplicar o bloqueio de acesso na próxima navegação entre módulos ou em até 5 minutos após a mudança de status, o que ocorrer primeiro

### Requirement 5: Remoção de Limites de Artistas

**User Story:** Como usuário da Maestra com assinatura ativa, eu quero criar quantos artistas precisar, para que eu possa gerenciar toda a minha carteira sem restrições.

#### Acceptance Criteria

1. WHILE a assinatura do usuário estiver com status "active", THE Maestra SHALL permitir criação de novos perfis de artistas sem verificar limite numérico
2. WHEN a assinatura do usuário transicionar para status "active", THE Maestra SHALL desbloquear (is_locked = false) todos os artistas do usuário que estiverem marcados como locked (is_locked = true), em até 5 segundos após a confirmação do pagamento
3. WHILE a assinatura do usuário estiver com status "active", THE Maestra SHALL remover da interface o componente de aviso "Limite de artistas atingido" e a sugestão de upgrade de plano
4. WHEN a assinatura do usuário é cancelada ou expira (status "cancelled"), THE Maestra SHALL manter os artistas existentes visíveis e com dados acessíveis para consulta, bloqueando criação de novos artistas, edição de perfis existentes e acesso a funcionalidades de gestão (CRM, marketing, catálogo), sem deletar dados

### Requirement 6: Migração do Modelo de Dados

**User Story:** Como desenvolvedor da plataforma, eu quero que o banco de dados seja adaptado para o novo modelo simplificado com Asaas, para que o sistema funcione corretamente com o novo gateway.

#### Acceptance Criteria

1. THE Maestra SHALL criar uma nova tabela para armazenar os dados de assinatura Asaas contendo: user_id (foreign key para auth.users), asaas_customer_id, asaas_subscription_id, status (valores permitidos: "active", "overdue", "cancelled", "pending"), billing_type, valor (numérico com 2 casas decimais), data de início, data da próxima cobrança, created_at e updated_at, com restrição de unicidade garantindo no máximo uma assinatura ativa por user_id
2. THE Maestra SHALL criar uma nova tabela de histórico de pagamentos Asaas contendo: user_id (foreign key para auth.users), asaas_payment_id (único), valor (numérico com 2 casas decimais), status (valores permitidos: "confirmed", "received", "overdue", "deleted", "pending"), data de pagamento, billing_type, created_at e updated_at
3. THE Maestra SHALL manter as tabelas legadas do Stripe (user_subscriptions, subscription_components, payment_history) sem alterações de schema ou remoção de dados, adicionando apenas um campo booleano "migrated" com valor padrão false para identificar registros migrados
4. THE Maestra SHALL criar uma tabela de configuração de plano contendo: nome (máximo 100 caracteres), descrição (máximo 500 caracteres), valor mensal (numérico com 2 casas decimais), e flag ativo (booleano), acessível para leitura por todas as Edge Functions e pelo frontend via query pública, e editável somente por usuários com role de administrador

### Requirement 7: Interface de Assinatura e Pagamento

**User Story:** Como usuário da Maestra, eu quero uma interface clara para assinar, pagar e gerenciar minha assinatura, para que eu tenha controle total sobre meu plano.

#### Acceptance Criteria

1. WHEN o usuário acessa a página de assinatura, THE Maestra SHALL exibir as informações do plano único (nome, valor mensal, lista de funcionalidades incluídas) e um botão para assinar
2. WHEN o usuário clica em assinar, THE Maestra SHALL exibir o QR Code PIX, a chave copia-e-cola gerada pelo Asaas e o tempo de expiração do QR Code para o primeiro pagamento
3. WHEN o pagamento é confirmado, THE Maestra SHALL redirecionar o usuário para o dashboard com uma mensagem de boas-vindas confirmando a ativação em até 5 segundos após a confirmação ser detectada
4. WHILE o usuário possui assinatura ativa, THE Maestra SHALL exibir na página de gerenciamento: status da assinatura, data da próxima cobrança, valor, e opção de cancelar
5. WHEN o usuário solicita cancelamento, THE Maestra SHALL exibir um modal de confirmação e, após confirmação do usuário, processar o cancelamento via Asaas_API
6. WHILE o usuário aguarda a confirmação do pagamento PIX, THE Maestra SHALL exibir um indicador de carregamento e verificar o status do pagamento por polling a cada 5 segundos por no máximo 10 minutos, informando ao usuário caso o tempo limite seja atingido sem confirmação
7. IF a criação da assinatura ou a geração do QR Code PIX falhar, THEN THE Maestra SHALL exibir mensagem de erro indicando a falha e permitir que o usuário tente novamente
8. IF o processamento do cancelamento via Asaas_API falhar, THEN THE Maestra SHALL exibir mensagem de erro indicando que o cancelamento não foi concluído e orientar o usuário a tentar novamente

### Requirement 8: Período de Graça para Pagamentos Atrasados

**User Story:** Como usuário da Maestra, eu quero ter um período de tolerância caso meu pagamento PIX atrase, para que eu não perca acesso imediato à plataforma.

#### Acceptance Criteria

1. WHEN o status da assinatura muda para "overdue", THE Access_Guard SHALL manter o acesso completo à plataforma por um período de graça de 72 horas contadas a partir do momento da mudança de status
2. WHILE o período de graça estiver ativo, THE Maestra SHALL exibir um banner de aviso persistente em todas as páginas informando que o pagamento está pendente e exibindo a data e hora limite para regularização
3. WHEN o período de graça expira sem pagamento confirmado, THE Access_Guard SHALL bloquear o acesso a todos os módulos da plataforma e redirecionar o usuário para a tela de pagamento, preservando todo o progresso e dados do usuário para acesso futuro após regularização
4. WHEN o pagamento é confirmado durante ou após o período de graça, THE Access_Guard SHALL restaurar o acesso completo em até 60 segundos após a confirmação do pagamento
5. IF o período de graça expirar enquanto o usuário estiver em uma sessão ativa, THEN THE Access_Guard SHALL encerrar a sessão e redirecionar o usuário para a tela de pagamento

### Requirement 9: Segurança e Validação das Integrações

**User Story:** Como operador da plataforma, eu quero que a integração com o Asaas seja segura e confiável, para que dados financeiros não sejam comprometidos.

#### Acceptance Criteria

1. THE Webhook_Handler SHALL armazenar a chave de API do Asaas exclusivamente em variáveis de ambiente do servidor (Supabase Edge Function secrets), sem que o valor da chave esteja presente em qualquer arquivo de código-fonte ou bundle entregue ao frontend
2. WHEN o Webhook_Handler receber uma requisição de webhook, THE Webhook_Handler SHALL validar o header `asaas-access-token` comparando-o com o token configurado nas variáveis de ambiente antes de processar o payload
3. IF o header de autenticação do webhook estiver ausente ou não corresponder ao token configurado, THEN THE Webhook_Handler SHALL rejeitar a requisição com status HTTP 401 e não processar o payload recebido
4. THE Subscription_Service SHALL realizar todas as chamadas à Asaas_API exclusivamente via Edge Functions do Supabase, sem que credenciais da API estejam presentes em qualquer arquivo de código-fonte ou bundle entregue ao frontend
5. THE Maestra SHALL aplicar Row Level Security (RLS) nas tabelas de assinatura de modo que consultas realizadas por um usuário autenticado retornem exclusivamente registros cujo campo `user_id` corresponda ao UID do usuário autenticado
6. IF uma Edge Function receber uma requisição sem um JWT válido emitido pelo Supabase Auth, THEN THE Edge Function SHALL rejeitar a requisição com status HTTP 401 e não executar nenhuma lógica de negócio
7. IF uma chamada da Edge Function à Asaas_API falhar por timeout (acima de 30 segundos) ou erro de rede, THEN THE Edge Function SHALL retornar uma resposta com status HTTP 502 e uma mensagem de erro indicando falha na comunicação com o serviço de pagamento, sem expor detalhes internos da API
