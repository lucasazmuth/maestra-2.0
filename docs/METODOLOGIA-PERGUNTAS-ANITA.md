# Perguntas de metodologia para a Anita — dimensão R (Alcance)

Levantado em 21/08/2026, a partir de um caso real relatado por usuária.

**Nada aqui foi alterado no método.** A classificação alto/baixo, o padrão R.E.A.L, os 16 perfis
e a linha de acender em 70 continuam exatamente como estão no doc. As duas questões abaixo
precisam de decisão sua antes de qualquer mudança.

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
