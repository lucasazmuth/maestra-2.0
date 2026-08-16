# Soundbox — referência de landing em HTML

Réplica em HTML/CSS dos três SVGs de referência (`Home1.svg`, `Sound.svg`, `Album.svg`), pra
servir de esqueleto na hora de montar a versão da Maestra. Não faz parte do app: são arquivos
estáticos, sem build, sem React.

```
home.html      → Home1.svg
sound.html     → Sound.svg
album.html     → Album.svg
soundbox.css   → estilos das três (tokens no topo)
img/           → 37 imagens extraídas dos SVGs
_contact.html  → índice visual das imagens (qual arquivo é qual)
```

## Como abrir

Abra `home.html` direto no navegador (duplo clique). Não precisa de servidor.

## De onde vieram as medidas

Os SVGs são exportações do Figma: as formas continuam sendo `rect`/`circle` com coordenadas, e só
os textos estão vetorizados. Então:

- **Cores, raios e tamanhos** saíram do próprio arquivo. Exemplos: o verde é `#B6FF52` (parada de
  gradiente), os cartões são `#162A47`, o rodapé `#162945`, o fundo é o degradê
  `#064BB5 → #040C18 → #064BB5` a 259°.
- **Prancheta**: 1440px de largura, conteúdo de 1110px (margem de 165px de cada lado).
- **Posições verticais**: conferidas uma a uma contra o SVG. Na home, os blocos batem com o
  original dentro de 8px, e a página fecha em 5044px contra 5075px do arquivo.
- **Textos** foram lidos das imagens (estão vetorizados, não dá pra copiar).
- **Fonte**: o arquivo não traz a fonte. Poppins é a mais próxima (geométrica, `a` de um andar,
  `O` circular) e é o que está no CSS.

## Imagens

As 37 imagens estavam embutidas em base64 dentro dos SVGs (por isso os arquivos tinham 3, 4 e
14 MB). Foram extraídas com este script:

```python
import re, base64
s = open('Home1.svg', encoding='utf-8').read()
pat = re.compile(r'<image\s+([^>]*?)xlink:href="data:image/(png|jpeg);base64,([^"]+)"', re.S)
for m in pat.finditer(s):
    ident = re.search(r'id="([^"]+)"', m.group(1)).group(1)
    ext = 'jpg' if m.group(2) == 'jpeg' else 'png'
    open(f'img/home1-{ident}.{ext}', 'wb').write(base64.b64decode(m.group(3)))
```

Abra `_contact.html` pra ver todas com o nome do arquivo embaixo.

## O que não é fiel ao original

- Os ícones dos cartões de recurso, as setas e os selos das lojas foram redesenhados em SVG
  inline (no original são vetores soltos, sem como extrair em grupo).
- O selo "Listen popular" é gerado por script (26 pontas) — o original tem o mesmo desenho, mas
  as pontas podem não cair no mesmo ângulo.
- Nas páginas `sound.html` e `album.html` conferi a estrutura e as medidas dos blocos, mas não
  fiz o alinhamento vertical linha a linha que fiz na home: os SVGs dessas duas usam grupos com
  `transform`, então as coordenadas dos `rect` não valem direto.
- O terceiro depoimento da home aparece cortado na direita no arquivo original; aqui ele é
  cortado do mesmo jeito, e o texto que falta foi completado.

## Pra montar a versão da Maestra

O CSS está dividido em três blocos comentados (`HOME`, `SOUND`, `ALBUM`) e os tokens ficam no
`:root`. Trocar `--neon`, `--card` e o degradê de `.page` já muda a cara inteira; a estrutura
(nav, hero, faixa de números, cartões, tabela, rodapé) segue valendo.
