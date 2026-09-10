import { render, screen } from '@testing-library/react';

import { CampoDoTopo } from '../pages/Catalog/ProjectSpace';
import { DS } from '../pages/Catalog/daw/tokens';

// A PROVENIÊNCIA DO ANDAMENTO TEM DE SER VISÍVEL.
//
// O detector passou a preencher o BPM sozinho na primeira gravação do projeto. Um número que
// aparece sozinho num campo é indistinguível de um número que a pessoa escreveu e esqueceu — e
// é sobre esse que ela depois vai confiar para registar a obra no ECAD. O campo diz de onde
// veio: pela borda, para quem olha, e pelo rótulo, para quem usa leitor de tela.

describe('o campo do andamento', () => {
  it('escrito à mão não anuncia nada', () => {
    render(
      <CampoDoTopo rotulo='BPM' valor='92' largura={48} limite={3} aoMudar={() => {}} />,
    );
    const campo = screen.getByLabelText('BPM');
    expect(campo).toHaveValue('92');
    expect(campo).not.toHaveAttribute('title');
    expect(campo).toHaveStyle({ borderColor: DS.color.borda });
  });

  it('ouvido do áudio diz que foi ouvido, e mostra-o', () => {
    render(
      <CampoDoTopo rotulo='BPM' valor='128' largura={48} limite={3} aoMudar={() => {}} ouvido />,
    );
    const campo = screen.getByLabelText('BPM ouvido do áudio');
    expect(campo).toHaveValue('128');
    // ⚠️ E CONTINUA A SER EDITÁVEL: o detector propõe, quem assina a obra decide.
    expect(campo).not.toBeDisabled();
    expect(campo).toHaveAttribute('title', expect.stringContaining('Escreva por cima'));
    expect(campo).toHaveStyle({ borderColor: DS.color.primaria });
  });
});
