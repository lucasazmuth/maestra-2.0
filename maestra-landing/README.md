# Maestra — Landing page

Landing page de marketing da **Maestra Manager**, **separada do app principal** (projeto Vite
próprio, pronto pra deploy na Vercel). Visual clean no estilo do design system do Spotify (preto/
branco, Inter, mínimo de bordas, sem gradientes), com o magenta da marca (`#af2896`) como acento.

## Rodar local

```bash
cd maestra-landing
npm install
npm run dev        # http://localhost:5173
npm run build      # gera dist/
npm run preview    # serve o dist/
```

## Deploy na Vercel (separado do app)

Crie um **novo projeto na Vercel** apontando para esta pasta:

- **Opção A (repo separado):** copie a pasta `maestra-landing` pra um repositório próprio e
  importe na Vercel. Framework detectado: **Vite**.
- **Opção B (monorepo):** importe o repositório e, nas configurações do projeto Vercel, defina
  **Root Directory = `maestra-landing`**.

Build já configurado em `vercel.json` (`vite build` → `dist/`).

## O que ajustar

- **URL do app:** `src/config.ts` → `APP_URL`. Hoje aponta pra `https://app.maestramanager.com.br`.
  Os botões "Começar grátis" / "Entrar" levam pra `${APP_URL}/signup` e `${APP_URL}/login`.
- **Preços:** `src/components/Plans.tsx` (`MONTHLY`, `ANNUAL`) — estáticos aqui.
- **Prints do produto:** Hero e Features usam placeholders. Troque por `<img src="...">` reais
  (diagnóstico, plano, Nyta) em `src/components/Hero.tsx` e nos `FeatureSection` do
  `src/pages/Home.tsx`.

## Estrutura

```
maestra-landing/
├─ index.html            # meta/title/favicon
├─ App.tsx               # renderiza <Home/>
├─ src/
│  ├─ config.ts          # APP_URL + signup/login
│  ├─ pages/Home.tsx     # composição das seções
│  └─ components/        # Logo, Header, Hero, FeaturesIntro, FeatureSection, Plans, Faq, CTASection, Footer
├─ tailwind.config.cjs
├─ vite.config.ts
└─ vercel.json
```
