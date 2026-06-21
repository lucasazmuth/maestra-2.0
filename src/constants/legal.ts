// Conteúdo das páginas legais (Termos de Uso e Política de Privacidade).
// Edite livremente: título, data de atualização (updatedAt, formato ISO AAAA-MM-DD) e o
// texto (Markdown). As páginas em /legal/:slug renderizam tudo a partir daqui.

export interface LegalDoc {
  title: string;
  updatedAt: string; // ISO: AAAA-MM-DD
  content: string; // Markdown
}

export type LegalSlug = 'termos' | 'privacidade';

export const LEGAL_DOCS: Record<LegalSlug, LegalDoc> = {
  termos: {
    title: 'Termos de Uso',
    updatedAt: '2026-06-16',
    content: `Bem-vindo à **Maestra Manager**. Ao usar a plataforma, você concorda com estes Termos de Uso. Leia com atenção.

## 1. Aceitação dos termos
Ao criar uma conta ou utilizar a Maestra Manager, você declara ter lido e aceito estes termos. Se não concordar, não utilize a plataforma.

## 2. Descrição do serviço
A Maestra Manager é uma ferramenta de gestão e planejamento estratégico de carreira para artistas, incluindo recursos de inteligência artificial (a Nyta), catálogo, agenda, plano de ação e equipe.

## 3. Conta e responsabilidades
- Você é responsável por manter a confidencialidade das suas credenciais de acesso.
- As informações fornecidas devem ser verdadeiras e atualizadas.
- É proibido usar a plataforma para fins ilícitos ou que violem direitos de terceiros.

## 4. Conteúdo do usuário
Você mantém a titularidade do conteúdo que cadastra (música, textos, imagens). A Maestra Manager apenas processa esses dados para oferecer os recursos da plataforma.

## 5. Assinatura e pagamentos
Os planos pagos são cobrados conforme o ciclo escolhido. Você pode cancelar a qualquer momento; o acesso permanece ativo até o fim do período já pago.

## 6. Inteligência artificial
A Nyta gera sugestões e análises que podem conter erros. As decisões finais são sempre suas. Confira informações importantes antes de agir.

## 7. Limitação de responsabilidade
A plataforma é fornecida "como está". Não garantimos resultados específicos de carreira decorrentes do uso da ferramenta.

## 8. Alterações
Estes termos podem ser atualizados. Mudanças relevantes serão comunicadas, e a data de atualização acima será revisada.

## 9. Contato
Dúvidas sobre estes termos? Fale com a gente em **suporte@maestramanager.com**.`,
  },
  privacidade: {
    title: 'Política de Privacidade',
    updatedAt: '2026-06-16',
    content: `Esta Política de Privacidade explica como a **Maestra Manager** coleta, usa e protege seus dados.

## 1. Dados que coletamos
- **Cadastro:** nome, e-mail e dados de autenticação.
- **Uso da plataforma:** artistas, catálogo, agenda, plano de ação e interações com a Nyta.
- **Integrações:** dados públicos do Spotify quando você conecta um artista.

## 2. Como usamos seus dados
- Para operar e melhorar a plataforma.
- Para gerar análises e sugestões personalizadas com a Nyta.
- Para comunicar avisos importantes sobre a sua conta.

## 3. Compartilhamento
Não vendemos seus dados. Compartilhamos apenas com provedores necessários para o funcionamento do serviço (ex.: infraestrutura e processamento de pagamentos), sob obrigações de confidencialidade.

## 4. Armazenamento e segurança
Os dados são armazenados em infraestrutura segura, com controles de acesso. Adotamos medidas técnicas e organizacionais para protegê-los.

## 5. Seus direitos
Você pode acessar, corrigir ou excluir seus dados e solicitar o cancelamento da conta a qualquer momento, pelas Configurações ou pelo suporte.

## 6. Retenção
Mantemos seus dados enquanto a conta estiver ativa ou conforme exigido por obrigações legais.

## 7. Alterações
Esta política pode ser atualizada. A data de atualização acima reflete a versão vigente.

## 8. Contato
Para exercer seus direitos ou tirar dúvidas, escreva para **suporte@maestramanager.com**.`,
  },
};
