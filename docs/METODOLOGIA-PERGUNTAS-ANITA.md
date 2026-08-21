# Perguntas de metodologia para a Anita

Levantado em 21/08/2026, a partir de casos reais testados na plataforma.

**Nada aqui foi alterado no método.** A classificação alto/baixo, o padrão R.E.A.L, os 16 perfis
e a linha de acender em 70 continuam exatamente como estão no doc. As questões abaixo precisam
de decisão sua antes de qualquer mudança.

A primeira parte trata da dimensão R (Alcance). A segunda, acrescentada depois de testarmos com
João Gomes e Anitta, trata do A (Audiência) e do L (Legitimação).

---

## O caso que originou

Uma artista com **556 mil ouvintes mensais no Spotify** e **24 mil seguidores no Instagram**
recebeu **R = 0/100**, com a mensagem "Faltam 70 pts para acender".

Investigado: **não é bug de dados nem de integração.** O cálculo está fazendo o que o método
manda. Mas o resultado exibido é difícil de defender para quem tem esses números.

## Questão 1 — a faixa de 20k a 100k seguidores fica 0,02 abaixo do corte

Na tabela de `socialFollowers` (§4.2), a faixa **20.000 a 100.000** seguidores mapeia para
**z = 0,50**. O corte de "alto" é **HIGH_Z = 0,52** (percentil 70).

A diferença é de **0,02**.

Consequência: **nenhum artista entre 20 mil e 100 mil seguidores pode ter esse componente alto**,
por definição. A faixa inteira é inelegível — 99.999 seguidores dá o mesmo resultado que 20.001.

**A pergunta:** isso é intencional? Se a leitura é "essa faixa está logo abaixo do percentil 70",
faz sentido estatístico e está correto. Mas se a intenção era que essa faixa acendesse, bastaria
z = 0,52. A margem de 0,02 é pequena o suficiente para levantar a dúvida, e a decisão muda o
diagnóstico de milhares de artistas nessa faixa.

Mesma pergunta, em menor grau, para `spotifyListeners`: a faixa **500 mil a 1 milhão** mapeia para
**z = 0,0** (a mediana). Ou seja, é preciso passar de **1 milhão** de ouvintes para o componente
acender. É esse o patamar pretendido?

## Questão 2 — a nota exibida não tinha granularidade abaixo do corte

Esta a gente já ajustou, mas você precisa saber e validar.

**Como era:** a nota do R abaixo do corte era `(n_componentes_altos / n) × 70`. Com 2 componentes,
as únicas notas possíveis eram **0, 35 e 69**. Quem estava encostado no corte recebia **a mesma
nota** de quem não tinha nada, e um seguidor a mais podia saltar 35 pontos de uma vez.

Medido antes da mudança:

| Ouvintes | Instagram | R |
|---|---|---|
| 556 mil | 24 mil | **0** |
| 556 mil | 99 mil | **0** |
| 556 mil | **100 mil** | **0** |
| 556 mil | 101 mil | 35 |
| **1 milhão** | 24 mil | **0** |
| 1,1 milhão | 24 mil | 35 |

Um artista com 1 milhão de ouvintes e 100 mil seguidores tirava zero.

**Como ficou:** abaixo do corte, a nota passou a refletir a **distância até o corte** em vez da
contagem de altos. Cada componente contribui com o quanto caminhou entre o piso da escala
(z = −1,5) e o corte (z = 0,52); a média vira a nota, ainda travada em ≤ 69.

| Caso | Antes | Depois |
|---|---|---|
| 1k ouvintes, 1k seguidores | 0 | 5 |
| **556 mil, 24 mil (o caso relatado)** | **0** | **61** |
| 1,1M + 101k (acende) | 70 | 70 |
| 38,8M + 61,2M + YouTube | 100 | 100 |

**O que NÃO mudou:** a classificação alto/baixo, o padrão, o perfil, e a invariante §9.1
(nota ≥ 70 se e somente se a dimensão acende). Só o número exibido abaixo do corte mudou.

**Por que só o R e não o A:** os três componentes do R (ouvintes, seguidores, vídeo) são escalas
contínuas — dá para medir "quão perto". Os quatro do A (conversão, engajamento, shows/mês, %
pagante) são limiares: não existe "quase faz bilheteria". Para o A, contar continua sendo a
leitura honesta, então ele ficou como estava.

**A pergunta:** o piso da régua está em z = −1,5 (o menor z das tabelas). Concorda com esse
ponto de partida, ou o zero deveria estar em outro lugar?

## Efeito sobre quem já tem diagnóstico

O `realIndex` fica salvo no perfil do artista, então diagnósticos já entregues não mudariam
sozinhos. Para não deixar dois artistas com os mesmos números exibindo notas diferentes conforme a
data, **a base foi recalculada em 21/08/2026**.

O que a passagem fez, em 63 diagnósticos na versão 3:

| | |
|---|---|
| Artistas com o R alterado | **30** |
| Artistas sem nenhuma alteração | 33 |
| Mudanças de perfil | **0** |
| Mudanças de padrão R.E.A.L | **0** |
| Violações da invariante §9.1 | **0** |

Nenhuma nota nova passou de 69, então **ninguém acendeu uma dimensão que estava apagada**. A
mudança é só de granularidade abaixo do corte, como descrito na Questão 2. Os 28 que continuam com
R = 0 têm no máximo 810 ouvintes mensais e nenhuma rede cadastrada — estão no piso da régua, e zero
é a leitura correta.

O `realIndex` anterior de todos os artistas foi copiado para a tabela `realindex_backup_20260821`
antes da escrita, então a passagem é reversível.

### Um efeito colateral encontrado no caminho

Em 02/07/2026 a escala de premiações ganhou um nível (a opção "prêmio local/regional" foi separada
da indicação). Dois diagnósticos feitos **horas antes** dessa mudança guardaram o índice na escala
velha, onde `5` era o topo; na escala de hoje, `5` é o penúltimo. Recalcular sem tratar isso
rebaixaria a resposta dessas duas artistas de "prêmio máximo" para um degrau abaixo. O índice foi
convertido para a escala atual antes do recálculo, e a nota de Legitimidade delas ficou intacta.

### Dois perfis ficaram de fora, e é proposital

**Roberta Sá** e **Bento Gil** têm diagnósticos anteriores à versão 3, guardados num formato de
respostas diferente. Não é o caso de recalcular: faltam **18 dos 19 campos** que a versão 3 usa no
primeiro caso e **7** no segundo. Rodar o motor atual em cima desses dados daria resultado
inventado — a Roberta Sá cairia de **Icon para Beginner**, com a Legitimidade sem valor nenhum,
porque a receita dela está gravada como faixa de texto ("Acima de R$ 50.000") e a imprensa como
frase, não como os números que a versão 3 exige.

Esses dois precisam **refazer o diagnóstico** na plataforma para entrar na versão 3. Migrar na
marra seria trocar um resultado correto por um errado.


---

# Parte 2 — dimensão A (Audiência): nenhum artista grande consegue acender

Testamos a plataforma com **João Gomes** e **Anitta**. Os dois receberam **A = 53/100 (Baixo)**.

## O que aconteceu

O A tem quatro componentes e exige que **os quatro** estejam altos para acender — é um "E", não uma
soma. João Gomes tem três altos e um baixo:

| Componente | João Gomes | Situação |
|---|---|---|
| Conversão (seguidores ÷ ouvintes) | 8,3 mi seguidores Spotify | **Alto** (e Top Tier) |
| Shows por mês | 25 | **Alto** |
| % público pagante | 95–100% | **Alto** (e Top Tier) |
| Engajamento por rede | IG 1,14% · TikTok 1,28% · YT 0,03% | **Baixo** |

O engajamento é o único que não passa, e por isso o A não acende. Como o perfil **Icon** exige as
quatro dimensões acesas, ele fica de fora.

Verificamos o efeito: **se o engajamento dele passasse do corte, ele seria Icon**, com A = 85 e Top
Tier geral. O engajamento sozinho é o que separa o maior artista do país do perfil que descreve
exatamente a carreira dele.

## Por que isso não é um caso isolado

Os cortes de engajamento são fixos (IG 2,8%, TikTok 9,0%, YouTube 4,0%), **independentes do tamanho
do público**. Mas taxa de engajamento cai conforme a audiência cresce — é assim em qualquer rede, e
aparece na nossa própria base:

| Seguidores no Instagram | Artistas | Engajamento médio |
|---|---|---|
| até 10 mil | 4 | **2,63%** |
| 10 mil a 100 mil | 6 | 1,36% |
| 100 mil a 1 milhão | 4 | 1,38% |
| acima de 1 milhão | 6 | **0,95%** |

A amostra é pequena, mas a direção é clara: quem tem mais público engaja proporcionalmente menos.
Um corte fixo, então, penaliza sistematicamente quem cresceu.

O resultado na base inteira (64 diagnósticos):

| Dimensão | Quantos acendem |
|---|---|
| E (Receita) | 22 |
| L (Legitimação) | 7 |
| R (Alcance) | 6 |
| **A (Audiência)** | **1** |
| **TOP ICON (as quatro)** | **0** |

**As perguntas:**

1. O A deveria mesmo exigir os quatro componentes altos, quando R e L trabalham com soma ponderada
   e renormalização? Hoje o A é a única dimensão que funciona como "E" — e é, de longe, a mais
   difícil de acender.
2. O corte de engajamento deveria variar conforme a faixa de público? Um artista com 17 milhões de
   seguidores e 1,1% de engajamento tem, em números absolutos, muito mais gente respondendo do que
   um com 5 mil seguidores e 3%.
3. O corte do YouTube (4,0%) parece alto para a escala real do dado: a mediana da nossa base é
   **0,13%**, e o valor mais alto que já vimos foi 9,4%. Confirmamos que não é erro de unidade — é
   a escala que a Chartmetric entrega. Esse patamar de 4% foi calibrado para essa escala?

# Parte 3 — dimensão L: o teto de 98 é real, mas vale confirmar

João Gomes e Anitta receberam **L = 98/100**, e a pergunta que surgiu foi se estava travado.

**Não está.** Os dois foram cadastrados com premiação no nível **"indicação internacional"**. Só o
nível acima — **ter ganhado** prêmio internacional — leva o L a 100, e verificamos que leva: mudando
só esse campo, o L vai a 100 exatamente.

Ou seja, o comportamento está correto: uma indicação não vale o mesmo que uma vitória. Fica só o
registro para você confirmar que é essa a intenção, já que na prática significa que **nenhum artista
brasileiro sem prêmio internacional conquistado pode ter L = 100**, por mais imprensa, playlist e
rádio que tenha.

Um detalhe técnico à parte, que não é decisão sua: a conta dá exatamente 98,5, e o arredondamento
de ponto flutuante joga para 98 em vez de 99. É 1 ponto, e a correção é trivial, mas mexe em nota
exibida — então fica esperando sua confirmação junto com o resto.

# Parte 4 — um dado que a Chartmetric não tem (não é decisão sua, é registro)

No diagnóstico do João Gomes, "YouTube mensal" apareceu vazio. Não é falha nossa nem da integração:
a Chartmetric respondeu literalmente `{"link": null, "monthly_views": []}` — ela não tem o canal do
YouTube Charts vinculado ao perfil dele. Para a Anitta o mesmo endpoint devolve normalmente (121
milhões de views mensais).

Isso **não prejudicou a nota dele**: pela regra de canal ausente (§4.3), o YouTube saiu da conta e o
R foi renormalizado nos outros dois canais, fechando em 100.

Vale registrar, porém, que temos um dado de YouTube que hoje não usamos: o mesmo perfil traz
**5,04 milhões de inscritos** por outro endpoint. **A pergunta:** faz sentido usar inscritos como
substituto quando as views mensais não existem, ou são medidas diferentes demais para se
substituírem (estoque × fluxo)?
