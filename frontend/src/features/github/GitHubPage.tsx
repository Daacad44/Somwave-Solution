import { type FormEvent, type ReactNode, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSIONS } from '@somwave/shared';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { engineeringApi } from '../engineering/api';
import { ACTIVITY_KINDS, githubApi, type ActivityKind } from './api';

export function GitHubPage(): ReactNode {
  const client = useQueryClient();
  const canManage = useHasPermission(PERMISSIONS.GITHUB_MANAGE);
  const [installationId, setInstallationId] = useState('');
  const [repositoryId, setRepositoryId] = useState('');
  const [kind, setKind] = useState<ActivityKind>('commits');
  const [message, setMessage] = useState('');
  const installations = useQuery({
    queryKey: ['github-installations'],
    queryFn: githubApi.installations,
    enabled: canManage,
  });
  const repositories = useQuery({
    queryKey: ['github-repositories'],
    queryFn: githubApi.repositories,
  });
  const projects = useQuery({
    queryKey: ['github-projects'],
    queryFn: engineeringApi.projects,
    enabled: canManage,
  });
  const selectedId = repositoryId || repositories.data?.[0]?.id || '';
  const activity = useQuery({
    queryKey: ['github-activity', selectedId, kind],
    queryFn: () => githubApi.activity(selectedId, kind),
    enabled: Boolean(selectedId),
  });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['github-installations'] });
    void client.invalidateQueries({ queryKey: ['github-repositories'] });
    void client.invalidateQueries({ queryKey: ['github-activity'] });
  };
  const connect = useMutation({
    mutationFn: githubApi.connect,
    onSuccess: () => {
      setInstallationId('');
      setMessage('Installation connected.');
      refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const disconnect = useMutation({
    mutationFn: githubApi.disconnect,
    onSuccess: () => {
      setMessage('Installation disconnected locally.');
      refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const map = useMutation({
    mutationFn: ({ id, projectId }: { id: string; projectId: string | null }) =>
      githubApi.map(id, projectId),
    onSuccess: refresh,
    onError: (error: Error) => setMessage(error.message),
  });
  const onConnect = (event: FormEvent) => {
    event.preventDefault();
    if (installationId.trim()) connect.mutate(installationId.trim());
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">GitHub integration</h1>
        <p className="mt-1 text-sm text-muted">
          Connect a GitHub App installation, map repositories to projects, and inspect repository
          activity.
        </p>
      </header>
      {message ? (
        <p role="status" className="text-sm text-ink">
          {message}
        </p>
      ) : null}
      {canManage ? (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <h2 className="text-lg font-semibold">App installations</h2>
          <p className="text-sm text-muted">
            Install the Somwave GitHub App in GitHub, then enter its numeric installation ID here.
            The server verifies the installation using App credentials.
          </p>
          <form onSubmit={onConnect} className="flex flex-wrap items-end gap-3">
            <Input
              label="Installation ID"
              value={installationId}
              onChange={(event) => setInstallationId(event.target.value)}
              inputMode="numeric"
              pattern="[1-9][0-9]*"
              required
            />
            <Button type="submit" isLoading={connect.isPending}>
              Connect
            </Button>
          </form>
          {installations.isLoading ? (
            <LoadingState rows={2} />
          ) : installations.isError ? (
            <ErrorState
              description="Could not load installations."
              onRetry={() => void installations.refetch()}
            />
          ) : installations.data?.length ? (
            <ul className="space-y-2">
              {installations.data.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-3"
                >
                  <span>
                    {row.accountLogin} · {row.status} · {row._count.repositories} repositories
                  </span>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={row.status === 'DISCONNECTED' || disconnect.isPending}
                    onClick={() => {
                      if (window.confirm(`Disconnect ${row.accountLogin} from Somwave?`))
                        disconnect.mutate(row.id);
                    }}
                  >
                    Disconnect
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No connected installations" />
          )}
        </div>
      ) : null}
      <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <h2 className="text-lg font-semibold">Repositories</h2>
        {repositories.isLoading ? (
          <LoadingState rows={3} />
        ) : repositories.isError ? (
          <ErrorState
            description="Could not load repositories."
            onRetry={() => void repositories.refetch()}
          />
        ) : repositories.data?.length ? (
          <div className="space-y-3">
            {repositories.data.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-border p-3"
              >
                <button
                  type="button"
                  className="text-left font-medium text-primary underline"
                  onClick={() => setRepositoryId(row.id)}
                >
                  {row.fullName}
                  {row.isPrivate ? ' · private' : ''}
                </button>
                {canManage ? (
                  <label className="text-sm">
                    Project{' '}
                    <select
                      className="ml-2 rounded border border-border bg-surface p-2"
                      value={row.projectId ?? ''}
                      disabled={map.isPending || projects.isLoading}
                      onChange={(event) =>
                        map.mutate({ id: row.id, projectId: event.target.value || null })
                      }
                    >
                      <option value="">Unmapped</option>
                      {projects.data?.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <span className="text-sm text-muted">
                    {row.projectId ? 'Mapped' : 'Unmapped'}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No accessible repositories" />
        )}
      </div>
      {selectedId ? (
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-lg font-semibold">Repository activity</h2>
          <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="GitHub activity">
            {ACTIVITY_KINDS.map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={value === kind}
                className={`rounded px-3 py-2 text-sm ${value === kind ? 'bg-primary text-surface' : 'bg-surface-alt text-ink'}`}
                onClick={() => setKind(value)}
              >
                {value}
              </button>
            ))}
          </div>
          {activity.isLoading ? (
            <LoadingState rows={4} />
          ) : activity.isError ? (
            <ErrorState
              description={activity.error.message}
              onRetry={() => void activity.refetch()}
            />
          ) : activity.data?.length ? (
            <ul className="mt-4 divide-y divide-border">
              {activity.data.map((row) => (
                <li key={row.id} className="py-3">
                  <div className="font-medium">
                    {row.url ? (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        {row.title}
                      </a>
                    ) : (
                      row.title
                    )}
                  </div>
                  <div className="text-sm text-muted">
                    {[
                      row.state,
                      row.actor,
                      row.createdAt ? new Date(row.createdAt).toLocaleString() : null,
                      row.additions === null ? null : `${row.additions} contributions`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No activity found" />
          )}
        </div>
      ) : null}
    </section>
  );
}
