import { type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../../components/states';
import { ProjectWorkspaceView } from './components/ProjectWorkspaceView';
import { useProjectWorkspace } from './hooks';

export function ProjectDetailPage(): ReactNode {
  const { id } = useParams();
  const query = useProjectWorkspace(id);

  if (!id) {
    return <ErrorState title="Project not found" />;
  }
  if (query.isLoading) {
    return <LoadingState rows={8} label="Loading project" />;
  }
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="Could not load project"
        description="Check that the project exists and you have access."
        onRetry={() => query.refetch()}
      />
    );
  }
  return <ProjectWorkspaceView data={query.data} backTo="/projects" backLabel="Projects" />;
}
