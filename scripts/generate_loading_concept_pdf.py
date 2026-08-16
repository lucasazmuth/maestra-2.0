from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "maestra-global-loading-concept.pdf"

W, H = 1280, 720
NAVY = HexColor("#101B3E")
PANEL = HexColor("#172650")
BLUE = HexColor("#526B96")
SOFT_BLUE = HexColor("#A9B9D5")
MIST = HexColor("#E9EEF8")
WHITE_80 = HexColor("#DCE6FA")
LINE = HexColor("#2B3D70")


def mark(pdf, x, y, size, color=BLUE, alpha=1):
    """Draw the supplied Group 34 mark, whose source artwork uses a 125x126 viewBox."""
    pdf.saveState()
    pdf.setFillColor(color)
    pdf.setFillAlpha(alpha)
    scale = size / 126
    # Lower-left diagonal body from Group 34.svg.
    body = pdf.beginPath()
    body.moveTo(x, y)
    body.lineTo(x + 124.416 * scale, y)
    body.lineTo(x, y + 126 * scale)
    body.close()
    pdf.drawPath(body, fill=1, stroke=0)
    # Upper-right wedge from Group 34.svg.
    wedge = pdf.beginPath()
    wedge.moveTo(x + 125 * scale, y)
    wedge.lineTo(x + 73 * scale, y + 125 * scale)
    wedge.lineTo(x + 125 * scale, y + 125 * scale)
    wedge.close()
    pdf.drawPath(wedge, fill=1, stroke=0)
    pdf.restoreState()


def text(pdf, value, x, y, size, color, font="Helvetica", align="left"):
    pdf.setFont(font, size)
    pdf.setFillColor(color)
    if align == "center":
        x -= stringWidth(value, font, size) / 2
    pdf.drawString(x, y, value)


def stage(pdf, x, label, time, title, description, kind):
    pdf.setFillColor(PANEL)
    pdf.roundRect(x, 165, 250, 290, 18, fill=1, stroke=0)
    text(pdf, time, x + 24, 418, 12, SOFT_BLUE, "Helvetica-Bold")
    text(pdf, label, x + 24, 392, 11, HexColor("#7290C7"), "Helvetica-Bold")

    cx, cy = x + 125, 300
    if kind in ("beams", "pulse", "loop"):
        pdf.saveState()
        pdf.setStrokeColor(SOFT_BLUE)
        pdf.setLineCap(1)
        pdf.setLineWidth(2.4)
        pdf.setStrokeAlpha(0.26 if kind == "beams" else 0.16)
        pdf.line(cx - 72, cy - 17, cx - 18, cy + 18)
        pdf.line(cx + 18, cy + 18, cx + 72, cy - 17)
        pdf.restoreState()
    if kind in ("pulse", "loop"):
        for radius, alpha in ((51, .08), (38, .13)):
            pdf.saveState()
            pdf.setStrokeColor(SOFT_BLUE)
            pdf.setLineWidth(1.5)
            pdf.setStrokeAlpha(alpha)
            pdf.circle(cx, cy, radius, stroke=1, fill=0)
            pdf.restoreState()
    mark(pdf, cx - 24, cy - 24, 48, WHITE_80 if kind == "rest" else BLUE)
    if kind == "loop":
        pdf.saveState()
        pdf.setStrokeColor(HexColor("#6685C3"))
        pdf.setLineWidth(2)
        pdf.setStrokeAlpha(.55)
        pdf.arc(cx - 37, cy - 37, cx + 37, cy + 37, 30, 260)
        pdf.restoreState()

    text(pdf, title, cx, 228, 15, white, "Helvetica-Bold", "center")
    text(pdf, description, cx, 204, 10.5, WHITE_80, "Helvetica", "center")


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(OUTPUT), pagesize=(W, H))
    pdf.setTitle("Maestra Manager - conceito de loading global")
    pdf.setAuthor("Maestra Manager")

    pdf.setFillColor(NAVY)
    pdf.rect(0, 0, W, H, fill=1, stroke=0)

    mark(pdf, 74, 632, 28, HexColor("#87A2D8"))
    text(pdf, "Maestra", 111, 644, 19, white, "Helvetica-Bold")
    text(pdf, "MANAGER", 113, 630, 8, SOFT_BLUE, "Helvetica-Bold")

    text(pdf, "LOADING GLOBAL", 74, 560, 12, HexColor("#8EA9DB"), "Helvetica-Bold")
    text(pdf, "A marca substitui o spinner.", 74, 510, 37, white, "Helvetica-Bold")
    text(pdf, "Uma animação breve de construção e respiração, inspirada na geometria da marca Maestra Manager.", 74, 478, 16, WHITE_80)

    pdf.setFillColor(HexColor("#1F3266"))
    pdf.roundRect(875, 500, 331, 90, 20, fill=1, stroke=0)
    mark(pdf, 907, 523, 42, white)
    text(pdf, "1,55 s", 968, 550, 23, white, "Helvetica-Bold")
    text(pdf, "ciclo discreto e contínuo", 968, 529, 11, WHITE_80)

    stage(pdf, 74, "ETAPA 01", "0.00s", "Marca em repouso", "sinal de espera claro", "rest")
    stage(pdf, 350, "ETAPA 02", "0.28s", "Construção", "feixes revelam a forma", "beams")
    stage(pdf, 626, "ETAPA 03", "0.70s", "Pulso de presença", "a marca alcança o foco", "pulse")
    stage(pdf, 902, "ETAPA 04", "1.55s", "Repetição suave", "retoma sem distração", "loop")

    pdf.setStrokeColor(LINE)
    pdf.setLineWidth(1)
    pdf.line(74, 132, 1206, 132)
    text(pdf, "IMPLEMENTAÇÃO", 74, 98, 10, SOFT_BLUE, "Helvetica-Bold")
    text(pdf, "Marca real em SVG + feixes geométricos + escala/opacity", 74, 75, 15, white, "Helvetica-Bold")
    text(pdf, "Acessível: respeita prefers-reduced-motion e mantém o estado de carregamento explícito.", 74, 51, 12, WHITE_80)
    text(pdf, "Maestra Manager", 1206, 58, 11, SOFT_BLUE, "Helvetica-Bold", "right")

    pdf.showPage()
    pdf.save()


if __name__ == "__main__":
    build()
