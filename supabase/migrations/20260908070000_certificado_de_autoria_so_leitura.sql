-- Fecha a escrita do certificado no nível do PRIVILÉGIO, e não só no da policy.
--
-- Descoberto ao aplicar a migration anterior em produção: esta base concede TODOS os
-- privilégios a `anon` e a `authenticated` em cada tabela nova do schema public (é o privilégio
-- padrão do projeto). O `grant select` de lá, portanto, não restringiu coisa nenhuma — a tabela
-- já nascia com INSERT, UPDATE e DELETE para os dois papéis.
--
-- Ninguém consegue escrever mesmo assim, porque a RLS está ligada e só existe policy de SELECT,
-- e RLS sem policy nega. Mas essa é uma linha de defesa só. No dia em que alguém acrescentar uma
-- policy permissiva por engano, ou desligar a RLS por um minuto para depurar, o privilégio já
-- estaria lá esperando. Um documento que afirma uma data e um conteúdo merece as duas linhas.
--
-- ⚠️ Isto vale para QUALQUER tabela nova deste projeto: quem escrever a próxima migration não
-- pode assumir que a ausência de `grant` significa ausência de privilégio.
--
-- `anon` perde até o SELECT: um certificado é da equipe do artista, e quem não entrou não é da
-- equipe de ninguém.

revoke all on public.version_certificates from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.version_certificates from authenticated;

grant select on public.version_certificates to authenticated;
