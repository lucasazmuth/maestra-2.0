# Risco do Spotify no lançamento nacional

**Pergunta que originou este documento:** dá para trocar a busca de artista do Spotify pela
Chartmetric, para não ficar refém do Development Mode num lançamento com milhares de usuários?

**Resposta curta:** trocar de fornecedor **não resolve** e piora em alguns pontos. O risco é
real, mas o remédio é de arquitetura, não de fornecedor. Detalhamento abaixo.

Levantado em 18/08/2026.

---

## 0. ⚠️ Incidente encontrado durante esta investigação (18/08/2026)

Ao testar a busca, o Spotify passou a responder **403** com este corpo:

> `Active premium subscription required for the owner of the app. When the subscription status
> changes, it can take a few hours before requests are allowed again.`

**A conta Spotify dona do app perdeu o Premium ativo**, e isso derruba a busca para TODOS os
usuários, em produção. Verificado que não é código nem credencial: a `spotify-app-token`
continua emitindo token normalmente (HTTP 200); o 403 vem do Spotify ao usar esse token.

**Ação:** reativar o Premium na conta dona do app. A normalização pode levar algumas horas
depois do pagamento, conforme a própria mensagem.

**Por que isso importa para este documento:** a exigência de "app owner com Premium ativo" é
requisito do Development Mode. Ou seja, além do limite de requisições, o Dev Mode embute um
**ponto único de falha comercial**: um cartão vencido na conta pessoal do dono derruba a
plataforma inteira. Para um lançamento nacional, isso é inaceitável — e reforça as ações da
seção 4.

---

## 1. O medo é justificado, mas por um motivo diferente do imaginado

A preocupação era "vou travar num teto de usuários". Não é isso:

- O teto de **5 usuários autenticados** do Development Mode vale só para o fluxo de login do
  usuário (Authorization Code). **A Maestra não usa isso.** A `spotify-app-token` usa
  `grant_type: client_credentials` (app-only, dados públicos), onde não existe "usuário
  autenticado". Ou seja: **não há teto de contas.** Mil usuários não esbarram nesse limite.

O problema real é outro, e mais sério:

- O limite de requisição é **por aplicativo**, numa janela deslizante de 30 segundos.
- Como o app usa Client Credentials, **todos os usuários compartilham o mesmo balde**. Não é
  "cada artista tem sua cota": é uma cota só, dividida por todo mundo ao mesmo tempo.
- A busca é **por digitação** (debounce de 400ms) e vai **direto do navegador para o Spotify**.
  Cada pessoa digitando consome a cota global.

Ou seja: o gargalo não aparece no cadastro nº 6. Aparece quando muita gente digita **ao mesmo
tempo** — exatamente o cenário de um lançamento nacional, em que o tráfego chega concentrado.

## 2. A saída oficial do Spotify está fechada para nós

O caminho natural seria pedir **Extended Quota Mode**. Os requisitos atuais (desde 15/05/2025):

| Requisito | Situação da Maestra |
|---|---|
| Ser pessoa jurídica registrada | ✅ Music Rio Academy LTDA |
| Serviço lançado e ativo | ✅ |
| **Mínimo de 250.000 usuários ativos mensais** | ❌ **inviável no lançamento** |
| Disponível em mercados-chave | parcial |

O requisito de 250 mil MAU cria um problema circular: **é preciso já ser grande para ganhar cota
de crescer.** Não dá para contar com o Extended Quota como plano para o lançamento.

⚠️ E fechou mais uma porta: desde **julho/2026**, a cota do Development Mode passou a ser contada
**por conta de desenvolvedor, não por Client ID**. Criar vários apps para dividir a carga
(gambiarra comum) **não funciona mais** — os 25 apps permitidos por conta dividem o mesmo balde.

## 3. Por que a Chartmetric não resolve

| | Spotify (Client Credentials) | Chartmetric |
|---|---|---|
| Custo | gratuito | **a partir de US$ 350/mês** |
| Limite | não divulgado, por app / 30s | **1 req/segundo (60/min)** |
| Papel hoje | busca + catálogo + identidade | enriquecimento do diagnóstico |

**1 requisição por segundo é pior que o Spotify para busca por digitação.** Com mil pessoas
digitando, 60 req/min é um funil muito mais estreito. Trocar a busca para a Chartmetric
transformaria um risco em uma certeza de fila — e ainda pago.

Existe um agravante estrutural: hoje a Chartmetric é resolvida **a partir do ID do Spotify**
(`/api/artist/spotify/{id}/get-ids`, ver `artist-diagnostic/index.ts`). O `spotify_artist_id` é
a chave externa do perfil: está na coluna `artists.spotify_artist_id`, alimenta o catálogo de
músicas e é o que amarra o diagnóstico. Trocar a busca não trocaria só a busca — mudaria a
identidade do artista no sistema inteiro.

## 4. O que de fato reduz o risco (por ordem de impacto)

O ganho não vem de trocar de API. Vem de **parar de mandar o navegador de cada usuário falar
direto com o Spotify**.

### 4.1. Mover a busca para uma Edge Function (maior impacto)

Hoje: `navegador de cada usuário → api.spotify.com`. N usuários = N conexões independentes
martelando a cota global, sem ninguém coordenando.

Proposto: `navegador → edge function → api.spotify.com`, com:

- **Cache compartilhado por termo normalizado.** Busca de artista tem cauda longa (cada um
  procura o próprio nome), mas tem repetição real em prefixos (`a`, `an`, `ani`...) e em nomes
  populares. Cachear por `lower(trim(q))` com TTL de horas corta uma fatia relevante.
- **Fila e ritmo globais.** Um único ponto sabe quantas chamadas estão em voo e segura o excesso,
  em vez de mil navegadores descobrindo o 429 cada um por si.
- **Degradação controlada.** Se a cota estourar, a function responde do cache ou devolve uma
  mensagem clara, em vez de espalhar erro na tela de todo mundo.

Bônus de segurança: hoje o access token do Spotify é entregue ao navegador e fica no
`localStorage` (`spotifyToken.ts`). Com o proxy, o token nunca sai do servidor.

### 4.2. Cortar chamadas por usuário (barato e imediato)

- **Mínimo de 3 caracteres** antes de buscar. Hoje qualquer 1 letra dispara — e uma letra só
  gera resultado inútil. Corta as buscas mais numerosas e mais inúteis.
- **Debounce de 400ms → 600/700ms.** Reduz as buscas intermediárias de quem digita devagar.

Só esses dois ajustes derrubam bastante o volume, sem tocar em arquitetura.

### 4.3. Cachear no servidor o que é imutável

O catálogo (`/artists`, `/albums`, `/tracks`) já é cacheado **no IndexedDB de cada navegador**
(`axios.ts`), o que ajuda o usuário recorrente mas **não ajuda a cota**: o primeiro acesso de cada
pessoa ainda vai à rede. Mover esse cache para o servidor (ou para uma tabela, como já se faz em
`artist_chartmetric_raw`) faz o segundo usuário que abrir o mesmo artista custar zero.

## 5. Onde a Chartmetric é a resposta certa

Não como substituta da busca, e sim:

- **Artistas fora do Spotify.** Já existe o caminho "Ainda estou iniciando, não tenho perfil no
  Spotify", que segue funcionando mesmo com o Spotify fora do ar.
- **Plano B de emergência.** Se o Spotify apertar o Dev Mode a ponto de inviabilizar a busca, o
  desenho correto é: buscar na Chartmetric e **extrair dela o `spotify_id`**, preservando a chave
  que o resto do sistema usa. Isso troca o fornecedor da busca **sem migrar a identidade** dos
  perfis — que é o que torna a troca cara.

## 6. Pendências para fechar o plano

1. **Medir antes de otimizar.** Não há hoje instrumentação do volume de chamadas ao Spotify.
   Antes do lançamento, registrar quantas chamadas um cadastro completo consome (busca + detalhe
   + catálogo). Sem esse número, qualquer estimativa de capacidade é chute.
2. **Confirmar o número da cota.** O Spotify **não divulga** o limite exato do Development Mode.
   Vale abrir um ticket no suporte deles perguntando o teto e se um lançamento nacional os faria
   reconsiderar o Extended Quota — o pior que acontece é um não.
3. **Verificar o endpoint de busca da Chartmetric.** A documentação pública (`apidocs.chartmetric.com`)
   não detalha o `/api/search`: não deu para confirmar o formato exato da resposta nem se ela
   devolve o `spotify_id` direto. Isso precisa ser testado com o token real antes de virar plano B
   confiável.

## Fontes

- [Spotify — Quota Modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- [Spotify — Rate Limits](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)
- [Spotify — Changelog julho/2026](https://developer.spotify.com/documentation/web-api/references/changes/july-2026)
- [Chartmetric — Documentação da API](https://apidocs.chartmetric.com/)
