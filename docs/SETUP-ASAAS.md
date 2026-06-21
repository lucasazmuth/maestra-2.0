# Guia de Configuração: Supabase + Asaas

Passo a passo completo para configurar a integração de assinatura Asaas na plataforma Maestra.

---

## Pré-requisitos

- [ ] Conta no [Supabase](https://supabase.com) com projeto criado
- [ ] Conta no [Asaas](https://www.asaas.com) (sandbox para dev, produção para deploy)
- [ ] [Supabase CLI](https://supabase.com/docs/guides/cli) instalado (`brew install supabase/tap/supabase`)
- [ ] Node.js 18+ e npm instalados

---

## Parte 1: Configurar o Supabase

### 1.1 Instalar o Supabase CLI

```bash
# macOS (Homebrew)
brew install supabase/tap/supabase

# Verificar instalação
supabase --version
```

### 1.2 Login no Supabase CLI

```bash
supabase login
```

Isso abre o navegador para autenticação. Após logar, o token fica salvo localmente.

### 1.3 Linkar o projeto

No diretório raiz do projeto:

```bash
cd spotify-react-web-client-main
supabase link --project-ref tpwmzcgtidaxgxwqfxwf
```

> O `project-ref` é o ID do projeto Supabase (visível na URL do dashboard: `https://supabase.com/dashboard/project/tpwmzcgtidaxgxwqfxwf`).

### 1.4 Verificar que o link funcionou

```bash
supabase status
```

Deve mostrar a URL do projeto e confirmar a conexão.

---

## Parte 2: Configurar o Asaas

### 2.1 Criar conta sandbox (desenvolvimento)

1. Acesse https://sandbox.asaas.com
2. Crie uma conta de sandbox (é gratuita, não precisa de dados reais)
3. Confirme o email

### 2.2 Obter a API Key

1. No painel do Asaas sandbox, vá em: **Configurações** → **Integrações** → **API**
2. Copie a chave de API (formato: `$aact_...`)
3. Guarde essa chave — será usada como `ASAAS_API_KEY`

### 2.3 Configurar o Webhook

1. No painel do Asaas sandbox, vá em: **Configurações** → **Webhooks** → **Adicionar**
2. Configure:
   - **URL**: `https://tpwmzcgtidaxgxwqfxwf.supabase.co/functions/v1/asaas-webhook`
   - **Eventos para receber**:
     - ✅ PAYMENT_CONFIRMED
     - ✅ PAYMENT_RECEIVED
     - ✅ PAYMENT_OVERDUE
     - ✅ PAYMENT_DELETED
     - ✅ SUBSCRIPTION_DELETED
     - ✅ SUBSCRIPTION_INACTIVATED
   - **Token de autenticação**: Invente um token seguro (ex: gere com `openssl rand -hex 32`)
3. Salve e anote o token — será usado como `ASAAS_WEBHOOK_TOKEN`

#### Gerar um token seguro:

```bash
openssl rand -hex 32
# Exemplo de output: a1b2c3d4e5f6...
```

---

## Parte 3: Configurar os Secrets no Supabase

### 3.1 Definir os secrets das Edge Functions

```bash
# Chave de API do Asaas (obtida no passo 2.2)
supabase secrets set ASAAS_API_KEY='$aact_SUA_CHAVE_AQUI'

# Token de webhook (definido no passo 2.3)
supabase secrets set ASAAS_WEBHOOK_TOKEN='seu_token_webhook_aqui'

# URL da API (sandbox para desenvolvimento)
supabase secrets set ASAAS_API_URL='https://sandbox.asaas.com'
```

### 3.2 Verificar que os secrets foram configurados

```bash
supabase secrets list
```

Deve listar:
```
ASAAS_API_KEY
ASAAS_WEBHOOK_TOKEN
ASAAS_API_URL
```

---

## Parte 4: Aplicar as Migrations no Banco

### 4.1 Verificar migrations pendentes

As migrations já foram aplicadas automaticamente via MCP durante a implementação. Para verificar:

```bash
supabase db diff
```

Se aparecerem migrations locais não aplicadas, rode:

```bash
supabase db push
```

### 4.2 Verificar que as tabelas existem

No dashboard do Supabase (Table Editor), você deve ver:
- `asaas_subscriptions`
- `asaas_payments`
- `asaas_plan_config` (com 1 registro "Maestra Pro")
- `asaas_webhook_events`

---

## Parte 5: Deploy das Edge Functions

As Edge Functions já foram deployadas automaticamente. Para re-deployar manualmente caso necessário:

```bash
# Deploy de todas
supabase functions deploy asaas-create-customer
supabase functions deploy asaas-create-subscription
supabase functions deploy asaas-cancel-subscription
supabase functions deploy asaas-subscription-status
supabase functions deploy asaas-webhook --no-verify-jwt
```

> ⚠️ O `--no-verify-jwt` é obrigatório **apenas** para o webhook (ele recebe chamadas externas do Asaas, sem JWT do Supabase).

### 5.1 Verificar que as functions estão ativas

```bash
supabase functions list
```

Todas devem estar com status `ACTIVE`.

---

## Parte 6: Configurar o Frontend (.env)

O arquivo `.env` na raiz do projeto já deve ter:

```env
REACT_APP_SUPABASE_URL=https://tpwmzcgtidaxgxwqfxwf.supabase.co
REACT_APP_SUPABASE_ANON_KEY=sb_publishable_JnmNt0Cg7tCJtQ9VXPfQBA_04mjnGP9
```

Para **desabilitar o paywall durante desenvolvimento** (útil para testar sem assinatura):

```env
REACT_APP_DISABLE_PAYWALL=true
```

Para **testar o fluxo de assinatura** (deve estar false):

```env
REACT_APP_DISABLE_PAYWALL=false
```

> ⚠️ **NUNCA** coloque `ASAAS_API_KEY` ou `ASAAS_WEBHOOK_TOKEN` no `.env` — eles são secrets do servidor e ficam apenas no Supabase.

---

## Parte 7: Testar o Fluxo Completo

### 7.1 Testar criação de cliente

1. Abra o app com `REACT_APP_DISABLE_PAYWALL=false`
2. Faça login
3. Você será redirecionado para `/assinatura`
4. Preencha nome, email e CPF de teste (ex: `123.456.789-09` — use um CPF válido de gerador)
5. Clique "Assinar agora"

### 7.2 Testar pagamento PIX (sandbox)

1. Após criar a assinatura, você será redirecionado para `/pagamento`
2. O QR Code PIX será exibido (no sandbox, é simulado)
3. Para simular o pagamento no sandbox:
   - Acesse o painel sandbox do Asaas
   - Vá em **Cobranças** → encontre a cobrança pendente
   - Clique em **Simular pagamento** (ou confirmar manualmente)
4. O webhook será disparado e o app deve detectar o pagamento em até 5 segundos

### 7.3 Testar cancelamento

1. Vá em **Configurações** (ícone de engrenagem)
2. Na seção "Assinatura", clique em "Cancelar assinatura"
3. Confirme no modal
4. O status deve mudar para "Cancelada"

### 7.4 Testar webhook manualmente (opcional)

```bash
curl -X POST \
  'https://tpwmzcgtidaxgxwqfxwf.supabase.co/functions/v1/asaas-webhook' \
  -H 'Content-Type: application/json' \
  -H 'asaas-access-token: SEU_WEBHOOK_TOKEN' \
  -d '{
    "id": "evt_teste_001",
    "event": "PAYMENT_CONFIRMED",
    "payment": {
      "id": "pay_teste_001",
      "customer": "cus_XXXXXXXX",
      "subscription": "sub_XXXXXXXX",
      "value": 49.90,
      "billingType": "PIX",
      "paymentDate": "2025-01-15"
    }
  }'
```

---

## Parte 8: Deploy para Produção

Quando estiver pronto para produção:

### 8.1 Criar conta Asaas produção

1. Acesse https://www.asaas.com
2. Crie conta real (precisa de CNPJ e dados reais)
3. Complete a verificação de identidade
4. Obtenha a API Key de produção

### 8.2 Atualizar secrets para produção

```bash
supabase secrets set ASAAS_API_KEY='$aact_CHAVE_PRODUCAO'
supabase secrets set ASAAS_WEBHOOK_TOKEN='token_producao_aqui'
supabase secrets set ASAAS_API_URL='https://api.asaas.com'
```

### 8.3 Atualizar webhook no Asaas produção

No painel de produção do Asaas, configure o webhook apontando para a mesma URL da Edge Function, mas com o token de produção.

### 8.4 Atualizar valor do plano (se necessário)

No Supabase dashboard (Table Editor), edite a tabela `asaas_plan_config`:
- Atualize `monthly_value` para o valor desejado em produção
- Mantenha `is_active = true`

---

## Troubleshooting

### "Não autorizado" ao chamar Edge Functions

- Verifique se o `REACT_APP_SUPABASE_ANON_KEY` no `.env` está correto
- Verifique se o usuário está logado (tem sessão ativa)

### Webhook retorna 401

- Verifique se o `ASAAS_WEBHOOK_TOKEN` configurado no Supabase secrets é exatamente o mesmo configurado no painel do Asaas
- O header deve ser `asaas-access-token` (minúsculas)

### "Erro interno" nas Edge Functions

- Verifique se `ASAAS_API_KEY` está configurado: `supabase secrets list`
- Verifique os logs: `supabase functions logs asaas-create-customer`

### QR Code não aparece na página de pagamento

- A API Asaas pode demorar alguns segundos para gerar o PIX após criar a assinatura
- No sandbox, a geração de PIX pode ser mais lenta
- Verifique os logs: `supabase functions logs asaas-create-subscription`

### Pagamento confirmado mas app não detecta

- Verifique se o webhook está configurado com os eventos corretos
- Verifique logs do webhook: `supabase functions logs asaas-webhook`
- O polling no frontend verifica a cada 5 segundos por 10 minutos

---

## Referência Rápida de Comandos

| Ação | Comando |
|------|---------|
| Login CLI | `supabase login` |
| Linkar projeto | `supabase link --project-ref tpwmzcgtidaxgxwqfxwf` |
| Definir secret | `supabase secrets set NOME=valor` |
| Listar secrets | `supabase secrets list` |
| Deploy function | `supabase functions deploy nome-funcao` |
| Ver logs | `supabase functions logs nome-funcao` |
| Listar functions | `supabase functions list` |
| Push migrations | `supabase db push` |
