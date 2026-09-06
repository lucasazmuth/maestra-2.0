// Plugin de configuracao: aplica os ajustes do Xcode a cada `expo prebuild`.
//
// Registrado em `app.json` como "./plugins/withAjustesDoXcode".

const { withXcodeProject } = require('@expo/config-plugins');
const { aplicarAjustes } = require('./ajustesDoXcode');

module.exports = function withAjustesDoXcode(config) {
  return withXcodeProject(config, (config) => {
    aplicarAjustes(config.modResults);
    return config;
  });
};
