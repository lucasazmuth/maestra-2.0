# Requirements Document

## Introduction

Validação e hardening do fluxo de pagamento end-to-end com o gateway Asaas. A plataforma Maestra já possui a integração Asaas implementada (Edge Functions, tabelas no banco, Redux slice, e páginas de checkout/pagamento/sucesso). Esta fase foca em garantir que o fluxo completo — desde o clique em "Assinar" até a ativação dos entitlements Pro — funcione de forma robusta, resiliente a falhas, e com feedback claro ao usuário em cada etapa.

O escopo inclui: validação do fluxo PIX (QR Code → pagamento → webhook → ativação), validação do fluxo Cartão de Crédito (cobrança imediata → ativação), tratamento de erros em cada etapa, resiliência do webhook, feedback visual correto durante transições de estado, e testes automatizados do fluxo completo.

## Glossary

- **Asaas_Gateway**: Serviço externo de pagamentos (asaas.com) que processa cobranças via PIX e cartão de crédito.
- **Edge_Function**: Função serverless no Supabase que intermediá a comunicação entre o frontend e a API Asaas.
- **Subscription_Page**: Página `/assinatura` onde o usuário preenche dados e escolhe forma de pagamento.
- **Payment_Page**: Página `/pagamento` que exibe o QR Code PIX e faz polling do status.
- **Success_Page**: Página `/assinatura/sucesso` exibida após confirmação do pagamento.
- **Subscription_Slice**: Redux slice (`subscription.ts`) que gerencia todo o estado de assinatura no frontend.
- **Webhook_Handler**: Edge Function `asaas-webhook` que recebe eventos do Asaas e atualiza o banco.
- **Entitlements_Hook**: Hook `useEntitlements` que deriva o plano (free/pro) a partir do status da assinatura.
- **Polling_Mechanism**: Mecanismo que consulta o status da assinatura a cada 5 segundos por até 10 minutos após pagamento PIX.
- **Grace_Period**: Período de tolerância (configurável via `grace_period_ends_at`) durante o qual o usuário mantém acesso Pro mesmo com pagamento em atraso.
- **Asaas_Customer**: Registro de cliente criado na API Asaas com nome, email e CPF/CNPJ do usuário.
- **PIX_Flow**: Fluxo de pagamento onde o usuário escaneia um QR Code ou copia a chave PIX para pagar.
- **Credit_Card_Flow**: Fluxo de pagamento onde a cobrança é processada imediatamente no cartão.

## Requirements

### Requirement 1: Criação de Cliente Asaas

**User Story:** Como usuário que deseja assinar o plano Pro, eu quero que meus dados sejam enviados ao Asaas para criar meu cadastro de cliente, para que eu possa receber cobranças recorrentes.

#### Acceptance Criteria

1. WHEN the user submits the Subscription_Page form with valid name, email, and CPF/CNPJ, THE Edge_Function `asaas-create-customer` SHALL create a customer in the Asaas_Gateway and return a `customerId` within 30 seconds.
2. WHEN the Asaas_Gateway returns an error or is unreachable during customer creation, THE Subscription_Slice SHALL store the error message and THE Subscription_Page SHALL display an inline error message indicating the failure reason adjacent to the form's submit action.
3. IF the CPF/CNPJ provided is invalid (fails digit validation), THEN THE Subscription_Page SHALL display a validation error message adjacent to the CPF/CNPJ input field before calling the Edge_Function.
4. THE Edge_Function `asaas-create-customer` SHALL associate the created Asaas customer with the authenticated Supabase `user_id` in the `asaas_subscriptions` table.
5. WHEN a customer already exists for the same `user_id`, THE Edge_Function `asaas-create-customer` SHALL return the existing `customerId` without creating a duplicate.
6. IF the user is not authenticated when submitting the Subscription_Page form, THEN THE Subscription_Page SHALL block the submission and redirect the user to the login page.

### Requirement 2: Criação de Assinatura PIX

**User Story:** Como usuário que escolheu PIX como forma de pagamento, eu quero que uma assinatura recorrente seja criada no Asaas com cobrança PIX, para que eu receba um QR Code para efetuar o primeiro pagamento.

#### Acceptance Criteria

1. WHEN the user selects PIX and submits the form, THE Edge_Function `asaas-create-subscription` SHALL create a monthly recurring subscription in the Asaas_Gateway with `billingType: PIX`, sending the customer ID from the current user context and the plan value read from `asaas_plan_config`.
2. WHEN the subscription is created with PIX, THE Edge_Function SHALL return a `pixQrCode` (base64 image), `pixCopyPaste` (text key), and `expiresAt` (ISO 8601 timestamp indicating when the QR code expires).
3. WHEN the PIX subscription is created successfully, THE Subscription_Slice SHALL store the `pixQrCode`, `pixCopyPaste`, and `expiresAt` values, and THE Subscription_Page SHALL navigate the user to the Payment_Page.
4. IF the Asaas_Gateway returns an error during PIX subscription creation, THEN THE Subscription_Slice SHALL store the error details and THE Subscription_Page SHALL display an error message indicating the subscription could not be created, without navigating away from the current page.
5. THE Edge_Function `asaas-create-subscription` SHALL read the plan value from the `asaas_plan_config` table to ensure the subscription uses the current configured price.
6. IF the `asaas_plan_config` table returns no valid plan entry or is unreachable, THEN THE Edge_Function SHALL return an error response indicating the plan configuration is unavailable, and THE Subscription_Page SHALL display an error message without navigating away.

### Requirement 3: Criação de Assinatura Cartão de Crédito

**User Story:** Como usuário que escolheu cartão de crédito, eu quero que a cobrança seja processada imediatamente, para que meu plano Pro seja ativado sem precisar aguardar confirmação manual.

#### Acceptance Criteria

1. WHEN the user selects CREDIT_CARD and submits valid card data, THE Edge_Function `asaas-create-subscription` SHALL create a recurring subscription with immediate first charge and return a response within 30 seconds.
2. WHEN the credit card charge is approved, THE Subscription_Slice SHALL update `status` to `active` and THE Subscription_Page SHALL navigate to the Success_Page.
3. WHEN the credit card charge is declined, THE Subscription_Slice SHALL store the error message returned by the payment gateway and THE Subscription_Page SHALL display an inline error message indicating the decline reason without navigating away from the current page.
4. THE Subscription_Page SHALL validate credit card fields (number length 13–19 digits, cardholder name 3–100 characters, expiry = 4 digits in MMYY format, CVV 3–4 digits, phone 10–11 digits, CEP = 8 digits) before calling the Edge_Function.
5. IF any credit card field fails validation, THEN THE Subscription_Page SHALL display an error indicator adjacent to each invalid field and SHALL disable the submit action until all fields pass validation.
6. IF the Edge_Function `asaas-create-subscription` does not respond within 30 seconds or returns a network error, THEN THE Subscription_Page SHALL display an error message indicating a communication failure and SHALL allow the user to retry the submission.

### Requirement 4: Pagamento PIX — QR Code e Polling

**User Story:** Como usuário que gerou um QR Code PIX, eu quero ver o QR Code com contador de expiração e ser notificado automaticamente quando o pagamento for confirmado, para que eu não precise recarregar a página manualmente.

#### Acceptance Criteria

1. WHEN the Payment_Page mounts with valid `pixData` in the Subscription_Slice, THE Payment_Page SHALL display the QR Code image and the PIX copy-paste text.
2. IF the Payment_Page mounts and `pixData` is absent or missing required fields (`qrCodeImage`, `copyPasteText`, `expiresAt`), THEN THE Payment_Page SHALL display an error message indicating that PIX data is unavailable and SHALL NOT start the Polling_Mechanism.
3. WHILE the QR Code has not expired, THE Payment_Page SHALL display a countdown timer in `mm:ss` format based on `pixData.expiresAt` that updates every 1 second.
4. WHEN the countdown reaches zero, THE Payment_Page SHALL display a message indicating the QR Code has expired, disable the "Copiar" button, and stop the Polling_Mechanism.
5. WHEN the Payment_Page mounts with valid `pixData`, THE Polling_Mechanism SHALL start checking the subscription status every 5 seconds.
6. WHEN the Polling_Mechanism detects `status === 'active'`, THE Payment_Page SHALL display a success state and navigate to the Success_Page after 1.5 seconds.
7. IF the Polling_Mechanism exceeds 10 minutes without detecting `active` status, THEN THE Payment_Page SHALL stop polling and display a timeout error message with an option to generate a new QR Code.
8. IF a polling request fails due to a network error, THEN THE Polling_Mechanism SHALL retry on the next 5-second interval without displaying an error to the user, up to 3 consecutive failures, after which THE Payment_Page SHALL display a connectivity error message.
9. WHEN the user clicks the "Copiar" button, THE Payment_Page SHALL copy the PIX copy-paste text to the clipboard and display a "Copiado" confirmation for 3 seconds.
10. IF the clipboard API is unavailable or the copy operation fails, THEN THE Payment_Page SHALL display a message indicating that automatic copy failed and instruct the user to copy the text manually.

### Requirement 5: Webhook de Confirmação de Pagamento

**User Story:** Como sistema, eu preciso processar as notificações de pagamento do Asaas em tempo real, para que o status da assinatura do usuário seja atualizado assim que o pagamento for confirmado.

#### Acceptance Criteria

1. WHEN the Asaas_Gateway sends a `PAYMENT_CONFIRMED` or `PAYMENT_RECEIVED` webhook event, THE Webhook_Handler SHALL update the `asaas_subscriptions` row to `status = 'active'` for the corresponding user and return HTTP 200.
2. WHEN the Asaas_Gateway sends a `PAYMENT_OVERDUE` webhook event, THE Webhook_Handler SHALL update the `asaas_subscriptions` row to `status = 'overdue'`, set `grace_period_ends_at` to 7 days from the event date, and return HTTP 200.
3. WHEN the Asaas_Gateway sends a `PAYMENT_DELETED` webhook event, THE Webhook_Handler SHALL update the `asaas_payments` row to `status = 'deleted'` and return HTTP 200.
4. WHEN the Asaas_Gateway sends a `SUBSCRIPTION_DELETED` or `SUBSCRIPTION_INACTIVATED` event, THE Webhook_Handler SHALL update the `asaas_subscriptions` row to `status = 'cancelled'` and return HTTP 200.
5. THE Webhook_Handler SHALL validate the `asaas-access-token` header against the configured `ASAAS_WEBHOOK_TOKEN` before processing any event.
6. IF the `asaas-access-token` header is missing or invalid, THEN THE Webhook_Handler SHALL return HTTP 401 without processing the event.
7. THE Webhook_Handler SHALL store every received event in `asaas_webhook_events` with the `event_id` as unique key to guarantee idempotency.
8. WHEN a duplicate `event_id` is received, THE Webhook_Handler SHALL return HTTP 200 without reprocessing the event.
9. WHEN a payment-related webhook event (`PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_CREATED`, `PAYMENT_UPDATED`) is received, THE Webhook_Handler SHALL insert or update a record in `asaas_payments` recording `asaas_payment_id`, `value`, `status`, `billing_type`, and `payment_date`.
10. IF a webhook event references a `subscription` or `payment` identifier that does not match any existing record in the database, THEN THE Webhook_Handler SHALL store the event in `asaas_webhook_events`, return HTTP 200, and skip further status updates.
11. IF the Webhook_Handler fails to persist the event or update the database due to a write error, THEN THE Webhook_Handler SHALL return HTTP 500 and SHALL NOT mark the event as processed, allowing Asaas to retry delivery.
12. THE Webhook_Handler SHALL complete processing of each webhook request within 10 seconds of receipt.

### Requirement 6: Status da Assinatura — Consulta

**User Story:** Como sistema, eu preciso consultar o status atualizado da assinatura ao carregar o app, para que os entitlements reflitam a realidade do pagamento.

#### Acceptance Criteria

1. WHILE the user is authenticated and `PAYWALL_DISABLED` is false, WHEN the Layout component mounts, THE Layout SHALL dispatch `fetchSubscriptionStatus` to load the current subscription state.
2. WHILE `fetchSubscriptionStatus` is in progress, THE Entitlements_Hook SHALL derive the plan as `free` until the response is received.
3. THE Edge_Function `asaas-subscription-status` SHALL query the `asaas_subscriptions` table for the authenticated `user_id` and return `status`, `asaasCustomerId`, `asaasSubscriptionId`, `nextDueDate`, `value`, and `gracePeriodEndsAt` within 5 seconds.
4. WHEN no subscription exists for the user, THE Edge_Function `asaas-subscription-status` SHALL return `status: 'none'` with all other fields as null.
5. IF the Edge_Function `asaas-subscription-status` fails to respond or returns an error, THEN THE Entitlements_Hook SHALL derive the plan as `free` and the Layout SHALL allow the user to continue using the app.
6. WHEN the subscription status is loaded, THE Entitlements_Hook SHALL derive the plan as `pro` if `status` is `active`, or if `status` is `overdue` and the current UTC date is on or before `gracePeriodEndsAt`; THE Entitlements_Hook SHALL derive the plan as `free` for any other `status` value including `none`, `cancelled`, `pending`, or `overdue` with current UTC date after `gracePeriodEndsAt`.

### Requirement 7: Cancelamento de Assinatura

**User Story:** Como usuário Pro que deseja cancelar a assinatura, eu quero poder cancelar pela plataforma, para que a cobrança recorrente seja interrompida no Asaas.

#### Acceptance Criteria

1. WHEN the user confirms the cancellation action, THE Edge_Function `asaas-cancel-subscription` SHALL call the Asaas_Gateway API to cancel the subscription identified by the stored `asaas_subscription_id`, with a timeout of 30 seconds.
2. WHEN the Asaas_Gateway API returns a success response or a 404 (subscription not found on gateway), THE Edge_Function `asaas-cancel-subscription` SHALL update the `asaas_subscriptions` row to `status = 'cancelled'` in the database.
3. WHEN the database update confirms the cancellation, THE Subscription_Slice SHALL update `status` to `cancelled` and clear `pixData`.
4. IF the Asaas_Gateway API returns a 5xx error or the request times out (30 seconds), THEN THE Edge_Function `asaas-cancel-subscription` SHALL return an error response indicating payment service unavailability, and the Subscription_Slice SHALL store the error message for display without changing the subscription status.
5. IF the user has no subscription record in `asaas_subscriptions`, THEN THE Edge_Function `asaas-cancel-subscription` SHALL return an error response indicating the resource was not found, and the Subscription_Slice SHALL store the error message for display.
6. WHILE the cancellation request is in progress, THE Subscription_Slice SHALL set `loading` to `true` and clear any previous error.

### Requirement 8: Transição de Estado e Feedback Visual

**User Story:** Como usuário, eu quero ver feedback visual claro sobre o estado da minha assinatura em todas as páginas, para que eu saiba se preciso agir sobre um pagamento pendente ou em atraso.

#### Acceptance Criteria

1. WHILE the subscription status is `pending` and the subscription state is initialized, THE StatusBanner SHALL display an "info" variant AnnouncementBanner with title "Pagamento em análise" and a "Ver status" CTA that navigates to `/pagamento`.
2. WHILE the subscription status is `overdue` and `gracePeriodEndsAt` is in the future, THE StatusBanner SHALL display a "warning" variant AnnouncementBanner with the deadline date formatted as "dd/MM/yyyy às HH:mm" and a "Regularizar agora" CTA that navigates to `/pagamento`.
3. WHILE the subscription status is `none` or `cancelled` and the subscription state is initialized, THE StatusBanner SHALL display a "promo" variant AnnouncementBanner with an "Assinar agora" CTA that navigates to `/assinatura`.
4. WHILE the current route pathname starts with `/assinatura` or `/pagamento`, THE useStatusBanner hook SHALL return `null` and no subscription-related banner SHALL be rendered.
5. WHEN the pollPaymentStatus thunk resolves with status `active` (polled every 5 seconds for up to 10 minutes), THE subscription Redux state SHALL update to `active`, causing useEntitlements to derive `plan: 'pro'` and unlock all gated features within the same React render cycle.
6. WHILE PAYWALL_DISABLED is `true`, THE useStatusBanner hook SHALL return `null` and no subscription-related banner SHALL be rendered.
7. WHILE the subscription state is not yet initialized (`initialized: false`), THE useStatusBanner hook SHALL return `null` to prevent displaying banners based on the default Redux state.

### Requirement 9: Resiliência e Tratamento de Erros

**User Story:** Como sistema, eu preciso lidar graciosamente com falhas de rede, timeouts e erros da API Asaas, para que o usuário tenha uma experiência clara mesmo quando algo dá errado.

#### Acceptance Criteria

1. WHEN any Edge_Function call fails due to a network error or does not respond within 30 seconds, THE Subscription_Slice SHALL store an error message in Portuguese that describes the failure category (e.g., connection, timeout, or server error) with a maximum length of 200 characters.
2. WHEN the Subscription_Page displays an error, THE Subscription_Page SHALL provide a dismissible Alert component that clears the error from the Subscription_Slice state on close.
3. WHEN the Payment_Page polling encounters a network error on a single iteration, THE Polling_Mechanism SHALL skip that iteration and continue polling on the next scheduled interval without resetting the polling timer.
4. IF the Polling_Mechanism encounters 3 consecutive network errors, THEN THE Polling_Mechanism SHALL stop polling and THE Payment_Page SHALL display an error message in Portuguese indicating that the connection was lost, with a retry button.
5. IF the Edge_Function `asaas-create-subscription` returns a response where `qrCode` is null or absent, THEN THE Subscription_Slice SHALL store an error message in Portuguese indicating PIX generation failure and SHALL NOT navigate to the Payment_Page.
6. WHEN the user navigates to the Payment_Page without `pixData` containing both a non-empty `qrCode` string and a non-empty `expirationDate` string in the Redux store, THE Payment_Page SHALL redirect to the Subscription_Page within 1 second of component mount.

### Requirement 10: Bypass de Desenvolvimento (PAYWALL_DISABLED)

**User Story:** Como desenvolvedor, eu quero poder desativar todo o fluxo de pagamento via variável de ambiente, para que o desenvolvimento de outras features não seja bloqueado pelo paywall.

#### Acceptance Criteria

1. WHILE `PAYWALL_DISABLED` is `true`, THE Layout SHALL NOT dispatch `fetchSubscriptionStatus` on mount nor on any subsequent polling interval.
2. WHILE `PAYWALL_DISABLED` is `true`, THE Entitlements_Hook SHALL return `plan: 'pro'`, `maxArtists: Infinity`, `maxCatalogTracks: Infinity`, and all feature flags (`planning`, `team`, `nyta`) as `true`, regardless of the subscription status in the database.
3. WHILE `PAYWALL_DISABLED` is `true`, THE useStatusBanner hook SHALL return `null`, causing the AnnouncementBanner to not render any subscription-related banner (`promo`, `grace`, or `pending`).
4. THE `PAYWALL_DISABLED` constant SHALL be derived from the environment variable `REACT_APP_DISABLE_PAYWALL` by strict equality comparison with the string `'true'`.
