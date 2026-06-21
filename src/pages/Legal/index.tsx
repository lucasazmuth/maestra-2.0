import { FC } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { FiArrowLeft } from 'react-icons/fi';

import { LEGAL_DOCS, type LegalSlug } from '../../constants/legal';
import './legal.scss';

// Páginas legais (Termos de Uso / Política de Privacidade). Conteúdo, título e data vêm de
// src/constants/legal.ts — basta editar lá para atualizar a página.
const Legal: FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const doc = slug ? LEGAL_DOCS[slug as LegalSlug] : undefined;

  if (!doc) return <Navigate to='/' replace />;

  const updated = new Date(`${doc.updatedAt}T00:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className='legal-page'>
      <button className='legal-back' onClick={() => navigate(-1)}>
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
