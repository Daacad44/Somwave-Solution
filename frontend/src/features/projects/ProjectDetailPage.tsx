import { type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../../components/states';
import { ProjectWorkspaceView } from './components/ProjectWorkspaceView';
import { useProjectWorkspace } from './hooks';

export function ProjectDetailPage(): ReactNode {
  const { id } = useParams();
  const query = useProjectWorkspace(id);

  if (!id) {
    return <ErrorState title="Mashruucan lama helin" />;
  }
  if (query.isLoading) {
    return <LoadingState rows={8} label="Waa la soo rarayaa mashruuca" />;
  }
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="Mashruuca lama soo rari karin"
        description="Hubi in mashruucu jiro oo aad fasax u leedahay."
        onRetry={() => query.refetch()}
      />
    );
  }
  return <ProjectWorkspaceView data={query.data} backTo="/projects" backLabel="Mashruucyada" />;
}
