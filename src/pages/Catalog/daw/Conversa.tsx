import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { FiMessageCircle, FiSend } from 'react-icons/fi';

import type { CatalogProjectMessage } from '@maestra/core/interfaces/maestra';
import { supabase } from '@maestra/core/lib/supabase';
import * as catalogDb from '@maestra/core/services/db/catalog';

import { DS } from './tokens';

// A CONVERSA do Espaço JAM: a equipa a falar sobre a música.
//
// ⚠️ ELA NÃO É COMENTÁRIO DE VERSÃO, e a diferença é o ponto. Um comentário preso a uma gravação
// responde "o que muda NESTA" e morre com ela; a conversa é o fio do trabalho — "consegue gravar
// quinta?", "o baixo ficou alto", "mandei a letra". Presa a uma versão, ela ficava espalhada por
// V1, V2 e V3, e quem chegava tinha de abrir três sítios para saber o que se passou.
//
// A tabela (`catalog_project_messages`), a RLS e o realtime nunca saíram do ar: o chat existia
// nesta tela, foi retirado em 09/09/2026, e volta agora — uma conversa por música, nas duas
// superfícies.

const quando = (valor?: string | null) => (valor
  ? new Date(valor).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  : '');

const iniciais = (valor?: string | null) => (valor || '?').trim().slice(0, 1).toUpperCase();

export const Conversa: FC<{
  projetoId: string;
  autor: { id?: string | null; nome: string; foto?: string | null };
  /** Quem só olha o catálogo lê a conversa, mas não escreve nela. */
  podeFalar: boolean;
}> = ({ projetoId, autor, podeFalar }) => {
  const [mensagens, setMensagens] = useState<CatalogProjectMessage[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const fim = useRef<HTMLDivElement>(null);

  const buscar = useCallback(async () => {
    try {
      setMensagens(await catalogDb.listCatalogProjectMessages(projetoId));
    } catch {
      setErro('Não foi possível carregar a conversa.');
    } finally {
      setCarregando(false);
    }
  }, [projetoId]);

  useEffect(() => { void buscar(); }, [buscar]);

  // ⚠️ EM TEMPO REAL: dois membros a falar ao mesmo tempo é o caso normal de um chat, e sem isto
  // cada um veria só a própria metade da conversa até recarregar a página.
  useEffect(() => {
    const canal = supabase
      .channel(`jam-conversa:${projetoId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'catalog_project_messages',
          filter: `project_id=eq.${projetoId}`,
        },
        () => { void buscar(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(canal); };
  }, [projetoId, buscar]);

  // A conversa abre no FIM: o que interessa numa é a última coisa que foi dita.
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }); }, [mensagens]);

  const enviar = async () => {
    const conteudo = texto.trim();
    if (!conteudo || enviando || !podeFalar) return;
    setEnviando(true);
    setErro('');
    try {
      const criada = await catalogDb.createCatalogProjectMessage({
        project_id: projetoId,
        author_id: autor.id ?? null,
        author_name: autor.nome,
        author_avatar: autor.foto ?? null,
        text: conteudo,
      });
      // Entra na hora, sem esperar o realtime dar a volta: quem escreveu tem de ver o que
      // escreveu no instante em que carrega em enviar.
      setMensagens((atuais) => (atuais.some((m) => m.id === criada.id) ? atuais : [...atuais, criada]));
      setTexto('');
    } catch {
      setErro('Não foi possível enviar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 420 }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14, display: 'grid', gap: 14 }}>
        {carregando ? (
          <p style={{ margin: 0, fontSize: 12, color: DS.color.textoFraco }}>Carregando…</p>
        ) : mensagens.length === 0 ? (
          <div style={{ display: 'grid', justifyItems: 'center', gap: 6, padding: '20px 0' }}>
            <FiMessageCircle size={22} color={DS.color.primaria} />
            <strong style={{ fontSize: 13, color: DS.color.texto }}>Ninguém falou ainda</strong>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: DS.color.textoFraco, textAlign: 'center' }}>
              Aqui é a conversa da equipe sobre esta música — combinar uma gravação, dizer o que
              mudar, mandar um recado. Fica tudo num sítio só.
            </p>
          </div>
        ) : mensagens.map((m) => (
          <div key={m.id} style={{ display: 'flex', gap: 10 }}>
            {m.author_avatar ? (
              <img
                src={m.author_avatar}
                alt=''
                style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                display: 'grid', placeItems: 'center',
                background: DS.color.bgPista, color: DS.color.textoApoio,
                fontSize: 12, fontWeight: 700,
              }}>
                {iniciais(m.author_name)}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <strong style={{ fontSize: 12, color: DS.color.texto }}>{m.author_name}</strong>
                <span style={{ fontSize: 10, color: DS.color.textoFraco }}>{quando(m.created_at)}</span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 13, lineHeight: 1.5, color: DS.color.textoApoio, whiteSpace: 'pre-wrap' }}>
                {m.text}
              </p>
            </div>
          </div>
        ))}
        <div ref={fim} />
      </div>

      {!!erro && (
        <p style={{ margin: 0, padding: '0 14px 8px', fontSize: 12, color: DS.color.agulha }}>{erro}</p>
      )}

      {podeFalar && (
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 8, padding: 10,
          borderTop: `1px solid ${DS.color.borda}`, background: DS.color.bgPainel,
        }}>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              // Enter envia, Shift+Enter quebra a linha: é o que todo chat faz, e é o gesto que
              // a mão já tem.
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar(); }
            }}
            rows={1}
            placeholder='Escreva para a equipe…'
            aria-label='Mensagem para a equipe'
            style={{
              flex: 1, minHeight: 36, maxHeight: 110, resize: 'none',
              padding: '9px 10px', borderRadius: DS.raio.medio,
              background: DS.color.bgCampo, border: `1px solid ${DS.color.borda}`,
              color: DS.color.texto, fontSize: 13, outline: 'none',
              fontFamily: DS.font.display,
            }}
          />
          <button
            type='button'
            onClick={() => { void enviar(); }}
            disabled={!texto.trim() || enviando}
            aria-label='Enviar mensagem'
            style={{
              width: 36, height: 36, borderRadius: DS.raio.medio, flexShrink: 0,
              display: 'grid', placeItems: 'center',
              background: DS.color.primaria, border: 'none', color: '#fff',
              opacity: !texto.trim() || enviando ? 0.4 : 1,
              cursor: !texto.trim() || enviando ? 'default' : 'pointer',
            }}
          >
            <FiSend size={15} />
          </button>
        </div>
      )}
    </div>
  );
};
