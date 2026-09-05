import fs from 'fs';
import path from 'path';

// As cópias de `supabase/functions/_shared` têm que ser idênticas ao original.
//
// O deploy de edge function não resolve `../_shared`, então cada função que usa um módulo
// compartilhado carrega uma cópia dele. Hoje as 7 cópias de `brevo.ts` estão idênticas — por
// disciplina, não por mecanismo: nada impedia alguém de corrigir um bug numa e esquecer das
// outras seis.
//
// Isso passou a doer com `apagarConta.ts`, que é a sequência de exclusão de conta: ela tem duas
// cópias (o painel admin e o cron da fila da LGPD), e uma divergência ali só apareceria na hora
// de apagar a conta de alguém.

const raiz = path.join(__dirname, '..', '..', 'supabase', 'functions');
const compartilhados = path.join(raiz, '_shared');

/** Todas as cópias de um módulo compartilhado, fora do próprio `_shared`. */
const copiasDe = (arquivo: string): string[] => {
  const achados: string[] = [];
  for (const funcao of fs.readdirSync(raiz, { withFileTypes: true })) {
    if (!funcao.isDirectory() || funcao.name === '_shared') continue;
    const candidato = path.join(raiz, funcao.name, arquivo);
    if (fs.existsSync(candidato)) achados.push(candidato);
  }
  return achados;
};

const modulos = fs
  .readdirSync(compartilhados)
  .filter((n) => n.endsWith('.ts'));

describe('cópias de _shared nas edge functions', () => {
  it('há módulos compartilhados para verificar', () => {
    expect(modulos.length).toBeGreaterThan(0);
  });

  describe.each(modulos)('%s', (modulo) => {
    const original = fs.readFileSync(path.join(compartilhados, modulo), 'utf8');
    const copias = copiasDe(modulo);

    it('tem ao menos uma cópia dentro de uma função', () => {
      // Módulo em `_shared` sem nenhuma cópia é código morto: ninguém consegue importá-lo.
      expect(copias.length).toBeGreaterThan(0);
    });

    it.each(copias.map((c) => [path.basename(path.dirname(c)), c]))(
      'a cópia em %s é idêntica ao original',
      (_funcao, caminho) => {
        expect(fs.readFileSync(caminho, 'utf8')).toBe(original);
      }
    );
  });
});
