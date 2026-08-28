/**
 * `process.env` no núcleo.
 *
 * Não é um global de verdade em nenhuma das duas superfícies: o webpack (CRA) e o babel (Expo)
 * substituem estas leituras por literais em tempo de build. Por isso a declaração é só do
 * `env`, e não do `process` inteiro — nada mais de Node existe aqui.
 *
 * Os nomes divergem entre as plataformas (`REACT_APP_*` na web, `EXPO_PUBLIC_*` no app). Todo
 * ponto de leitura no núcleo tem valor padrão, então o app funciona antes mesmo de alguém
 * configurar as variáveis dele.
 */
declare const process: {
  env: Record<string, string | undefined>;
};
