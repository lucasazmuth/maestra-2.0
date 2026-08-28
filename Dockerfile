ARG REACT_APP_SPOTIFY_CLIENT_ID
ARG REACT_APP_SPOTIFY_REDIRECT_URL=http://127.0.0.1:3000/

# build environment
FROM node:18.12 as builder
WORKDIR /usr/src/app

# Manifestos antes do codigo: assim o install vira uma camada cacheada, refeita so quando as
# dependencias mudam. Os package.json dos WORKSPACES vem junto — sem eles o npm nao monta o link
# de @maestra/core, e o build nao resolve o pacote.
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/

# `npm ci` no lugar do `yarn install --only=production` que estava aqui. O comando antigo tinha
# dois defeitos, e os dois so ficaram visiveis quando a producao caiu:
#
#   1. O repositorio migrou para npm + workspaces. O yarn.lock continuou no repositorio como
#      lockfile secundario, e era dele que a imagem instalava — outro grafo de dependencias,
#      resolvido por outro gerenciador, diferente do que qualquer pessoa tem localmente.
#   2. `--only=production` omite as devDependencies, e o build PRECISA delas: `typescript` compila
#      o @maestra/core no prebuild, e o @reduxjs/toolkit e usado pelo app inteiro.
#
# Ou seja, este build deveria falhar. Ele nao falhava porque nao havia .dockerignore: o `COPY . .`
# abaixo jogava o node_modules da maquina de quem buildava por cima do install do container, e a
# imagem saia com a mistura dos dois. Enquanto a maquina de origem estivesse "boa", passava. Foi
# assim que a producao quebrou com "createClient is not a function", na fronteira CommonJS do
# @maestra/core (o unico consumidor CJS do supabase-js), sem nenhuma mudanca de codigo relacionada.
#
# `--legacy-peer-deps` e necessario hoje: react-player-controls ainda declara peer de React <19.
# Sem ele o `npm ci` para com ERESOLVE. Isso e divida, nao solucao — vale resolver o conflito e
# tirar a flag depois.
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# production environment
FROM nginx:1.23.2-alpine
RUN rm -rf /etc/nginx/conf.d
COPY ./docker/nginx/default.conf /etc/nginx/conf.d/
COPY --from=builder /usr/src/app/build /usr/share/nginx/html
RUN chmod +r /usr/share/nginx/html/*
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
