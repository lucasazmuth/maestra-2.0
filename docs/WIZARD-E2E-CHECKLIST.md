# Checklist E2E — Planejamento Estratégico (wizard conversacional)

Roteiro de regressão para rodar após qualquer mudança nos prompts do `wizard-ai`,
no orquestrador (`src/pages/Wizard/chat/NytaChat.tsx`) ou na persistência
(`src/pages/Wizard/index.tsx`). Validado em 2026-06-12.

## Pré-requisito

- Artista em onboarding (`content.step` 0). Para resetar um artista de teste:
  ```sql
  update artists set content = jsonb_build_object(
    'step', 0, 'wizardVersion', 2, 'spotifyProfile', content->'spotifyProfile'
  ) where id = '<artist_id>';
  ```
  Reset com o wizard **desmontado** (navegue para `/artists` antes) e limpe a fatia
  `artists` do `persist:root` no localStorage — senão o Redux reidrata o estado antigo
  e regrava por cima.
- `wizard-ai` deployado (MCP `deploy_edge_function`, projeto `tpwmzcgtidaxgxwqfxwf`,
  `verify_jwt: true`).

## Percurso (9 etapas)

1. **Identidade · gêneros** — selecionar 2-3 chips → Confirmar.
2. **Identidade · bio** — escrever no campo (texto livre).
3. **Identidade · visão** — testar "Sugerir com IA": responder as 3 perguntas, **dar um prazo explícito** (ex.: "2 anos").
4. **Identidade · missão** — testar caminho manual (escrever direto).
5. **Identidade · valores** — selecionar chips + adicionar 1 valor próprio.
6. **Objetivos** — selecionar 5 (botão "Fechar meu Top 5" só habilita com exatamente 5).
7. **Quiz SWOT (8 perguntas)** — responder; testar "Escrever do meu jeito" em ao menos 1.
8. **Análise SWOT (board)** — **adicionar uma força à mão** e confirmar (testa `swotUserEdits`).
9. **Quiz Estratégia (6 perguntas)** — responder; testar o botão **← Voltar** (some na 1ª pergunta).
10. **Estratégias** — revisar; opcionalmente testar "Gerar outras".
11. **Priorização** — testar **"Usar sugestão da Nyta"** (pré-preenche e pula pro ranking).
12. **Cronograma** — aprovar.
13. **Resultado** — testar "Regenerar resumo"; depois "Concluir e liberar o painel".

## Critérios de aceite (objetivos)

| # | Critério | Onde verificar |
|---|----------|----------------|
| 1 | **Conclusão persiste**: `content.step = 9` + `executiveSummary` salvo + cronograma com `deadline` | SQL em `artists.content` |
| 2 | **Visão respeita o prazo literal** dado pelo usuário (não troca "2 anos" por "2-3 anos") | bolha de proposta |
| 3 | **Visão/missão/resumo sem clichês** ("potencial máximo", "consolidar presença", "rumo ao sucesso") | textos gerados |
| 4 | **Quiz SWOT não repete** o que já foi respondido (público-alvo, gêneros, o que produz) | enunciados 1-8 |
| 5 | **Quiz SWOT com taxonomia fixa**: 2 Forças, 2 Fraquezas, 2 Oportunidades, 2 Ameaças | enunciados 1-8 |
| 6 | **Toda estratégia tem métrica numérica + canal + prazo** na descrição (não paráfrase da SWOT) | cards de estratégia |
| 7 | **Cruzamentos usam texto integral da SWOT** (sem truncar) + prefixo legível "SO · Ataque" | enunciados do quiz de estratégia |
| 8 | **Cronograma não "adquire" forças**: tarefas exploram capacidades já listadas como força, nunca propõem criar/comprar/desenvolver o que o artista já tem | tarefas do cronograma |
| 9 | **Tarefas começam com verbo de entrega** (Publicar/Enviar/Lançar/Gravar/Agendar) — sem "Análise de…" / "Implementação de…" | tarefas do cronograma |
| 10 | **Itens SWOT adicionados à mão** fluem para o quiz de estratégia e são tratados como fato | `content.swotUserEdits` + enunciados |
| 11 | **Calibração por porte** quando `spotifyProfile.followers` existe (metas coerentes com a base) | objetivos / estratégias |
| 12 | **RAG indexa 1 plano** ao concluir, sem 409 (trigger `auto_index_artist_plan` tolera conflito de título) | `strategic_plans` por `artist_id` |
| 13 | **Gate de qualidade**: resposta lixo ("asdf") ou não-resposta ("não sei") → a Nyta repergunta de forma específica e NÃO avança | bio, visão/missão, entrevista guiada, "Escrever do meu jeito" |
| 14 | **Gate não exagera**: resposta válida curta ("2 anos", "Brasil") passa de primeira, sem repergunta | qualquer texto livre |
| 15 | **Gate não prende**: após 2 reperguntas, a 3ª resposta é aceita mesmo imperfeita (limite `GATE_MAX_ATTEMPTS`) | entrevista guiada |

## Gate de qualidade (action `validateAnswer`)

Cada resposta de texto livre passa por `gemini.validateAnswer` (action `validateAnswer` no
wizard-ai) antes de avançar. Aplicado em: bio, visão/missão manuais, entrevista guiada de
visão/missão, e "Escrever do meu jeito" dos quizzes. Fail-open (erro de rede/IA → aceita).
Limite de 2 reperguntas por pergunta (`GATE_MAX_ATTEMPTS` em `NytaChat.tsx`).

Casos de teste do gate (validados 2026-06-12):
- `asdf qqqq` (bio) → reprovado, repergunta. ✅
- `não sei` / `sei lá` (entrevista) → reprovado, repergunta específica. ✅
- `tanto faz` (3ª tentativa) → aceito, avança (não prende). ✅
- `2 anos` (resposta curta válida) → aprovado de primeira. ✅

## Entrevista adaptativa de visão/missão (action `nextInterviewQuestion`)

O "Sugerir com IA" da visão/missão usa entrevista adaptativa: a 1ª pergunta é fixa
(`INTERVIEW[field].opener` em `nytaPersona.tsx`, latência zero) e as seguintes a IA gera
com base nas respostas anteriores — aprofunda lacunas, nunca repete o já respondido.
Limite `INTERVIEW[field].max` (visão 3, missão 4). Fail-safe: erro → compõe com o que tem.

Critério de aceite: ao responder o opener com um prazo (ex.: "5 anos"), a próxima pergunta
NÃO deve perguntar prazo de novo — deve avançar para público/diferencial.

Caso de teste (validado 2026-06-12, visão):
- Opener "O que quer se tornar?" → respondi "...nos próximos 5 anos, com disco premiado".
- Q2 adaptativa → perguntou **público-alvo** (pulou o prazo, que eu já havia dado). ✅
- Q3 adaptativa → perguntou **diferencial/marca registrada**. ✅
- No limite (3) → compôs a visão cobrindo todas as respostas, com "5 anos" literal. ✅

## Quizzes SWOT/estratégia adaptativos um-a-um (actions `nextSwotQuestion` / `nextStrategyQuestion`)

Os quizzes de diagnóstico (SWOT, 8 perguntas) e cruzamento (estratégia, 6) deixaram de ser
gerados em lote: cada pergunta é gerada UMA POR VEZ com base nas respostas anteriores. A
cobertura é garantida pela área/tipo fixados por índice:
- SWOT: índices 0-1 Forças, 2-3 Fraquezas, 4-5 Oportunidades, 6-7 Ameaças (`SWOT_QUIZ_TARGET=8`).
- Estratégia: índices 0..5 → SO, ST, WO, WT, SO, ST (`STRATEGY_QUIZ_TARGET=6`).

Mecânica (em `script.ts` `quizBeat` + `NytaChat.runPrepare`): `quizBeat` pede a próxima
geração enquanto `questions.length < target` e todas as atuais estão respondidas; ao atingir
o alvo, conclui via `autoPersistStep`. `answerQuiz` só armazena (sem auto-avançar). Fail-safe:
se a geração falhar, encerra o quiz com o que tem. Contador exibido é `(idx+1)/target`.

Critérios de aceite:
- Cobertura por área/tipo respeitada (validar `swotQuizQuestions`/`strategyQuizQuestions` no banco).
- Cada pergunta adapta às respostas (ex.: "Qual **outra** força?", não repete opção já escolhida).
- Cruzamentos usam texto integral da SWOT + prefixo "SO · Ataque —" etc.
- Ao concluir cada quiz, o step avança (SWOT→3, estratégia→5) e a etapa seguinte gera normalmente.

Caso de teste (validado 2026-06-12):
- SWOT: 8 perguntas geradas 1-a-1, ordem Força/Força/Fraqueza/Fraqueza/Oport./Oport./Ameaça/Ameaça,
  com frases adaptativas ("outra força", "outra fraqueza"). step→3, board OK. ✅
- Estratégia: 6 perguntas, tipos SO/ST/WO/WT/SO/ST, texto integral da SWOT, legenda. step→5,
  6 estratégias geradas. ✅

**Nota de UX**: há ~1-2s de geração entre cada pergunta (typing indicator). É o custo da
adaptatividade (uma chamada de IA por pergunta, vs. uma única no modo lote antigo).

## Linguagem para iniciante leigo (metodologia invisível)

O objetivo é o leigo se sentir conduzido por alguém que entende, não examinado por um
framework. A metodologia (SWOT/TOWS/priorização) opera por baixo, mas NÃO aparece na tela.

Regras implementadas:
- **Labels das etapas** sem jargão (`STEP_LABELS` em `script.ts`): Identidade, Metas,
  Diagnóstico, Seu retrato, Caminhos, Estratégias, Prioridades, Cronograma, Seu plano.
  Nada de "Quiz SWOT", "Análise SWOT", "Priorização".
- **Sem códigos SO/ST/WO/WT nem "Ataque/Defesa"** na tela: removidos da legenda, dos cards
  de estratégia e da priorização; as perguntas de cruzamento são geradas em linguagem plana
  (`nextStrategyQuestion` no wizard-ai instrui "o ARTISTA NAO PODE VER NADA DISSO").
- **Priorização pré-preenchida**: `PriorityScale` busca a sugestão da Nyta no mount e cai
  direto na ordem pronta; o leigo nunca encara a grade de 25 notas (ajuste é opcional).
- **Sem números de prioridade crus** ("prioridade 34") no ranking nem no resumo.
- **Micro-explicações "por que isso importa"** nas falas (`SAY` em `nytaPersona.tsx`) antes
  de diagnóstico, caminhos e priorização; visão×missão com diferença explicada.
- **Markdown renderizado** nas bolhas e no resumo (`ChatMarkdown` via react-markdown);
  o resumo usa **negrito** e listas.
- **Sem travessão (—)** nas falas da IA: removido das `SAY` e proibido nos prompts
  conversacionais (interview, reask, quizzes, visão/missão, resumo).

Critérios de aceite (varredura no DOM da conversa, validados 2026-06-12):
- `temTravessao: false`, `temSWOT: false`, `temCodigoSOST: false`, `temPrioridadeNum: false`,
  `temAsteriscoCru: false` (markdown renderiza). ✅
- Label da etapa de cruzamentos = "CAMINHOS"; perguntas sem siglas. ✅
- Priorização cai direto em "Sua ordem de prioridade" (pré-preenchida). ✅
- Resumo com títulos em negrito e listas; banco: step 9, executiveSummary salvo. ✅

### Refino do phrasing das perguntas de cruzamento (`nextStrategyQuestion`, wizard-ai v14–v16)

O molde único "Você tem [X]" quebrava nas fraquezas ("Você tem falta de shows", torto e
ilógico). Agora cada tipo de cruzamento tem um **molde de fala próprio** no prompt, com as
fraquezas enquadradas com leveza:
- SO: "Você manda bem em [FORÇA]. Como usar esse ponto forte pra aproveitar [OPORTUNIDADE]?"
- ST: "[FORÇA] é um trunfo seu. Como usar isso a seu favor pra lidar com [AMEAÇA]?"
- WO: "Um ponto que dá pra melhorar é [FRAQUEZA]. O que você pode fazer pra não deixar passar [OPORTUNIDADE]?"
- WT: "Hoje [FRAQUEZA] ainda pesa, e isso te deixa exposto a [AMEAÇA]. Qual seria um primeiro passo pra se proteger?"

Cada tipo também tem um EXEMPLO de tom no prompt. Proibido explicitamente "Você tem falta de",
"Você é fraco em", "Sua fraqueza é". Moldes/exemplos escritos COM acentuação correta de
propósito (ancoram o Groq, que sem isso tende a omitir acentos); regra reforçada exigindo
"TODOS os acentos".

Critérios de aceite (validados 2026-06-12 no preview, AZMUTH BEATS seed step 4):
- Todos os 6 cruzamentos saem em frase natural de consultor, sem "Você tem falta de", sem
  siglas, sem travessão; fraquezas com leveza. ✅
- Acentuação completa nas perguntas (você, música, é, está, experiência, lançamentos). ✅
- WO/WT logicamente coerentes (endereçar a fraqueza p/ capturar a oportunidade ou se proteger
  da ameaça), não "usar uma fraqueza para aproveitar algo". ✅

> **Deploy**: o `wizard-ai` é deployado pelo MCP com o conteúdo inline do repo. A partir do v16,
> o conteúdo deployado é o arquivo do repo **verbatim** (repo = produção); evite "limpar"
> strings ao transcrever para o deploy, pra não criar divergência repo↔produção.

### RAG nas opções dos quizzes (wizard-ai v17)

As actions adaptativas `nextSwotQuestion` e `nextStrategyQuestion` passaram a usar a base de
conhecimento (`searchSimilarPlans` + `formatReferenceContext`) — antes não usavam (só o SWOT/
objetivos do artista). Agora as OPÇÕES dos quizzes são ancoradas em estratégias de planos reais
de artistas similares (115 planos aprovados, ~109 de consultoria humana), filtrados por
segmento/porte, e o prompt instrui **calibrar ao porte/estágio** do artista (nunca copiar).

- `nextStrategyQuestion` passou a receber `identity` + `spotify` (antes só `swot`/`objectives`)
  pra alimentar o RAG; `gemini.nextStrategyQuestion` e a chamada em `NytaChat` foram atualizados.
- Adicionado `calibrationContext` no prompt de cruzamentos.

Critérios de aceite (validados 2026-06-12 no preview, AZMUTH BEATS / MPB / iniciante):
- RAG roda: chamada do wizard-ai em ~2.3s (vs ~0.5s sem RAG), status 200 nos logs. ✅
- Opções mais concretas/decisórias (ex.: ST renda → "oferecer serviços de produção",
  "cursos online", "merchandising"). ✅
- Calibração ao estágio: WO shows → "eventos locais"/"agenda de shows" (não "festivais
  nacionais", que é o que a base traz pra artistas médios/consolidados). ✅

> **Nota honesta**: pra artista INICIANTE o efeito visível é sutil (o modelo já gerava opções
> contextuais, e estratégias avançadas da base são suavizadas pro estágio). O ganho é mais
> evidente em artistas médios/consolidados, onde a base é mais densa. As referências são
> anonimizadas (sem nome de artista), igual ao RAG já usado nas demais etapas.

### Nível consultor sênior (wizard-ai v18)

Teste E2E crítico (Marina das Cordas, MPB, 12k seguidores, medium) revelou que o teto de
qualidade era a profundidade do SWOT e a perda da visão no caminho. Correções:

- **Oportunidades estratégicas (sem filler)** em `nextSwotQuestion`: proibido opção que é só o
  nome de uma plataforma ("YouTube Music"); cada opção de oportunidade é uma abertura concreta
  de mercado (festivais, editais/leis de incentivo, playlists editoriais, parcerias com
  consagrados, assessoria de imprensa, sincronização), ancorada no RAG. Ameaças reais e atuais
  (sem pandemia), sem repetir.
- **Visão/missão como âncora obrigatória** em `createObjectives` e `createStrategies`: pelo
  menos um objetivo/estratégia DEVE endereçar os alvos concretos da visão (festivais nominais,
  região, público). Cobre o espectro de um plano sênior (posicionamento, lançamentos, shows/
  festivais, mídia/parcerias, monetização, base de fãs), não só crescimento digital. Considera
  as alavancas das consultorias reais (branding, media kit, assessoria, prospecção de festivais/
  editais, captação de leads). Números realistas (EP = 4-6 faixas, sem falsa precisão).
- **Acentos do resumo** em `createFinalResult`: títulos "Onde você está hoje" / "Próximos 90 dias".

Critérios de aceite (validados 2026-06-12 no preview):
- Metas trazem os festivais da visão: "2 apresentações em festivais como o Coala e o Rec-Beat". ✅
- Espectro sênior nas metas (festivais, parcerias/marcas, lançamentos, base de fãs, digital). ✅
- "10 faixas/EP" virou "1 EP com 5 faixas". ✅
- Oportunidades do SWOT sem filler de plataforma; todas estratégicas (festivais, editais,
  playlists, consagrados, parcerias). ✅

### Objetivos como PILARES (formato da consultoria real) — wizard-ai v19

A base real estrutura objetivos como pilares curtos (O1-O5): "Ampliar a agenda de shows",
"Ampliar os resultados digitais", "Gerar resultados financeiros", "Produzir músicas que gerem
conexão". O nosso gerava frases SMART longas e formulaicas ("Atingir 30.000 seguidores em 12
meses, por meio de..."), liderando com métrica de vaidade (seguidores/popularidade/engajamento)
— que na consultoria real é KPI, nunca objetivo. Daí a sensação de "mesmo formato pra todos".

`createObjectives` reescrito: objetivos = PILARES concisos (4-12 palavras), distintos e sem
sobreposição; PROIBIDO métrica de vaidade como objetivo (o número fino vai pras estratégias);
âncora na visão. (`formatReferenceContext` passou a mostrar 6 objetivos de referência, não 4.)

Critérios de aceite (validados 2026-06-12, Marina das Cordas, v19):
- Objetivos viraram pilares curtos: "Consolidar agenda de shows no Sudeste", "Ampliar presença
  em festivais como Coala e Rec-Beat", "Produzir músicas que gerem conexão com o público
  feminino", "Aumentar receita por meio de shows e merchandising". ✅
- `temVaidade: false` (sem "atingir 30.000 seguidores" como objetivo). ✅
- Resumo final: "Próximos 90 dias" com acento. ✅

### Âncora da visão nas estratégias = requisito HARD (wizard-ai v20)

O GAP do v19 (festivais nos objetivos/SWOT mas não nas estratégias) foi fechado em duas camadas:
1. **Prompt**: a regra de âncora da visão em `createStrategies` virou "REQUISITO NAO-NEGOCIAVEL,
   com PRIORIDADE sobre cobrir todos os cruzamentos" + "comece a lista por essa estratégia".
2. **Validação pós-geração + retry** (mesmo padrão do anti-vagueza): se a visão/missão contém
   `/festiv/i` e nenhuma estratégia gerada menciona festival, regenera UMA vez exigindo
   obrigatoriamente uma estratégia de prospecção/aplicação a festivais.

Critério de aceite (validado 2026-06-12, Marina das Cordas, v20):
- Estratégias passaram a incluir, como PRIMEIRA, "Festivais de música" citando Coala e Rec-Beat
  (pitch via SubmitHub/Groover, 10 placements, 9 meses). `temFestival: true`. ✅
- 5 estratégias em dimensões distintas (festivais, parcerias, gestão, receita, playlists). ✅

> Polimento pendente (model-side, não estrutural): o phrasing da estratégia de festival às vezes
> mistura "prospecção de festival" com "pitch de playlist". A âncora dispara corretamente; só a
> redação pode ser refinada no prompt se quiser.

### Teste-benchmark vs plano REAL da base (Zanna, wizard-ai v20)

Recriamos o perfil de uma artista real da base (Zanna: MPB contemporânea, 38k seg, medium/
established, ambição internacional + vibe wellness) e rodamos o walk completo, comparando a
saída da IA com o plano REAL da consultoria humana.

**Visão gerada vs real**: praticamente equivalente ("referência da música brasileira
contemporânea, obra atemporal que atravessa gerações, exterior/internacional, bem-estar"). ✅

**Objetivos (pilares) vs os O1-O6 reais**: 4-5 de 6 batem (digital global, shows internacionais,
mídia, exposição/exterior, parcerias). Gap: faltou um pilar financeiro/monetização explícito (O5
real). ✅⚠️

**Oportunidades do SWOT**: todas internacionais e estratégicas (festivais Europa, assessoria de
imprensa internacional, playlists editoriais, produtores globais), sem filler. ✅

**Estratégias vs as 25 reais**: acertou os TOP levers da consultoria — Identidade Visual Única
(= branding/direção de imagem), Festivais de MPB na Europa (= prospecção de festivais/showcases),
Parcerias Internacionais (= feat/parcerias), Diversificação de Receitas em moedas (= resultados
financeiros, amarrado à ameaça do dólar). Todas concretas (métrica+canal+prazo). Gap: a cauda
longa de um plano de 25 estratégias (assessoria de imprensa, editais/leis de incentivo,
sincronização, rádio) não cabe em 4-6. ✅⚠️

**Veredito**: nas etapas validadas, a IA entrega plano de nível sênior, aderente à metodologia
real, calibrado ao perfil (internacional) e ao risco (dólar). Pontos a evoluir: (1) garantir um
pilar de monetização nos objetivos; (2) opcionalmente, gerar mais estratégias (6-8) para cobrir
a cauda longa de levers que a consultoria real usa.

### Fechando os 2 gaps + teste com multi-seleção (wizard-ai v21)

1. **Pilar financeiro obrigatório** em `createObjectives` (regra 3b): todo conjunto de objetivos
   DEVE ter um pilar de monetização/resultados financeiros (como nos planos reais).
2. **6-8 estratégias** em `createStrategies` (era 4-6), com instrução para DISTRIBUIR entre
   dimensões diferentes e cobrir as alavancas profissionais (assessoria, editais, sincronização,
   rádio, branding, financiamento coletivo). `formatReferenceContext` mostra 6 estratégias de
   referência (era 4).

Re-teste Zanna (v21) com **múltiplas opções por pergunta** (como um humano real faz, não 1 só):
- Objetivos: 6 pilares, agora **incluindo "Gerar Resultados Financeiros Sustentáveis"** —
  cobrindo os 6 O's reais da Zanna. `temPilarFinanceiro: true`, `temVaidade: false`. ✅
- Multi-seleção no SWOT gerou um retrato bem mais rico (5 forças / 4 fraquezas / 5 oportunidades
  / 4 ameaças = 18 itens, vs 12 do single-select). ✅
- Estratégias: **7** geradas (Festivais Internacionais, Parcerias DJs Globais, **Assessoria de
  Imprensa**, Plataformas Digitais, Playlists Editoriais, Parcerias Consagrados, Equipe de
  Gestão) — cobrindo ~7 dos top levers reais, incluindo a assessoria de imprensa que faltava. ✅
- Cronograma com 7 estratégias (21 tarefas), prioridade e resumo OK; banco: step 9, 5 metas,
  7 estratégias, pilar financeiro presente. ✅

> Nota de teste: marcar 1 só opção por pergunta (como eu fazia para ir rápido) subestima a
> qualidade — o usuário real marca várias, o que enriquece o SWOT e o plano. Testar sempre com
> multi-seleção.
> Polimento pendente (model-side): as descrições às vezes usam "utilizando a plataforma de X"
> genérico em vez de citar a ferramenta real (SubmitHub, etc.); dá pra apertar no prompt.

### Seleção do quiz: múltipla + opção própria (`QuizOptions`)

`QuizOptions` (`widgets.tsx`) vale para os dois quizzes (diagnóstico e caminhos). Comportamento
(não depende mais do flag `multi` da IA):
- Clicar numa opção **marca/desmarca** (toggle), nunca auto-avança.
- "Escrever do meu jeito" abre um campo inline; "Adicionar" insere a opção do artista como um
  chip selecionado, **somado** às marcadas (não substitui). No sucesso o campo se **fecha**
  (pra adicionar outra, toca "Escrever do meu jeito" de novo); na reprovação fica aberto.
- **Gate de qualidade na opção própria** (`validateCustom` → `gemini.validateAnswer`): antes de
  virar chip, a opção escrita passa pelo mesmo gate das respostas digitadas. Lixo/não-resposta é
  barrado com um reask gentil inline (âmbar) e NÃO entra; o texto fica no campo para o artista
  ajustar. Fail-open no erro de rede. Selecionar opções da IA não passa pelo gate (já são válidas).
- "Confirmar (N)" envia todas as escolhas juntas (`join('; ')`); habilita com ≥1 selecionada.
- "← Voltar" disponível a partir da 2ª pergunta.

Critérios de aceite (validados 2026-06-12 no preview):
- Marcar 2 opções mantém ambas e mostra "Confirmar (2)", sem pular de pergunta. ✅
- Campo custom adiciona "Parcerias com podcasts de cultura" como 3º chip; "Confirmar (3)". ✅
- Resposta enviada = "opção A; opção B; opção própria"; avança para a próxima pergunta. ✅
- Opção própria "asdf kkk" é barrada pelo gate (reask inline, sem chip); "Fechar parcerias com
  playlists colaborativas de MPB" passa e vira chip. ✅

## SQL de verificação pós-conclusão

```sql
select
  content->>'step' as step,                                   -- esperado: 9
  length(content->>'executiveSummary') > 100 as tem_sumario,  -- true
  (select count(*) from json_array_elements(content->'strategies') s,
     json_array_elements(s->'tasks') t where t->>'deadline' is not null) as tarefas_com_prazo, -- 18 (6×3)
  content->'swotUserEdits' as user_edits,
  (select count(*) from strategic_plans where artist_id = '<artist_id>') as plano_rag -- 1
from artists where id = '<artist_id>';
```

## Notas de armadilhas conhecidas

- **Cliques no mesmo tick**: selecionar chips e clicar "Confirmar" no mesmo `eval`/tick às
  vezes engole o último clique (React batching). Em automação, separe em passos.
- **Re-persist do Redux**: o `persist:root` reidrata `artists`; resete a fatia antes de
  recarregar para refletir mudanças feitas direto no banco.
- **Trigger de RAG**: `auto_index_artist_plan` insere em `strategic_plans` quando
  `step` cruza ≥7. O índice `UNIQUE(title) WHERE status<>'rejected'` já causou 409 que
  travava a conclusão; o trigger agora ignora `unique_violation` (best-effort).
