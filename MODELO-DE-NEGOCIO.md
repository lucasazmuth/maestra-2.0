# Maestra Manager — Modelo de Negócio

> Documento de apresentação para sócios. Descreve o produto e o modelo de monetização **atualmente implementados** no sistema. Valores de produto/preço/limites são reais (estão no código). Itens de mercado e financeiros (CAC, LTV, churn, custos de infra) estão sinalizados como **[A PREENCHER]** — devem ser completados com dados reais antes da apresentação final.

---

## 1. Resumo executivo

A **Maestra** é uma plataforma SaaS que coloca um **consultor de carreira musical guiado por IA** no bolso do artista independente. Em poucos minutos de conversa, a "Maestra IA" constrói com o artista um **plano estratégico completo** — identidade, metas, diagnóstico (SWOT), estratégias, priorização e um **plano de ação com prazos** — e segue como assistente no dia a dia (tarefas, marketing, catálogo, agenda, equipe).

O modelo é **freemium com assinatura recorrente**: o artista cria 1 perfil grátis para conhecer, mas as funcionalidades principais ficam bloqueadas até assinar o plano **PRO (R$ 49,90/mês)**, que libera tudo e permite gerenciar até 10 perfis.

---

## 2. Problema e oportunidade

- Carreira musical hoje exige **estratégia de negócio** (lançamentos, marketing, dados, monetização), não só talento.
- **Consultoria/empresariamento profissional é caro e inacessível** para o artista independente — normalmente custa de centenas a milhares de reais por mês, ou exige ceder percentual da carreira.
- A maioria dos artistas iniciantes **não tem método**: não sabe definir objetivos, priorizar ações nem transformar intenção em um plano executável.

**Oportunidade:** entregar, por uma fração do custo de um consultor, o **método + a execução assistida por IA**, escalável para milhares de artistas simultaneamente.

> Tamanho de mercado (TAM/SAM/SOM): **[A PREENCHER]** — nº de artistas independentes no Brasil / lançando em DSPs, etc.

---

## 3. Proposta de valor

**"O empresário/estrategista de carreira que cabe no bolso do artista."**

- **Método de consultoria sênior, automatizado**: o mesmo raciocínio de um plano de carreira profissional (identidade → objetivos → SWOT → estratégias → prioridades → cronograma), conduzido em linguagem simples para artista leigo.
- **Da estratégia à execução**: não para no diagnóstico — gera um **plano de ação com tarefas e prazos** e acompanha a execução.
- **Assistente sempre disponível (Maestra IA)**: tira dúvidas, sugere marketing, cria tarefas, ajuda no dia a dia.
- **Tudo num só lugar**: planejamento, catálogo de faixas, agenda, equipe e integração com Spotify (métricas reais).

---

## 4. Produto (o que está implementado)

| Módulo | O que entrega |
|--------|----------------|
| **Planejamento Estratégico (Wizard + Maestra IA)** | Conversa guiada que monta: Identidade (bio, visão, missão, valores), Objetivos, Diagnóstico SWOT, Estratégias, Priorização e Cronograma/Plano de ação. |
| **Maestra IA (assistente)** | Chat de IA integrado para planejamento, gestão de tarefas, sugestões de marketing e dúvidas. |
| **Plano de Ação** | Tarefas com responsáveis, prazos e vínculo às estratégias/objetivos. |
| **Catálogo** | Cadastro e gestão das faixas/lançamentos do artista. |
| **Agenda** | Eventos e compromissos da carreira. |
| **Equipe** | Gestão colaborativa (membros com acesso ao perfil do artista). |
| **Integração Spotify** | Importa perfil, métricas (seguidores, popularidade) e catálogo. |
| **Avanço de fases** | A cada ciclo concluído, replaneja a próxima fase da carreira (modelo de uso contínuo). |

**Stack técnica:** React (web) + Supabase (banco, autenticação, edge functions, storage) + IA em servidor (Groq / Llama 3.3 70B) + Asaas (pagamentos) + API do Spotify.

---

## 5. Público-alvo

- **Foco inicial: artistas independentes** que gerenciam a própria carreira (o produto fala diretamente com o artista).
- Secundário (já suportado pela arquitetura): pequenos **empresários/assessorias** que cuidam de poucos artistas (o plano PRO permite até 10 perfis).

> Personas detalhadas e segmentação: **[A PREENCHER]**.

---

## 6. Modelo de monetização (implementado)

**Freemium + assinatura recorrente mensal.**

| | **Grátis** | **PRO — R$ 49,90/mês** |
|---|---|---|
| Perfis de artista | **1** | **Até 10** |
| Catálogo (faixas) | Até **10** | **Ilimitado** |
| Planejamento estratégico com IA | 🔒 Bloqueado | ✅ Liberado |
| Maestra IA (assistente) | 🔒 Bloqueado | ✅ Liberado |
| Gestão de equipe | 🔒 Bloqueado | ✅ Liberado |
| Acesso aos perfis já criados | ✅ | ✅ |

**Lógica do funil:**
1. O artista entra grátis, cria 1 perfil e **vê o valor** (mas as funcionalidades-núcleo estão bloqueadas).
2. Para usar planejamento, IA, equipe e catálogo completo, **assina o PRO**.
3. Se cancelar: **mantém o acesso** aos perfis que criou, mas perde as funcionalidades premium e não cria novos perfis até reassinar (sem perder dados → reduz atrito de retorno).

**Pagamento:** assinatura recorrente via **Asaas**, com **PIX** e **Cartão de Crédito**.

> Observação: a infraestrutura já suporta **modelo por componentes** (storage por perfil, perfis adicionais), o que abre caminho para *add-ons* e planos sob medida no futuro (ver seção 11).

---

## 7. Modelo de receita

- **Receita recorrente (MRR/ARR)** = nº de assinantes ativos × R$ 49,90.
- Receita previsível e escalável: o custo marginal de mais um assinante é baixo (infra em nuvem + IA em servidor).

| Métrica | Fórmula | Valor |
|---------|---------|-------|
| MRR | assinantes ativos × R$ 49,90 | **[A PREENCHER]** |
| ARR | MRR × 12 | **[A PREENCHER]** |
| Ticket médio | (hoje, plano único) | **R$ 49,90** |

---

## 8. Estrutura de custos

**Custos variáveis (por uso):**
- **IA (Groq / Llama 3.3 70B)** — roda em edge function no servidor; inferência rápida e de baixo custo por requisição. **Vantagem estrutural: a IA não roda no cliente nem usa modelos caros.** Custo estimado: **[A PREENCHER R$/1k tokens × uso médio por artista]**.
- **Supabase** — banco, auth, storage e edge functions (escala por uso). **[A PREENCHER]**.
- **Asaas** — taxa por transação (PIX/cartão). **[A PREENCHER % por cobrança]**.

**Custos fixos / operacionais:**
- Desenvolvimento e manutenção do produto. **[A PREENCHER]**.
- Marketing e aquisição. **[A PREENCHER]**.
- Suporte. **[A PREENCHER]**.

---

## 9. Unit economics (estrutura para preencher)

| Indicador | Como calcular | Valor |
|-----------|----------------|-------|
| ARPU | Receita / usuários ativos | ~R$ 49,90 (assinante) |
| CAC | Gasto de aquisição / novos clientes | **[A PREENCHER]** |
| Churn mensal | Cancelamentos / base | **[A PREENCHER]** |
| LTV | ARPU × margem ÷ churn | **[A PREENCHER]** |
| LTV / CAC | (saudável ≥ 3) | **[A PREENCHER]** |
| Margem bruta | (Receita − custos variáveis) / Receita | **[A PREENCHER]** |

> Meta de referência de SaaS saudável: **LTV/CAC ≥ 3** e **payback de CAC < 12 meses**.

---

## 10. Vantagens competitivas (moat)

- **Método proprietário de planejamento** traduzido para linguagem de artista leigo (barreira de produto, não só de tech).
- **IA de baixo custo no servidor** (Groq/Llama) → margem melhor que concorrentes que dependem de modelos caros por requisição.
- **Da estratégia à execução** (plano de ação + acompanhamento), não apenas um chatbot genérico.
- **Dados do artista no tempo** (perfil, métricas Spotify, histórico de fases) → personalização crescente e custo de troca.

---

## 11. Alavancas de crescimento de receita (roadmap de monetização)

1. **Plano anual** (com desconto) → aumenta retenção e caixa adiantado.
2. **Add-ons** já suportados pela arquitetura: perfis adicionais acima de 10, storage extra.
3. **Tier para assessorias/labels** (multi-artista em escala).
4. **Upsell de serviços**: distribuição, prensagem, parcerias — a plataforma vira hub.
5. **Parcerias/afiliados** com DSPs, distribuidoras e marcas.

---

## 12. Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Baixa conversão free→PRO | Reforçar percepção de valor no free; provar ROI do plano de ação. |
| Churn alto | Uso contínuo (avanço de fases), resultados visíveis, plano anual. |
| Custo de IA escalar | IA server-side de baixo custo; monitorar tokens por artista. |
| Dependência de terceiros (Spotify, Asaas, Supabase) | Abstrações já isolam integrações; planos de contingência. |
| Concorrência (chatbots genéricos) | Método + execução + dados, não só conversa. |

---

## 13. Business Model Canvas (resumo)

| Bloco | Resumo |
|-------|--------|
| **Proposta de valor** | Consultor de carreira com IA, da estratégia ao plano de ação, acessível ao artista independente. |
| **Segmentos de cliente** | Artistas independentes (foco); assessorias pequenas (até 10 perfis). |
| **Canais** | Web app (Maestra Manager); aquisição digital. |
| **Relacionamento** | Self-service + assistente de IA; uso recorrente por fases. |
| **Fontes de receita** | Assinatura PRO recorrente (R$ 49,90/mês); futuros add-ons e plano anual. |
| **Recursos-chave** | Plataforma, método de planejamento, IA, dados do artista. |
| **Atividades-chave** | Produto/IA, conteúdo de método, aquisição e retenção. |
| **Parcerias-chave** | Supabase, Groq, Asaas, Spotify; futuras com distribuidoras/DSPs. |
| **Estrutura de custos** | Infra (Supabase), IA (Groq), pagamento (Asaas), produto, marketing. |

---

*Preparado com base no sistema implementado. Campos **[A PREENCHER]** dependem de dados reais de mercado, custos e tração para a versão final da apresentação.*
