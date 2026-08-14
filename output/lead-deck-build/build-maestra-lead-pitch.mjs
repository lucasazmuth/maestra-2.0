import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const ROOT = "/Users/andrade/Documents/maestra-2.0-main";
const OUT = "/Users/andrade/Documents/maestra-2.0-main/output/maestra-lead-facing-pitch-deck.pptx";
const TMP = "/Users/andrade/Documents/maestra-2.0-main/output/lead-deck-build";

const W = 1280;
const H = 720;
const C = {
  black: "#050707",
  deep: "#0B1210",
  surface: "#101C18",
  ink: "#EAF7F0",
  muted: "#AAB9B2",
  dim: "#71847D",
  line: "#2C403A",
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

function text(slide, copy, pos, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    position: pos,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = copy;
  shape.text.style = {
    fontFace: "Aptos",
    fontSize: style.fontSize ?? 22,
    bold: style.bold ?? false,
    color: style.color ?? C.ink,
    alignment: style.alignment ?? "left",
    ...style.extra,
  };
  return shape;
}

function title(slide, copy, subcopy) {
  text(slide, copy, { left: 72, top: 58, width: 940, height: 94 }, {
    fontSize: 38,
    bold: true,
  });
  if (subcopy) {
    text(slide, subcopy, { left: 74, top: 132, width: 830, height: 48 }, {
      fontSize: 19,
      color: C.muted,
    });
  }
}

function footer(slide, n) {
  text(slide, "Maestra Manager", { left: 72, top: 666, width: 220, height: 24 }, {
    fontSize: 12,
    bold: true,
    color: C.dim,
  });
  text(slide, String(n).padStart(2, "0"), { left: 1166, top: 660, width: 48, height: 28 }, {
    fontSize: 14,
    color: C.dim,
    alignment: "right",
  });
}

function rule(slide, x, y, w, color = C.green) {
  slide.shapes.add({
    geometry: "rect",
    position: { left: x, top: y, width: w, height: 4 },
    fill: color,
    line: { style: "solid", fill: color, width: 0 },
  });
}

function surface(slide, pos, fill = C.deep) {
  return slide.shapes.add({
    geometry: "roundRect",
    position: pos,
    fill,
    line: { style: "solid", fill: C.line, width: 1 },
    borderRadius: 18,
  });
}

function bullet(slide, copy, x, y, width, opts = {}) {
  const color = opts.dot ?? C.green;
  slide.shapes.add({
    geometry: "ellipse",
    position: { left: x, top: y + 10, width: 8, height: 8 },
    fill: color,
    line: { style: "solid", fill: color, width: 0 },
  });
  text(slide, copy, { left: x + 22, top: y, width, height: opts.height ?? 48 }, {
    fontSize: opts.fontSize ?? 20,
    color: opts.color ?? C.ink,
  });
}

async function screenshot(slide, rel, pos, alt) {
  slide.images.add({
    blob: await png(rel),
    contentType: "image/png",
    alt,
    fit: "cover",
    position: pos,
    geometry: "roundRect",
    borderRadius: 20,
  });
}

function notes(slide, speakerLines, sources) {
  slide.speakerNotes.textFrame.setText([
    ...speakerLines,
    "",
    "[Sources]",
    ...sources.map((s) => `- ${s}`),
  ].join("\n"));
  slide.speakerNotes.setVisible(true);
}

async function main() {
  await fs.mkdir(TMP, { recursive: true });
  const deck = Presentation.create({ slideSize: { width: W, height: H } });

  {
    const slide = deck.slides.add();
    slide.background.fill = C.black;
    slide.images.add({
      blob: await png("public/brand/maestra-wordmark-light.png"),
      contentType: "image/png",
      alt: "Logo Maestra",
      fit: "contain",
      position: { left: 72, top: 72, width: 300, height: 58 },
    });
    text(slide, "Desenvolva artistas com método, dados e acompanhamento contínuo", {
      left: 72,
      top: 190,
      width: 750,
      height: 174,
    }, { fontSize: 53, bold: true });
    text(slide, "Maestra combina diagnóstico de carreira, planejamento guiado por IA e gestão operacional para transformar intenção em plano de ação.", {
      left: 76,
      top: 390,
      width: 646,
      height: 88,
    }, { fontSize: 24, color: C.muted });
    rule(slide, 76, 520, 190);
    await screenshot(slide, "prints-registro-v2/02-maestra-manager/02-dashboard.png", {
      left: 816,
      top: 116,
      width: 350,
      height: 448,
    }, "Dashboard de acompanhamento de artista na Maestra");
    notes(slide, ["Abrir a reunião com a promessa de valor para o cliente: desenvolvimento de artistas com método e continuidade."], [
      "public/brand/maestra-wordmark-light.png",
      "prints-registro-v2/02-maestra-manager/02-dashboard.png",
      "README.md",
    ]);
  }

  {
    const slide = deck.slides.add();
    slide.background.fill = C.black;
    title(slide, "O desafio é acompanhar evolução, não apenas atrair artistas.", "Quando a base cresce, orientação individual vira gargalo e os planos se perdem entre ferramentas, conversas e planilhas.");
    const rows = [
      ["Visibilidade", "Entender em que estágio cada artista está e o que precisa destravar primeiro."],
      ["Prioridade", "Transformar diagnóstico em ações concretas, com foco no próximo ciclo de carreira."],
      ["Ritmo", "Manter uma cadência de execução sem depender de consultoria manual em cada interação."],
    ];
    rows.forEach(([head, body], i) => {
      const y = 222 + i * 116;
      rule(slide, 94, y + 5, 58, [C.green, C.teal, C.lime][i]);
      text(slide, head, { left: 184, top: y - 2, width: 286, height: 40 }, {
        fontSize: 30,
        bold: true,
      });
      text(slide, body, { left: 520, top: y, width: 560, height: 58 }, {
        fontSize: 22,
        color: C.muted,
      });
    });
    footer(slide, 2);
    notes(slide, ["Este slide abre a dor do lead, sem falar da operação interna do BD."], [
      "MODELO-DE-NEGOCIO.md, seção 2",
    ]);
  }

  {
    const slide = deck.slides.add();
    slide.background.fill = C.black;
    title(slide, "A Maestra entrega uma jornada completa para cada artista.", "Do primeiro diagnóstico ao acompanhamento diário, tudo fica conectado em um mesmo ambiente.");
    const steps = [
      ["1", "Diagnóstico REAL", "Leitura inicial da carreira em alcance, receita, audiência e legitimidade."],
      ["2", "Plano guiado", "Objetivos, SWOT, estratégias, prioridades e cronograma em linguagem simples."],
      ["3", "Execução assistida", "Tarefas, agenda, catálogo, equipe e apoio da Nyta IA no dia a dia."],
    ];
    steps.forEach(([num, head, body], i) => {
      const x = 102 + i * 360;
      slide.shapes.add({
        geometry: "ellipse",
        position: { left: x, top: 226, width: 88, height: 88 },
        fill: [C.green, C.teal, C.lime][i],
        line: { style: "solid", fill: "none", width: 0 },
      });
      text(slide, num, { left: x, top: 244, width: 88, height: 50 }, {
        fontSize: 32,
        bold: true,
        color: C.black,
        alignment: "center",
      });
      text(slide, head, { left: x - 40, top: 356, width: 260, height: 36 }, {
        fontSize: 26,
        bold: true,
        alignment: "center",
      });
      text(slide, body, { left: x - 58, top: 410, width: 300, height: 98 }, {
        fontSize: 19,
        color: C.muted,
        alignment: "center",
      });
    });
    text(slide, "Resultado: sua organização acompanha uma trilha consistente, enquanto o artista recebe orientação prática.", {
      left: 178,
      top: 586,
      width: 860,
      height: 42,
    }, { fontSize: 21, color: C.muted, alignment: "center" });
    footer(slide, 3);
    notes(slide, ["Mostrar a jornada como produto de valor para o lead, não como arquitetura interna."], [
      "MODELO-DE-NEGOCIO.md, seções 3 e 4",
      "maestra-landing/src/pages/Home.tsx",
    ]);
  }

  {
    const slide = deck.slides.add();
    slide.background.fill = C.black;
    title(slide, "O Diagnóstico REAL cria uma base comum para decidir o próximo passo.", "O artista entende onde está. Sua equipe entende onde apoiar.");
    await screenshot(slide, "prints-registro-v2/01-diagnostico-real/03-resultado-perfil.png", {
      left: 76,
      top: 202,
      width: 594,
      height: 340,
    }, "Resultado do Diagnóstico REAL no produto");
    text(slide, "Quatro dimensões acionáveis", { left: 738, top: 216, width: 420, height: 44 }, {
      fontSize: 31,
      bold: true,
    });
    bullet(slide, "Alcance e descoberta", 744, 304, 380);
    bullet(slide, "Sinais de monetização", 744, 358, 380, { dot: C.teal });
    bullet(slide, "Audiência e engajamento", 744, 412, 380, { dot: C.lime });
    bullet(slide, "Legitimidade de mercado", 744, 466, 380, { dot: C.white });
    footer(slide, 4);
    notes(slide, ["Explicar que o diagnóstico cria linguagem comum para priorização e acompanhamento."], [
      "docs/DIAGNOSTICO_REAL_V2.md, seções 1 e 2",
      "prints-registro-v2/01-diagnostico-real/03-resultado-perfil.png",
    ]);
  }

  {
    const slide = deck.slides.add();
    slide.background.fill = C.black;
    title(slide, "O plano sai pronto para execução, não fica parado como relatório.", "A Maestra conduz o raciocínio estratégico e transforma respostas em tarefas, prazos e prioridades.");
    await screenshot(slide, "prints-registro-v2/02-maestra-manager/03-planejamento.png", {
      left: 718,
      top: 190,
      width: 450,
      height: 336,
    }, "Tela de planejamento estratégico da Maestra");
    text(slide, "Para o artista", { left: 86, top: 230, width: 310, height: 36 }, {
      fontSize: 28,
      bold: true,
      color: C.green,
    });
    bullet(slide, "Clareza sobre objetivos, posicionamento e próximos passos.", 90, 304, 510);
    text(slide, "Para sua organização", { left: 86, top: 404, width: 390, height: 38 }, {
      fontSize: 28,
      bold: true,
      color: C.teal,
    });
    bullet(slide, "Uma visão estruturada do que cada artista precisa para evoluir.", 90, 478, 520, { dot: C.teal });
    footer(slide, 5);
    notes(slide, ["Este slide conecta a experiência do artista ao valor operacional para o cliente."], [
      "MODELO-DE-NEGOCIO.md, seção 4",
      "maestra-landing/src/pages/Home.tsx",
      "prints-registro-v2/02-maestra-manager/03-planejamento.png",
    ]);
  }

  {
    const slide = deck.slides.add();
    slide.background.fill = C.black;
    title(slide, "Nyta IA mantém o plano vivo entre uma reunião e outra.", "A assistente trabalha com o contexto do perfil, do planejamento e da rotina do artista.");
    await screenshot(slide, "prints-registro-v2/03-nyta/02-assistente-pro-aberta.png", {
      left: 92,
      top: 198,
      width: 510,
      height: 354,
    }, "Assistente Nyta IA aberto dentro da plataforma");
    text(slide, "Apoio recorrente", { left: 690, top: 222, width: 420, height: 40 }, {
      fontSize: 30,
      bold: true,
    });
    bullet(slide, "Responde dúvidas com base no contexto da carreira.", 696, 304, 430);
    bullet(slide, "Sugere caminhos de marketing, gestão e execução.", 696, 362, 430, { dot: C.teal });
    bullet(slide, "Ajuda a criar tarefas, eventos e itens de catálogo.", 696, 420, 430, { dot: C.lime });
    footer(slide, 6);
    notes(slide, ["Reposicionar a IA como continuidade de acompanhamento, não como chatbot genérico."], [
      "docs/FREEMIUM-E-NYTA.md, seção 3",
      "prints-registro-v2/03-nyta/02-assistente-pro-aberta.png",
    ]);
  }

  {
    const slide = deck.slides.add();
    slide.background.fill = C.black;
    title(slide, "Sua equipe ganha uma visão única da operação do artista.", "Catálogo, agenda, equipe e plano de ação ficam no mesmo lugar para reduzir dispersão e aumentar cadência.");
    const imgs = [
      ["prints-registro-v2/02-maestra-manager/04-plano-de-acao.png", "Plano de ação", 82],
      ["prints-registro-v2/02-maestra-manager/06-catalogo-lancamentos.png", "Catálogo", 378],
      ["prints-registro-v2/02-maestra-manager/07-agenda.png", "Agenda", 674],
      ["prints-registro-v2/02-maestra-manager/08-equipe.png", "Equipe", 970],
    ];
    for (const [rel, label, x] of imgs) {
      await screenshot(slide, rel, { left: x, top: 226, width: 230, height: 164 }, label);
      text(slide, label, { left: x, top: 414, width: 230, height: 34 }, {
        fontSize: 22,
        bold: true,
        alignment: "center",
      });
    }
    text(slide, "Em vez de uma entrega pontual, a parceria vira um sistema de acompanhamento contínuo.", {
      left: 196,
      top: 548,
      width: 820,
      height: 52,
    }, { fontSize: 23, color: C.muted, alignment: "center" });
    footer(slide, 7);
    notes(slide, ["Mostrar os módulos operacionais como continuidade natural do diagnóstico e do plano."], [
      "MODELO-DE-NEGOCIO.md, seção 4",
      "prints-registro-v2/02-maestra-manager/04-plano-de-acao.png",
      "prints-registro-v2/02-maestra-manager/06-catalogo-lancamentos.png",
      "prints-registro-v2/02-maestra-manager/07-agenda.png",
      "prints-registro-v2/02-maestra-manager/08-equipe.png",
    ]);
  }

  {
    const slide = deck.slides.add();
    slide.background.fill = C.black;
    title(slide, "Um piloto pode provar valor sem exigir uma grande implantação.", "Começamos com um recorte controlado, acompanhamos uso e decidimos a próxima escala com evidência.");
    const phases = [
      ["Recorte", "Selecionar uma turma, roster ou comunidade inicial."],
      ["Ativação", "Artistas fazem diagnóstico e primeiro plano guiado."],
      ["Acompanhamento", "Observar adesão, tarefas criadas e uso recorrente."],
      ["Escala", "Definir modelo de continuidade com base nos aprendizados."],
    ];
    phases.forEach(([head, body], i) => {
      const x = 82 + i * 292;
      surface(slide, { left: x, top: 232, width: 238, height: 198 }, i === 0 ? "#102219" : C.deep);
      text(slide, head, { left: x + 24, top: 260, width: 190, height: 34 }, {
        fontSize: 25,
        bold: true,
        color: [C.green, C.teal, C.lime, C.white][i],
      });
      text(slide, body, { left: x + 24, top: 322, width: 184, height: 80 }, {
        fontSize: 18,
        color: C.muted,
      });
    });
    text(slide, "O piloto pode ser ajustado ao seu contexto: distribuição, label, aceleração, comunidade, educação ou programa de desenvolvimento artístico.", {
      left: 156,
      top: 542,
      width: 900,
      height: 52,
    }, { fontSize: 20, color: C.muted, alignment: "center" });
    footer(slide, 8);
    notes(slide, ["Usar este slide para levar a conversa a um desenho de piloto concreto."], [
      "MODELO-DE-NEGOCIO.md, seções 5 e 11",
    ]);
  }

  {
    const slide = deck.slides.add();
    slide.background.fill = C.black;
    slide.images.add({
      blob: await png("public/brand/maestra-wordmark-light.png"),
      contentType: "image/png",
      alt: "Logo Maestra",
      fit: "contain",
      position: { left: 72, top: 72, width: 270, height: 54 },
    });
    text(slide, "Vamos desenhar o piloto?", { left: 72, top: 198, width: 660, height: 74 }, {
      fontSize: 52,
      bold: true,
    });
    text(slide, "Três decisões já colocam a parceria em movimento:", {
      left: 76,
      top: 312,
      width: 620,
      height: 38,
    }, { fontSize: 24, color: C.muted });
    bullet(slide, "Qual grupo de artistas entra primeiro?", 86, 394, 600);
    bullet(slide, "Que evolução queremos medir nesse ciclo?", 86, 452, 600, { dot: C.teal });
    bullet(slide, "Quem acompanha a ativação e os próximos passos?", 86, 510, 600, { dot: C.lime });
    await screenshot(slide, "prints-registro-v2/02-maestra-manager/01-artistas.png", {
      left: 822,
      top: 174,
      width: 348,
      height: 378,
    }, "Lista de artistas no Manager");
    text(slide, "maestramanager.com", { left: 86, top: 614, width: 350, height: 34 }, {
      fontSize: 24,
      bold: true,
      color: C.green,
    });
    footer(slide, 9);
    notes(slide, ["Fechar pedindo uma decisão prática, não apenas feedback geral."], [
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
