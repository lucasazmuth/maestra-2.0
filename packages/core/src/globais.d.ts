/**
 * O que o núcleo pode assumir que existe em QUALQUER plataforma.
 *
 * O `tsconfig` deste pacote não carrega a lib `dom` de propósito: é o que faz o compilador
 * recusar `document`, `window` e `localStorage` aqui dentro, em vez de deixar passar e quebrar
 * só no aparelho. O preço é declarar à mão o que é de fato universal.
 *
 * Regra para crescer esta lista: só entra o que existe no navegador, no Node e no React Native.
 * Se algo só existe em dois dos três, o lugar é uma porta em `nucleo/`, não aqui.
 */

declare const console: {
  log(...dados: unknown[]): void;
  warn(...dados: unknown[]): void;
  error(...dados: unknown[]): void;
  info(...dados: unknown[]): void;
};
