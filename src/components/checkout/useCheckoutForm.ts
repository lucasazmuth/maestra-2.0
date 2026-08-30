// O hook do formulário de pagamento MUDOU-SE para o núcleo (`hooks/useCheckoutForm`): o app
// nativo cobra pelas mesmas regras. Aqui fica só o que depende do DOM.
//
// Nada é reexportado deste arquivo: `export … from` cruzando a fronteira do pacote passa no
// `tsc` e some no bundle do webpack (já derrubou `audioMeta` e `RealBadge`). Quem precisa do
// hook o importa do núcleo.

// Foca e rola até o primeiro campo marcado como inválido (após uma tentativa de
// pagar). Roda no próximo tick pra o React já ter pintado as classes de erro.
export function focusFirstInvalidField() {
  setTimeout(() => {
    const el = document.querySelector(
      '.ant-input-status-error, .ant-input-affix-wrapper-status-error',
    ) as HTMLElement | null;
    if (!el) return;
    const input = (el.matches('input') ? el : el.querySelector('input')) as HTMLElement | null;
    input?.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 0);
}

