// A sequência de exclusão de uma conta, num lugar só.
//
// Ela é delicada e foi cara de acertar: a ORDEM importa, e qualquer tabela esquecida faz o
// `deleteUser` falhar com o inútil "Database error deleting user". Existia apenas dentro do
// `admin-users`; com a exclusão pedida pela própria pessoa (LGPD art. 18, VI, e regra 5.1.1 da
// App Store), passou a ter dois chamadores — e duas cópias divergentes disso seria a pior
// duplicação possível, porque a divergência só aparece na hora de apagar.
//
// Cópias deste arquivo vivem dentro de cada função que o usa (o deploy de edge function não
// resolve `../_shared`). `src/__tests__/edgeSharedCopies.test.ts` garante que sejam idênticas.

// deno-lint-ignore no-explicit-any
type Admin = any;

/**
 * Apaga tudo o que pertence ao usuário e, por fim, o próprio usuário.
 *
 * NÃO decide se PODE apagar — quem chama é que valida (o admin não pode excluir a si mesmo nem
 * outro admin; a pessoa só pode excluir a própria conta). Aqui é só a execução.
 */
export async function apagarConta(admin: Admin, userId: string): Promise<{ erro?: string }> {
  // A ORDEM importa: apaga os artistas PRIMEIRO. O trigger fn_track_artist_deletion grava em
  // artist_deletions usando o user_id — e isso precisa acontecer com o usuário ainda presente
  // (senão viola a FK). Só depois limpamos as tabelas cujo FK pra auth.users é NO ACTION
  // (as com ON DELETE CASCADE somem sozinhas no deleteUser). Se QUALQUER uma dessas ficar pra
  // trás, o deleteUser falha com "Database error deleting user". Os filhos dessas tabelas
  // (whatsapp_messages, chat_messages, crm_quote_items etc.) são todos CASCADE, então cair a
  // linha-pai já os limpa.
  await admin.from("artists").delete().eq("user_id", userId);

  // Tabelas NO ACTION que apontam pro dono via `user_id`.
  for (const t of ["artist_deletions", "account_deletion_requests", "artist_members", "nyta_conversations", "whatsapp_instances"]) {
    await admin.from(t).delete().eq("user_id", userId);
  }
  // Tabelas NO ACTION com nome de coluna diferente (dono OU só "ator" do registro).
  await admin.from("whatsapp_instance_assignments").delete().eq("assigned_by_user_id", userId);
  await admin.from("chats").delete().eq("created_by", userId);
  await admin.from("crm_quotes").delete().eq("created_by", userId);
  // updated_by só marca quem editou por último (pode ser registro de outra pessoa) → zera a ref.
  await admin.from("crm_quotes").update({ updated_by: null }).eq("updated_by", userId);

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("[apagarConta] deleteUser:", error.message);
    return { erro: `Falha ao excluir: ${error.message}` };
  }
  return {};
}
