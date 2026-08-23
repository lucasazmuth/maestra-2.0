import React from 'react';

/**
 * Rede de seguranca da aplicacao inteira.
 *
 * POR QUE EXISTE: nao havia NENHUM error boundary no projeto. Qualquer excecao durante o render
 * desmontava a arvore toda e deixava a tela BRANCA, sem mensagem e sem saida — aconteceu em
 * producao no meio do checkout da assinatura, que e o pior lugar possivel para isso.
 *
 * O caso mais comum e o ChunkLoadError. O app e quase todo `lazy()`, e cada deploy publica
 * chunks com hash novo e remove os antigos. Uma aba que ficou aberta durante um deploy carrega
 * um bundle que conhece nomes de arquivo que nao existem mais: ao navegar para uma rota ainda
 * nao baixada, o import dinamico toma 404. Isso atinge QUALQUER usuario com a aba aberta, a
 * cada deploy — nao e um caso raro.
 *
 * Para esse caso a recuperacao e trivial e automatica: recarregar busca o index.html novo, com
 * os nomes de chunk certos. Recarrega UMA vez por sessao (marca em sessionStorage); se falhar de
 * novo, o problema nao e chunk velho e a pessoa ve a tela de erro em vez de um loop de reload.
 */

const CHAVE_RELOAD = 'maestra:chunk-reload';

// A mensagem varia por navegador; o nome do erro nem sempre vem. Casar pelos dois lados.
export function ehErroDeChunk(error: unknown): boolean {
  const e = error as { name?: string; message?: string } | null;
  const nome = e?.name || '';
  const msg = e?.message || '';
  return (
    nome === 'ChunkLoadError' ||
    /Loading chunk .* failed/i.test(msg) ||
    /Loading CSS chunk .* failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  );
}

/** Recarrega uma vez por sessao. Devolve false quando ja tentou (para nao entrar em loop). */
export function tentarRecarregarUmaVez(): boolean {
  try {
    if (sessionStorage.getItem(CHAVE_RELOAD)) return false;
    sessionStorage.setItem(CHAVE_RELOAD, String(Date.now()));
  } catch {
    // Navegacao anonima pode bloquear sessionStorage. Sem o guarda o risco de loop e real,
    // entao nao recarrega: melhor mostrar a tela de erro do que piscar para sempre.
    return false;
  }
  window.location.reload();
  return true;
}

/** Some com a marca depois de um carregamento saudavel, liberando a proxima tentativa. */
export function limparMarcaDeReload(): void {
  try {
    sessionStorage.removeItem(CHAVE_RELOAD);
  } catch {
    /* sem sessionStorage, nada a limpar */
  }
}

interface Props { children: React.ReactNode }
interface State { erro: Error | null; recarregando: boolean }

class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { erro: null, recarregando: false };

  static getDerivedStateFromError(erro: Error): State {
    return { erro, recarregando: false };
  }

  componentDidCatch(erro: Error, info: React.ErrorInfo) {
    if (ehErroDeChunk(erro)) {
      // Deploy novo com aba velha: recarregar resolve sozinho.
      if (tentarRecarregarUmaVez()) {
        this.setState({ recarregando: true });
        return;
      }
    }
    console.error('[app] erro nao tratado:', erro, info.componentStack);
  }

  render() {
    const { erro, recarregando } = this.state;
    if (!erro) return this.props.children;

    // Recarregando: nao mostra erro, senao a pessoa ve um susto por um instante e some.
    if (recarregando) return <div style={estilos.tela} />;

    const chunk = ehErroDeChunk(erro);
    return (
      <div style={estilos.tela}>
        <div style={estilos.cartao}>
          <h1 style={estilos.titulo}>
            {chunk ? 'Atualize a pagina para continuar' : 'Algo deu errado por aqui'}
          </h1>
          <p style={estilos.texto}>
            {chunk
              ? 'Saiu uma versao nova do Maestra enquanto esta aba estava aberta. Recarregar resolve.'
              : 'Nao conseguimos carregar esta tela. Recarregar costuma resolver; se insistir, fale com o suporte.'}
          </p>
          <button
            style={estilos.botao}
            onClick={() => { limparMarcaDeReload(); window.location.reload(); }}
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}

const estilos: Record<string, React.CSSProperties> = {
  tela: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f7f8fb',
    padding: 20,
    fontFamily: "Inter, 'Helvetica Neue', Arial, sans-serif",
  },
  cartao: {
    maxWidth: 420,
    width: '100%',
    background: '#fff',
    border: '1px solid #e3eaf3',
    borderRadius: 14,
    padding: '28px 26px',
    textAlign: 'center',
  },
  titulo: { fontSize: 19, fontWeight: 800, color: '#2c3f63', margin: '0 0 10px' },
  texto: { fontSize: 14, lineHeight: 1.55, color: '#405985', margin: '0 0 22px' },
  botao: {
    background: '#3361ff',
    color: '#fff',
    border: 'none',
    borderRadius: 9999,
    padding: '12px 28px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
};

export default AppErrorBoundary;
