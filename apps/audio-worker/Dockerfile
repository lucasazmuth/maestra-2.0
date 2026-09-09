# O worker de áudio.
#
# ⚠️ DESENVOLVIMENTO É SEMPRE POR AQUI, nunca `pip install` na máquina de ninguém: o essentia só
# tem wheel para Linux x86_64 e versões específicas de Python. No Apple Silicon a instalação
# nativa é um pântano, e a versão que sair de lá não é a que corre em produção.
FROM python:3.11-slim

# O ffmpeg é quem converte qualquer entrada para o WAV mono 44.1 kHz que o essentia espera.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# `-u` para o log sair sem buffer: com buffer, um worker que morre a meio leva consigo as
# últimas linhas, que são exatamente as que explicam por que ele morreu.
CMD ["python", "-u", "-m", "app.main"]
