# Nyta — Etapa: SWOT Cruzada → Estratégias

**Documento parcial** — bloco a ser incorporado no Roteiro de Perguntas (Documento 2), após SWOT. **Origem:** análise de 100+ planejamentos reais com SWOT cruzada (corpus adicional ao KSR). **Versão:** 1.0

---

## O que esta etapa faz

A partir dos quatro quadrantes mapeados na SWOT, a Nyta **gera automaticamente as estratégias** do artista — cruzando fraquezas com oportunidades e forças com ameaças. O artista valida, ajusta e pode acrescentar estratégias próprias.

Esta é a etapa mais automatizada do método: em vez de perguntar ao artista "o que você vai fazer sobre cada fraqueza?", a Nyta já traz as estratégias derivadas e pede confirmação. O papel do artista aqui é **validar, ajustar e complementar** — não criar do zero.

---

## 1\. A lógica de cruzamento (motor interno da Nyta)

O corpus de 100+ planejamentos reais revela que as estratégias não são criativas no sentido amplo — elas seguem **padrões altamente recorrentes** de cruzamento. A Nyta aplica este raciocínio:

**Para cada fraqueza identificada:** qual oportunidade do ambiente pode combater essa fraqueza? Qual força interna pode compensá-la? → a combinação gera a estratégia.

**Para cada ameaça identificada:** qual força pode ser usada para desviar dessa ameaça? → gera estratégia defensiva.

**Prioridade de cruzamento:** fraqueza \+ oportunidade são o cruzamento mais fértil (geram a maior parte das estratégias). Força \+ ameaça gera estratégias de proteção. Força \+ oportunidade gera estratégias de alavancagem (menos urgentes, entram depois).

---

## 2\. Mapa de cruzamentos — o banco de estratégias da Nyta

Este é o coração da etapa. Para cada fraqueza frequente, a Nyta conhece as estratégias que o corpus comprova como resposta padrão. **Material interno — não exibir ao artista na íntegra; usar para gerar as sugestões personalizadas.**

| Fraqueza | Cruzamento com | Estratégias geradas |
| :---- | :---- | :---- |
| Gestão não profissional das redes sociais | Redes sociais (oportunidade) | Contratar social media para planejamento estruturado; investir em tráfego pago nos lançamentos; criar site com captação de leads; programação de conteúdo para YouTube |
| Material de apresentação desatualizado / ausente | Contratantes / imprensa / marcas (oportunidade) | Realizar branding; produzir novo material (fotos / release / PDF); criar vídeo de venda do show |
| Ausência de empresário / gestor | Mercado / contratantes (oportunidade) | Pesquisar e prospectar empresário(a); contratar assistente de produção; fazer parceria com booker |
| Gestão comercial passiva / sem prospecção | Contratantes de shows — corporativo / órgãos públicos / casas de show / particulares / festivais (oportunidade) | Identificar o cliente ideal; preparar material de venda específico; ativar prospecção estruturada com metas; fazer parceria com booker |
| Baixa capacidade de investimento | Editais / leis de incentivo / crowdfunding / patrocínio (oportunidade) | Pesquisar e inscrever em editais; criar projeto incentivado via lei de incentivo; criar campanha de crowdfunding; prospectar marcas patrocinadoras |
| Empresa não formalizada (MEI) / sem jurídico | Contratos / editais / leis / editoras (oportunidade) | Migrar empresa para LTDA; contratar suporte jurídico; fazer contrato com editora administradora |
| Identidade visual / branding desalinhado | Imprensa / contratantes / marcas / redes (oportunidade) | Contratar consultoria de branding; revisar toda a comunicação visual; atualizar materiais a partir do novo branding |
| Ausência de editora / direitos autorais | Sincronização / direitos autorais / conexos (oportunidade) | Pesquisar editoras para contrato de administração; criar editora própria (LTDA) com administração de major; ativar oportunidades de sincronização |
| Ausência de assessoria de imprensa | Imprensa / rádio / podcasts / TV (oportunidade) | Contratar assessoria de imprensa nos lançamentos; contratar divulgador de rádio; enviar media kit para influenciadores; prospectar participações em podcasts |
| Sem distribuidora / sem programação de lançamentos | Streaming / redes / imprensa (oportunidade) | Contratar distribuidora com atendimento; criar programação estruturada de lançamentos; incluir feats para ampliar alcance |
| Network existente mas não ativado | Contratantes / parceiros / imprensa / marcas (oportunidade) | Mapear e classificar o network por tipo; criar fluxo de comunicação segmentado; ativar parceiros estratégicos individualmente |
| Show não está pronto / sem material de venda audiovisual | Contratantes / festivais / casas de show (oportunidade) | Montar e estrear o show; realizar show de lançamento com registro audiovisual; criar vídeo overview para venda |

**Estratégias universais** (aparecem em quase todos os planos, independente da SWOT específica):

- Criar a lojinha do artista (merchan / produtos)  
- Pesquisar e inscrever o projeto em editais  
- Criar projeto incentivado para captação de recursos  
- Prospectar participações em podcasts e canais do YouTube  
- Frequentar eventos e congressos do mercado da música

---

## 3\. Prompt de condução

### Ponte

Agora chegamos na parte mais estratégica: a gente vai usar tudo o que você mapeou — suas forças, fraquezas, oportunidades e ameaças — para criar as estratégias da sua carreira. A lógica é simples: para cada coisa que falta, a gente procura uma oportunidade lá fora que ajude a resolver. E suas forças entram pra potencializar o caminho.

### Apresentação das estratégias geradas

*(A Nyta gera a lista a partir do mapa de cruzamentos, personalizada com o contexto do artista: nome, gênero, estágio, alcance geográfico, "por quem" da visão. Apresenta em linguagem natural, não como lista técnica.)*

A partir do que você me contou, aqui estão as estratégias que fazem mais sentido para a sua carreira. Dá uma olhada:

*(lista gerada — ver mapa na seção 2\)*

O que você acha? Tem alguma que não faz sentido retirar, alguma que você quer ajustar, ou alguma ideia sua que ainda não apareceu aqui?

### Campo de ajuste *(campo aberto)*

Quer acrescentar alguma estratégia que não apareceu?

### Reflexo de fechamento

Ótimo. Essas são as suas estratégias. Na próxima etapa, a gente vai priorizar — porque executar tudo ao mesmo tempo não funciona.

---

## 4\. Notas de implementação (dev)

1. **Geração personalizada:** a Nyta não despeja o mapa inteiro. Ela filtra as estratégias com base nas fraquezas e oportunidades que o artista efetivamente marcou na SWOT. Só aparecem estratégias relevantes para aquele artista específico.  
     
2. **Personalização de linguagem:** os nomes das estratégias devem usar o contexto acumulado. Ex.: em vez de "Criar a lojinha do artista", usar "Criar a Lojinha da \[nome\]". Em vez de "prospectar corporativos", considerar o estágio e o nicho.  
     
3. **Estratégias universais** entram sempre, mesmo que não derivem diretamente da SWOT do artista — o corpus comprova que aparecem em quase todos os planos.  
     
4. **Volume esperado:** o cruzamento costuma gerar 15 a 25+ estratégias. A Nyta apresenta todas as relevantes — a priorização vem na próxima etapa (não aqui).  
     
5. **Validação:** o artista pode remover, ajustar e acrescentar livremente. Lista final salva em `{estrategias[]}`.  
     
6. **Força \+ ameaça:** para artistas com forças muito claras (ex: network forte \+ ameaça de alta concorrência), a Nyta pode sugerir estratégias de alavancagem: "Você tem uma rede de contatos forte — vale ativar esse network para criar diferenciação frente à concorrência."  
     
7. **Fronteira da arte:** se o artista sugerir uma estratégia que entre no território criativo (ex: "mudar o estilo musical para alcançar mais público"), a Nyta acolhe como dado e redireciona: *"Essa é uma decisão 100% sua como artista. O que posso te ajudar é a pensar em como comunicar e posicionar o que você já faz."*

---

*Próxima etapa: Priorização das estratégias.*  
