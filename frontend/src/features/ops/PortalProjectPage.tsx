import { type ReactNode } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../../components/states';
import { ProjectWorkspaceView } from '../projects/components/ProjectWorkspaceView';
import { usePortalProject, usePortalDocuments } from './hooks';
import { downloadPortalDocument } from './api';

export function PortalProjectPage(): ReactNode {
  const { id } = useParams();
  const query = usePortalProject(id);
  const documents = usePortalDocuments(id);

  if (!id) {
    return <ErrorState title="Project not found" />;
  }
  if (query.isLoading) {
    return <LoadingState rows={8} label="Loading project" />;
  }
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="Project could not be loaded"
        description="This project is not linked to your account, or it no longer exists."
        onRetry={() => query.refetch()}
      />
    );
  }
  return (
    <div className="space-y-5">
      <ProjectWorkspaceView
        data={query.data}
        backTo="/portal/projects"
        backLabel="My Projects"
        language="en"
        clientView
      />
      <section
        className="rounded-lg border border-border bg-surface p-4"
        aria-label="Shared documents"
      >
        <h2 className="text-lg font-semibold text-ink">Shared documents</h2>
        {documents.isLoading ? (
          <LoadingState rows={2} />
        ) : documents.isError ? (
          <ErrorState title="Documents could not be loaded" onRetry={() => documents.refetch()} />
        ) : documents.data?.length ? (
          <div className="mt-3 space-y-3">
            {documents.data.map((document) => (
              <article key={document.id} className="rounded border border-border p-3">
                <h3 className="font-medium text-ink">{document.title}</h3>
                {document.category ? (
                  <p className="text-sm text-muted">{document.category}</p>
                ) : null}
                {document.format === 'FILE' ? (
                  <button
                    type="button"
                    className="mt-2 text-accent underline"
                    onClick={() => void downloadPortalDocument(id, document)}
                  >
                    Download {document.fileName ?? 'file'}
                  </button>
                ) : document.content ? (
                  <div
                    className="prose mt-2 max-w-none text-ink"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(
                        document.format === 'MARKDOWN'
                          ? (marked.parse(document.content, { async: false }) as string)
                          : document.content,
                      ),
                    }}
                  />
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">No documents have been shared yet.</p>
        )}
      </section>
    </div>
  );
}
