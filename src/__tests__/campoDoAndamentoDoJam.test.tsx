import { fireEvent, render, screen } from '@testing-library/react';

import { CampoDoTopo } from '../pages/Catalog/ProjectSpace';

// ⚠️ O RÓTULO MUDOU-SE PARA DENTRO DO CAMPO. Ele vivia ao lado, e o campo vazio mostrava um
// traço: um retângulo com um traço, ao lado da palavra "BPM", não se lia como campo — via-se a
// palavra e não se percebia que havia ali onde escrever. Como vazio, ele diz as duas coisas de
// uma vez, e o campo aparece mesmo sem nada dentro.
describe('o vazio do campo', () => {
  it('o rótulo está DENTRO do campo, e não ao lado dele', () => {
    const { container } = render(
      <CampoDoTopo rotulo='BPM' vazio='BPM' apenas='numero' valor='' largura={48} limite={3} aoMudar={() => {}} />,
    );
    expect(screen.getByLabelText('BPM')).toHaveAttribute('placeholder', 'BPM');
    // E não sobrou texto solto na tela a repetir o que o campo já diz.
    expect(container.textContent).toBe('');
  });

  // ⚠️ FILTRA NA TECLA, e não valida no fim. Um campo que aceita tudo e recusa ao gravar deixa
  // escrever "128bpm", sair da tela e descobrir mais tarde que nada foi salvo.
  it('o andamento só aceita algarismos', () => {
    const escrito: string[] = [];
    render(
      <CampoDoTopo rotulo='BPM' vazio='BPM' apenas='numero' valor='' largura={48} limite={3} aoMudar={(v) => escrito.push(v)} />,
    );
    fireEvent.change(screen.getByLabelText('BPM'), { target: { value: '12b' } });
    expect(escrito).toEqual(['12']);
  });

  // O tom não é um número — e o `#` de `C#m` não é pontuação: um filtro de "só letras" apagava-o
  // e deixava a pessoa a lutar com o campo sem perceber porquê.
  it('o tom aceita letras e o sustenido, e recusa algarismos', () => {
    const escrito: string[] = [];
    render(
      <CampoDoTopo rotulo='TOM' vazio='TOM' apenas='texto' valor='' largura={52} limite={6} aoMudar={(v) => escrito.push(v)} />,
    );
    fireEvent.change(screen.getByLabelText('TOM'), { target: { value: 'C#m7' } });
    expect(escrito).toEqual(['C#m']);
  });
});
