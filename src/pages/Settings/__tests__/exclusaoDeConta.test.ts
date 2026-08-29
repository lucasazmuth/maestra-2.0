import fs from 'fs';
import path from 'path';

// O texto e o comportamento do "Cancelar cadastro".
//
// Este é um teste de FONTE, e isso é deliberado: montar a tela de Configurações inteira em jsdom
// exige store, antd, assinatura e sessão — muito custo para verificar duas coisas que, quando
// erram, erram de forma grave e silenciosa.
//
// As duas são:
//
// 1) a tela NÃO pode abrir e-mail para o suporte. O cron `account-purge-due` cumpre a fila
//    sozinho desde que o prazo vence; continuar avisando por e-mail geraria trabalho manual para
//    algo que já acontece, com o risco de alguém executar duas vezes;
// 2) a copy PRECISA dizer o prazo. Ela prometia remoção "permanente" e imediata, e as duas
//    metades estavam erradas — quem se arrependesse não sabia que ainda dava tempo.

const fonte = fs.readFileSync(path.join(__dirname, '..', 'index.tsx'), 'utf8');

describe('cancelar cadastro', () => {
  it('não manda o pedido por e-mail para o suporte', () => {
    expect(fonte).not.toMatch(/mailto:/);
    expect(fonte).not.toMatch(/SUPPORT_EMAIL/);
  });

  it('diz o prazo de 30 dias para a pessoa', () => {
    // Três lugares: o parágrafo explicativo, a confirmação e a mensagem de sucesso.
    const mencoes = fonte.match(/30 dias/g) ?? [];
    expect(mencoes.length).toBeGreaterThanOrEqual(3);
  });

  it('não promete mais remoção imediata', () => {
    expect(fonte).not.toMatch(/serão removidos\. Esta ação é permanente/);
  });

  // A assinatura sai ANTES do pedido: cobrança viva numa conta que a pessoa pediu para apagar
  // seguiria cobrando pelos 30 dias.
  it('cancela a assinatura antes de registrar o pedido', () => {
    const posCancelamento = fonte.indexOf('cancelSubscription()');
    const posPedido = fonte.indexOf("from('account_deletion_requests').insert");
    expect(posCancelamento).toBeGreaterThan(-1);
    expect(posPedido).toBeGreaterThan(posCancelamento);
  });
});
