-- Declaração de vínculo do usuário com o Perfil de Artista que ele cria.
--
-- POR QUE: hoje qualquer pessoa cria um perfil de qualquer artista, preenche o questionário com
-- números inventados e gera um PDF com a marca da Maestra, que circula por e-mail e WhatsApp. Os
-- Termos já vedam usar a plataforma para violar direito de terceiro (§9) e preveem indenização
-- (§14), mas nada disso é acionável sem PROVA de quem declarou o quê, e quando.
--
-- Esta migration não impede a criação — a declaração é registrada, não bloqueante. O valor está em
-- tornar a má-fé explícita e datada, com IP e a versão exata dos Termos vigentes no momento.

-- A trilha nasceu por USUÁRIO (aceite de política, termos, maioridade). Esta declaração é por
-- PERFIL: a mesma conta pode declarar vínculos diferentes com artistas diferentes. Nulo em todas
-- as linhas que já existem, que são consentimentos de conta.
alter table public.user_consents
  add column if not exists artist_id uuid references public.artists(id) on delete cascade;

comment on column public.user_consents.artist_id is
  'Perfil de Artista a que a declaração se refere. Nulo nos consentimentos de conta.';

create index if not exists user_consents_artist_idx
  on public.user_consents (artist_id, kind, occurred_at desc)
  where artist_id is not null;

-- O CHECK de `kind` é uma lista fechada: sem estender, o insert de 'vinculo_artista' falha.
alter table public.user_consents drop constraint if exists user_consents_kind_check;
alter table public.user_consents add constraint user_consents_kind_check
  check (kind in ('politica_privacidade', 'termos', 'maioridade', 'comunicacoes', 'pesquisa',
                  'vinculo_artista'));
