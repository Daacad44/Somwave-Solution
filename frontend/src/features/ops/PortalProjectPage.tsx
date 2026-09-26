import { type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../../components/states';
import { ProjectWorkspaceView } from '../projects/components/ProjectWorkspaceView';
import { usePortalProject } from './hooks';

export function PortalProjectPage(): ReactNode {
  const { id } = useParams();
  const query = usePortalProject(id);

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
        description="Mashruucan kuma xirna akoonkaaga, ama lama helin."
        onRetry={() => query.refetch()}
      />
    );
  }
  return (
    <ProjectWorkspaceView data={query.data} backTo="/portal/projects" backLabel="Mashruucyadayda" />
  );
}
