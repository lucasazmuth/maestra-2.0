# Chartmetric API

## Fonte de verdade local

`Chartmetric Developer API.yaml` e a especificacao OpenAPI recebida em 14 de
setembro de 2026. Hash SHA-256:

`2483b154e6cb221863abc3eec9a80f3c39df4c0fa6aff0716981c257c4789e80`

Antes de alterar uma chamada, payload ou parser do Chartmetric, consulte esse
arquivo e atualize esta nota quando a Chartmetric publicar outra versao.

## Rotas usadas pela Maestra

| Necessidade | Rota | Contrato importante |
| --- | --- | --- |
| Resolver ID | `GET /api/artist/spotify/{id}/get-ids` | Converte o ID Spotify em ID Chartmetric. |
| Metadados | `GET /api/artist/{id}` | Fonte de metadados e `cm_statistics`. |
| Metricas | `GET /api/artist/{id}/stat/{source}` | Usar `field`, `since` e `until` conforme a metrica. |
| Cidades/paises | `GET /api/artist/{id}/where-people-listen` | Apos 2024-08-12, alguns valores sao estimativas da Chartmetric. O payload sinaliza isso com `is_estimate`; nao os apresentar como medicao direta do Spotify. |
| Audiencia social | `GET /api/artist/{id}/{instagram,youtube,tiktok}-audience-stats` | Em 1 de outubro de 2026, campos de social audience mudam de fonte e alguns deixam de atualizar. Tratar ausencia como indisponibilidade, nao como zero. |
| Playlists do artista | `GET /api/artist/{id}/{platform}/{status}/playlists` | Rota correta para saber em quais playlists as faixas do artista aparecem. `platform=spotify`, `status=current` para o diagnostico atual. |
| Artistas proximos | `GET /api/artist/{id}/neighboring-artists` | Rota usada pelo enriquecimento. |

## Playlists: regra operacional

A rota global `GET /api/playlist/spotify/lists` lista o catalogo inteiro do
Spotify. Ela nao aceita artista como filtro e nao pode substituir a rota de
playlists por artista.

Para `GET /api/artist/{id}/spotify/current/playlists`:

- a resposta possui entradas em `obj`, com `playlist` e `track` aninhados;
- `playlist.editorial` e o indicador de curadoria editorial oficial;
- `limit` aceita de 1 a 100;
- a documentacao alerta que, sem flags booleanas explicitas, a API pode
  devolver `obj: []`;
- `editorial` e suportado em Spotify e tem valor padrao documentado `true`.

Por isso, cada objetivo precisa de uma chamada com filtro explicito. Para a
contagem de editoriais, usar `editorial=true`. Para o painel de todas as
playlists, validar em payload real a semantica de `editorial=false` antes de
substituir a chamada atual: a descricao diz que esse valor inclui playlists de
usuarios, mas a tabela tambem alerta que flags nao sao mutuamente exclusivos.

O parser atual preserva o sinal em
`supabase/functions/artist-diagnostic/index.ts` e
`supabase/functions/artist-enrich-chartmetric/index.ts`. Ao mudar o contrato,
ajuste os dois no mesmo commit e cubra tanto `obj` quanto entradas aninhadas.

## Protecoes de dados

- Numeros agregados podem chegar como string; normalizar antes de calcular.
- Campos ausentes, `null`, 4xx e rate limit sao estados diferentes de `0`.
- Guardar payload bruto e timestamp durante depuracoes de contrato.
- Nao registrar token Chartmetric, cabecalho Authorization ou dados pessoais
  fora da infraestrutura autorizada.
