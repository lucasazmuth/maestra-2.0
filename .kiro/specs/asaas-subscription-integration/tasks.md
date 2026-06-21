# Implementation Plan: Integração de Assinatura Asaas

## Overview

Migração do sistema de monetização da plataforma Maestra de Stripe para Asaas, implementando um plano único de assinatura recorrente via PIX. A implementação segue uma abordagem incremental: banco de dados → Edge Functions → frontend Redux → páginas de UI → testes.

## Tasks

- [x] 1. Configurar banco de dados e modelos de dados
  - [x] 1.1 Criar migration para tabelas Asaas (asaas_subscriptions, asaas_payments, asaas_plan_config, asaas_webhook_events)
    - Criar tabela `asaas_subscriptions` com campos: id, user_id (FK unique), asaas_customer_id, asaas_subscription_id, status, billing_type, value, started_at, next_due_date, grace_period_ends_at, created_at, updated_at
    - Criar tabela `asaas_payments` com campos: id, user_id (FK), asaas_payment_id (unique), value, status, payment_date, billing_type, created_at, updated_at
    - Criar tabela `asaas_plan_config` com campos: id, name, description, monthly_value, is_active, created_at, updated_at
    - Criar tabela `asaas_webhook_events` com campos: id, event_id (unique), event_type, payload (jsonb), processed_at
    - Aplicar CHECK constraints nos campos status de ambas as tabelas
    - _Requirements: 6.1, 6.2, 6.4_

  - [x] 1.2 Configurar Row Level Security (RLS) nas tabelas Asaas
    - Habilitar RLS em asaas_subscriptions: usuário pode SELECT/UPDATE apenas seus próprios registros
    - Habilitar RLS em asaas_payments: usuário pode SELECT apenas seus próprios registros
    - Habilitar RLS em asaas_plan_config: SELECT público, INSERT/UPDATE/DELETE apenas para admins (role platform_admins)
    - asaas_webhook_events: sem acesso público (apenas via service_role nas Edge Functions)
    - _Requirements: 9.5_

  - [x] 1.3 Adicionar campo `migrated` nas tabelas legadas do Stripe
    - ALTER TABLE user_subscriptions ADD COLUMN migrated boolean DEFAULT false
    - ALTER TABLE subscription_components ADD COLUMN migrated boolean DEFAULT false
    - ALTER TABLE payment_history ADD COLUMN migrated boolean DEFAULT false
    - _Requirements: 6.3_

  - [x] 1.4 Inserir registro inicial na tabela asaas_plan_config
    - Inserir plano "Maestra Pro" com valor mensal configurável e is_active = true
    - _Requirements: 2.6, 6.4_

  - [x]* 1.5 Escrever property test para RLS Data Isolation
    - **Property 12: RLS Data Isolation**
    - **Validates: Requirements 9.5**

- [x] 2. Implementar Edge Functions de criação de cliente e assinatura
  - [x] 2.1 Criar Edge Function `asaas-create-customer`
    - Implementar validação de entrada (nome ≥3 chars, email válido, CPF/CNPJ com dígitos verificadores)
    - Verificar se usuário já possui asaas_customer_id no banco → reutilizar
    - Chamar POST /v3/customers no Asaas API se necessário
    - Armazenar asaas_customer_id no banco
    - Tratar erros: 401 JWT inválido, 400 validação, 502 timeout/rede
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 9.4, 9.6, 9.7_

  - [x]* 2.2 Escrever property test para criação idempotente de cliente
    - **Property 1: Idempotent Customer Creation**
    - **Validates: Requirements 1.3**

  - [x]* 2.3 Escrever property test para validação de entrada
    - **Property 2: Input Validation Rejects All Invalid Data**
    - **Validates: Requirements 1.5**

  - [x] 2.4 Criar Edge Function `asaas-create-subscription`
    - Buscar valor do plano ativo em asaas_plan_config
    - Chamar POST /v3/subscriptions no Asaas API com billingType PIX e ciclo MONTHLY
    - Armazenar asaas_subscription_id e status na tabela asaas_subscriptions
    - Retornar dados PIX (qrCode, copyPaste, expiresAt) da primeira cobrança
    - Tratar erros: 401, 400, 502
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 9.4, 9.6, 9.7_

  - [x] 2.5 Criar Edge Function `asaas-cancel-subscription`
    - Buscar assinatura do usuário no banco
    - Chamar DELETE /v3/subscriptions/{id} no Asaas API
    - Atualizar status para "cancelled" no banco local
    - Tratar erros: 401, 404, 502
    - _Requirements: 7.5, 7.8, 9.4, 9.6, 9.7_

  - [x] 2.6 Criar Edge Function `asaas-subscription-status`
    - Consultar status da assinatura do usuário no banco local
    - Retornar: status, nextDueDate, value, gracePeriodEndsAt
    - Tratar erros: 401, 404
    - _Requirements: 4.5, 7.4_

- [x] 3. Implementar Edge Function de Webhook
  - [x] 3.1 Criar Edge Function `asaas-webhook` (verify_jwt: false)
    - Validar header `asaas-access-token` contra variável de ambiente
    - Verificar idempotência: checar event_id em asaas_webhook_events
    - Mapear eventos para status: PAYMENT_CONFIRMED/RECEIVED → active, PAYMENT_OVERDUE → overdue, SUBSCRIPTION_DELETED/INACTIVATED/PAYMENT_DELETED → cancelled
    - Atualizar asaas_subscriptions com novo status
    - Calcular grace_period_ends_at (now + 72h) quando status → overdue
    - Inserir registro em asaas_payments quando aplicável
    - Desbloquear artistas (is_locked = false) quando status → active
    - Registrar evento em asaas_webhook_events
    - Retornar HTTP 200 para payloads malformados (com log)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.2, 8.1, 9.1, 9.2, 9.3_

  - [x]* 3.2 Escrever property test para transições de estado via webhook
    - **Property 3: Webhook State Machine Transitions**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x]* 3.3 Escrever property test para autenticação de webhook
    - **Property 4: Webhook Authentication Rejects Invalid Tokens**
    - **Validates: Requirements 3.4, 9.2, 9.3, 9.6**

  - [x]* 3.4 Escrever property test para idempotência de webhook
    - **Property 5: Webhook Idempotency**
    - **Validates: Requirements 3.6**

  - [x]* 3.5 Escrever property test para degradação graciosa com payloads malformados
    - **Property 6: Webhook Graceful Degradation for Malformed Payloads**
    - **Validates: Requirements 3.5**

- [x] 4. Checkpoint - Verificar backend
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implementar Redux slice e hooks de assinatura
  - [x] 5.1 Criar `subscriptionSlice` no Redux store
    - Definir interface SubscriptionState com campos: status, asaasCustomerId, asaasSubscriptionId, nextDueDate, value, gracePeriodEndsAt, loading, error, pixData
    - Implementar async thunks: fetchSubscriptionStatus, createAsaasCustomer, createSubscription, cancelSubscription, pollPaymentStatus
    - Registrar slice no store principal (src/store/store.ts)
    - _Requirements: 2.1, 2.2, 7.4, 7.5, 7.6_

  - [x] 5.2 Criar hook `useSubscriptionGuard`
    - Ler status da assinatura do Redux store
    - Implementar lógica de período de graça (72h após overdue)
    - Consultar status periodicamente (a cada 5 minutos)
    - Retornar { hasAccess, reason, shouldShowBanner }
    - Redirecionar para página de pagamento quando acesso negado
    - Implementar fallback com cache de 10 minutos em caso de falha
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x]* 5.3 Escrever property test para Access Guard com assinatura ativa
    - **Property 7: Active Subscription Grants Full Access**
    - **Validates: Requirements 4.1, 4.2, 5.1**

  - [x]* 5.4 Escrever property test para bloqueio com assinatura inativa
    - **Property 8: Inactive Subscription Blocks Access**
    - **Validates: Requirements 4.3, 4.4, 8.3**

  - [x]* 5.5 Escrever property test para cálculo do período de graça
    - **Property 11: Grace Period Computation**
    - **Validates: Requirements 8.1**

- [x] 6. Implementar lógica de artistas e desbloqueio
  - [x] 6.1 Atualizar lógica de criação de artistas para respeitar status da assinatura
    - Remover verificação de limite numérico de artistas quando assinatura ativa
    - Bloquear criação de novos artistas quando assinatura cancelled/overdue (sem graça)
    - Remover componente de aviso "Limite de artistas atingido" quando ativo
    - _Requirements: 5.1, 5.3, 5.4_

  - [x]* 6.2 Escrever property test para desbloqueio de artistas na ativação
    - **Property 9: Artist Unlock on Activation**
    - **Validates: Requirements 5.2**

  - [x]* 6.3 Escrever property test para acesso read-only com assinatura cancelada
    - **Property 10: Cancelled Subscription Allows Read-Only Artist Access**
    - **Validates: Requirements 5.4**

- [x] 7. Checkpoint - Verificar lógica de negócios
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implementar páginas de assinatura e pagamento
  - [x] 8.1 Criar página de assinatura (`SubscriptionPage`)
    - Exibir informações do plano (nome, valor, funcionalidades)
    - Formulário de dados do cliente (nome, email, CPF/CNPJ) com validação inline
    - Botão para assinar que dispara createAsaasCustomer → createSubscription
    - Tratamento de erros com mensagens ao usuário
    - _Requirements: 7.1, 7.2, 7.7, 1.5_

  - [x] 8.2 Criar página de pagamento PIX (`PaymentPage`)
    - Exibir QR Code PIX renderizado como imagem
    - Exibir chave copia-e-cola com botão de copiar
    - Exibir countdown de expiração do QR Code
    - Implementar polling a cada 5 segundos por até 10 minutos (pollPaymentStatus)
    - Exibir indicador de carregamento durante polling
    - Redirecionar para dashboard com mensagem de boas-vindas ao confirmar pagamento
    - Informar ao usuário se timeout de 10 minutos atingido
    - _Requirements: 7.2, 7.3, 7.6, 2.4, 2.5_

  - [x] 8.3 Criar seção de gerenciamento de assinatura em Settings (`SubscriptionManagementPage`)
    - Exibir status atual da assinatura, próxima cobrança e valor
    - Botão cancelar com modal de confirmação
    - Processar cancelamento via cancelSubscription thunk
    - Tratar falha no cancelamento com mensagem de erro
    - _Requirements: 7.4, 7.5, 7.8_

  - [x] 8.4 Implementar banner de período de graça
    - Banner persistente em todas as páginas quando status overdue e dentro do período de graça
    - Exibir data e hora limite para regularização
    - Remover banner quando pagamento confirmado
    - _Requirements: 8.2_

- [x] 9. Integrar Access Guard nas rotas protegidas
  - [x] 9.1 Aplicar `useSubscriptionGuard` nas rotas de módulos protegidos
    - Integrar guard em todas as rotas de módulos: Planejamento, Catálogo, Releases, CRM, Marketing, Agenda, WhatsApp, Chat, AI Chat, Equipe
    - Implementar redirecionamento para página de assinatura/pagamento quando sem acesso
    - Exibir mensagem para usuários sem assinatura com link para página de assinatura
    - Aplicar bloqueio na próxima navegação ou em até 5 minutos após mudança de status
    - _Requirements: 4.1, 4.3, 4.4, 4.7, 8.3, 8.5_

- [x] 10. Configurar variáveis de ambiente e segurança
  - [x] 10.1 Documentar e configurar secrets nas Edge Functions
    - Definir ASAAS_API_KEY como secret da Edge Function
    - Definir ASAAS_WEBHOOK_TOKEN como secret da Edge Function
    - Garantir que nenhuma credencial esteja em código-fonte ou bundle do frontend
    - _Requirements: 9.1, 9.4_

- [x] 11. Final checkpoint - Verificar integração completa
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- A linguagem de implementação é TypeScript, conforme definido no design
- Edge Functions utilizam Supabase Edge Functions (Deno runtime)
- Frontend utiliza React + Redux Toolkit + TypeScript

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["1.5", "2.1", "2.4", "2.5", "2.6"] },
    { "id": 3, "tasks": ["2.2", "2.3", "3.1"] },
    { "id": 4, "tasks": ["3.2", "3.3", "3.4", "3.5"] },
    { "id": 5, "tasks": ["5.1", "10.1"] },
    { "id": 6, "tasks": ["5.2", "6.1"] },
    { "id": 7, "tasks": ["5.3", "5.4", "5.5", "6.2", "6.3"] },
    { "id": 8, "tasks": ["8.1", "8.3"] },
    { "id": 9, "tasks": ["8.2", "8.4"] },
    { "id": 10, "tasks": ["9.1"] }
  ]
}
```
