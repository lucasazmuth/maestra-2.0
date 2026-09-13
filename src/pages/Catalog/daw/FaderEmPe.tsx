import { FC, useRef } from 'react';

import { DS } from './tokens';

// O FADER EM PÉ da mesa — o mesmo desenho do app.
//
// ⚠️ ERA UM `<input type=range>` DEITADO DE LADO (`writing-mode: vertical-lr`). Funcionava, e
// parecia outra coisa: o trilho nativo vem creme-claro no meio de uma tela quase preta, com a
// espessura e o botão que cada navegador decide — num canal de 116 px era uma barra pálida a
// atravessar o cartão de cima a baixo. O app desenha o seu: trilho escuro de 6, preenchido DE
// BAIXO PARA CIMA na cor da faixa, e um botão redondo de 22.
//
// Feito à mão pela mesma razão do app: são trinta linhas, e instalar um pacote para isto seria
// mais peso do que código.

const TRILHO = 6;
const BOTAO = 22;

/**
 * Onde o dedo (ou o rato) tocou, em quanto de volume.
 *
 * ⚠️ O ZERO É EMBAIXO. É a única coisa que distingue um fader em pé de um deitado virado de
 * lado, e enganá-la dá um controlo que funciona ao contrário — o gesto de baixar sobe.
 */
export const volumeDoToque = (y: number, altura: number): number =>
  // O limite trata sozinho da altura ZERO: `1 - y/0` é `-Infinity`, e preso entre 0 e 1 dá 0.
  Math.max(0, Math.min(1 - y / altura, 1));

export const FaderEmPe: FC<{
  /** 0..1 */
  valor: number;
  cor: string;
  rotulo: string;
  travado?: boolean;
  aoMudar: (v: number) => void;
}> = ({ valor, cor, rotulo, travado, aoMudar }) => {
  const alvo = useRef<HTMLDivElement>(null);
  const preso = useRef(false);

  const levar = (clientY: number) => {
    const caixa = alvo.current?.getBoundingClientRect();
    if (!caixa) return;
    aoMudar(volumeDoToque(clientY - caixa.top, caixa.height));
  };

  const cheio = Math.max(0, Math.min(valor, 1));

  return (
    <div
      ref={alvo}
      role='slider'
      tabIndex={travado ? -1 : 0}
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(cheio * 100)}
      aria-disabled={travado}
      // ⚠️ PONTEIRO, E NÃO RATO: ao toque o rato só é imitado depois de o dedo levantar, e
      // nunca em série — com `mousemove` o arrasto simplesmente não acontecia no telemóvel.
      onPointerDown={(evento) => {
        if (travado) return;
        preso.current = true;
        evento.currentTarget.setPointerCapture(evento.pointerId);
        levar(evento.clientY);
      }}
      onPointerMove={(evento) => { if (preso.current) levar(evento.clientY); }}
      onPointerUp={() => { preso.current = false; }}
      onPointerCancel={() => { preso.current = false; }}
      onKeyDown={(evento) => {
        if (travado) return;
        const passo = evento.shiftKey ? 0.1 : 0.02;
        if (evento.key === 'ArrowUp') { evento.preventDefault(); aoMudar(Math.min(1, cheio + passo)); }
        if (evento.key === 'ArrowDown') { evento.preventDefault(); aoMudar(Math.max(0, cheio - passo)); }
      }}
      style={{
        // ⚠️ O FADER ESTICA até onde a coluna vai: 150 px fixos dão saltos de 4 % por pixel
        // debaixo de um dedo. É a mesma decisão do app.
        flex: '1 1 auto', minHeight: 180, width: BOTAO + 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
        cursor: travado ? 'default' : 'pointer',
        touchAction: 'none',
      }}
    >
      <div style={{
        width: TRILHO, height: '100%', borderRadius: TRILHO / 2,
        background: DS.color.bgCampo, overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}>
        <div style={{ width: '100%', height: `${cheio * 100}%`, background: cor }} />
      </div>
      <div style={{
        position: 'absolute', bottom: `${cheio * 100}%`,
        // Metade da altura para baixo: o `bottom` posiciona a borda, e o que tem de ficar sobre
        // o valor é o CENTRO do botão.
        marginBottom: -BOTAO / 2,
        width: BOTAO, height: BOTAO, borderRadius: '50%',
        background: '#fff', border: `1px solid ${DS.color.bordaForte}`,
        pointerEvents: 'none',
      }} />
    </div>
  );
};
