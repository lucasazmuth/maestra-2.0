import { FC } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { FiArrowLeft } from 'react-icons/fi';

import { LEGAL_DOCS, type LegalSlug } from '@maestra/core/constants/legal';
import { useAppSelector } from '@maestra/core/store/store';
import './legal.scss';

// Páginas legais (Termos de Uso / Política de Privacidade). Conteúdo, título e data vêm de
// src/constants/legal.ts — basta editar lá para atualizar a página.
const Legal: FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const logado = useAppSelector((s) => !!s.auth.user);
  const doc = slug ? LEGAL_DOCS[slug as LegalSlug] : undefined;

  // ⚠️ O VOLTAR PRECISA DE UM DESTINO, e um `navigate(-1)` cego não tem.
  //
  // Esta página abre de TRÊS sítios, e num deles não há histórico nenhum: o cadastro e o
  // consentimento ligam para cá com `target='_blank'`, e numa aba recém-aberta um recuo não vai
  // a lado nenhum. O único controlo da página não fazia nada — e quem chega por um link de
  // e-mail cai no mesmo caso, ou pior, é atirado para fora do produto.
  //
  // O `key` do react-router é 'default' na primeira entrada do histórico, e é ele que distingue
  // os dois casos. Sem histórico, o destino depende de quem está a ler: a página é pública, e o
  // rodapé da landing manda para cá gente sem conta nenhuma.
  const voltar = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(logado ? '/artists' : '/');
  };

  if (!doc) return <Navigate to='/' replace />;

  const updated = new Date(`${doc.updatedAt}T00:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className='legal-page'>
      <button className='legal-back' onClick={voltar}>
        <FiArrowLeft size={16} /> Voltar
      </button>
      <h1 className='legal-title'>{doc.title}</h1>
      <p className='legal-updated'>Última atualização: {updated}</p>
      <div className='legal-content'>
        <ReactMarkdown>{doc.content}</ReactMarkdown>
      </div>
    </div>
  );
};

export default Legal;
