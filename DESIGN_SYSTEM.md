# Design System — Maestra

Versão 1.0 · 2026

Este documento é a referência visual do produto ativo. A identidade combina estrutura, precisão e acolhimento em uma interface predominantemente escura.

## Princípios

- Clareza antes de decoração.
- Hierarquia tipográfica forte, sem sacrificar a leitura funcional.
- Deep Violet é a cor institucional e usa sempre conteúdo branco quando aplicado como fundo sólido.
- Cores semânticas e de integrações externas permanecem restritas ao contexto que representam.
- A marca deve ser renderizada pelos vetores oficiais; não recomponha o nome com texto.

## Marca

Os vetores normalizados ficam em src/assets/brand e as versões públicas em public/brand.

| Variante | Uso |
| --- | --- |
| Símbolo | favicon, ícone de app, avatar institucional e espaços compactos |
| Wordmark | relatórios, PDFs, e-mails e assinaturas com pouco espaço vertical |
| Lockup | topbar, landing, autenticação e contextos institucionais |

No React, use o componente MaestraBrand com:

- variant: symbol, wordmark ou lockup;
- tone: light ou dark;
- beta: mantém o selo nos pontos em que o produto ainda o exibe;
- className, style e atributos ARIA comuns.

Use tone light sobre Onyx, Deep Violet ou imagens escuras. Use tone dark sobre Bone ou branco. O símbolo mantém Onyx e lavanda internos nas duas situações.

## Paleta institucional

| Token | Hex | Aplicação |
| --- | --- | --- |
| Deep Violet | #9A4FD1 | ação primária, foco e destaque institucional |
| Deep Violet Hover | #8442B6 | hover e active de ações primárias |
| Onyx | #0A0A0A | fundo principal e símbolo |
| Bone | #F5F4F2 | texto principal e superfícies claras |
| Pure White | #FFFFFF | conteúdo sobre Deep Violet e contraste máximo |
| Symbol Lavender | #C97EF3 | geometria interna do símbolo e acento auxiliar |

Tokens de código:

- TypeScript: src/constants/brand.ts
- SCSS: src/styles/variables.scss
- CSS: variáveis --maestra-* definidas em src/styles/App.scss

Não use texto preto sobre Deep Violet. O par institucional de botão é fundo #9A4FD1 com texto #FFFFFF; no hover, fundo #8442B6 com texto #FFFFFF.

## Superfícies escuras

| Papel | Valor recomendado |
| --- | --- |
| Fundo raiz | Onyx |
| Container principal | #121212 |
| Card | #181818 |
| Campo e superfície elevada | #1F1F1F a #2A2A2A |
| Borda discreta | rgba(255, 255, 255, 0.08) |
| Texto secundário | #B3B3B3 |
| Texto silencioso | #8A8A92 |

Gradientes podem combinar Deep Violet, lavanda e tons frios, desde que não substituam a cor sólida em controles de ação.

## Tipografia

As fontes são hospedadas no bundle por Fontsource.

| Papel | Família | Peso e tratamento |
| --- | --- | --- |
| Display e títulos estruturais | Inter | 700–800, caixa normal para leitura natural |
| Corpo e interface | Inter, Helvetica Neue, Arial | 400–700, caixa normal |
| Kicker, indicador e metadado | JetBrains Mono | 500–700, tracking amplo, caixa alta |

Variáveis:

- --font-display
- --font-body
- --font-mono

Títulos de página e grandes seções usam Inter. Títulos funcionais, campos, botões e cards permanecem em caixa normal quando isso melhora a leitura. Metadados curtos, estados e labels técnicos podem usar JetBrains Mono.

## Componentes e estados

### Botão primário

- Fundo Deep Violet.
- Texto e ícone brancos.
- Hover Deep Violet Hover.
- Foco visível com halo violeta e contraste mínimo AA.
- Disabled reduz opacidade, sem remover o rótulo.

### Botão secundário

Use fundo transparente ou superfície escura, texto branco e borda discreta. O hover pode elevar a superfície ou reforçar a borda.

### Cards e campos

Cards usam contraste de superfície, não uma profusão de bordas. Campos precisam de rótulo persistente, placeholder secundário e foco violeta. Erro continua vermelho; sucesso e o Diagnóstico REAL mantêm seus verdes semânticos.

### Títulos

Títulos estruturais usam Inter em caixa normal. Caixa alta fica reservada a kickers, categorias, indicadores e metadados curtos. Títulos de card e textos de tarefa também usam caixa normal. Evite tracking amplo em parágrafos.

## Acessibilidade

- Todo uso significativo da marca precisa de nome acessível “Maestra”.
- Marca decorativa usa aria-hidden.
- Não comunique estado apenas por cor.
- Preserve foco de teclado e área mínima de toque de 44 × 44 px.
- Respeite prefers-reduced-motion.
- Verifique contraste AA para texto funcional.
- Em fundos violetas, use sempre branco.

## PWA e notificações

O manifesto usa Onyx como theme_color e background_color. favicon.svg, favicon.ico, Apple Touch Icon, logo192.png e logo512.png derivam do símbolo oficial. O service worker deve mudar de versão sempre que os assets de instalação forem alterados.

Push usa logo192.png como ícone e favicon32.png como badge.

## E-mails

Os helpers Brevo usam:

- wordmark PNG hospedado em /brand/maestra-wordmark-light.png;
- fundo Onyx e texto Bone;
- CTA Deep Violet com texto branco;
- remetente público “Maestra”;
- rodapé jurídico inalterado.

A fonte canônica é supabase/functions/_shared/brevo.ts. As cópias locais das funções devem permanecer byte a byte sincronizadas.

## Relatórios e exportações

Cartões compartilháveis e PDFs usam o wordmark vetorial e fontes locais. O corpo usa --font-body; títulos usam --font-display; indicadores curtos podem usar --font-mono. O domínio institucional permanece inalterado.

## Verificação

Execute antes do rollout:

    npm run brand:check
    npm test -- --watchAll=false
    npm run build

Além dos testes, valide landing, autenticação, área logada, diagnóstico, checkout e administração em desktop e mobile. Gere ao menos um PNG e um PDF reais, confira manifesto/ícones e renderize amostras locais dos e-mails.
