-- Adequação LGPD: versionamento dos textos legais, trilha de consentimentos e estado de
-- conformidade por usuário.
--
-- Contexto: os Termos (§3) e a Política (§11) já restringem o uso a maiores de 18 anos, mas nada
-- no código verificava isso, e não havia registro de quem aceitou qual versão de qual documento.
-- A LGPD exige demonstrar consentimento — quem, quando, o quê e sob qual texto.
--
-- A regra de negócio (idade >= 18) NÃO mora aqui: mora na edge function `account-consent`, que
-- escreve com service role. O papel destas tabelas é tornar a escrita pelo cliente impossível —
-- sem isso a trava seria decorativa, contornável por qualquer um com o DevTools aberto.

-- ── Documentos legais versionados ───────────────────────────────────────────────────────────
-- O conteúdo é copiado para cá (e não só referenciado) porque o aceite precisa ser reproduzível:
-- quando alguém editar src/constants/legal.ts, o texto que a pessoa aceitou continua íntegro.
create table if not exists public.legal_documents (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null check (slug in ('privacidade', 'termos', 'tcle')),
  version         integer not null check (version >= 1),
  title           text not null,
  content         text not null,
  content_sha256  text not null,
  published_at    date not null default current_date,
  is_current      boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (slug, version)
);

-- Só uma versão vigente por documento — o gate lê exatamente uma linha por slug.
create unique index if not exists legal_documents_one_current
  on public.legal_documents (slug) where is_current;

-- ── Trilha de consentimentos (append-only) ──────────────────────────────────────────────────
-- Cada mudança de status é uma LINHA NOVA. Estado atual = última linha por (user_id, kind).
create table if not exists public.user_consents (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  kind              text not null check (kind in (
                      'politica_privacidade', 'termos', 'maioridade', 'comunicacoes', 'pesquisa')),
  status            text not null check (status in ('dado', 'negado', 'revogado')),
  -- Preenchidos quando o consentimento se refere a um documento (política, termos, TCLE).
  document_slug     text,
  document_version  integer,
  content_sha256    text,
  source            text not null default 'app',
  ip                text,
  user_agent        text,
  occurred_at       timestamptz not null default now()
);

create index if not exists user_consents_user_kind_idx
  on public.user_consents (user_id, kind, occurred_at desc);

-- Trilha de auditoria não se corrige, se complementa. O gatilho vale inclusive para a service
-- role: um UPDATE distraído numa rotina administrativa apagaria a prova do consentimento.
--
-- Só UPDATE. DELETE fica liberado de propósito: o FK para auth.users é ON DELETE CASCADE, e um
-- gatilho que barrasse DELETE faria a remoção da conta abortar com "Database error deleting user"
-- — ou seja, impediria o titular de exercer o direito de eliminação (art. 18, VI) em nome de
-- proteger o registro do consentimento. A garantia que interessa aqui é não reescrever o passado;
-- apagar tudo junto com a conta é um evento legítimo, e quem o documenta é
-- account_deletion_requests, cuja linha sobrevive à exclusão.
create or replace function public.fn_user_consents_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'user_consents é append-only: registre uma nova linha em vez de alterar a existente';
end;
$$;

drop trigger if exists user_consents_append_only on public.user_consents;
create trigger user_consents_append_only
  before update on public.user_consents
  for each row execute function public.fn_user_consents_append_only();

-- ── Estado de conformidade por usuário ──────────────────────────────────────────────────────
-- Espelho derivado da trilha, para o gate resolver o acesso com UMA leitura indexada.
create table if not exists public.user_compliance (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  birth_date         date,
  declared_adult_at  timestamptz,
  review_status      text not null default 'ok' check (review_status in ('ok', 'menor_em_revisao')),
  blocked_at         timestamptz,
  reviewed_at        timestamptz,
  reviewed_by        uuid references auth.users (id),
  review_note        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Sanidade apenas. A regra dos 18 anos não cabe num CHECK: current_date não é IMMUTABLE, e a
  -- idade muda com o tempo — quem valida é a edge function, no momento da declaração.
  constraint user_compliance_birth_date_sane
    check (birth_date is null or (birth_date > date '1900-01-01' and birth_date < date '2100-01-01'))
);

-- ── Leitura conveniente: o consentimento vigente de cada tipo ────────────────────────────────
-- security_invoker: a view respeita a RLS de quem consulta, em vez dos direitos do dono.
create or replace view public.user_consents_current
with (security_invoker = true)
as
select distinct on (user_id, kind)
  user_id, kind, status, document_slug, document_version, content_sha256, occurred_at
from public.user_consents
order by user_id, kind, occurred_at desc;

-- ── RLS ─────────────────────────────────────────────────────────────────────────────────────
-- Nenhuma policy de INSERT/UPDATE/DELETE em lugar nenhum: a escrita é exclusividade da service
-- role (que ignora RLS). É isto que torna a trava de idade inviolável pelo front.
alter table public.legal_documents enable row level security;
alter table public.user_consents   enable row level security;
alter table public.user_compliance enable row level security;

drop policy if exists legal_documents_read_all on public.legal_documents;
create policy legal_documents_read_all
  on public.legal_documents for select
  using (true);

drop policy if exists user_consents_read_own on public.user_consents;
create policy user_consents_read_own
  on public.user_consents for select
  using (auth.uid() = user_id);

drop policy if exists user_compliance_read_own on public.user_compliance;
create policy user_compliance_read_own
  on public.user_compliance for select
  using (auth.uid() = user_id);

-- O painel admin precisa enxergar a fila de revisão de menores e comprovar aceites numa auditoria.
drop policy if exists user_consents_read_admin on public.user_consents;
create policy user_consents_read_admin
  on public.user_consents for select
  using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));

drop policy if exists user_compliance_read_admin on public.user_compliance;
create policy user_compliance_read_admin
  on public.user_compliance for select
  using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));

-- ── Seed: v1 dos documentos já publicados ───────────────────────────────────────────────────
-- Texto idêntico ao de src/constants/legal.ts nesta data, gerado a partir do próprio arquivo.
-- Ao publicar uma revisão, crie uma migration nova: marque is_current=false na anterior e insira
-- version+1. O gate volta a pedir aceite sozinho.
insert into public.legal_documents
  (slug, version, title, content, content_sha256, published_at, is_current)
values
  ('termos', 1, 'Termos de Uso', 'Estes Termos de Uso ("Termos") regem o acesso e a utilização da plataforma **Maestra** ("Maestra", "Plataforma"), disponibilizada por **MUSIC RIO ACADEMY LTDA**, inscrita no CNPJ sob o nº 22.826.985/0001-41, com sede na Rua Riposeira, nº 1286, São Conrado, Rio de Janeiro/RJ, CEP 22.610-380 ("nós", "nosso"). Ao criar uma conta ou utilizar a Plataforma, você ("Usuário", "você") declara ter lido, compreendido e aceito integralmente estes Termos. **Se não concordar, não utilize a Plataforma.**

## 1. Definições
- **Plataforma / Maestra:** o software de gestão e planejamento estratégico de carreira artística, incluindo a assistente de inteligência artificial "Nyta" e os módulos de perfil, diagnóstico, músicas, agenda, plano de ação e equipe.
- **Conta:** o cadastro individual que dá acesso à Plataforma.
- **Conteúdo do Usuário:** todo dado, texto, imagem, áudio, obra musical, metadado ou informação que você insere, envia ou gera na Plataforma.
- **Perfil de Artista:** o espaço de trabalho vinculado a um artista, que pode ser desbloqueado mediante pagamento único.
- **Assinatura PRO:** o plano recorrente que habilita recursos avançados, incluindo a Nyta contínua.

## 2. Objeto e descrição do serviço
A Maestra é uma ferramenta de organização, diagnóstico e planejamento de carreira para artistas e suas equipes. A Nyta gera sugestões, análises e textos com base nas informações do Perfil de Artista. A Plataforma é um **instrumento de apoio à gestão**: não presta consultoria jurídica, contábil, financeira ou de investimento, e não intermedeia contratos artísticos com terceiros.

## 3. Elegibilidade e capacidade
O uso da Plataforma é restrito a pessoas **maiores de 18 (dezoito) anos** e plenamente capazes. Ao se cadastrar, você declara preencher esses requisitos e que as informações fornecidas são verdadeiras, exatas e atualizadas. Contas empresariais devem ser operadas por representante com poderes para tanto.

## 4. Conta, credenciais e segurança
- O cadastro exige confirmação de e-mail por código de verificação (OTP).
- Você é o único responsável por manter a confidencialidade das suas credenciais e por toda atividade realizada na sua Conta.
- Comunique-nos imediatamente qualquer uso não autorizado, por **maestra@musicrioacademy.com.br**.
- Você pode convidar membros de equipe, informando nome e e-mail de terceiros. Ao fazê-lo, você declara ter base legítima para compartilhar esses dados e é responsável por essas informações perante os titulares.

## 5. Planos, preços e pagamentos
- A Maestra oferece: (i) **recursos gratuitos**, disponíveis a qualquer Conta; (ii) **desbloqueio de Perfil de Artista** mediante **pagamento único**; e (iii) **Assinatura PRO** recorrente, na periodicidade exibida no momento da contratação.
- Os **recursos gratuitos** estão sujeitos a estes Termos e podem ser alterados, limitados ou descontinuados a qualquer tempo, sem que isso gere direito a indenização, preservados os recursos já pagos.
- Os **preços vigentes** são exibidos no momento da contratação, na própria tela de checkout, e podem ser atualizados a qualquer tempo, sem efeito retroativo sobre contratações já realizadas.
- Os pagamentos são processados pela **Asaas** (instituição de pagamento). Os **dados de cartão são transmitidos diretamente à Asaas e não são armazenados** por nós. A cobrança aparece no seu extrato/fatura em nome de **MUSIC RIO ACADEMY LTDA — CNPJ 22.826.985/0001-41**.
- Na Assinatura PRO, a cobrança é **recorrente e automática** até o cancelamento. Falhas de pagamento podem suspender o acesso aos recursos pagos.
- **Cupons de desconto**, quando disponibilizados, seguem as condições, prazos e limites específicos de cada campanha.

## 6. Direito de arrependimento e reembolso (CDC, art. 49)
Por se tratar de contratação à distância, você pode **desistir da compra no prazo de 7 (sete) dias corridos**, contados da data da contratação, com **reembolso integral** do valor pago, tanto no desbloqueio de Perfil quanto na Assinatura PRO. Para exercer o direito, escreva para **maestra@musicrioacademy.com.br**. O estorno é realizado pelo mesmo meio de pagamento, observados os prazos operacionais da instituição de pagamento.

## 7. Cancelamento e vigência
- Você pode **cancelar a Assinatura PRO a qualquer momento** pelas Configurações; o acesso aos recursos pagos permanece ativo até o fim do período já pago, sem novas cobranças.
- O desbloqueio de Perfil concede acesso ao Perfil pago conforme descrito na contratação.
- Podemos suspender ou encerrar Contas que violem estes Termos, a lei ou direitos de terceiros, resguardado, quando cabível, aviso prévio e o direito ao contraditório.
- Antes de excluir sua Conta, você pode solicitar a **exportação dos seus dados**, conforme descrito na Política de Privacidade.

## 8. Conteúdo do Usuário e propriedade intelectual
- Você **mantém a titularidade** do Conteúdo do Usuário (inclusive obras musicais, letras, imagens e textos).
- Você nos concede uma **licença limitada, não exclusiva e gratuita**, unicamente para hospedar, processar, exibir e operar os recursos da Plataforma em seu benefício, inclusive para gerar as análises e sugestões da Nyta. Essa licença vigora enquanto o respectivo conteúdo permanecer na Plataforma e cessa automaticamente com a sua exclusão pelo Usuário ou com o encerramento da Conta, ressalvadas cópias de segurança transitórias e hipóteses de guarda legal.
- Você declara possuir os direitos necessários sobre o Conteúdo do Usuário e se responsabiliza por ele.
- O **software, a marca "Maestra", a "Nyta", o layout e os elementos da Plataforma** são de nossa titularidade ou licenciados a nós, protegidos pela legislação de propriedade intelectual. Estes Termos não transferem qualquer direito sobre eles.

## 9. Uso aceitável
É vedado, entre outros: (i) usar a Plataforma para fins ilícitos ou que violem direitos de terceiros; (ii) inserir conteúdo ilegal, difamatório ou que infrinja direitos autorais; (iii) tentar acessar áreas restritas, burlar controles de segurança ou realizar engenharia reversa; (iv) sobrecarregar, automatizar indevidamente ou prejudicar o funcionamento da Plataforma; (v) compartilhar credenciais ou revender o acesso sem autorização.

## 10. Integrações de terceiros
A Plataforma pode integrar serviços de terceiros para obter dados públicos e métricas de audiência (por exemplo, plataformas de streaming que você conecta). O uso desses serviços sujeita-se também aos respectivos termos e políticas. Não nos responsabilizamos por indisponibilidades, alterações ou imprecisões de dados originados de terceiros.

## 11. Inteligência artificial e análises automatizadas
- A Nyta é assistida por modelos de linguagem de terceiro, aos quais são enviadas as informações do Perfil de Artista necessárias para gerar as respostas.
- O **diagnóstico de carreira** é gerado de forma automatizada a partir das informações fornecidas por você e de métricas obtidas das integrações. Ele é um ponto de partida analítico, não um julgamento definitivo sobre a carreira.
- As saídas da Nyta e do diagnóstico são **sugestões automatizadas** e **podem conter erros, imprecisões ou informações desatualizadas**. Elas **não constituem aconselhamento profissional** e **não garantem resultado**.
- **As decisões são sempre suas.** Confira informações relevantes antes de agir. Você pode solicitar informações e revisão sobre esses tratamentos automatizados pelo canal indicado na Política de Privacidade.

## 12. Disponibilidade e isenção de garantias
A Plataforma é fornecida **"no estado em que se encontra" e "conforme disponível"**. Podemos realizar manutenções, atualizações e alterações de recursos. **Não garantimos resultados específicos de carreira** decorrentes do uso da ferramenta, nem operação ininterrupta ou livre de erros, ressalvadas as garantias legais aplicáveis às relações de consumo.

## 13. Limitação de responsabilidade
Nos limites permitidos pela legislação aplicável, não respondemos por danos indiretos, lucros cessantes, perda de dados ou de oportunidade, nem por atos de terceiros (inclusive suboperadores e integrações). Nenhuma disposição destes Termos afasta direitos irrenunciáveis do consumidor previstos no CDC.

## 14. Indenização
Você concorda em nos indenizar por perdas e danos decorrentes do uso irregular da Plataforma, da violação destes Termos ou da lei, ou da violação de direitos de terceiros por Conteúdo do Usuário por você inserido.

## 15. Privacidade
O tratamento de dados pessoais é regido pela nossa **Política de Privacidade**, parte integrante destes Termos, disponível em /legal/privacidade.

## 16. Alterações dos Termos
Podemos atualizar estes Termos a qualquer tempo. Mudanças relevantes serão comunicadas por meios razoáveis (e-mail ou aviso na Plataforma), e a data de atualização acima será revisada. O uso continuado após a vigência implica concordância.

## 17. Lei aplicável e foro
Estes Termos são regidos pela **lei brasileira**. Fica eleito o **foro da Comarca do Rio de Janeiro/RJ** para dirimir controvérsias, sem prejuízo do direito do consumidor de demandar no foro de seu domicílio, nos termos do CDC.

## 18. Contato
Dúvidas sobre estes Termos: **maestra@musicrioacademy.com.br**.', '34d4ac69d2b2cd722806464da63a25d0d8e42c4aad5be196dce0f4b461ed80ab', '2026-07-02'::date, true),
  ('privacidade', 1, 'Política de Privacidade', 'Esta Política de Privacidade descreve como a **MUSIC RIO ACADEMY LTDA**, CNPJ 22.826.985/0001-41, com sede na Rua Riposeira, nº 1286, São Conrado, Rio de Janeiro/RJ, CEP 22.610-380 ("nós", "Controladora"), trata os dados pessoais dos usuários da plataforma **Maestra**, em conformidade com a **Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD)**.

## 1. Encarregado (DPO) e contato
Para exercer seus direitos ou tirar dúvidas sobre privacidade, fale com o nosso Encarregado pelo tratamento de dados: **maestra@musicrioacademy.com.br**.

## 2. Dados que tratamos
Tratamos apenas os dados necessários para operar a Plataforma:

- **Cadastro e conta:** nome, e-mail, senha (armazenada de forma criptografada — nunca em texto puro) e código de verificação (OTP).
- **Pagamento e faturamento:** CPF/CNPJ, nome do titular, telefone, CEP e endereço (logradouro, bairro, cidade, UF), identificadores atribuídos pela instituição de pagamento, status e histórico de cobranças. **Os dados do cartão (número, validade, CVV) são transmitidos diretamente à instituição de pagamento e NÃO são armazenados por nós.**
- **Conteúdo do artista:** identidade e bio do artista, músicas (faixas, letras, ISRC/UPC, metadados), agenda/eventos, plano de ação, diagnóstico e respostas de quiz.
- **Equipe:** nome, e-mail e função dos membros que você convida.
- **Integrações:** identificador público do artista em plataformas de streaming que você conecta e métricas de audiência obtidas de provedor especializado.
- **Assistente Nyta:** o conteúdo das conversas com a Nyta e contadores de uso.
- **Arquivos:** avatar, capas e áudios que você faz upload.
- **Dados técnicos:** informações de sessão/autenticação e registros de acesso, para segurança e funcionamento (Marco Civil da Internet).

## 3. Origem dos dados
Os dados são: (i) **fornecidos por você** (cadastro, pagamento, conteúdo); (ii) **gerados pelo uso** (conversas, análises, registros); ou (iii) **obtidos de fontes de terceiros** integradas por você (dados públicos de plataformas de streaming e métricas de audiência musical).

## 4. Finalidades e bases legais (LGPD, art. 7º e 10)
- **Executar o contrato** (criar e manter a conta, processar pagamentos, entregar os recursos contratados) — art. 7º, V.
- **Cumprir obrigações legais e regulatórias** (fiscais, contábeis, guarda de registros) — art. 7º, II.
- **Legítimo interesse** (melhorar, proteger e dar segurança à Plataforma; prevenir fraudes) — art. 7º, IX, sempre respeitados seus direitos e expectativas.
- **Consentimento**, quando aplicável (por exemplo, comunicações não essenciais) — art. 7º, I, podendo ser revogado a qualquer tempo.

## 5. Compartilhamento com suboperadores
Não vendemos seus dados. Compartilhamos apenas o necessário com prestadores que atuam como **operadores**, sob obrigações contratuais de confidencialidade e segurança, descritos abaixo por categoria de finalidade:

- **Infraestrutura em nuvem, banco de dados, autenticação e armazenamento** — hospedagem e operação da Plataforma (dados de conta, conteúdo do artista e arquivos; exceto dados de cartão).
- **Instituição/gateway de pagamento** — processamento de pagamentos (PIX, cartão, boleto): CPF/CNPJ, nome, e-mail, telefone, endereço e dados de cartão.
- **Provedor de e-mail transacional** — envio de mensagens de verificação, convites e avisos: nome, e-mail e código de verificação.
- **Provedor de métricas e analytics de audiência musical** — enriquecimento dos dados de carreira: identificador público do artista.
- **Plataformas de streaming musical** — leitura de dados públicos do artista que você conecta.
- **Provedor de inteligência artificial (modelos de linguagem)** — geração das respostas da assistente Nyta: contexto do Perfil de Artista e a mensagem enviada.

**Mediante solicitação**, informamos ao titular os operadores específicos com os quais seus dados foram compartilhados (LGPD, art. 18, VII). Também poderemos compartilhar dados para **cumprir a lei**, atender **autoridades competentes** ou **defender nossos direitos**, sempre nos limites legais.

## 6. Transferência internacional
Alguns suboperadores podem processar dados **fora do Brasil**. Nesses casos, adotamos salvaguardas adequadas, como cláusulas contratuais que asseguram nível de proteção compatível com a LGPD, e observamos os requisitos dos arts. 33 a 36 da LGPD e da regulamentação da ANPD sobre transferência internacional.

## 7. Retenção e eliminação
Mantemos seus dados **enquanto a conta estiver ativa** e pelo prazo necessário ao cumprimento das finalidades e de **obrigações legais**. Em especial: registros de acesso à aplicação são guardados por, no mínimo, **6 (seis) meses** (Marco Civil da Internet, art. 15); documentos fiscais e de faturamento, pelo prazo de **5 (cinco) anos** exigido pela legislação tributária. Encerrada a relação, os demais dados são eliminados ou anonimizados, ressalvadas as hipóteses de guarda obrigatória previstas em lei.

## 8. Segurança da informação e incidentes
Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo **isolamento por usuário (Row-Level Security)**, **controle de acesso**, **criptografia de senhas** e **tráfego criptografado**. Os **dados de cartão não trafegam nem são armazenados em nossos servidores** — são tratados diretamente pela instituição de pagamento.

Caso ocorra incidente de segurança que possa acarretar risco ou dano relevante aos titulares, comunicaremos a **ANPD** e os titulares afetados, nos termos do **art. 48 da LGPD**, informando a natureza do incidente, os dados envolvidos e as medidas adotadas.

## 9. Seus direitos (LGPD, art. 18)
Você pode, a qualquer tempo: confirmar a existência de tratamento; **acessar** seus dados; **corrigir** dados incompletos ou desatualizados; solicitar **anonimização, bloqueio ou eliminação**; requerer **portabilidade e exportação** dos seus dados; obter informação sobre **compartilhamentos**; e **revogar consentimento**. Para exercer, escreva para **maestra@musicrioacademy.com.br**.

A **exclusão da conta** pode ser solicitada nas Configurações; o pedido é registrado, a assinatura ativa é cancelada e a eliminação é processada, ressalvada a guarda legal obrigatória. Antes da exclusão, você pode solicitar a **exportação dos dados do seu Perfil de Artista** pelo canal do Encarregado.

Você também tem o direito de peticionar em relação aos seus dados perante a **Autoridade Nacional de Proteção de Dados (ANPD)**.

## 10. Cookies e tecnologias de sessão
Utilizamos armazenamento local e tokens de sessão **estritamente necessários** para autenticação e funcionamento da Plataforma. Não utilizamos esses recursos para publicidade de terceiros.

## 11. Menores de idade
A Plataforma é destinada a **maiores de 18 anos**. Não coletamos intencionalmente dados de menores. Identificado tratamento indevido, os dados serão eliminados.

## 12. Decisões automatizadas e inteligência artificial
A Plataforma realiza tratamentos automatizados a partir dos dados do Perfil de Artista, em especial: (i) o **diagnóstico de carreira**, gerado automaticamente a partir das suas respostas e das métricas obtidas das integrações; e (ii) as **sugestões e análises da assistente Nyta**, geradas com apoio de modelos de linguagem.

Essas saídas têm **caráter consultivo** e não produzem, por si, efeitos jurídicos sobre o titular; as decisões são sempre do Usuário. Ainda assim, nos termos do **art. 20 da LGPD**, você pode solicitar informações claras sobre os critérios gerais desses tratamentos e a revisão de resultados, pelo canal do Encarregado, respeitados os segredos comercial e industrial.

## 13. Alterações desta Política
Podemos atualizar esta Política a qualquer tempo. Mudanças relevantes serão comunicadas por meios razoáveis, e a data de atualização acima refletirá a versão vigente.

## 14. Contato
Encarregado pelo tratamento de dados (DPO): **maestra@musicrioacademy.com.br**.', '52afff7b524573be8bd0d31937cfb2880fd7d7c4eeb8f312972b76528d4775e2', '2026-07-02'::date, true)
on conflict (slug, version) do nothing;
