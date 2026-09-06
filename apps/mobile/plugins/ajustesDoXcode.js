// Os ajustes do projeto iOS que o `expo prebuild` nao faz sozinho.
//
// A pasta `ios/` e GERADA e nao vai para o Git (apps/mobile/.gitignore). Editar o
// `project.pbxproj` a mao funciona ate alguem rodar `expo prebuild --clean`, e ai os dois
// valores abaixo somem sem aviso — o build volta a falhar com mensagens que nao dizem a causa.
// Aqui eles moram num arquivo versionado, e a regeneracao ja sai certa.
//
// A logica fica separada do plugin de proposito: assim da para testa-la sem montar o Expo.

const AJUSTES = {
  // A fase "Bundle React Native code and images" roda o Node para gerar o `main.jsbundle`, e
  // esse script precisa ler a arvore do projeto inteira e escrever dentro do DerivedData. Com a
  // caixa de areia ligada o build morre em cinco negacoes de leitura e escrita, nenhuma delas
  // dizendo que o problema e esta chave. Todos os Pods ja vem com NO; so o alvo do app nao vinha.
  ENABLE_USER_SCRIPT_SANDBOXING: 'NO',
  // O time do Apple Developer Program (Music Rio Academy Ltda.). Sem ele o Xcode abre sem time
  // selecionado e cai no Personal Team, que nao suporta Sign in with Apple nem publica na loja.
  DEVELOPMENT_TEAM: 'NX83Q24CXV',
};

/**
 * Escreve os ajustes em TODAS as configuracoes de build do projeto do app.
 *
 * Vale para o nivel do projeto e para o do alvo: uma definicao no alvo vence a do projeto, entao
 * deixar so a de cima seria uma armadilha silenciosa se o alvo passasse a definir a chave.
 *
 * Nao toca no projeto dos Pods — o `withXcodeProject` do Expo entrega apenas o `.xcodeproj` do
 * app, e os Pods ja nascem com a caixa de areia desligada.
 *
 * @param {{ pbxXCBuildConfigurationSection: () => Record<string, unknown> }} projeto
 * @returns {number} quantas configuracoes foram alteradas, para o chamador poder conferir
 */
function aplicarAjustes(projeto) {
  const configuracoes = projeto.pbxXCBuildConfigurationSection();
  let alteradas = 0;

  for (const [chave, configuracao] of Object.entries(configuracoes)) {
    // A biblioteca `xcode` guarda, ao lado de cada entrada, uma segunda chave `<id>_comment`
    // com o nome legivel ("Debug", "Release"). Ela e uma string, nao um objeto.
    if (chave.endsWith('_comment')) continue;
    if (!configuracao || typeof configuracao !== 'object') continue;
    if (!configuracao.buildSettings) continue;

    Object.assign(configuracao.buildSettings, AJUSTES);
    alteradas += 1;
  }

  return alteradas;
}

module.exports = { AJUSTES, aplicarAjustes };
