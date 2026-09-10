"""BPM e tom, com o essentia.

O que sai daqui NUNCA escreve por cima de `catalog_versions.bpm` e `key`, que são texto que o
artista digitou. Vai para `version_analysis`, aparece ao lado do campo com um "usar", e quem
decide é a pessoa. A razão é simples: o detector erra, e erra de um jeito específico.

⚠️ SOBRE A CONFIANÇA DO TOM. O `KeyExtractor` confunde relativa maior com menor com frequência
conhecida (Am e C têm as mesmas notas). Por isso a confiança vai gravada junto e a tela mostra
o número: um tom com confiança baixa é uma sugestão, não uma resposta, e apresentá-lo com a
mesma cara de um BPM (que é bem mais confiável) enganaria quem lê.
"""

from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path
from typing import Any

MOTOR = "essentia-2.1b6.dev1110"

# 44.1 kHz mono é o que os extratores do essentia esperam. Deixar a taxa original faz o
# RhythmExtractor devolver BPM proporcionalmente errado quando o arquivo vem em 48 kHz — e o
# número sai plausível, que é o pior tipo de erro.
TAXA = 44100


def _para_wav(bytes_do_audio: bytes, pasta: Path) -> Path:
    """MP3/WAV/o que for → WAV mono 44.1 kHz, pelo ffmpeg."""
    entrada = pasta / "entrada"
    entrada.write_bytes(bytes_do_audio)
    saida = pasta / "audio.wav"
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-i", str(entrada), "-ac", "1", "-ar", str(TAXA), str(saida)],
        check=True,
    )
    return saida


def analisar(bytes_do_audio: bytes) -> dict[str, Any]:
    """Devolve BPM, tom e duração de um arquivo de áudio.

    Importa o essentia DENTRO da função de propósito: ele carrega modelos e pesa alguns
    segundos, e assim o worker sobe e começa a atender a fila antes de pagar esse custo — e um
    trabalho de outro tipo nunca paga por ele.
    """
    import essentia.standard as es  # noqa: PLC0415

    with tempfile.TemporaryDirectory() as tmp:
        pasta = Path(tmp)
        wav = _para_wav(bytes_do_audio, pasta)

        audio = es.MonoLoader(filename=str(wav), sampleRate=TAXA)()
        if len(audio) < TAXA:  # menos de um segundo
            raise ValueError("O áudio é curto demais para analisar.")

        bpm, _batidas, confianca_do_bpm, _, _ = es.RhythmExtractor2013(method="multifeature")(audio)
        tom, escala, forca = es.KeyExtractor()(audio)

        return {
            "bpm": round(float(bpm), 1),
            # O extrator devolve a confiança numa escala de 0 a 5.32; normalizada para 0..1,
            # que é a faixa que a coluna aceita e a única em que "0,8" quer dizer alguma coisa.
            "bpm_confianca": round(min(float(confianca_do_bpm) / 5.32, 1.0), 3),
            "tom": str(tom),
            "tom_escala": str(escala),
            "tom_confianca": round(float(forca), 3),
            "duracao_segundos": round(len(audio) / TAXA, 2),
        }
