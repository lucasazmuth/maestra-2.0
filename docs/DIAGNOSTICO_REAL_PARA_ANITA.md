# Diagnóstico REAL v2 — Pontos para a Anita decidir

**Para:** Anita Carvalho · **De:** time de produto/dev · **Data:** jun/2026
**Atualização:** suas respostas foram aplicadas e validadas com dados reais (Liniker, Marina, Luísa
Sonza). Resumo das aplicações + 1 ponto novo no fim ("Parte 5").

O motor REAL v2 (do seu doc *Motor REAL Consolidado*) já está **no ar e funcionando** — testado com
artistas reais. Este documento lista só o que **falta você decidir/calibrar**. Cada ponto tem o que
fizemos, por quê, e a pergunta para você.

> **Como ler:** onde está **PROPOSTA**, foi um valor inicial que nós sugerimos (você ajusta). Onde está
> **DECIDIDO**, seguimos o seu doc e só precisamos do seu "ok, mantém".

---

## Parte 1 — Decisões de método (precisam do seu sim/não)

### 1.1 Fonte de renda não-musical "derruba o E"
O seu doc diz: *"fonte de renda não-musical derruba o E mesmo com faturamento alto"*. Implementamos
como um **teto**: se a renda principal vem de **fora da música**, o E **não acende** — mesmo com
faturamento alto, CNPJ e empresário. (O E mede "a música sustenta?".)
**DECISÃO:** mantém esse teto absoluto? Ou a fonte não-musical só deve **reduzir** (não zerar) a chance
de acender?

### 1.2 Shows × cachê (o "híbrido c" que ficou pendente no seu doc)
Seu doc deixou em aberto incorporar **shows × cachê** ao E. Por ora **NÃO incorporamos** — o E é a média
ponderada dos **5 sinais** (faturamento, fonte, investimento, CNPJ, empresário), como no corpo do doc.
A pergunta de shows alimenta só o **A** (público ao vivo).
**DECISÃO:** seguimos sem o híbrido c por enquanto? Ou você quer que a receita de shows entre no E já?

### 1.3 Pergunta de shows: "por mês"
Perguntamos **"shows por mês"** (mais fácil para o artista) e reescalonamos para a sua tabela anual
recalibrada (n=40) multiplicando por 12.
**DECISÃO:** mantém "por mês"? (a tabela de z continua a sua, de 12 meses.)

### 1.4 Sem Spotify (artista iniciante)
Quem não tem Spotify gera diagnóstico só com o autorrelato; todos os sinais digitais entram como
**baixo** (sua "opção B" — a ausência *é* o diagnóstico). Tende a dar **Beginner**.
**DECISÃO:** confirma a opção B?

---

## Parte 2 — Cortes de "alto" para calibrar (com dados reais)

Estes são os cortes que o seu doc deixou **em aberto** ("pendências A e L") — propusemos valores
iniciais (top 5–10%, suas âncoras do Loud&Clear). Abaixo, os **números reais** de 3 artistas que
testamos, para você ter referência concreta de onde está a régua:

| Sinal | Corte de "alto" PROPOSTO | Pabllo Vittar | Liniker | Marina Sena |
|---|---|---|---|---|
| Ouvintes Spotify | **> 1 milhão** | 7,5 mi | 2,65 mi | 6,35 mi |
| Engajamento (IG) | **> 4%** | 0,37% | 4,35% | 6,30% |
| Engajamento (TikTok) | **> 4%** | 0,27% | — | 9,26% |
| Seguidores música (Deezer) | **> 250 mil** | 1,63 mi | (sem dado) | 215 mil |
| Playlists editoriais | **≥ 3** | — | 15 | 10 |
| Público médio/show | **> 500** | *(autorrelato)* | — | — |
| YouTube views/mês | **5 mi** *(seu doc)* | 18,6 mi | (sem dado) | (sem dado) |

**Leituras que valem a sua atenção:**
- **Engajamento:** o corte de 4% deixa **Pabllo baixo** (0,37%) e **Liniker/Marina altos**. Faz sentido?
  Artistas gigantes têm engajamento % naturalmente baixo — então o corte premia quem tem público
  **comprometido**, não quem tem público **grande**. (É exatamente a distinção R × A que você defende.)
  **DECISÃO:** 4% é a régua certa, ou prefere outro valor?
- **Ouvintes:** os 3 são > 1 milhão → todos "alto" em alcance. A régua de 1M = elite (top ~5% mundial,
  do Loud&Clear) está confirmada como exigente.
- **Playlists editoriais:** ≥ 3 deixa Liniker (15) e Marina (10) altos. Onde você marcaria o corte?

> Os outros cortes PROPOSTA (faturamento→nota, investimento, e a conversão do boletim 0–100) estão
> documentados e são ajustáveis numa linha cada. Posso te mandar a tabela completa se quiser revisar
> número a número.

---

## Parte 3 — Limitações de dados (afetam a régua)

1. **TikTok "views de vídeo" não existe na API** que temos. O seu doc previa TikTok em **dois**
   componentes do R (seguidores + views — a "opção D"). Hoje o componente de **vídeo** do R usa **só
   YouTube**. **DECISÃO:** ok manter só YouTube no vídeo, ou buscar outra fonte para TikTok views?
2. **Airplay de rádio:** funciona, mas vem **vazio** para muitos artistas de MPB/indie (pouco airplay
   rastreado). Nesses casos o componente é só **ignorado** (não conta contra o artista). **DECISÃO:**
   ok? (o L continua acendendo via prêmios + imprensa + playlists.)
3. **YouTube views / Deezer fans:** populam quando o artista tem o dado; quando não tem, são ignorados.

---

## Parte 4 — Recalibração futura (já estava no seu doc)

- Quando a **Profissionalismo 2026** trouxer ~400 respostas, reancorar as tabelas de z (shows, etc.) em
  dados reais — hoje várias são "calibração inicial por julgamento informado", como você anotou.
- Comparação por **percentil** entre artistas (boletim estilo ENEM com posição relativa) depende de
  base cheia — passo futuro.

---

## Resumo: o que precisamos de você

1. **Confirmar** as 4 decisões de método (Parte 1).
2. **Calibrar** os cortes de "alto" (Parte 2) — com os números reais como referência.
3. **Decidir** sobre TikTok views e airplay (Parte 3).

Qualquer ajuste que você definir, a gente aplica rápido (cada corte é um número num único arquivo).

---

## Parte 5 — O que já aplicamos das suas respostas (validado com dados reais)

| Sua decisão | Status |
|---|---|
| 1.1 Tirar o teto do E (fonte não-musical = 0,0 no sinal de 20%, sem zerar) | ✅ aplicado |
| 1.2 Seguir sem o híbrido shows×cachê | ✅ mantido (cachê segue coletado) |
| 1.3 Shows "por mês" ×12 · 1.4 Opção B (sem Spotify) | ✅ confirmados |
| 2 Engajamento 4% · playlists ≥3 · público 500 · ouvintes 1M | ✅ mantidos (validados: Marina IG 6,3% alto / Pabllo 0,37% baixo — exatamente a distinção R×A) |
| 2 Deezer 250mil → **100mil** | ✅ aplicado (Marina 215mil agora conta; Luísa 2,3mi alto) |
| 3.2/3.3 Airplay e plataforma ausente | ✅ ignora sem penalizar |

### 🆕 Novidade — TikTok views: **A LICENÇA COBRE!** (sua questão 3.1)
Testamos e o campo `tiktok_top_video_views` **veio** (Luísa Sonza: **15,2 bilhões**), de graça (já vem
na meta, sem chamada extra). **Implementamos a opção D** — TikTok entra no componente de vídeo do R.

**⚠️ Mas precisamos da sua decisão:** o número (15 **bilhões**) mostra que o campo é o **total
acumulado do vídeo mais visto**, não "views/mês (média 3m)" como o seu doc previa. São métricas de
**escala/natureza diferentes** — e o componente de vídeo mistura isso com o YouTube (que é mensal).

Por ora, **recalibramos o corte** do TikTok para a escala acumulada (alto ≈ >200M total) — senão todo
artista com vídeo viral ficaria no máximo. **DECISÃO da Anita:**
1. O "total acumulado do top vídeo" serve como medida de "consumo viral", ou você quer um campo de
   **views/mês** de verdade (precisaríamos achar outro endpoint/campo)?
2. Se servir o acumulado: qual o corte de "alto" (hoje propusemos >200M)?
3. Faz sentido **misturar** YouTube (mensal) + TikTok (acumulado) no mesmo componente, ou separar?
