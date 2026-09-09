# O worker de áudio

Pede trabalho à fila `audio_jobs`, processa, devolve, e volta a dormir.

Corre **fora do Supabase** porque o que ele faz não cabe numa edge function: ffmpeg e essentia
são binários, e o Deno Deploy não executa binário nem dá minutos de CPU.

## O que ele NÃO decide

Nada. Quem pode pedir, qual a cota, o que fazer quando falha, quanto esperar até tentar de novo
— tudo isso vive no banco, nas funções de `supabase/migrations/20260909120000_fila_de_analise_de_audio.sql`.
O worker só reserva, processa e devolve.

É isso que permite trocar o que está dentro de `app/tarefas/` — outro modelo, uma API paga,
outra máquina — sem tocar em mais nada do produto.

## ⚠️ Não instale nada na sua máquina

O `essentia-tensorflow` só tem wheel para **Linux x86_64** e versões específicas de Python. No
Apple Silicon a instalação nativa é um pântano, e a versão que sair de lá não é a que corre em
produção. Desenvolvimento é sempre no contêiner:

```bash
docker build -t maestra-audio-worker apps/audio-worker
```

Para correr contra o Supabase real (cuidado: ele vai processar trabalhos de verdade):

```bash
docker run --rm -p 8080:8080 \
  -e SUPABASE_URL=https://tpwmzcgtidaxgxwqfxwf.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e AUDIO_WORKER_KEY=... \
  maestra-audio-worker
```

## Publicar

O deploy é seu — eu não crio contas em serviços externos.

```bash
fly launch --no-deploy --name maestra-audio-worker
fly secrets set \
  SUPABASE_URL=https://tpwmzcgtidaxgxwqfxwf.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=... \
  AUDIO_WORKER_KEY=<invente uma chave longa>
fly deploy
```

Depois, no Supabase, para a fila deixar de esperar pelo cron e a máquina acordar na hora:

```bash
supabase secrets set \
  AUDIO_WORKER_URL=https://maestra-audio-worker.fly.dev \
  AUDIO_WORKER_KEY=<a mesma chave>
```

**Sem esses dois segredos nada quebra**: o pedido entra na fila e fica lá até haver worker. É o
estado enquanto a máquina não está no ar.

## O que custa

Com `performance-2x` (2 vCPU, 2 GB) a ~0,08 USD/hora, e faixas de quatro minutos:

| Tarefa | Tempo por faixa |
|---|---|
| `bpm_tom` (essentia) | 10 a 25 s |
| `sensorial` (essentia + modelos) | 20 a 40 s |
| `letra` (whisper em CPU) | 40 a 90 s |

Mil faixas por mês com BPM e tom dá menos de 1 USD de CPU. O motor do custo é a transcrição, e
é linear no volume.

**Vale saber antes de investir na transcrição própria:** a plataforma já tem `GROQ_API_KEY`
configurada (usada pela `nyta-chat`), e o whisper da Groq sai a cerca de 0,04 USD por hora de
áudio — mais barato do que a máquina que o correria. Das ferramentas planeadas, a letra é a
única em que "no nosso servidor" é claramente a opção mais cara.

## A memória

2 GB não é folga: o essentia carrega modelos. Com menos, o processo morre por memória no meio
da primeira análise — e na fila isso aparece como um trabalho que volta três vezes e desiste,
sem que o log diga o motivo.
