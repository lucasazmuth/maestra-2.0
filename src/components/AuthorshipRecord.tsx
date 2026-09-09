import { FC, useCallback, useEffect, useState } from 'react';
import { Button, Spin } from 'antd';
import { FiDownload, FiShield } from 'react-icons/fi';

import {
  AVISO_DO_CERTIFICADO, certificarVersao, hashLegivel, listarCertificados,
  type CertificadoDeAutoria,
} from '@maestra/core/services/db/certificados';
import { montarCertificadoDeAutoria } from '@maestra/core/documentos/certificadoHtml';

import styles from './AuthorshipRecord.module.scss';

// O REGISTRO DE AUTORIA de uma versão — o espelho web de `casca/jam/RegistroDeAutoria.tsx`.
//
// Carimba a existência: a impressão digital do arquivo, a data e o nome de quem declara. O hash
// é calculado no SERVIDOR (edge function `version-certify`), a partir do arquivo que está no
// Storage; um hash que saísse do navegador não certificaria nada, porque quem carimba seria
// quem é carimbado.
//
// ⚠️ O AVISO NÃO É OPCIONAL. "Certificado", num produto de música, puxa ECAD e Biblioteca
// Nacional sozinho. A frase vem do núcleo, a mesma que o app mostra e a mesma que sai no PDF.

/** `2026-09-08T14:30:00Z` → `08/09/2026`, no fuso de Brasília, como no documento. */
const shortDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

/**
 * Imprime o certificado.
 *
 * O app usa o `expo-print`; aqui quem imprime é o próprio navegador, a partir do MESMO HTML do
 * núcleo. Não é captura de tela: o PDF sai com texto de verdade, selecionável, e o documento é
 * igual ao que sai do celular.
 */
const printCertificate = (c: CertificadoDeAutoria) => {
  const html = montarCertificadoDeAutoria({
    musica: c.musica,
    versao: c.versao,
    artista: c.artista,
    autorNome: c.autor_nome,
    sha256: c.sha256,
    algoritmo: c.algoritmo,
    arquivoNome: c.arquivo_nome,
    arquivoBytes: c.arquivo_bytes,
    certificadoEm: c.certificado_em,
  });
  const janela = window.open('', '_blank', 'width=840,height=1180');
  if (!janela) return;
  janela.document.write(html);
  janela.document.close();
  // O `print` tem que esperar a folha de estilo entrar, senão imprime o documento sem desenho.
  janela.onload = () => { janela.focus(); janela.print(); };
};

const AuthorshipRecord: FC<{ versionId: string; hasAudio: boolean }> = ({ versionId, hasAudio }) => {
  const [records, setRecords] = useState<CertificadoDeAutoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [stamping, setStamping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setRecords(await listarCertificados(versionId));
    } catch {
      // Silêncio de propósito: não conseguir LISTAR não interrompe quem está editando a versão.
      // O erro que interessa é o de carimbar, e esse aparece.
    } finally {
      setLoading(false);
    }
  }, [versionId]);

  useEffect(() => { void reload(); }, [reload]);

  const stamp = async () => {
    setError(null);
    setStamping(true);
    try {
      const { certificado, novo } = await certificarVersao(versionId);
      // Certificar de novo o mesmo arquivo devolve o carimbo antigo, com a data original.
      if (novo) setRecords((before) => [certificado, ...before]);
      else await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não consegui registrar a autoria.');
    } finally {
      setStamping(false);
    }
  };

  if (loading) return <div className={styles.loading}><Spin size='small' /></div>;

  return (
    <div className={styles.box}>
      <span className={styles.label}>Autoria</span>

      {records.map((c) => (
        <div key={c.id} className={styles.record}>
          <i className={styles.seal}><FiShield size={16} /></i>
          <div className={styles.body}>
            <strong>Registrado em {shortDate(c.certificado_em)}</strong>
            {/* Os primeiros caracteres bastam para conferir de relance; o hash inteiro sai no
                PDF, que é onde ele serve para comparar. */}
            <small className={styles.hash}>{hashLegivel(c.sha256).slice(0, 17)}…</small>
            <small>{c.autor_nome}</small>
          </div>
          <Button
            type='text'
            icon={<FiDownload />}
            onClick={() => printCertificate(c)}
            aria-label={`Baixar o certificado de ${shortDate(c.certificado_em)}`}
          />
        </div>
      ))}

      <Button
        type='link'
        icon={<FiShield />}
        loading={stamping}
        disabled={!hasAudio}
        onClick={() => void stamp()}
        className={styles.action}
      >
        {!hasAudio
          ? 'Envie o áudio para poder registrar'
          : records.length ? 'Registrar de novo' : 'Registrar autoria'}
      </Button>

      <p className={styles.notice}>{AVISO_DO_CERTIFICADO}</p>
      {!!error && <p className={styles.error}>{error}</p>}
    </div>
  );
};

export default AuthorshipRecord;
