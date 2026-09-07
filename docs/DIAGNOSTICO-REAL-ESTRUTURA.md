# Diagnóstico REAL — estrutura de cálculo e montagem

Documento de referência do **motor v3** como ele está rodando hoje, não como a especificação
descreve. Onde os dois divergem, está marcado.

Fonte de verdade no código:

| O quê | Onde |
|---|---|
| Motor (cálculo puro) | `packages/core/src/services/realEngine/index.ts` |
| Cópia usada no servidor | `supabase/functions/artist-diagnostic/realEngine.ts` |
| Montagem das entradas | `supabase/functions/artist-diagnostic/index.ts` |
| Perguntas do autorrelato | `packages/core/src/constants/quizDoDiagnostico.ts` |
| Rótulos de exibição | `packages/core/src/constants/realCopy.ts` |
| Testes | `packages/core/src/services/realEngine/realEngine.test.ts` |

As duas cópias do motor foram conferidas e estão **idênticas**. Elas são duplicadas porque o Deno
não importa de fora do diretório da função; qualquer alteração precisa ser feita nas duas.

---

## 1. A ideia em uma página

O REAL mede quatro dimensões independentes. Cada uma **acende ou apaga** segundo sua própria
regra. O padrão de quatro bits, na ordem **R · E · A · L**, endereça um de 16 perfis.

| Dimensão | O que mede | Acende quando |
|---|---|---|
| **R** — Alcance | Tamanho da audiência digital | os 3 componentes presentes estão altos |
| **E** — Receita | Dinheiro que a música gera por mês | receita efetiva ≥ R$ 11.250 |
| **A** — Audiência | Qualidade e conversão dessa audiência | os 4 componentes presentes estão altos |
| **L** — Legitimação | Reconhecimento de mercado e crítica | nota_L ≥ 0,70 **e** ≥1 sinal de plataforma |

Duas réguas atravessam tudo:

- **Alto** = percentil 70 = **z ≥ 0,52**
- **TOP ICON** = percentil 95 = **z ≥ 1,64**

O **TOP ICON global** só é marcado quando as **quatro** dimensões atingem TOP ICON.

---

## 2. De onde vem cada número

### 2.1 Dados de plataforma (Chartmetric)

Buscados no momento do diagnóstico, a partir do ID do Spotify que a artista escolheu.

| Campo do motor | Origem na Chartmetric |
|---|---|
| `spotifyListeners` | `/artist/{id}` → `cm_statistics.sp_monthly_listeners` |
| `spotifyFollowers` | `/artist/{id}` → `cm_statistics.sp_followers` |
| `igFollowers` | `/artist/{id}` → `cm_statistics.ins_followers` |
| `tiktokFollowers` | `/artist/{id}` → `cm_statistics.tiktok_followers` |
| `youtubeMonthlyViews` | `/artist/{id}/stat/youtube_artist?field=monthly_views` |
| `igEngagement` | `/artist/{id}/instagram-audience-stats` → `engagement_rate` |
| `tiktokEngagement` | `/artist/{id}/tiktok-audience-stats` |
| `youtubeEngagement` | `/artist/{id}/youtube-audience-stats` |
| `editorialPlaylists` | `/artist/{id}/spotify/current/playlists` → conta as com `editorial: true` |
| `radioAirplay` | `/radio/artist/{id}/airplay-totals` → soma de execuções, janela de 180 dias |
| `deezerFans` | `/artist/{id}/stat/deezer?field=fans` — **exibição apenas, não entra no índice** |

As taxas de engajamento já chegam **em porcentagem** e não são multiplicadas por 100.

### 2.2 Autorrelato (quiz)

`showsPerMonth`, `cache`, `revenueSources`, `temCnpj`, `temEmpresario`, `premios`,
`imprensaRepercussao`, `imprensaMatrix`, `imprensaFrequencia`, `fazBilheteria`, `pagantePct`.

`investimento` é coletado para o diagnóstico, mas **não entra no índice**.

### 2.3 Regra de ausência de dado

Esta é a regra que mais muda resultado, e tem dois caminhos distintos:

**Sem Spotify conectado** — todo componente de API recebe o **z mínimo da tabela dele**. Não é um
piso único: cada tabela começa num lugar diferente, e usar um piso global fazia "sem dado nenhum"
valer mais que zero. Medindo cada componente contra o piso da própria tabela, o mínimo vira 0.

**Com Spotify, sub-item ausente** — o sub-item **sai da média** do componente, sem punir. Se o
componente inteiro ficar sem dado, ele conta como ausente.

**Componente ausente sai da conta da dimensão**, e ela é reponderada sobre o que existe. Vale
para R e para A. A razão é simetria: sem isso, quem não faz show com bilheteria teria o
"% público pagante" ausente e **nunca** poderia acender o A, por melhores que fossem os outros
três. Se *tudo* estiver ausente, a lista cheia é usada de volta, porque `[].every()` é `true` em
JavaScript e acenderia a dimensão sobre lista vazia.

Atenção: **canal presente com número ruim continua contando.** Só o realmente ausente é ignorado.

---

## 3. R — Alcance

Três componentes de peso igual (⅓).

| Componente | Entrada |
|---|---|
| Ouvintes mensais | `spotifyListeners` |
| Seguidores de rede | média dos z de `igFollowers` e `tiktokFollowers` |
| Consumo de vídeo | `youtubeMonthlyViews` |

Views do TikTok foram descartadas: o número é acumulado, não mensal.

### Tabelas de z

**Ouvintes mensais**

| até | 1k | 5k | 20k | 100k | 500k | 1M | 5M | 20M | acima |
|---|---|---|---|---|---|---|---|---|---|
| z | −1,5 | −1,2 | −0,9 | −0,6 | −0,3 | 0,0 | 0,8 | 1,7 | 2,4 |

**Seguidores de rede (IG e TikTok)**

| até | 1k | 5k | 20k | 100k | 500k | 1M | acima |
|---|---|---|---|---|---|---|---|
| z | −1,2 | −0,7 | −0,2 | 0,5 | 1,2 | 1,8 | 2,4 |

**Vídeo (YouTube, views/mês)**

| até | 10k | 50k | 200k | 1M | 5M | 20M | acima |
|---|---|---|---|---|---|---|---|
| z | −1,2 | −0,7 | −0,2 | 0,5 | 1,2 | 1,9 | 2,5 |

> **Divergência da spec.** As faixas de ouvintes acima de 1M (5M → 1,7 e 20M → 2,4) **não estão no
> documento**; foram acrescentadas porque o teto impresso de z = 0,8 tornava o TOP ICON de R
> (z ≥ 1,64) — e portanto o TOP ICON global — matematicamente inalcançável. Nenhuma faixa impressa
> foi alterada. Está marcado `[PROPOSTA]` no código, pendente de calibração.

**Acende** com os três componentes presentes altos. **TOP ICON** com os três em z ≥ 1,64.

---

## 4. E — Receita

```
receita_shows    = shows_por_mês × cachê_médio
receita_total    = receita_shows + faturamento_fora_shows
modulador        = 1 − (0,10 se NÃO tem empresário) − (0,05 se NÃO tem CNPJ)
receita_efetiva  = receita_total × modulador
```

O modulador é um desconto por falta de estrutura: sem empresário e sem CNPJ, o multiplicador é
0,85.

- **Acende** com receita efetiva ≥ **R$ 11.250/mês**
- **TOP ICON** com receita efetiva ≥ **R$ 50.000/mês**

`faturamento_fora_shows` é a soma das fontes declaradas na pizza de receita, quando existirem;
caso contrário, usa o número único informado.

---

## 5. A — Audiência

Quatro componentes de peso igual (25%). Nenhum deles é z contínuo: são todos **limiares**.

| Componente | Alto | TOP ICON |
|---|---|---|
| Conversão (seguidores ÷ ouvintes Spotify) | ≥ 0,25 | ≥ 0,333 |
| Engajamento por rede (≥1 rede acima do corte) | ver abaixo | ver abaixo |
| Shows por mês | > 3 | > 30 |
| % público pagante | faixa 70‑94% ou 95‑100% | faixa 95‑100% |

**Cortes de engajamento, por rede (%)**

| Rede | Alto | TOP ICON |
|---|---|---|
| Instagram | 2,8 | 6 |
| TikTok | 9 | 15 |
| YouTube | 4 | 8 |

O componente de engajamento acende se **qualquer** rede passar do corte.
O "% público pagante" só existe se a artista declarar que faz bilheteria; senão, é ausente.

**Acende** com os quatro componentes presentes altos.

**TOP ICON de A** exige que A acenda **e** que conversão e % pagante estejam ambos no P95. Aqui a
ausência **continua pesando de propósito**: quem não faz bilheteria pode acender o A, mas não marca
TOP ICON nesta dimensão. Foi decisão deliberada — o TOP ICON é a distinção mais rara do método e
não foi afrouxado junto com o resto.

---

## 6. L — Legitimação

Soma ponderada de quatro partes, com renormalização.

| Parte | Peso |
|---|---|
| Prêmios | 0,30 |
| Imprensa | 0,30 |
| Playlists editoriais | 0,20 |
| Rádio | 0,20 |

### Prêmios

| Nível | Significado | Nota |
|---|---|---|
| 0 | Nunca indicada nem premiada | 0,00 |
| 1 | Indicação local/regional | 0,30 |
| 2 | Ganhou local/regional | 0,50 |
| 3 | Indicação nacional | 0,70 |
| 4 | Ganhou nacional | 0,85 |
| 5 | Indicação internacional | 0,95 |
| 6 | Ganhou internacional | 1,00 |

Alto a partir de 0,70 (indicação nacional). TOP ICON a partir de 0,95.

### Imprensa

```
nota = MAIOR peso entre as células marcadas ÷ 100 × multiplicador de frequência   (teto 1,0)
```

É o **maior**, não a média: a matriz mede o **teto** de legitimação alcançado, e marcar um veículo
menor não pode baixar a nota. Volume e recorrência entram pelo multiplicador de frequência.

**Pesos por tipo × porte**

| Tipo | Pequeno | Médio | Grande |
|---|---|---|---|
| Imprensa | 75 | 85 | 100 |
| TV | 80 | 90 | 100 |
| Influenciadores | 50 | 70 | 90 |
| YouTube | 50 | 65 | 80 |
| Podcasts | 30 | 55 | 80 |
| Blogs | 30 | 45 | 60 |

**Multiplicador de frequência:** esporádico 0,80 · lançamento 1,00 · perene 1,30

A nota de imprensa só é calculada se a artista declarou repercussão **e** marcou ao menos uma
célula. Caso contrário, é 0.

### Playlists e rádio

- **Playlists editoriais:** binário. 1 se houver ≥1 playlist editorial, senão 0.
- **Rádio:** binário. 1 se houver execuções. Se for zero ou ausente, **sai da conta** e os pesos
  são renormalizados sobre as três partes restantes.

### Trava de plataforma

`L` só acende com **pelo menos um sinal de plataforma real** — playlist editorial ou rádio —
independentemente da nota. Isso impede acender a dimensão apenas com júri e imprensa.

- **Acende** com nota_L ≥ 0,70 **e** trava satisfeita
- **TOP ICON** exige L aceso **e** prêmio no nível internacional

---

## 7. Boletim 0–100

Cada dimensão recebe uma nota de 0 a 100 com **uma invariante que nunca pode quebrar**:

```
apagada ∈ [0, 70)        acesa ∈ [70, 100]        linha de acender fixa em 70
```

A nota **nunca contradiz** o aceso/apagado. Abaixo do corte o valor é travado em ≤ 69, porque um
arredondamento poderia levar a 70 e exibir "70/100" numa dimensão apagada.

O método de cálculo abaixo do corte muda por dimensão, e a razão é metodológica:

**R — distância até o corte.** Os três componentes são z contínuos, então dá para dizer o quanto
falta. A nota é a média do progresso de cada componente entre o piso da tabela dele e o corte.

> Isto corrigiu um defeito real: pela contagem de altos, uma artista com 556 mil ouvintes e 24 mil
> seguidores tirava **0/100**, porque os dois componentes ficavam logo abaixo do corte e "0 de 2
> altos" vira zero. Com dois componentes, as únicas notas possíveis abaixo do corte eram 0, 35 e
> 69: quem estava encostada no corte recebia a mesma nota de quem não tinha nada, e um seguidor a
> mais podia saltar 35 pontos de uma vez.

**A — contagem de altos.** Os quatro componentes são limiares, não sinais contínuos. Não existe
"quão perto" de *fazer bilheteria*. Contar é a única leitura honesta.

```
apagada:  (nº de altos ÷ nº de componentes) × 70,  travado em ≤69
acesa:    70 + (nº de TOP ICON ÷ nº de componentes) × 30
```

**E — proporção da receita.** Linear de 0 até R$ 11.250 na metade de baixo; de R$ 11.250 a
R$ 50.000 na metade de cima; 100 acima disso.

**L — proporção da nota_L**, usando o **aceso** e não só a nota. Com a trava de plataforma, a
nota_L pode passar de 0,70 sem acender; nesse caso a nota fica travada em ≤ 69 e a invariante se
mantém.

---

## 8. Os 16 perfis

Bits na ordem **R E A L**.

| Padrão | Perfil | Leitura curta |
|---|---|---|
| 1111 | **Icon** | As quatro frentes altas |
| 1110 | **Hit** | Vende, lota e tem digital; falta crítica |
| 1101 | **Spotlight** | Sólida fora dos palcos |
| 1100 | **Digital** | Vive nas plataformas |
| 1011 | **Underpaid** | Entrega muito, recebe pouco |
| 1010 | **Potential** | Gente vê, não vira dinheiro nem crítica |
| 1001 | **Hype** | Buzz sem estrutura |
| 1000 | **Influencer** | Alcance sem conversão |
| 0111 | **Analog** | Consagrada no físico, ausente no digital |
| 0110 | **Rising** | Base do ao vivo funcionando |
| 0101 | **Outlier** | Fatura e é reconhecida, sem palco nem digital |
| 0100 | **Moneymaker** | Fatura sem aparecer |
| 0011 | **Bet** | O setor acredita; o público ainda não |
| 0010 | **Paradox** | Só palco |
| 0001 | **Cult** | Só crítica |
| 0000 | **Beginner** | Ponto de partida |

---

## 9. Pontos em aberto e divergências

### 9.1 Defeito: quem ganhou prêmio internacional é rebaixada

O quiz oferece **sete** níveis de premiação (0 a 6, incluindo "Ganhei prêmio internacional") e a
tabela do motor tem as sete notas. Mas a montagem das entradas **corta em 5**:

```ts
premios: Math.max(0, Math.min(5, Math.round(num0(qz?.premios))))
```
`supabase/functions/artist-diagnostic/index.ts`

Consequências para quem responde "Ganhei prêmio internacional":

- a nota de prêmios vira 0,95 em vez de 1,00, e a nota_L fica 0,015 mais baixa;
- na exibição do relatório, ela aparece como **"Indicação a prêmio internacional"**, um degrau
  abaixo do que respondeu.

O TOP ICON de L continua alcançável, porque o corte é ≥ 0,95. **Recomendo trocar o `5` por `6`.**
Decisão de metodologia, por isso está aqui e não foi alterado por conta própria.

### 9.2 Cortes marcados `[PROPOSTA]`

Foram definidos por julgamento porque a especificação os deixa em aberto, e estão sujeitos a
recalibração:

- as duas faixas de elite de ouvintes acima de 1M (seção 3);
- os cortes de TOP ICON de engajamento (IG 6, TikTok 15, YouTube 8);
- o TOP ICON de shows (> 30/mês).

Todos os cortes estão centralizados no objeto `CUTS`, num único lugar do arquivo, exatamente para
recalibrar sem caçar número espalhado pelo código.

### 9.3 Dados que a Chartmetric não entrega

`igFollowers` volta nulo com frequência para artistas que têm Instagram ativo. Quando isso
acontece, o componente de seguidores de rede fica só com o TikTok, ou some inteiro, e o R é
reponderado. O mesmo vale para as taxas de engajamento. É a maior fonte de imprecisão do
diagnóstico hoje.

### 9.4 Deezer

`deezerFans` é buscado e exibido, mas **não entra em nenhum cálculo** do v3.

---

## 10. Como conferir um resultado

Todo diagnóstico guarda o objeto completo em `artists.content.realIndex`, incluindo:

- `components.r` / `components.a` — cada componente com seu `z`, `high`, `topicon` e `absent`
- `components.l` — as quatro partes e a `notaL`
- `components.e` — receita total, modulador e receita efetiva
- `inputs` — **todas** as entradas que produziram aquele resultado
- `computedAt`

Ou seja, qualquer nota é reconstituível sem reprocessar nada: o `inputs` guardado, passado pelo
motor, reproduz exatamente o mesmo `realIndex`.

Os JSONs crus de cada chamada à Chartmetric ficam em `artist_chartmetric_raw`, por artista e
endpoint.
