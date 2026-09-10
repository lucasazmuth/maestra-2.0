"""A conversa com a fila.

O worker fala com o banco por FUNÇÕES, e nunca por `update` direto nas tabelas. Não é
preciosismo: é o que mantém num só lugar as regras que importam — quem pode reservar o quê,
como se conta uma tentativa, e a invariante de que resultado de máquina não escreve por cima
do que o artista digitou. Ver `supabase/migrations/20260909120000_fila_de_analise_de_audio.sql`.

As funções são `security definer` e só o `service_role` pode executá-las.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

import httpx


@dataclass(frozen=True)
class Trabalho:
    id: str
    artist_id: str
    version_id: str | None
    tipo: str
    entrada: dict[str, Any]
    tentativas: int

    @classmethod
    def de_linha(cls, linha: dict[str, Any]) -> "Trabalho":
        return cls(
            id=linha["id"],
            artist_id=linha["artist_id"],
            version_id=linha.get("version_id"),
            tipo=linha["tipo"],
            entrada=linha.get("entrada") or {},
            tentativas=linha.get("tentativas") or 0,
        )


class Fila:
    def __init__(self, url: str, chave_de_servico: str, worker: str) -> None:
        self._base = url.rstrip("/")
        self._worker = worker
        self._http = httpx.Client(
            timeout=60,
            headers={
                "apikey": chave_de_servico,
                "Authorization": f"Bearer {chave_de_servico}",
                "Content-Type": "application/json",
            },
        )

    def _rpc(self, nome: str, **argumentos: Any) -> Any:
        resposta = self._http.post(f"{self._base}/rest/v1/rpc/{nome}", json=argumentos)
        resposta.raise_for_status()
        return resposta.json()

    def reservar(self, lote: int = 1, posse_segundos: int = 900) -> list[Trabalho]:
        """Pega trabalho.

        O `for update skip locked` do lado do banco é o que permite mais de uma máquina sem
        trabalho duplicado: quem chega em segundo SALTA a linha já travada em vez de esperar
        por ela — e esperar seria pior, porque acabaria por processar o mesmo trabalho.
        """
        linhas = self._rpc(
            "reservar_trabalhos_de_audio",
            p_worker=self._worker,
            p_lote=lote,
            p_posse_segundos=posse_segundos,
        )
        return [Trabalho.de_linha(linha) for linha in (linhas or [])]

    def pulsar(self, trabalho_id: str, posse_segundos: int = 900) -> bool:
        """Diz que ainda está vivo.

        Sem isto, uma transcrição longa ultrapassa a posse e outra máquina reclama o trabalho no
        meio do caminho — as duas gastam CPU no mesmo áudio e só uma consegue gravar.
        """
        return bool(self._rpc(
            "pulsar_trabalho_de_audio",
            p_id=trabalho_id, p_worker=self._worker, p_posse_segundos=posse_segundos,
        ))

    def registrar_analise(
        self, trabalho_id: str, arquivo_sha256: str, motor: str, analise: dict[str, Any]
    ) -> bool:
        """Grava a análise e fecha o trabalho, numa transação só.

        Em duas chamadas, gravar a análise e falhar ao fechar o trabalho deixaria o pedido
        eternamente "a processar" com o resultado já no banco: a tela giraria para sempre em
        cima de um número que existe.
        """
        return bool(self._rpc(
            "registrar_analise_de_audio",
            p_job_id=trabalho_id, p_worker=self._worker,
            p_arquivo_sha256=arquivo_sha256, p_motor=motor, p_analise=analise,
        ))

    def falhar(self, trabalho_id: str, erro: str, retentavel: bool = True) -> bool:
        """Devolve o trabalho com um erro.

        `retentavel=False` é para o que não adianta repetir: formato que o ffmpeg não abre,
        áudio de zero segundo, arquivo corrompido. Gastar três tentativas a falhar da mesma
        maneira só atrasa a resposta a quem está à espera.
        """
        return bool(self._rpc(
            "falhar_trabalho_de_audio",
            p_id=trabalho_id, p_worker=self._worker,
            p_erro=erro[:500], p_retentavel=retentavel,
        ))

    def baixar(self, balde: str, caminho: str) -> bytes:
        """O arquivo, pelo caminho no balde.

        Pelo caminho e com o service role, e não pela URL pública: é o que garante que estamos
        a ler o arquivo que a versão aponta, e continua a funcionar se o balde deixar de ser
        público um dia.
        """
        resposta = self._http.get(f"{self._base}/storage/v1/object/{balde}/{caminho}")
        resposta.raise_for_status()
        return resposta.content

    def fechar(self) -> None:
        self._http.close()


def da_ambiente(worker: str) -> Fila:
    url = os.environ["SUPABASE_URL"]
    chave = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return Fila(url, chave, worker)
