# Supabase Edge Functions — Secrets Configuration

Este documento descreve os secrets necessários para as Edge Functions de integração com o Asaas.

## Secrets Obrigatórios

| Secret | Descrição | Onde obter |
|--------|-----------|------------|
| `ASAAS_API_KEY` | Chave de API do Asaas (sandbox ou produção) | Painel Asaas → Configurações → Integrações → API |
| `ASAAS_WEBHOOK_TOKEN` | Token para validação dos webhooks recebidos do Asaas | Definido por você ao configurar o webhook no painel Asaas |

## Secrets Opcionais

| Secret | Descrição | Valor padrão |
|--------|-----------|--------------|
| `ASAAS_API_URL` | URL base da API do Asaas | `https://sandbox.asaas.com` (sandbox) |

> **Nota:** Se `ASAAS_API_URL` não for definido, as Edge Functions usarão o ambiente sandbox automaticamente.  
> Para produção, defina como `https://api.asaas.com`.

## Secrets Gerenciados pelo Supabase (automáticos)

Estes secrets são provisionados automaticamente pelo Supabase e não precisam ser configurados manualmente:

| Secret | Descrição |
|--------|-----------|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave anônima (pública) do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço (admin) do Supabase |

## Como Configurar os Secrets

### Via CLI (recomendado)

```bash
# Configurar a chave da API Asaas
supabase secrets set ASAAS_API_KEY=sua_chave_aqui

# Configurar o token de validação do webhook
supabase secrets set ASAAS_WEBHOOK_TOKEN=seu_token_aqui

# (Opcional) Configurar URL de produção do Asaas
supabase secrets set ASAAS_API_URL=https://api.asaas.com
```

### Verificar secrets configurados

```bash
supabase secrets list
```

### Remover um secret

```bash
supabase secrets unset ASAAS_API_KEY
```

## Mapeamento: Quais Functions Usam Quais Secrets

| Edge Function | `ASAAS_API_KEY` | `ASAAS_WEBHOOK_TOKEN` | `ASAAS_API_URL` |
|---------------|:---------------:|:---------------------:|:---------------:|
| `asaas-create-customer` | ✅ | — | ✅ |
| `asaas-create-subscription` | ✅ | — | ✅ |
| `asaas-cancel-subscription` | ✅ | — | ✅ |
| `asaas-webhook` | — | ✅ | — |
| `asaas-subscription-status` | — | — | — |

### Detalhamento

- **`asaas-create-customer`**: Usa `ASAAS_API_KEY` para autenticar chamadas à API do Asaas ao criar clientes. Usa `ASAAS_API_URL` para determinar o ambiente (sandbox/produção).
- **`asaas-create-subscription`**: Usa `ASAAS_API_KEY` para criar assinaturas e consultar cobranças PIX. Usa `ASAAS_API_URL` para o endpoint.
- **`asaas-cancel-subscription`**: Usa `ASAAS_API_KEY` para cancelar assinaturas via API. Usa `ASAAS_API_URL` para o endpoint.
- **`asaas-webhook`**: Usa `ASAAS_WEBHOOK_TOKEN` para validar o header `asaas-access-token` das requisições recebidas do Asaas. Não faz chamadas à API do Asaas.
- **`asaas-subscription-status`**: Consulta apenas o banco de dados local. Não precisa de secrets do Asaas.

## Segurança

### Regras Importantes

1. **NUNCA** commitar secrets no código-fonte ou em arquivos `.env` do repositório
2. **NUNCA** expor `ASAAS_API_KEY` ou `ASAAS_WEBHOOK_TOKEN` no frontend/bundle
3. Todas as credenciais do Asaas são acessadas exclusivamente via `Deno.env.get()` dentro das Edge Functions
4. O arquivo `.env` na raiz do projeto contém apenas variáveis públicas do frontend (Supabase URL e Anon Key)
5. O `.gitignore` já exclui arquivos `.env` do controle de versão

### Rotação de Secrets

Para rotacionar a chave da API:

1. Gere uma nova chave no painel Asaas
2. Atualize o secret: `supabase secrets set ASAAS_API_KEY=nova_chave`
3. As Edge Functions usarão a nova chave automaticamente na próxima invocação
4. Revogue a chave antiga no painel Asaas

Para rotacionar o token de webhook:

1. Atualize o secret: `supabase secrets set ASAAS_WEBHOOK_TOKEN=novo_token`
2. Atualize o token no painel de webhooks do Asaas (Configurações → Webhooks)
3. Verifique que os webhooks continuam sendo recebidos com sucesso

## Ambientes

| Ambiente | `ASAAS_API_URL` | Painel Asaas |
|----------|-----------------|--------------|
| Sandbox (desenvolvimento) | `https://sandbox.asaas.com` | https://sandbox.asaas.com |
| Produção | `https://api.asaas.com` | https://www.asaas.com |

> **Importante:** Use chaves de sandbox durante o desenvolvimento. As chaves de produção só devem ser configuradas no projeto Supabase de produção.
