# Design System — Spotify React Web Client

> Referência completa de tokens, componentes, padrões visuais e diretrizes de implementação do clone do Spotify Web Player.

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Tokens de Design](#2-tokens-de-design)
3. [Paleta de Cores](#3-paleta-de-cores)
4. [Tipografia](#4-tipografia)
5. [Espaçamento](#5-espaçamento)
6. [Bordas e Sombras](#6-bordas-e-sombras)
7. [Breakpoints e Layout Responsivo](#7-breakpoints-e-layout-responsivo)
8. [Animações e Transições](#8-animações-e-transições)
9. [Componentes UI](#9-componentes-ui)
10. [Ícones](#10-ícones)
11. [Assets](#11-assets)
12. [Páginas](#12-páginas)

---

## 1. Visão Geral

| Propriedade | Valor |
|---|---|
| **Stack** | React 19, TypeScript, SCSS, Tailwind CSS v3.4, Ant Design v5 |
| **Tema** | Dark mode exclusivo |
| **Fonte principal** | SpotifyMixUI / SpotifyMixUITitle (CDN Encore) |
| **Gerenciamento de estado** | Redux Toolkit + redux-persist |
| **Ícones** | SVG customizados (60+) + react-icons/fa6 |
| **Layout** | 3 painéis resizáveis (react-resizable-panels) |

O projeto replica a interface do Spotify Web Player com fidelidade visual ao **Encore Design System** do Spotify, usando os mesmos tokens CSS (`--encore-*`), fontes proprietárias e padrões de interação.

---

## 2. Tokens de Design

### SCSS Variables
**Arquivo:** [`src/styles/variables.scss`](src/styles/variables.scss)

| Variável | Valor | Uso |
|---|---|---|
| `$background-color` | `#121212` | Background principal |
| `$container-border-radius` | `10px` | Raio padrão de containers |
| `$text-primary-color` | `white` | Texto principal |
| `$text-secondary-color` | `#b3b3b3` | Texto secundário/mudo |
| `$desktop-breakpoint` | `768px` | Limite mobile/tablet |
| `$desktop-small-breakpoint` | `900px` | Limite tablet/desktop |

### CSS Custom Properties (`--encore-*`)
Mapeiam o Encore Design System do Spotify.

#### Espaçamento
| Propriedade | Valor |
|---|---|
| `--encore-spacing-tighter-5` | `2px` |
| `--encore-spacing-tighter-4` | `4px` |
| `--encore-spacing-tighter-3` | `6px` |
| `--encore-spacing-tighter-2` | `8px` |
| `--encore-spacing-base` | `16px` |

#### Controles
| Propriedade | Valor |
|---|---|
| `--encore-control-size-smaller` | `32px` |
| `--encore-control-size-base` | `48px` |
| `--encore-control-size-larger` | `56px` |
| `--encore-button-corner-radius` | `9999px` |

#### Layout Dinâmico
| Propriedade | Default | Descrição |
|---|---|---|
| `--home-section-padding` | `20px` | Padding das seções da home |
| `--min-column-width` | `200px` | Largura mínima de coluna do grid |
| `--grid-gap` | `24px` | Gap do grid principal |
| `--item-height` | `48px` / `64px` | Altura de item de lista |

---

## 3. Paleta de Cores

### Backgrounds

| Swatch | Hex | Uso |
|---|---|---|
| ⬛ `#121212` | `#121212` | Background principal da aplicação |
| ⬛ `#181818` | `#181818` | Cards, elementos mais escuros |
| ⬛ `#1f1f1f` | `#1f1f1f` | Inputs, backgrounds de formulários |
| ⬛ `#282828` | `#282828` | Menus, dropdowns, modais |
| ⬛ `#242424` | `#242424` | Variante de card secundário |
| ⬛ `#343434` | `#343434` | Hover sobre elementos escuros |

### Brand / Ação

| Swatch | Hex | Uso |
|---|---|---|
| 🟢 `#1ed760` | `#1ed760` | Cor primária de ação (botões, ativo) |
| 🟢 `#1db954` | `#1db954` | Verde escuro (indicadores ativos) |
| 🟢 `#21cc44` | `#21cc44` | Hover do volume slider |
| 🟢 `#64d26d` | `#64d26d` | Animação de like (heart) |
| 🟢 `rgba(30,215,96,0.3)` | — | Radial gradient do device panel |

### Texto

| Swatch | Hex | Uso |
|---|---|---|
| ⬜ `#ffffff` | `#ffffff` | Texto primário |
| 🔘 `#b3b3b3` | `#b3b3b3` | Texto secundário, ícones inativos |
| 🔘 `#bababa` | `#bababa` | Variante de texto mudo |
| 🔘 `#c7c7c7` | `#c7c7c7` | Texto em elementos hover |
| ⬛ `#2a2929` | `#2a2929` | Texto escuro sobre fundo claro |

### Estado e Semântica

| Swatch | Hex | Uso |
|---|---|---|
| 🔴 `#e91429` | `#e91429` | Erro, alerta destrutivo |
| 🔵 `#0074e0` | `#0074e0` | Links, popovers |
| 🔵 `#4cb3ff` | `#4cb3ff` | Hover de links |

### Gradientes

| Nome | Valor |
|---|---|
| Login container | `linear-gradient(90deg, #af2896, #509bf5)` |
| Fade esquerda (carousel) | `linear-gradient(90deg, #121212 16%, rgba(18,18,18,0) 100%)` |
| Fade direita (carousel) | `linear-gradient(270deg, #121212 16%, rgba(18,18,18,0) 100%)` |
| Modal header | `linear-gradient(-180deg, rgba(0,0,0,0.4), #282828)` |
| Device panel | `radial-gradient(82.95% 283.44% at 50% -160.29%, rgba(30,215,96,0.3) 0, #181818 100%)` |
| Skeleton shimmer | `linear-gradient(90deg, rgb(206 206 206/6%) 25%, rgb(79 79 79/15%) 37%, rgba(0,0,0,0.06) 63%)` |

### Transparências Recorrentes

| Valor | Uso típico |
|---|---|
| `rgba(0,0,0,0.2)` | Sombras leves |
| `rgba(0,0,0,0.3)` | Sombras médias, overlays |
| `rgba(0,0,0,0.5)` | Sombras pesadas |
| `rgba(0,0,0,0.7)` | Overlay de modal |
| `rgba(255,255,255,0.1)` | Hover sutil em dark |
| `rgba(255,255,255,0.15)` | Hover de library card |

**Arquivos fonte:** `src/styles/App.scss`, `src/styles/variables.scss`, `src/constants/spotify.ts`

---

## 4. Tipografia

### Famílias de Fonte

| Família | Variantes | Uso |
|---|---|---|
| `SpotifyMixUI` | Regular (400), Bold (700) | Corpo de texto, UI geral |
| `SpotifyMixUITitle` | Variable, Bold (700), Extrabold (800) | Títulos, headings |
| Fallbacks | `CircularSp-Arab`, `CircularSp-Hebr`, `CircularSp-Cyrl`, `CircularSp-Grek`, `CircularSp-Deva`, `sans-serif` | Suporte multilíngue |

### URLs das Fontes (CDN Encore)

```css
/* SpotifyMixUI Regular */
https://encore.scdn.co/fonts/SpotifyMixUI-Regular-cc3b1de388efa4cbca6c75cebc24585e.woff2

/* SpotifyMixUI Bold */
https://encore.scdn.co/fonts/SpotifyMixUI-Bold-4264b799009b1db5c491778b1bc8e5b7.woff2

/* SpotifyMixUITitle Variable */
https://encore.scdn.co/fonts/SpotifyMixUITitleVariable-8769ccfde3379b7ebcadd9529b49d0cc.woff2

/* SpotifyMixUITitle Bold */
https://encore.scdn.co/fonts/SpotifyMixUITitle-Bold-37290f1de77f297fcc26d71e9afcf43f.woff2

/* SpotifyMixUITitle Extrabold */
https://encore.scdn.co/fonts/SpotifyMixUITitle-Extrabold-ba6c73cd7f82c81e49cf2204017803ed.woff2
```

### Escala Tipográfica

| Tamanho | rem | Peso(s) | Line-height | Uso |
|---|---|---|---|---|
| Display XL | `2rem` | 700, 800 | `1.1` | Títulos de página grandes |
| Display L | `1.8rem` | 700 | `1.1` | Títulos secundários |
| Display M | `1.6rem` | 700 | `1.25` | Headings de seção |
| Title | `1.5rem` | 700 | `1.25` | Títulos de card/seção |
| Subtitle | `1.25rem` | 600–700 | `1.25` | Subtítulos |
| Body | `1rem` | 400–500 | `1.5` | Texto corrido |
| Small | `0.9rem` | 400 | `1.5` | Metadados, labels |
| XSmall | `0.875rem` | 400 | `1.5` | Texto de suporte |
| Caption | `0.8rem` | 400 | `1.5` | Legendas, timestamps |
| Micro | `0.75rem` | 400 | `1.5` | Contagem de tempo, badges |

### Pesos Disponíveis

| Peso | Valor | Uso |
|---|---|---|
| Light | `100` | Raramente usado |
| Regular | `400` | Corpo padrão |
| Medium | `500` | Ênfase leve |
| Semibold | `600` | Labels, navegação |
| Bold | `700` | Títulos, botões |
| Extrabold | `800` | Display, destaque máximo |

---

## 5. Espaçamento

### Sistema Base (8px)

O espaçamento segue uma grade de 8px. Tokens do Tailwind CSS mapeados:

| Classe Tailwind | Valor |
|---|---|
| `p-1` / `m-1` | `0.25rem` (4px) |
| `p-2` / `m-2` | `0.5rem` (8px) |
| `p-3` / `m-3` | `0.75rem` (12px) |
| `p-4` / `m-4` | `1rem` (16px) |
| `p-5` / `m-5` | `1.25rem` (20px) |
| `p-6` / `m-6` | `1.5rem` (24px) |

### Grid System

O projeto usa Tailwind com breakpoints estendidos:

| Breakpoint | Largura | Colunas típicas |
|---|---|---|
| `xxs` | `100px` | 1 |
| `xs` | `400px` | 2 |
| `sm` | `640px` | 2–3 |
| `md` | `768px` | 3–4 |
| `lg` | `1024px` | 4–5 |
| `xl` | `1280px` | 5 |

**Cores customizadas Tailwind:**
- `bg-spotify-gray` → `#121212`
- `bg-spotify-gray-light` → `#181818`
- `bg-spotify-gray-lightest` → `#282828`

---

## 6. Bordas e Sombras

### Border Radius

| Valor | Uso |
|---|---|
| `9999px` | Botões pill, chips, controles arredondados |
| `50%` | Avatares, fotos de perfil |
| `10px` | Containers principais, seções |
| `8px` | Cards, dropdowns, modais |
| `4px` | Miniaturas de imagens, elementos menores |
| `2px` | Itens de menu |

### Box Shadows

| Nível | Valor | Uso |
|---|---|---|
| Small | `0 2px 4px rgba(0,0,0,0.2)` | Cards em repouso |
| Medium | `0 4px 16px rgba(0,0,0,0.3)` | Cards em hover |
| Large | `0 8px 24px rgba(0,0,0,0.5)` | Modais, elementos flutuantes |
| XLarge | `0 8px 8px rgba(0,0,0,0.3)` | Player bar |
| Dropdown | `0 16px 24px rgba(0,0,0,0.3), 0 6px 8px rgba(0,0,0,0.2)` | Menus dropdown |
| Inset | `0 -1px 0 0 #181818` | Efeito de separador inferior |

### Scrollbar

```css
/* Largura */
width: 8px;
border-radius: 4px;

/* Thumb */
background: rgba(255,255,255,0.3);
/* Thumb hover */
background: rgba(0,0,0,0.5);

/* Track */
background: transparent;

/* Mobile — oculto */
scrollbar-width: none;
-ms-overflow-style: none;
```

---

## 7. Breakpoints e Layout Responsivo

### Breakpoints Principais

| Breakpoint | Comportamento |
|---|---|
| `< 768px` | **Mobile** — biblioteca vira drawer, player fixo no rodapé, navbar oculta, sem painel direito |
| `768px – 900px` | **Tablet** — biblioteca colapsada (85px), sem painel "Now Playing" |
| `> 950px` | **Desktop** — 3 painéis resizáveis completos |

### Estrutura de Layout

```
┌─────────────────────────────────────────────┐
│                  Navbar                      │  ← 64px
├──────────┬──────────────────┬───────────────┤
│          │                  │               │
│ Library  │   Main Content   │  Now Playing  │
│ (Sidebar)│   (Scroll Area)  │   (Sidebar)   │
│          │                  │               │
│ min: 85px│  (flexível)      │ 23–30% width  │
│ max: 28% │                  │               │
│          │                  │               │
├──────────┴──────────────────┴───────────────┤
│              Playing Bar                     │  ← 105px
└─────────────────────────────────────────────┘
```

### Dimensões-Chave

| Elemento | Valor |
|---|---|
| Altura total da área de conteúdo | `calc(100vh - 105px)` |
| Altura quando outro dispositivo ativo | `calc(100vh - 141px)` |
| Altura da seção principal | `calc(100vh - 150px)` |
| Library — colapsada | `85px` largura |
| Library — expandida | `280px` default (resizável até 28%) |
| Now Playing | `23–30%` largura |
| Border radius da seção principal | `10px` |

### Comportamento Responsivo por Componente

**Library Sidebar:**
- `< 900px`: colapsa automaticamente para modo icon (85px)
- `< 768px`: desaparece, vira `LibraryDrawer` sobreposto

**Playing Bar:**
- Desktop: fixo no rodapé (`105px`)
- Mobile: `NowPlayingBarMobile` compacto + `MobileMenu` (3 abas: Home, Search, Library)

**Now Playing (painel direito):**
- `< 900px`: oculto, vira `PlayingNowDrawer` sobreposto

**Navbar:**
- `< 768px`: `visibility: hidden`

---

## 8. Animações e Transições

### Transições Padrão

```scss
/* Classe utilitária global */
.transition {
  transition-property: color, background-color, border-color, fill, stroke,
    opacity, box-shadow, transform, filter;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 0.25s;
}
```

### Tabela de Animações

| Elemento | Duração | Easing | Efeito |
|---|---|---|---|
| Play/Pause button | `33ms` | `cubic-bezier(0.3,0,0.7,1)` | Resposta imediata ao clique |
| Hover padrão (cards, botões) | `200–250ms` | `cubic-bezier(0.4,0,0.2,1)` | Scale + cor |
| Header background (scroll) | `600ms` | `ease-in-out` | Fade de cor gradiente |
| Header content opacity | `300ms` | `ease-in-out` | Fade do título |
| Like heart (fill) | `200ms` | `ease` | Mudança de cor |
| Like heart (float) | `650ms` | `cubic-bezier(0.12,0.84,0.5,0.44)` | Partículas subindo |
| Volume slider | `100ms` | — | Mudança de largura |
| Search input | `100ms` | `ease-in` | Expansão + sombra |
| Library card hover | `200ms` | `ease-in-out` | Background color |
| Resize handler | `300ms` | — | Fade de opacidade |
| Skeleton shimmer | `1.4s` | — | Loop de gradiente |
| Loading spinner | `1.2s` | `ease-in-out` | Bounce circular |

### Keyframe Animations

#### `floatingHearts` — Animação de Like
```css
@keyframes floatingHearts {
  0%   { opacity: 0; transform: translateY(10px); }
  50%  { opacity: 0.5; }
  100% { opacity: 0; transform: translateY(-50px); }
}
/* Duração: 0.65s | Delays escalonados: 0.1s, 0.2s, 0.3s, 0.5s */
```

#### `scalePulse` — Pulso do Heart
```css
@keyframes scalePulse {
  from { transform: scale(0); }
  to   { transform: scale(1.1); opacity: 0; }
}
```

#### `sk-circleBounceDelay` — Loading Spinner
```css
@keyframes sk-circleBounceDelay {
  0%, 80%, 100% { transform: scale(0); }
  40%           { transform: scale(1); }
}
/* 12 círculos com delays: -1.1s, -1.0s, -0.9s... -0.1s */
/* Cor: #1cd760 (Spotify green) */
```

#### `gradient` — Fullscreen Background
```css
@keyframes gradient {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

### Hover States Padrão

```scss
/* Cards e itens de lista */
&:hover {
  transform: scale(1.04);
  background-color: rgba(255, 255, 255, 0.1);
}

/* Botões de controle */
&:hover  { transform: scale(1.1); }
&:active { transform: scale(1); }

/* Ícones inativos → ativos */
color: #b3b3b3; /* → */ color: #ffffff;
fill: #b3b3b3;  /* → */ fill: #1ed760; /* (para ícones de estado) */
```

---

## 9. Componentes UI

### Componentes Base

#### `WhiteButton`
**Arquivo:** [`src/components/Button/index.tsx`](src/components/Button/index.tsx)

```typescript
interface Props {
  title: string;
  onClick: () => void;
  size?: 'default' | 'small';
}
```

Botão de contorno branco com texto `#b3b3b3`, hover para `#ffffff`. Bordas `9999px`. Variante `small` reduz padding.

---

#### `Chip`
**Arquivo:** [`src/components/Chip/index.tsx`](src/components/Chip/index.tsx)

```typescript
interface Props {
  text: string | ReactNode;
  active?: boolean;
  onClick?: () => void;
}
```

Filtro pill com estado ativo (background `#ffffff`, texto preto) e inativo (background `rgba(255,255,255,0.1)`). Hover: `hsla(0,0%,100%,0.3)`. Padding: `12px`. Radius: `9999px`.

---

#### `Slider`
**Arquivo:** [`src/components/Slider/index.tsx`](src/components/Slider/index.tsx)

```typescript
interface Props {
  isEnabled: boolean;
  direction?: Direction;  // horizontal | vertical
  value: number;          // 0–100
  onChangeStart?: () => void;
  onChange: (value: number) => void;
  onChangeEnd?: (value: number) => void;
}
```

Usado para volume e barra de progresso. Thumb aparece apenas no hover. Track ativa em verde Spotify (`#1ed760`), hover: `#21cc44`.

---

#### `Tooltip`
**Arquivo:** [`src/components/Tooltip/index.tsx`](src/components/Tooltip/index.tsx)

Wrapper do `Tooltip` do Ant Design com estilos customizados. Background `#282828`, texto branco, radius `4px`.

---

#### `Spinner`
**Arquivo:** [`src/components/spinner/spinner.tsx`](src/components/spinner/spinner.tsx)

```typescript
interface Props {
  loading: boolean;
  section?: string;   // variante de tamanho/posição
  children?: any;
}
```

12 círculos animados com `sk-circleBounceDelay`. Cor `#1cd760`. Envolve o conteúdo e exibe durante carregamento.

---

### Layout

#### `AppLayout`
**Arquivo:** [`src/components/Layout/index.tsx`](src/components/Layout/index.tsx)

```typescript
interface Props {
  children: ReactElement;
}
```

Container raiz da aplicação. Gerencia painéis resizáveis (`react-resizable-panels`), modais, drawers e a barra de reprodução. Persiste estado dos painéis via `autoSaveId='persistence'`.

---

#### `Navbar`
**Arquivo:** [`src/components/Layout/components/Navbar/index.tsx`](src/components/Layout/components/Navbar/index.tsx)

Sem props. Contém:
- `HistoryNavigation` — botões voltar/avançar
- `Search` — campo de busca expansível
- `Header` — avatar e menu do usuário

Oculto (`visibility: hidden`) em `< 768px`.

---

#### `Library`
**Arquivo:** [`src/components/Layout/components/Library/index.tsx`](src/components/Layout/components/Library/index.tsx)

Sidebar esquerda. Sub-componentes: `Title`, `Filters`, `AddPlaylistButton`, `YourLibrary` (lista). Dois estados de exibição:
- **Collapsed** (85px): apenas ícones
- **Expanded** (280px+): lista completa com filtros

---

#### `PlayingNow`
**Arquivo:** [`src/components/Layout/components/NowPlaying/index.tsx`](src/components/Layout/components/NowPlaying/index.tsx)

Sidebar direita com três abas:
- **Queue** — próximas faixas
- **Details** — detalhes da faixa atual + próxima
- **Devices** — lista de dispositivos disponíveis

---

#### `NowPlayingBar`
**Arquivo:** [`src/components/Layout/components/PlayingBar/index.tsx`](src/components/Layout/components/PlayingBar/index.tsx)

Barra inferior fixa. Sub-componentes:

| Sub-componente | Descrição |
|---|---|
| `SongDetails` | Capa, nome da música e artistas |
| `PlayControls` | Shuffle, prev, play/pause, next, repeat |
| `SongProgressBar` | Slider de progresso com tempos |
| `Volume` | Slider de volume com ícone de mute |
| `ExtraButtons` | Queue, devices, details, fullscreen |
| `OtherDeviceAlert` | Alerta quando tocando em outro dispositivo |

Versão mobile: `mobilePlayer.tsx` (compacto, sem controles avançados).

---

#### `PageHeader`
**Arquivo:** [`src/components/Layout/components/Header/index.tsx`](src/components/Layout/components/Header/index.tsx)

```typescript
interface Props {
  children: any;
  color: string;              // cor extraída do álbum/playlist
  activeHeider?: number;
  hiddenContent?: boolean;
  activeContentHeight?: number;
  container: RefObject<HTMLDivElement | null>;
  sectionContainer?: RefObject<HTMLDivElement | null>;
}
```

Header sticky com gradiente gerado a partir da cor dominante do conteúdo. Fica transparente no topo e aparece gradualmente no scroll (`transition: background-color 0.6s ease-in-out`).

---

### Listas e Cards

#### `GridItemList`
**Arquivo:** [`src/components/Lists/list.tsx`](src/components/Lists/list.tsx)

```typescript
interface Props {
  title?: ReactNode;
  headerClassName?: string;
  items: Item[];              // Album | Playlist | Artist | Track
  moreUrl?: string;
  extra?: ReactNode;
  chips?: ReactNode;
  subtitle?: string;
  multipleRows?: boolean;
  horizontalScroll?: boolean;
  headerActionsAlign?: 'center' | 'bottom';
  onItemClick?: (item: Item) => void;
  onItemDelete?: (item: Item) => void;
  getDescription?: (item: Item) => string;
}
```

Container universal de listas. Suporta grid responsivo e scroll horizontal (carousel). Faz o dispatch para o tipo correto de card automaticamente.

---

#### Cards de Grid
**Arquivo:** [`src/components/Lists/GridCards.tsx`](src/components/Lists/GridCards.tsx)

| Componente | Props principais | Descrição |
|---|---|---|
| `ArtistCard` | `item: Artist, onClick?, getDescription?` | Foto circular, nome, "Artista" |
| `AlbumCard` | `item: Album, onClick?, getDescription?` | Capa quadrada, título, ano |
| `PlaylistCard` | `item: Playlist, onClick?, getDescription?` | Capa, título, descrição |
| `TrackCard` | `item: Track, onClick?, getDescription?` | Capa, título, artistas |

Todos com hover que exibe `PlayCircle` no canto inferior direito.

---

#### `PlayCircle`
**Arquivo:** [`src/components/Lists/PlayCircle.tsx`](src/components/Lists/PlayCircle.tsx)

```typescript
interface Props {
  size?: number;
  big?: boolean;
  image?: string;
  isCurrent?: boolean;
  context?: {
    context_uri?: string;
    uris?: string[];
  };
}
```

Botão de play circular verde (`#1ed760`) que aparece no hover de cards. `isCurrent` exibe pause ao invés de play. Animação `transform: scale(1.1)` no hover.

---

#### `ScrollableGridCarousel`
**Arquivo:** [`src/components/Lists/ScrollableGridCarousel.tsx`](src/components/Lists/ScrollableGridCarousel.tsx)

```typescript
interface Props {
  children: ReactNode;
  className?: string;
}
```

Carousel horizontal com botões de seta. Gradiente de fade nas bordas (`linear-gradient`). Scroll suave via `scrollBy`.

---

### Tabela de Músicas

#### `SongView`
**Arquivo:** [`src/components/SongsTable/songView.tsx`](src/components/SongsTable/songView.tsx)

```typescript
interface Props {
  song: Track;
  index?: number;
  saved?: boolean;
  canEdit?: boolean;
  addedAt?: string;
  activable?: boolean;
  size?: 'small' | 'normal';
  album?: Album | null;
  playlist?: Playlist | null;
  artist?: Artist | null;
  onToggleLike?: () => void;
  view: 'LIST' | 'COMPACT';
  context: {
    context_uri?: string;
    uris?: string[];
    offset?: { position: number };
  };
  fields: ((props: ComponentProps) => React.ReactElement | null)[];
}
```

Linha de música composta por sub-componentes declarativos via prop `fields`:

| Sub-componente | Uso |
|---|---|
| `SongViewComponents.Title` | Nome da música |
| `SongViewComponents.Cover` | Capa do álbum |
| `SongViewComponents.TitleWithCover` | Cover + título juntos |
| `SongViewComponents.ClickeableCover` | Cover clicável |
| `SongViewComponents.Artists` | Lista de artistas linkados |
| `SongViewComponents.Album` | Nome do álbum linkado |
| `SongViewComponents.AddedAt` | Data de adição (formato relativo) |
| `SongViewComponents.AddToLiked` | Botão de like/unlike |
| `SongViewComponents.Actions` | Menu de ações (3 pontos) |
| `SongViewComponents.Time` | Duração da faixa |

---

#### `TableHeader`
**Arquivo:** [`src/components/SongsTable/header.tsx`](src/components/SongsTable/header.tsx)

```typescript
interface Props {
  view: 'COMPACT' | 'LIST';
  fields: ((props: ItemProps) => React.ReactElement | null)[];
}
```

Sub-componentes de cabeçalho correspondentes: `Index`, `Title`, `Artists`, `Time`, `Space`, `Album`, `DateAdded`.

---

#### `SongSkeleton`
**Arquivo:** [`src/components/SongsTable/skeleton.tsx`](src/components/SongsTable/skeleton.tsx)

Loading skeleton para linhas da tabela. Usa animação de shimmer (`background-animation`).

---

### Ações e Context Menus

Todos os wrappers de ação usam o mesmo padrão:

```typescript
interface Props {
  children: React.ReactNode | React.ReactNode[];
  trigger?: ('contextMenu' | 'click')[];  // default: contextMenu
}
```

| Componente | Arquivo | Item alvo |
|---|---|---|
| `TrackActionsWrapper` | `src/components/Actions/TrackActions.tsx` | Faixa |
| `AlbumActionsWrapper` | `src/components/Actions/AlbumActions.tsx` | Álbum |
| `ArtistActionsWrapper` | `src/components/Actions/ArtistActions.tsx` | Artista |
| `PlaylistActionsWrapper` | `src/components/Actions/PlaylistActions.tsx` | Playlist |

`TrackActionsWrapper` tem props adicionais: `saved?`, `canEdit?`, `album?`, `artist?`, `playlist?`, `onSavedToggle?`.

---

#### `AddSongToLibraryButton`
**Arquivo:** [`src/components/Actions/AddSongToLibrary.tsx`](src/components/Actions/AddSongToLibrary.tsx)

```typescript
interface Props {
  size?: number;
  isSaved: boolean;
  id: string;
  onToggle: () => void;
}
```

Botão de coração animado. `isSaved=false`: contorno `#b3b3b3`. `isSaved=true`: preenchido `#1ed760`.

---

### Modais e Drawers

| Componente | Arquivo | Trigger |
|---|---|---|
| `LoginModal` | `src/components/Modals/LoginModal.tsx` | Redux state `ui.loginModal` |
| `EditPlaylistModal` | `src/components/Modals/EditPlaylistModal.tsx` | Redux state `ui.editPlaylistModal` |
| `LanguageModal` | `src/components/Modals/LanguageModal.tsx` | Redux state `ui.languageModal` |
| `LibraryDrawer` | `src/components/Drawers/LibraryDrawer.tsx` | Mobile `< 900px` |
| `PlayingNowDrawer` | `src/components/Drawers/PlayingNowDrawer.tsx` | Mobile `< 900px` |

---

### Componentes de Estado Vazio / Full Screen

#### `FullScreenPlayer`
**Arquivo:** [`src/components/FullScreen/index.tsx`](src/components/FullScreen/index.tsx)

```typescript
interface Props {
  onExit: () => Promise<void>;
}
```

Player em tela cheia com arte do álbum ampliada, gradient animado de fundo, controles centralizados e slider de volume.

---

## 10. Ícones

### Biblioteca Custom SVG
**Arquivo:** [`src/components/Icons/index.tsx`](src/components/Icons/index.tsx)

60+ ícones SVG como componentes React. Todos com atributo `data-encore-id` (padrão Encore Design System).

**Padrão de cor:**
- Inativo: `fill="#b3b3b3"`
- Ativo/Hover: `fill="#ffffff"` ou `fill="#1ed760"`
- Via prop: `active?: boolean`

**ViewBox padrão:** `16 0 16 16` ou `0 0 24 24`

#### Navegação
| Ícone | Componente | Estado ativo |
|---|---|---|
| Home | `HomeIcon` / `ActiveHomeIcon` | Preenchido |
| Browse | `BrowseIcon` | — |
| Search | `SearchIcon` | — |
| Library | `LibraryIcon` / `LibraryCollapsedIcon` | — |

#### Player
| Ícone | Componente |
|---|---|
| Play | `Play` |
| Pause | `Pause` |
| Pular para frente | `SkipNext` |
| Pular para trás | `SkipBack` |
| Repetir | `Replay` |
| Repetir 1 | `ReplayOne` |
| Shuffle | `ShuffleIcon` |

#### Volume
| Ícone | Componente |
|---|---|
| Volume cheio | `VolumeIcon` |
| Volume baixo | `VolumeOneIcon` |
| Volume médio | `VolumeTwoIcon` |
| Mudo | `VolumeMuteIcon` |

#### Biblioteca e Ações
| Ícone | Componente |
|---|---|
| Adicionar à biblioteca | `AddToLibrary` |
| Adicionado | `AddedToLibrary` |
| Deletar | `DeleteIcon` |
| Adicionar à fila | `AddToQueueIcon` |
| Adicionar à playlist | `AddToPlaylist` |
| Nova playlist | `NewPlaylistIcon` |
| Editar | `EditIcon` |

#### UI Geral
| Ícone | Componente |
|---|---|
| Menu 3 pontos | `MenuDots` |
| Menu hamburguer | `MenuIcon` |
| Fechar | `CloseIcon` / `CloseIcon2` |
| Expandir | `ExpandIcon` / `ExpandOutIcon` |
| Seta baixo | `ArrowDownIcon` |
| Seta cima | `ArrowUpIcon` |
| Verificado | `VerifiedIcon` |
| Mundo | `WorldIcon` |
| Relógio | `Clock` |
| Grade | `GridIcon` |

#### Dispositivos
| Ícone | Componente |
|---|---|
| Dispositivo genérico | `DeviceIcon` |
| Mobile | `MobileIcon` |
| Laptop | `LaptopIcon` |
| Telefone | `PhoneIcon` |
| Speaker | `SpeakerIcon` |

### Ícones react-icons
**Pacote:** `react-icons/fa6`

| Ícone | Componente | Uso |
|---|---|---|
| Logo Spotify | `FaSpotify` | Navbar, loading |
| Cadeado fechado | `FaLock` | Playlist privada |
| Cadeado aberto | `FaUnlock` | Playlist pública |

---

## 11. Assets

**Diretório:** [`public/images/`](public/images/)

| Arquivo | Tipo | Uso |
|---|---|---|
| `playlist.png` | PNG | Placeholder de capa de playlist |
| `liked-songs.png` | PNG | Coleção "Músicas Curtidas" |
| `artist.png` | PNG | Placeholder de foto de artista |
| `no-episodes.png` | PNG | Estado vazio — sem episódios (podcasts) |
| `equaliser-animated.gif` | GIF | Indicador animado de faixa tocando na library |
| `previous_song.svg` | SVG | Botão anterior (estado normal) |
| `previous_song_hover.svg` | SVG | Botão anterior (estado hover) |
| `next_song.svg` | SVG | Botão próximo (estado normal) |
| `next_song_hover.svg` | SVG | Botão próximo (estado hover) |
| `forward.svg` | SVG | Botão avançar |

**Favicons:** `public/favicon.ico`, `public/favicon16.png`, `public/favicon32.png`

---

## 12. Páginas

| Página | Rota | Componente raiz | Descrição |
|---|---|---|---|
| Home | `/` | `src/pages/Home/index.tsx` | Seções dinâmicas: recentes, recomendados, top |
| Album | `/album/:id` | `src/pages/Album/index.tsx` | Header, tracklist, outros álbuns |
| Artista | `/artist/:id` | `src/pages/Artist/index.tsx` | Header com foto, top tracks, discografia |
| Playlist | `/playlist/:id` | `src/pages/Playlist/index.tsx` | Header, tracklist, recomendações |
| Busca Home | `/search` | `src/pages/Search/Home/index.tsx` | Categorias de browse |
| Resultados de busca | `/search/:query` | `src/pages/Search/Container/index.tsx` | Top result, faixas, artistas, álbuns, playlists |
| Músicas Curtidas | `/liked` | `src/pages/LikedSongs/index.tsx` | Todas as músicas salvas |
| Browse | `/browse` | `src/pages/Browse/index.tsx` | Categorias/gêneros |
| Gênero | `/genre/:id` | `src/pages/Genre/index.tsx` | Playlists de um gênero |
| Discografia | `/discography/:id` | `src/pages/Discography/index.tsx` | Todos os álbuns do artista |
| Perfil do usuário | `/user/:id` | `src/pages/User/Home/index.tsx` | Estatísticas, playlists, artistas seguidos |
| Músicas do usuário | `/user/:id/songs` | `src/pages/User/Songs/index.tsx` | Top tracks do usuário |
| Artistas seguidos | `/user/:id/artists` | `src/pages/User/Artists/index.tsx` | Artistas seguidos |
| Playlists do usuário | `/user/:id/playlists` | `src/pages/User/Playlists/index.tsx` | Playlists públicas |
| 404 | `*` | `src/pages/404/index.tsx` | Página não encontrada |

### Padrão de Página

Todas as páginas com header dinâmico seguem o padrão:
1. Recebem `container: RefObject<HTMLDivElement>` para calcular scroll
2. Usam `PageHeader` com `color` extraído da imagem principal via `colorthief`
3. Header muda de transparente para gradiente colorido conforme o scroll
4. Conteúdo em scroll infinito (`react-infinite-scroll-component`)

---

*Gerado a partir do código-fonte em [`src/`](src/) — versão `2.0.7`*
