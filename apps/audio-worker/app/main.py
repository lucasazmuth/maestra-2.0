"""O worker de áudio: pede trabalho à fila, faz, devolve, e volta a dormir.

Corre fora do Supabase porque o que ele faz não cabe numa edge function: ffmpeg e essentia são
binários, e o Deno Deploy não executa binário nem dá minutos de CPU.

O ciclo é de propósito burro. Toda a regra — quem pode pedir, qual a cota, o que fazer quando
falha, quanto esperar até tentar de novo — vive no banco, nas funções da migration da fila.
Aqui só há: reservar, processar, devolver. É o que permite trocar o que está dentro de
`tarefas/` (outro modelo, uma API paga, outra máquina) sem tocar em mais nada do produto.

Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AUDIO_WORKER_KEY,
           PORTA (padrão 8080), OCIOSO_ATE_DORMIR (padrão 120s).
"""

from __future__ import annotations

import hashlib
import logging
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

from app.fila import Fila, Trabalho, da_ambiente
from app.tarefas import bpm_tom

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("audio-worker")

# O nome desta máquina na fila. É por ele que as funções sabem que quem devolve o resultado é
# quem reservou o trabalho — um worker zombie, que perdeu a posse e acordou depois, não escreve
# por cima de quem de facto fez o serviço.
WORKER = os.environ.get("FLY_MACHINE_ID") or f"worker-{os.getpid()}"

# Sem trabalho por este tempo, o processo sai com 0 e a máquina adormece. É o que faz a conta
# ser proporcional ao uso: uma equipe pequena não gera fila contínua.
OCIOSO_ATE_DORMIR = int(os.environ.get("OCIOSO_ATE_DORMIR", "120"))

# Enquanto processa, avisa que está vivo a cada meio período da posse.
POSSE_SEGUNDOS = 900
PULSO_SEGUNDOS = 300

TAREFAS = {"bpm_tom": bpm_tom}

# Erros que não adianta repetir: o arquivo não vai melhorar na terceira tentativa.
DEFINITIVOS = (ValueError,)


def processar(fila: Fila, trabalho: Trabalho) -> None:
    tarefa = TAREFAS.get(trabalho.tipo)
    if tarefa is None:
        # Um tipo que este worker não conhece é um deploy pela metade, não um arquivo ruim:
        # marcado como definitivo para não ficar a girar na fila até esgotar tentativas.
        fila.falhar(trabalho.id, f"Este worker não sabe fazer '{trabalho.tipo}'.", retentavel=False)
        return

    parar_o_pulso = threading.Event()

    def pulsar() -> None:
        while not parar_o_pulso.wait(PULSO_SEGUNDOS):
            fila.pulsar(trabalho.id, POSSE_SEGUNDOS)

    batida = threading.Thread(target=pulsar, daemon=True)
    batida.start()

    try:
        balde = trabalho.entrada.get("balde", "catalog")
        caminho = trabalho.entrada.get("caminho")
        if not caminho:
            fila.falhar(trabalho.id, "O trabalho não diz qual arquivo analisar.", retentavel=False)
            return

        bytes_do_audio = fila.baixar(balde, caminho)
        # O hash amarra a análise AO ARQUIVO. Sem ele, trocar o áudio da versão deixaria o
        # número antigo a mentir sobre o novo, e ninguém perceberia porque o número continua lá.
        sha256 = hashlib.sha256(bytes_do_audio).hexdigest()

        comecou = time.monotonic()
        analise = tarefa.analisar(bytes_do_audio)
        log.info(
            "%s %s em %.1fs: %s",
            trabalho.tipo, trabalho.id, time.monotonic() - comecou, analise,
        )

        fila.registrar_analise(trabalho.id, sha256, tarefa.MOTOR, analise)
    except DEFINITIVOS as e:
        log.warning("trabalho %s recusado: %s", trabalho.id, e)
        fila.falhar(trabalho.id, str(e), retentavel=False)
    except Exception as e:  # noqa: BLE001 — qualquer outra coisa merece nova tentativa
        log.exception("trabalho %s falhou", trabalho.id)
        fila.falhar(trabalho.id, str(e), retentavel=True)
    finally:
        parar_o_pulso.set()


def ciclo(fila: Fila) -> None:
    ocioso_desde = time.monotonic()
    while True:
        trabalhos = fila.reservar(lote=1, posse_segundos=POSSE_SEGUNDOS)
        if not trabalhos:
            if time.monotonic() - ocioso_desde > OCIOSO_ATE_DORMIR:
                log.info("sem trabalho há %ss; a dormir", OCIOSO_ATE_DORMIR)
                return
            time.sleep(2)
            continue
        ocioso_desde = time.monotonic()
        for trabalho in trabalhos:
            processar(fila, trabalho)


class Porta(BaseHTTPRequestHandler):
    """Só duas rotas: uma para a plataforma saber que estamos vivos, outra para acordar.

    O toque em `/acordar` é o que tira a máquina do sono — no Fly, o próprio pedido HTTP a
    liga. A chave existe porque sem ela qualquer pessoa acende a máquina em ciclo e a conta de
    CPU é nossa.
    """

    def do_GET(self) -> None:  # noqa: N802
        self.send_response(200 if self.path == "/saude" else 404)
        self.end_headers()
        self.wfile.write(b"ok" if self.path == "/saude" else b"")

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/acordar":
            self.send_response(404)
            self.end_headers()
            return
        esperada = os.environ.get("AUDIO_WORKER_KEY")
        if esperada and self.headers.get("x-worker-key") != esperada:
            self.send_response(401)
            self.end_headers()
            return
        # Responde já: quem chama é a edge function de enfileirar, e ela não pode ficar à espera
        # de uma análise de três minutos para dizer a alguém que o pedido entrou na fila.
        self.send_response(202)
        self.end_headers()
        self.wfile.write(b"acordado")

    def log_message(self, *_args) -> None:
        """Silencia o log por pedido do http.server, que polui e não diz nada."""


def main() -> None:
    porta = int(os.environ.get("PORTA", "8080"))
    servidor = HTTPServer(("0.0.0.0", porta), Porta)
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    log.info("worker %s à escuta na porta %s", WORKER, porta)

    fila = da_ambiente(WORKER)
    try:
        ciclo(fila)
    finally:
        fila.fechar()


if __name__ == "__main__":
    main()
