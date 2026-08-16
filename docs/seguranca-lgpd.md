# Desenho de segurança e guarda de dados

Documento de apoio ao art. 46 da LGPD (medidas proporcionais ao risco) e ao protocolo do Comitê de
Ética em Pesquisa. Descreve como a Maestra guarda os dados hoje — não o que se pretende fazer.

Atualizado em 15/08/2026.

## Infraestrutura

A plataforma roda sobre Supabase (PostgreSQL 17 gerenciado) com front-end estático servido pela
Vercel. Todo o tráfego entre navegador e servidores é criptografado (HTTPS/TLS). As senhas são
tratadas pelo Supabase Auth e armazenadas apenas como hash — a aplicação nunca vê a senha em texto
puro, e o login social (Google) não gera senha alguma.

Dados de cartão de crédito **não trafegam nem são armazenados** em nossos servidores: são enviados
diretamente à instituição de pagamento (Asaas), que devolve apenas identificadores e status.

## Isolamento entre usuários

O isolamento é feito no banco, por *Row Level Security* (RLS), e não apenas na interface: cada
tabela com dado de usuário só devolve as linhas de quem consulta, mesmo que a requisição seja
forjada. O acesso a perfis compartilhados com a equipe passa pela função `has_artist_access`, que
confere o nível de permissão do convite.

Operações que precisam atravessar vários usuários (painel administrativo, cobrança, exclusão de
conta) ficam em *edge functions* que rodam com a chave de serviço. Essas funções sempre identificam
quem chamou pelo token de autenticação e, quando administrativas, confirmam a permissão contra a
tabela `platform_admins` antes de qualquer leitura.

As tabelas de consentimento (`user_consents`, `user_compliance`) são um caso especial: têm leitura
restrita ao titular e **nenhuma política de escrita**. Só a chave de serviço grava, o que impede
qualquer manipulação a partir do navegador. `user_consents` tem ainda um gatilho que recusa
`UPDATE`, de modo que a trilha de consentimento só cresce, nunca é reescrita.

## Segredos

Chaves de API (Supabase, Asaas, Chartmetric, Brevo, provedor de IA) ficam em variáveis de ambiente
do Supabase e da Vercel. Não há segredo versionado no repositório: o front-end só recebe a chave
pública (`anon`), cujo alcance é limitado pela RLS.

## Retenção

Conforme a Política de Privacidade: registros de acesso por no mínimo 6 meses (Marco Civil, art.
15) e documentos fiscais por 5 anos. Pedidos de exclusão de conta ficam registrados em
`account_deletion_requests` com data do pedido, prazo de execução e data de cumprimento; a linha
sobrevive à exclusão dos dados justamente para comprovar o atendimento.

## Pontos em aberto

Levantamento automático do Supabase em 15/08/2026 — 121 apontamentos, dos quais os relevantes:

| Gravidade | Apontamento | Situação |
|---|---|---|
| ERRO | `user_account_type` pode expor dados de `auth.users` a papéis `anon`/`authenticated` | **A tratar.** É o mais grave da lista. |
| ERRO | 6 views com `SECURITY DEFINER` (`release_stats`, `user_account_type`, `whatsapp_*`, `user_subscription_pro_details`) | A tratar: rodam com os direitos do dono e ignoram a RLS de quem consulta. |
| INFO | 3 tabelas com RLS ligada e nenhuma política (`access_passes`, `chartmetric_api_calls`, `nyta_daily_usage`) | Sem política, ninguém lê pelo cliente — fecha por padrão, mas convém tornar explícito. |
| AVISO | Proteção contra senhas vazadas desativada no Supabase Auth | Ligar no painel: bloqueia senhas conhecidas em vazamentos públicos. |
| AVISO | 42 funções com `search_path` mutável | Risco baixo no uso atual; vale corrigir por higiene. |

Itens que dependem de confirmação de quem administra as contas e não foram verificados por código:

- Quem tem acesso ao painel do Supabase e à conta da Vercel hoje (reduzir ao mínimo e registrar).
- Política de backup do plano contratado (frequência, retenção e criptografia em repouso).
- Registro de acessos administrativos ao banco pelo painel.
