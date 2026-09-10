-- O PAN e o TIPO da pista, e o volume MASTER da gravação.
--
-- Pan: −1 é tudo na esquerda, 0 é o centro, 1 é a direita. É o segundo controlo de qualquer
-- mesa depois do volume — é com ele que se abre espaço entre duas camadas que disputam a mesma
-- frequência, sem baixar nenhuma delas.
--
-- Tipo: por agora só 'audio' toca. Os outros existem porque a tela os mostra e porque a pista
-- guarda essa escolha desde já — quando o piano roll e o sequenciador entrarem, a pista já sabe
-- o que é, e ninguém tem de reclassificar nada à mão.
alter table catalog_tracks
  add column if not exists pan numeric(4,3) not null default 0 check (pan >= -1 and pan <= 1),
  add column if not exists kind text not null default 'audio'
    check (kind in ('audio', 'synth', 'piano', 'drums'));

-- O volume geral da montagem. Vive na GRAVAÇÃO, e não na pista: é o fader que fica depois de
-- todos os outros. 0.8 de partida é o que a referência mostra (80%), e é folga suficiente para
-- somar seis pistas sem encostar no teto logo de saída.
alter table catalog_versions
  add column if not exists master_gain numeric(4,3) not null default 0.8
    check (master_gain >= 0 and master_gain <= 1);
