import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const helperPath = path.join(root, 'supabase', 'functions', '_shared', 'brevo.ts');
const outputPath = path.join(root, 'output', 'email', 'maestra-email-preview.html');
const source = fs.readFileSync(helperPath, 'utf8');

const transpiled = ts.transpileModule(source, {
  fileName: helperPath,
  reportDiagnostics: true,
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});

const errors = (transpiled.diagnostics || []).filter(
  (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
);
if (errors.length) {
  for (const diagnostic of errors) {
    console.error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
  }
  process.exit(1);
}

globalThis.Deno = {
  env: {
    get(name) {
      return name === 'APP_URL' ? 'http://127.0.0.1:3000' : undefined;
    },
  },
};

const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`;
const { emailLayout, ctaButton, otpBlock } = await import(moduleUrl);

const html = emailLayout({
  title: 'Sua estratégia começa agora',
  bodyHtml: `
    <p style="color:#c2c2cc;line-height:1.7;margin:0 0 14px;">Esta é uma amostra local dos e-mails transacionais da Maestra. Nenhuma mensagem foi enviada.</p>
    ${otpBlock('482917')}
    ${ctaButton('Continuar na Maestra', 'http://127.0.0.1:3000/login')}
    <p style="color:#8f8f99;font-size:13px;line-height:1.6;">O código expira em 10 minutos. Se você não solicitou este acesso, ignore este e-mail.</p>
  `,
});

const required = [
  '/brand/maestra-wordmark-light.png',
  '#9A4FD1',
  '#FFFFFF',
  'Maestra',
  'Helvetica Neue',
];
for (const value of required) {
  if (!html.includes(value)) throw new Error(`Amostra de e-mail sem o valor esperado: ${value}`);
}

for (const forbidden of ['Maestra Manager', '#BE81EC', 'SpotifyMixUI']) {
  if (html.includes(forbidden)) throw new Error(`Amostra de e-mail contém referência legada: ${forbidden}`);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html);
console.log(outputPath);
