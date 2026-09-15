import { FC } from 'react';
import { Navigate, useParams } from 'react-router-dom';

const DiagnosticView: FC = () => {
  const { id } = useParams();
  return <Navigate to={`/artists/${id || ''}?aba=diagnostico`} replace />;
};

export default DiagnosticView;
