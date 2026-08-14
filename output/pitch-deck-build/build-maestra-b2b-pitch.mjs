import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const ROOT = "/Users/andrade/Documents/maestra-2.0-main";
const OUT = "/Users/andrade/Documents/maestra-2.0-main/output/maestra-b2b-pitch-deck.pptx";
const TMP = "/Users/andrade/Documents/maestra-2.0-main/output/pitch-deck-build";

const W = 1280;
const H = 720;
const C = {
  black: "#050707",
  black2: "#0B1210",
  ink: "#EAF7F0",
  muted: "#AAB9B2",
  faint: "#22312D",
  line: "#2D403A",
  green: "#71F2A6",
  teal: "#25D7B9",
  lime: "#B7F66B",
  white: "#FFFFFF",
};

async function writeBlob(file, blob) {
  await fs.writeFile(file, new Uint8Array(await blob.arrayBuffer()));
}

async function png(rel) {
  return fs.readFile(path.join(ROOT, rel));
}

function addText(slide, text, pos, style = {}) {
  const box = slide.shapes.add({
    geometry: "textbox",
    position: pos,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  box.text = text;
  box.text.style = {
    fontFace: "Aptos",
    fontSize: style.fontSize ?? 24,
    bold: style.bold ?? false,
    color: style.color ?? C.ink,
    alignment: style.alignment ?? "left",
    ...style.extra,
  };
  return box;
}

function addTitle(slide, title, subtitle) {
  addText(slide, title, { left: 72, top: 58, width: 920, height: 92 }, {
    fontSize: 38,
    bold: true,
    color: C.ink,
  });
  if (subtitle) {
    addText(slide, subtitle, { left: 74, top: 128, width: 840, height: 42 }, {
      fontSize: 18,
      color: C.muted,
    });
  }
}

function addFooter(slide, n) {
  addText(slide, "Maestra Manager", { left: 72, top: 666, width: 240, height: 24 }, {
    fontSize: 12,
    color: "#6F837B",
    bold: true,
  });
  addText(slide, String(n).padStart(2, "0"), { left: 1164, top: 660, width: 48, height: 28 }, {
    fontSize: 14,
    color: "#6F837B",
    alignment: "right",
  });
}

function addRule(slide, x, y, w, color = C.green) {
  slide.shapes.add({
    geometry: "rect",
    position: { left: x, top: y, width: w, height: 4 },
    fill: color,
    line: { style: "solid", fill: color, width: 0 },
  });
}

function addSurface(slide, pos, fill = C.black2, line = C.line) {
  return slide.shapes.add({
    geometry: "roundRect",
    position: pos,
    fill,
    line: { style: "solid", fill: line, width: 1 },
    borderRadius: 18,
  });
}

function addBullet(slide, text, x, y, width, color = C.ink) {
  slide.shapes.add({
    geometry: "ellipse",
    position: { left: x, top: y + 9, width: 7, height: 7 },
    fill: C.green,
    line: { style: "solid", fill: C.green, width: 0 },
  });
  addText(slide, text, { left: x + 20, top: y, width, height: 44 }, {
    fontSize: 20,
    color,
  });
}

async function addScreenshot(slide, rel, pos, opts = {}) {
  slide.images.add({
    blob: await png(rel),
    contentType: "image/png",
    alt: opts.alt ?? "Tela do produto Maestra",
    fit: opts.fit ?? "cover",
    position: pos,
    geometry: "roundRect",
    borderRadius: opts.radius ?? 20,
  });
}

function notes(slide, lines, sources) {
  const body = [
    ...lines,
    "",
    "[Sources]",
    ...sources.map((s) => `- ${s}`),
  ].join("\n");
  slide.speakerNotes.textFrame.setText(body);
  slide.speakerNotes.setVisible(true);
}

async function main() {
  await fs.mkdir(TMP, { recursive: true });
  const deck = Presentation.create({ slideSize: { width: W, height: H } });

  // 1
  {
    const slide = deck.slides.add();
    slide.background.fill = C.black;
    slide.images.add({
      blob: await png("public/brand/maestra-wordmark-light.png"),
      contentType: "image/png",
      alt: "Logo Maestra",
      fit: "contain",
      position: { left: 72, top: 70, width: 300, height: 60 },
    });
    addText(slide, "A camada de estratégia para desenvolver artistas em escala", {
      left: 72,
      top: 184,
      width: 680,
      height: 168,
    }, { fontSize: 52, bold: true, color: C.ink });
    addText(slide, "Diagnóstico, planejamento, IA e gestão em uma plataforma para parceiros que precisam acompanhar muitos artistas sem perder método.", {
      left: 76,
      top: 376,
      width: 610,
      height: 96,
    }, { fontSize: 24, color: C.muted });
    addRule(slide, 76, 516, 180);
    await addScreenshot(slide, "prints-registro-v2/02-maestra-manager/02-dashboard.png", {
      left: 770,
      top: 95,
      width: 420,
      height: 500,
    }, { alt: "Dashboard de artista na Maestra" });
    notes(slide, ["Abrir posicionando a Maestra como infraestrutura de desenvolvimento de carreira para uso B2B."], [
      "public/brand/maestra-wordmark-light.png",
      "prints-registro-v2/02-maestra-manager/02-dashboard.png",
      "README.md",
    ]);
  }

  // 2
  {
    const slide = deck.slides.add();
    slide.background.fill = C.black;
    addTitle(slide, "O gargalo B2B não é acesso ao artista. É acompanhamento com método.", "Parceiros musicais precisam transformar interesse em evolução mensurável, repetível e fácil de operar.");
    const rows = [
      ["Muitos artistas, pouco tempo", "Times de BD, aceleração, distribuição e comunidade precisam orientar rosters inteiros sem virar consultoria manual para cada caso."],
      ["Dados espalhados", "Spotify, catálogo, agenda, objetivos e tarefas costumam viver em ferramentas separadas, dificultando priorização."],
      ["Execução sem cadência", "Mesmo quando existe diagnóstico, falta um plano vivo com prazos, responsáveis e revisão de progresso."],
    ];
    rows.forEach(([h, b], i) => {
      const y = 218 + i * 124;
      addRule(slide, 92, y + 4, 58, [C.green, C.teal, C.lime][i]);
      addText(slide, h, { left: 174, top: y - 2, width: 360, height: 42 }, { fontSize: 28, bold: true });
      addText(slide, b, { left: 550, top: y, width: 570, height: 68 }, { fontSize: 20, color: C.muted });
    });
    addFooter(slide, 2);
    notes(slide, ["Enquadrar o problema pelo ângulo do parceiro: volume, visibilidade e cadência."], [
      "MODELO-DE-NEGOCIO.md, seção 2",
    ]);
  }

  // 3
  {
    const slide = deck.slides.add();
    slide.background.fill = C.black;
    addTitle(slide, "Maestra conecta diagnóstico, plano e operação em um único fluxo.", "O parceiro não entrega só uma ferramenta: entrega um método de desenvolvimento contínuo.");
    const steps = [
      ["Diagnosticar", "Raio-X da carreira e perfil REAL"],
      ["Planejar", "Objetivos, SWOT, estratégias e prioridades"],
      ["Executar", "Plano de ação com tarefas, prazos e responsáveis"],
      ["Gerir", "Catálogo, agenda, equipe e acompanhamento"],
    ];
    steps.forEach(([h, b], i) => {
      const x = 90 + i * 285;
      slide.shapes.add({
        geometry: "ellipse",
        position: { left: x, top: 236, width: 96, height: 96 },
        fill: [C.green, C.teal, C.lime, "#FFFFFF"][i],
        line: { style: "solid", fill: "none", width: 0 },
      });
      addText(slide, String(i + 1), { left: x, top: 255, width: 96, height: 54 }, {
        fontSize: 34,
        bold: true,
        color: C.black,
        alignment: "center",
      });
      if (i < 3) {
        slide.shapes.add({
          geometry: "line",
          position: { left: x + 118, top: 284, width: 136, height: 0 },
          line: { style: "solid", fill: C.line, width: 3 },
        });
      }
      addText(slide, h, { left: x - 20, top: 370, width: 152, height: 36 }, { fontSize: 25, bold: true, alignment: "center" });
      addText(slide, b, { left: x - 48, top: 420, width: 208, height: 74 }, { fontSize: 18, color: C.muted, alignment: "center" });
    });
    addFooter(slide, 3);
    notes(slide, ["Mostrar a Maestra como ciclo de desenvolvimento, não como chatbot ou dashboard isolado."], [
      "MODELO-DE-NEGOCIO.md, seções 3 e 4",
      "maestra-landing/src/pages/Home.tsx",
    ]);
  }

  // 4
  {
    const slide = deck.slides.add();
    slide.background.fill = C.black;
    addTitle(slide, "O Diagnóstico REAL cria uma leitura inicial comum para artista e parceiro.", "A carreira é avaliada em quatro dimensões e traduzida em um perfil acionável.");
    await addScreenshot(slide, "prints-registro-v2/01-diagnostico-real/03-resultado-perfil.png", {
      left: 72,
      top: 198,
      width: 610,
      height: 348,
    }, { alt: "Resultado do Diagnóstico REAL" });
    addText(slide, "R · E · A · L", { left: 752, top: 214, width: 360, height: 58 }, { fontSize: 42, bold: true, color: C.green });
    addBullet(slide, "Reach: alcance e descoberta", 756, 306, 410);
    addBullet(slide, "Earnings: sinais de monetização", 756, 362, 410);
    addBullet(slide, "Audience: base e engajamento", 756, 418, 410);
    addBullet(slide, "Legitimacy: validação de mercado", 756, 474, 410);
    addFooter(slide, 4);
    notes(slide, ["Explicar que o diagnóstico dá uma linguagem comum para priorizar o próximo ciclo do artista."], [
      "docs/DIAGNOSTICO_REAL_V2.md, seções 1 e 2",
      "prints-registro-v2/01-diagnostico-real/03-resultado-perfil.png",
    ]);
  }

  // 5
  {
    const slide = deck.slides.add();
    slide.background.fill = C.black;
    addTitle(slide, "O planejamento transforma diagnóstico em plano executável.", "A metodologia conduz identidade, objetivos, SWOT, estratégias, priorização e cronograma.");
    await addScreenshot(slide, "prints-registro-v2/02-maestra-manager/03-planejamento.png", {
      left: 700,
      top: 178,
      width: 476,
      height: 360,
    }, { alt: "Planejamento estratégico na Maestra" });
    addText(slide, "Da conversa guiada ao plano de ação", { left: 78, top: 214, width: 510, height: 52 }, { fontSize: 31, bold: true });
    addBullet(slide, "Estratégias priorizadas para o momento da carreira", 84, 306, 490);
    addBullet(slide, "Cronograma e tarefas com vínculo ao objetivo", 84, 368, 490);
    addBullet(slide, "Método próprio traduzido para linguagem simples", 84, 430, 490);
    addText(slide, "Base conceitual citada na landing: metodologia da Anita Carvalho, com mais de 30 anos de carreira e 313 planejamentos reais.", {
      left: 84,
      top: 524,
      width: 520,
      height: 62,
    }, { fontSize: 16, color: "#88A097" });
    addFooter(slide, 5);
    notes(slide, ["Usar este slide para vender método e execução, não só automação."], [
      "maestra-landing/src/pages/Home.tsx",
      "MODELO-DE-NEGOCIO.md, seção 4",
      "prints-registro-v2/02-maestra-manager/03-planejamento.png",
    ]);
  }

  // 6
  {
    const slide = deck.slides.add();
    slide.background.fill = C.black;
    addTitle(slide, "Nyta IA acompanha a operação com contexto, não respostas genéricas.", "O assistente trabalha dentro do perfil do artista e pode apoiar decisões e tarefas do dia a dia.");
    await addScreenshot(slide, "prints-registro-v2/03-nyta/02-assistente-pro-aberta.png", {
      left: 96,
      top: 188,
      width: 520,
      height: 372,
    }, { alt: "Assistente Nyta IA aberto no produto" });
    addText(slide, "O que o parceiro ganha", { left: 704, top: 218, width: 420, height: 44 }, { fontSize: 30, bold: true });
    addBullet(slide, "Suporte recorrente para dúvidas, marketing e execução", 708, 304, 430);
    addBullet(slide, "Memória do perfil, plano, tarefas e agenda", 708, 366, 430);
    addBullet(slide, "Ações operacionais: criar tarefas, eventos e itens de catálogo", 708, 428, 430);
    addFooter(slide, 6);
    notes(slide, ["Mostrar a IA como assistente operacional em contexto, com ferramentas conectadas ao produto."], [
      "docs/FREEMIUM-E-NYTA.md, seção 3",
      "prints-registro-v2/03-nyta/02-assistente-pro-aberta.png",
    ]);
  }

  // 7
  {
    const slide = deck.slides.add();
    slide.background.fill = C.black;
    addTitle(slide, "O Manager centraliza a rotina que sustenta o plano.", "Catálogo, agenda, equipe e dashboard reduzem a distância entre estratégia e acompanhamento.");
    const imgs = [
      ["prints-registro-v2/02-maestra-manager/05-catalogo-rascunhos.png", 80, 202, "Catálogo"],
      ["prints-registro-v2/02-maestra-manager/07-agenda.png", 432, 202, "Agenda"],
      ["prints-registro-v2/02-maestra-manager/08-equipe.png", 784, 202, "Equipe"],
    ];
    for (const [rel, x, y, label] of imgs) {
      await addScreenshot(slide, rel, { left: x, top: y, width: 320, height: 210 }, { alt: `${label} na Maestra` });
      addText(slide, label, { left: x, top: y + 230, width: 320, height: 34 }, { fontSize: 24, bold: true, alignment: "center" });
    }
    addText(slide, "A plataforma vira um registro vivo do ciclo: o que foi diagnosticado, o que foi planejado e o que está em execução.", {
      left: 172,
      top: 554,
      width: 836,
      height: 52,
    }, { fontSize: 21, color: C.muted, alignment: "center" });
    addFooter(slide, 7);
    notes(slide, ["Conectar os módulos de gestão ao valor para parceiros: visibilidade e rotina."], [
      "MODELO-DE-NEGOCIO.md, seção 4",
      "prints-registro-v2/02-maestra-manager/05-catalogo-rascunhos.png",
      "prints-registro-v2/02-maestra-manager/07-agenda.png",
      "prints-registro-v2/02-maestra-manager/08-equipe.png",
    ]);
  }

  // 8
  {
    const slide = deck.slides.add();
    slide.background.fill = C.black;
    addTitle(slide, "Para B2B, Maestra pode operar como plataforma de desenvolvimento de roster.", "A mesma base atende parceiros com diferentes relações com artistas.");
    const cases = [
      ["Distribuidoras e DSP partners", "Onboarding estratégico para artistas da base e sinalização de oportunidades."],
      ["Labels, escritórios e assessorias", "Gestão de múltiplos perfis com visão comum de plano, agenda, catálogo e tarefas."],
      ["Aceleradoras e programas públicos", "Turmas de artistas com diagnóstico inicial, trilha de ação e acompanhamento."],
      ["Educação e comunidades musicais", "Ferramenta prática para transformar conteúdo em plano aplicado à carreira."],
    ];
    cases.forEach(([h, b], i) => {
      const x = i % 2 === 0 ? 92 : 672;
      const y = i < 2 ? 214 : 414;
      addSurface(slide, { left: x, top: y, width: 480, height: 128 }, C.black2, C.line);
      addText(slide, h, { left: x + 28, top: y + 24, width: 420, height: 34 }, { fontSize: 24, bold: true, color: i === 0 ? C.green : C.ink });
      addText(slide, b, { left: x + 28, top: y + 66, width: 416, height: 48 }, { fontSize: 17, color: C.muted });
    });
    addFooter(slide, 8);
    notes(slide, ["Apresentar estes como territórios de conversa para BD, ajustando exemplos conforme o cliente."], [
      "MODELO-DE-NEGOCIO.md, seções 5 e 11",
    ]);
  }

  // 9
  {
    const slide = deck.slides.add();
    slide.background.fill = C.black;
    addTitle(slide, "A conversa comercial pode começar por um piloto simples.", "O objetivo é provar ativação, qualidade do plano e recorrência de uso antes de discutir escala.");
    const x0 = 116;
    const items = [
      ["1", "Recorte", "Escolher segmento, tamanho de turma ou roster e perfil ideal de artista."],
      ["2", "Ativação", "Conduzir cadastro, Diagnóstico REAL e primeiro plano de ação."],
      ["3", "Acompanhamento", "Medir adesão, tarefas criadas, uso da Nyta e próximos ciclos."],
    ];
    items.forEach(([n, h, b], i) => {
      const x = x0 + i * 350;
      slide.shapes.add({
        geometry: "ellipse",
        position: { left: x, top: 238, width: 78, height: 78 },
        fill: i === 0 ? C.green : i === 1 ? C.teal : C.lime,
        line: { style: "solid", fill: "none", width: 0 },
      });
      addText(slide, n, { left: x, top: 254, width: 78, height: 44 }, { fontSize: 29, bold: true, color: C.black, alignment: "center" });
      addText(slide, h, { left: x - 26, top: 354, width: 220, height: 40 }, { fontSize: 26, bold: true });
      addText(slide, b, { left: x - 26, top: 404, width: 258, height: 92 }, { fontSize: 18, color: C.muted });
    });
    addText(slide, "Modelos de parceria podem ser definidos caso a caso: licença por cohort, pacote para roster, ação patrocinada ou parceria de distribuição/benefícios.", {
      left: 176,
      top: 578,
      width: 838,
      height: 48,
    }, { fontSize: 19, color: C.muted, alignment: "center" });
    addFooter(slide, 9);
    notes(slide, ["Este slide evita travar em preço logo no começo e orienta a call para desenho de piloto."], [
      "MODELO-DE-NEGOCIO.md, seções 6 e 11",
    ]);
  }

  // 10
  {
    const slide = deck.slides.add();
    slide.background.fill = C.black;
    slide.images.add({
      blob: await png("public/brand/maestra-wordmark-light.png"),
      contentType: "image/png",
      alt: "Logo Maestra",
      fit: "contain",
      position: { left: 72, top: 68, width: 260, height: 52 },
    });
    addText(slide, "Próximo passo: desenhar o piloto com o cliente na própria call.", {
      left: 72,
      top: 190,
      width: 742,
      height: 126,
    }, { fontSize: 46, bold: true });
    const qs = [
      "Qual roster, turma ou comunidade entra primeiro?",
      "Que evolução do artista o cliente quer provar?",
      "Quem acompanha resultados e ativa próximos ciclos?",
    ];
    qs.forEach((q, i) => addBullet(slide, q, 82, 374 + i * 58, 680));
    await addScreenshot(slide, "prints-registro-v2/02-maestra-manager/01-artistas.png", {
      left: 842,
      top: 168,
      width: 330,
      height: 390,
    }, { alt: "Lista de artistas na Maestra" });
    addText(slide, "maestramanager.com", { left: 82, top: 612, width: 360, height: 32 }, { fontSize: 22, color: C.green, bold: true });
    addFooter(slide, 10);
    notes(slide, ["Fechar com perguntas que movem a conversa para piloto e próximos critérios de sucesso."], [
      "maestra-landing/src/config.ts",
      "prints-registro-v2/02-maestra-manager/01-artistas.png",
    ]);
  }

  for (const [i, slide] of deck.slides.items.entries()) {
    const stem = `slide-${String(i + 1).padStart(2, "0")}`;
    await writeBlob(path.join(TMP, `${stem}.png`), await deck.export({ slide, format: "png", scale: 1 }));
    await fs.writeFile(path.join(TMP, `${stem}.layout.json`), await (await slide.export({ format: "layout" })).text());
  }
  await writeBlob(path.join(TMP, "montage.webp"), await deck.export({ format: "webp", montage: true, scale: 1 }));
  const pptx = await PresentationFile.exportPptx(deck);
  await pptx.save(OUT);
  console.log(OUT);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
