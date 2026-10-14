import { type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorState, LoadingState } from '../../../components/states';
import { getProjectActivity } from '../api';

export function ProjectActivityPanel({ projectId }: { projectId: string }): ReactNode {
  const query = useQuery({
    queryKey: ['project-activity', projectId],
    queryFn: () => getProjectActivity(projectId),
  });
  if (query.isLoading) return <LoadingState rows={5} />;
  if (query.isError)
    return (
      <ErrorState
        description="Could not load project activity."
        onRetry={() => void query.refetch()}
      />
    );
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold">Project activity</h2>
      <p className="mt-1 text-sm text-muted">
        Recent changes and assignment decisions in this project.
      </p>
      {query.data?.length ? (
        <ol className="mt-4 divide-y divide-border">
          {query.data.map((event) => (
            <li
              key={`${event.resourceType}-${event.id}`}
              className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div>
                <strong>{event.action.replaceAll('.', ' ').replaceAll('_', ' ')}</strong>
                <p className="text-muted">
                  {event.resourceType} · {event.actorName || 'System'}
                </p>
              </div>
              <time className="text-muted" dateTime={event.occurredAt}>
                {new Date(event.occurredAt).toLocaleString()}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState title="No recorded activity yet" />
      )}
    </section>
  );
}
