import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProjectDocumentation } from '@somwave/shared';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useCurrentUser } from '../auth/hooks';
import { engineeringApi } from './api';
import { documentationApi } from './documentationApi';
import { listMilestones } from '../milestones/api';

const DOCUMENTS_PER_PAGE = 20;

function RichEditor({
  initial,
  onChange,
}: {
  initial: string;
  onChange: (value: string) => void;
}): ReactNode {
  const editor = useEditor({
    extensions: [StarterKit],
    content: DOMPurify.sanitize(initial),
    onUpdate: ({ editor: current }) => onChange(DOMPurify.sanitize(current.getHTML())),
  });
  if (!editor) return <LoadingState rows={2} />;
  return (
    <div className="rounded border border-border bg-surface">
      <div
        className="flex flex-wrap gap-2 border-b border-border p-2"
        aria-label="Formatting toolbar"
      >
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-label="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          Bold
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-label="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          Italic
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          Heading
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          List
        </Button>
      </div>
      <EditorContent
        editor={editor}
        className="min-h-48 p-3 text-ink [&_.ProseMirror]:min-h-40 [&_.ProseMirror]:outline-none"
      />
    </div>
  );
}

function DocumentEditor({
  projectId,
  document,
  onSaved,
}: {
  projectId: string;
  document: ProjectDocumentation | null;
  onSaved: (id: string) => void;
}): ReactNode {
  const client = useQueryClient();
  const [title, setTitle] = useState(document?.title ?? '');
  const [folder, setFolder] = useState(document?.folder ?? '');
  const [format, setFormat] = useState<'MARKDOWN' | 'RICH_TEXT'>(
    document?.format === 'RICH_TEXT' ? 'RICH_TEXT' : 'MARKDOWN',
  );
  const [content, setContent] = useState(document?.content ?? '');
  const [ownerId, setOwnerId] = useState(document?.ownerId ?? '');
  const members = useQuery({
    queryKey: ['engineering-members', projectId],
    queryFn: () => engineeringApi.members(projectId),
  });
  const save = useMutation({
    mutationFn: async () =>
      document
        ? documentationApi.update(projectId, document.id, {
            expectedVersion: document.currentVersion,
            title,
            folder: folder || null,
            content,
            ownerId: ownerId || null,
          })
        : documentationApi.create(projectId, {
            title,
            folder: folder || undefined,
            format,
            content,
            ownerId: ownerId || undefined,
          }),
    onSuccess: (saved) => {
      void client.invalidateQueries({ queryKey: ['documentation'] });
      onSaved(saved.id);
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };
  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold">
        {document ? 'Edit documentation' : 'New documentation'}
      </h2>
      <Input
        label="Title"
        value={title}
        required
        maxLength={200}
        onChange={(event) => setTitle(event.target.value)}
      />
      <Input
        label="Folder"
        value={folder}
        maxLength={200}
        onChange={(event) => setFolder(event.target.value)}
      />
      <label className="block text-sm">
        Owner{' '}
        <select
          className="mt-1 w-full rounded border border-border bg-surface p-3"
          value={ownerId}
          onChange={(event) => setOwnerId(event.target.value)}
        >
          <option value="">No owner</option>
          {members.data?.map((member) => (
            <option key={member.user.id} value={member.user.id}>
              {member.user.name}
            </option>
          ))}
        </select>
      </label>
      {!document ? (
        <label className="block text-sm">
          Format{' '}
          <select
            className="ml-2 rounded border border-border bg-surface p-2"
            value={format}
            onChange={(event) => setFormat(event.target.value as 'MARKDOWN' | 'RICH_TEXT')}
          >
            <option value="MARKDOWN">Markdown</option>
            <option value="RICH_TEXT">Rich text</option>
          </select>
        </label>
      ) : null}
      {format === 'RICH_TEXT' ? (
        <RichEditor key={document?.id ?? 'new'} initial={content} onChange={setContent} />
      ) : (
        <label className="block text-sm">
          Markdown
          <textarea
            className="mt-1 min-h-48 w-full rounded border border-border bg-surface p-3 font-mono"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={500000}
          />
        </label>
      )}
      {save.isError ? (
        <p role="alert" className="text-sm text-error">
          {save.error.message}
        </p>
      ) : null}
      <Button type="submit" isLoading={save.isPending}>
        Save document
      </Button>
    </form>
  );
}

export function DocumentationPage({
  projectId: fixedProjectId,
}: { projectId?: string } = {}): ReactNode {
  const client = useQueryClient();
  const { data: user } = useCurrentUser();
  const [projectId, setProjectId] = useState('');
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [renameFrom, setRenameFrom] = useState('');
  const [renameTo, setRenameTo] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [editing, setEditing] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [linkTarget, setLinkTarget] = useState<'task' | 'milestone'>('task');
  const [linkId, setLinkId] = useState('');
  const projects = useQuery({
    queryKey: ['engineering-projects'],
    queryFn: engineeringApi.projects,
  });
  const selectedProjectId = fixedProjectId || projectId || projects.data?.[0]?.id || '';
  const documents = useQuery({
    queryKey: ['documentation', selectedProjectId, search, folder, status],
    queryFn: () => documentationApi.list(selectedProjectId, search, folder, status),
    enabled: Boolean(selectedProjectId),
  });
  const folders = useQuery({
    queryKey: ['documentation-folders', selectedProjectId],
    queryFn: () => documentationApi.folders(selectedProjectId),
    enabled: Boolean(selectedProjectId),
  });
  const selected = documents.data?.find((row) => row.id === documentId) ?? null;
  const documentCount = documents.data?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(documentCount / DOCUMENTS_PER_PAGE));
  const visibleDocuments = documents.data?.slice(
    (Math.min(page, pageCount) - 1) * DOCUMENTS_PER_PAGE,
    Math.min(page, pageCount) * DOCUMENTS_PER_PAGE,
  );
  const comments = useQuery({
    queryKey: ['documentation-comments', selectedProjectId, documentId],
    queryFn: () => documentationApi.comments(selectedProjectId, documentId),
    enabled: Boolean(selectedProjectId && documentId),
  });
  const versions = useQuery({
    queryKey: ['documentation-versions', selectedProjectId, documentId],
    queryFn: () => documentationApi.versions(selectedProjectId, documentId),
    enabled: Boolean(selectedProjectId && documentId),
  });
  const links = useQuery({
    queryKey: ['documentation-links', selectedProjectId, documentId],
    queryFn: () => documentationApi.links(selectedProjectId, documentId),
    enabled: Boolean(selectedProjectId && documentId),
  });
  const tasks = useQuery({
    queryKey: ['engineering-tasks', selectedProjectId],
    queryFn: () => engineeringApi.tasks(selectedProjectId),
    enabled: Boolean(selectedProjectId && selected),
  });
  const milestones = useQuery({
    queryKey: ['documentation-milestones', selectedProjectId],
    queryFn: () => listMilestones({ page: 1, pageSize: 100, projectId: selectedProjectId }),
    enabled: Boolean(selectedProjectId && selected),
  });
  useEffect(() => {
    if (selectedProjectId && !projectId && !fixedProjectId) setProjectId(selectedProjectId);
  }, [selectedProjectId, projectId, fixedProjectId]);
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['documentation'] });
    void client.invalidateQueries({ queryKey: ['documentation-comments'] });
    void client.invalidateQueries({ queryKey: ['documentation-links'] });
    void client.invalidateQueries({ queryKey: ['documentation-versions'] });
  };
  const addComment = useMutation({
    mutationFn: () => documentationApi.addComment(selectedProjectId, documentId, commentBody),
    onSuccess: () => {
      setCommentBody('');
      refresh();
    },
  });
  const removeComment = useMutation({
    mutationFn: (commentId: string) =>
      documentationApi.removeComment(selectedProjectId, documentId, commentId),
    onSuccess: refresh,
  });
  const addLink = useMutation({
    mutationFn: () => documentationApi.link(selectedProjectId, documentId, linkTarget, linkId),
    onSuccess: () => {
      setLinkId('');
      refresh();
    },
  });
  const removeLink = useMutation({
    mutationFn: ({ target, id }: { target: 'task' | 'milestone'; id: string }) =>
      documentationApi.unlink(selectedProjectId, documentId, target, id),
    onSuccess: refresh,
  });
  const changeStatus = useMutation({
    mutationFn: (status: ProjectDocumentation['status']) =>
      documentationApi.status(selectedProjectId, documentId, selected!.currentVersion, status),
    onSuccess: refresh,
  });
  const changeClientVisibility = useMutation({
    mutationFn: (clientVisible: boolean) =>
      documentationApi.clientVisibility(selectedProjectId, documentId, clientVisible),
    onSuccess: refresh,
  });
  const proposeTasks = useMutation({
    mutationFn: () => documentationApi.proposeTasks(selectedProjectId, documentId),
    onSuccess: (rows) => {
      refresh();
      window.alert(
        `${rows.length} draft tasks created. Submit each for review in the Engineering Workspace.`,
      );
    },
  });
  const renameFolder = useMutation({
    mutationFn: () => documentationApi.renameFolder(selectedProjectId, renameFrom, renameTo),
    onSuccess: () => {
      setRenameFrom('');
      setRenameTo('');
      refresh();
      void client.invalidateQueries({ queryKey: ['documentation-folders'] });
    },
  });
  const preview = selected?.content
    ? DOMPurify.sanitize(
        selected.format === 'MARKDOWN'
          ? (marked.parse(selected.content, { async: false }) as string)
          : selected.content,
      )
    : '';
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold text-ink">Project documentation</h1>
      {projects.isLoading ? (
        <LoadingState rows={2} />
      ) : projects.isError ? (
        <ErrorState
          description="Could not load projects."
          onRetry={() => void projects.refetch()}
        />
      ) : !projects.data?.length ? (
        <EmptyState title="No accessible projects" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {!fixedProjectId ? (
              <label className="text-sm">
                Project
                <select
                  className="mt-1 w-full rounded border border-border bg-surface p-3"
                  value={selectedProjectId}
                  onChange={(event) => {
                    setProjectId(event.target.value);
                    setPage(1);
                    setDocumentId('');
                    setEditing(false);
                  }}
                >
                  {projects.data.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <Input
              label="Search documents"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <label className="text-sm">
              Folder
              <select
                className="mt-1 w-full rounded border border-border bg-surface p-3"
                value={folder}
                onChange={(event) => {
                  setFolder(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All folders</option>
                {folders.data?.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Status
              <select
                className="mt-1 w-full rounded border border-border bg-surface p-3"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="IN_REVIEW">In review</option>
                <option value="APPROVED">Approved</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>
          </div>
          {folders.data?.length ? (
            <form
              className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-3"
              onSubmit={(event) => {
                event.preventDefault();
                renameFolder.mutate();
              }}
            >
              <label className="text-sm">
                Rename folder
                <select
                  className="mt-1 block rounded border border-border bg-surface p-2"
                  value={renameFrom}
                  onChange={(event) => setRenameFrom(event.target.value)}
                  required
                >
                  <option value="">Select folder</option>
                  {folders.data.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="New name"
                value={renameTo}
                onChange={(event) => setRenameTo(event.target.value)}
                required
                maxLength={200}
              />
              <Button type="submit" size="sm" isLoading={renameFolder.isPending}>
                Rename
              </Button>
              {renameFolder.isError ? (
                <p role="alert" className="text-error">
                  {renameFolder.error.message}
                </p>
              ) : null}
            </form>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-[minmax(15rem,20rem)_1fr]">
            <aside className="rounded-lg border border-border bg-surface p-3">
              <Button
                size="sm"
                onClick={() => {
                  setDocumentId('');
                  setEditing(true);
                }}
              >
                New document
              </Button>
              {documents.isLoading ? (
                <LoadingState rows={4} />
              ) : documents.isError ? (
                <ErrorState
                  description="Could not load documentation."
                  onRetry={() => void documents.refetch()}
                />
              ) : documents.data?.length ? (
                <ul className="mt-3 space-y-1">
                  {visibleDocuments?.map((row) => (
                    <li key={row.id}>
                      <button
                        className={`w-full rounded p-3 text-left ${documentId === row.id ? 'bg-surface-alt' : ''}`}
                        onClick={() => {
                          setDocumentId(row.id);
                          setEditing(false);
                        }}
                      >
                        <span className="block font-medium">{row.title}</span>
                        <span className="text-xs text-muted">
                          {row.folder || 'Unfiled'} · {row.status.replace('_', ' ')} · v
                          {row.currentVersion}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No documents match" />
              )}
              {documentCount > DOCUMENTS_PER_PAGE ? (
                <nav
                  aria-label="Documentation pages"
                  className="mt-3 flex items-center justify-between gap-2 text-xs text-muted"
                >
                  <span>
                    Page {Math.min(page, pageCount)} of {pageCount} · {documentCount} documents
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={page <= 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={page >= pageCount}
                      onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </nav>
              ) : null}
            </aside>
            <div className="space-y-4">
              {editing ? (
                <DocumentEditor
                  key={`${selectedProjectId}:${documentId || 'new'}`}
                  projectId={selectedProjectId}
                  document={selected}
                  onSaved={(id) => {
                    setDocumentId(id);
                    setEditing(false);
                    refresh();
                  }}
                />
              ) : selected ? (
                <>
                  <article className="rounded-lg border border-border bg-surface p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h2 className="text-xl font-semibold">{selected.title}</h2>
                        <p className="text-sm text-muted">
                          {selected.status.replace('_', ' ')} · Version {selected.currentVersion} ·{' '}
                          {selected.format.replace('_', ' ')}
                        </p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                        Edit
                      </Button>
                    </div>
                    {selected.format === 'FILE' ? (
                      <p className="mt-4 text-sm">
                        {selected.fileName} · Download from the Engineering Workspace.
                      </p>
                    ) : (
                      <div
                        className="prose mt-4 max-w-none whitespace-pre-wrap break-words text-ink"
                        dangerouslySetInnerHTML={{ __html: preview }}
                      />
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selected.status === 'DRAFT' ? (
                        <Button size="sm" onClick={() => changeStatus.mutate('IN_REVIEW')}>
                          Submit for review
                        </Button>
                      ) : null}
                      {selected.status === 'IN_REVIEW' ? (
                        <>
                          <Button size="sm" onClick={() => changeStatus.mutate('APPROVED')}>
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => changeStatus.mutate('DRAFT')}
                          >
                            Return to draft
                          </Button>
                        </>
                      ) : null}
                      {selected.status === 'APPROVED' ? (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={changeClientVisibility.isPending}
                            onClick={() => changeClientVisibility.mutate(!selected.clientVisible)}
                          >
                            {selected.clientVisible
                              ? 'Remove from client portal'
                              : 'Share with client'}
                          </Button>
                          {selected.format !== 'FILE' ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={proposeTasks.isPending}
                              onClick={() => {
                                if (
                                  window.confirm('Create draft task proposals from this document?')
                                )
                                  proposeTasks.mutate();
                              }}
                            >
                              Propose tasks
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => changeStatus.mutate('ARCHIVED')}
                          >
                            Archive
                          </Button>
                        </>
                      ) : null}
                    </div>
                    {changeStatus.isError ? (
                      <p role="alert" className="text-error">
                        {changeStatus.error.message}
                      </p>
                    ) : null}
                    {changeClientVisibility.isError ? (
                      <p role="alert" className="text-error">
                        {changeClientVisibility.error.message}
                      </p>
                    ) : null}
                    {proposeTasks.isError ? (
                      <p role="alert" className="text-error">
                        {proposeTasks.error.message}
                      </p>
                    ) : null}
                  </article>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <section className="rounded-lg border border-border bg-surface p-4">
                      <h3 className="font-semibold">Comments</h3>
                      {comments.isLoading ? (
                        <LoadingState rows={2} />
                      ) : (
                        <ul className="mt-2 space-y-2">
                          {comments.data?.map((row) => (
                            <li key={row.id} className="rounded bg-surface-alt p-2 text-sm">
                              <p>{row.body}</p>
                              <div className="mt-1 flex justify-between text-xs text-muted">
                                <span>{new Date(row.createdAt).toLocaleString()}</span>
                                {row.authorId === user?.id ? (
                                  <button
                                    className="text-primary underline"
                                    onClick={() => removeComment.mutate(row.id)}
                                  >
                                    Delete
                                  </button>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                      <form
                        className="mt-3 flex gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          addComment.mutate();
                        }}
                      >
                        <Input
                          aria-label="New comment"
                          value={commentBody}
                          required
                          maxLength={10000}
                          onChange={(event) => setCommentBody(event.target.value)}
                        />
                        <Button type="submit" size="sm" isLoading={addComment.isPending}>
                          Post
                        </Button>
                      </form>
                      {addComment.isError ? (
                        <p role="alert" className="text-error">
                          {addComment.error.message}
                        </p>
                      ) : null}
                    </section>
                    <section className="rounded-lg border border-border bg-surface p-4">
                      <h3 className="font-semibold">Linked work</h3>
                      <ul className="mt-2 space-y-1 text-sm">
                        {links.data?.taskIds.map((id) => (
                          <li key={id}>
                            Task: {tasks.data?.find((task) => task.id === id)?.title ?? id}{' '}
                            <button
                              className="text-primary underline"
                              onClick={() => removeLink.mutate({ target: 'task', id })}
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                        {links.data?.milestoneIds.map((id) => (
                          <li key={id}>
                            Milestone:{' '}
                            {milestones.data?.data.find((item) => item.id === id)?.title ?? id}{' '}
                            <button
                              className="text-primary underline"
                              onClick={() => removeLink.mutate({ target: 'milestone', id })}
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                      <form
                        className="mt-3 space-y-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          addLink.mutate();
                        }}
                      >
                        <select
                          className="rounded border border-border bg-surface p-2"
                          value={linkTarget}
                          onChange={(event) => {
                            setLinkTarget(event.target.value as 'task' | 'milestone');
                            setLinkId('');
                          }}
                        >
                          <option value="task">Task</option>
                          <option value="milestone">Milestone</option>
                        </select>
                        {linkTarget === 'task' ? (
                          <select
                            className="w-full rounded border border-border bg-surface p-2"
                            value={linkId}
                            onChange={(event) => setLinkId(event.target.value)}
                          >
                            <option value="">Select a task</option>
                            {tasks.data?.map((task) => (
                              <option key={task.id} value={task.id}>
                                {task.title}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            className="w-full rounded border border-border bg-surface p-2"
                            value={linkId}
                            onChange={(event) => setLinkId(event.target.value)}
                          >
                            <option value="">Select a milestone</option>
                            {milestones.data?.data.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.title}
                              </option>
                            ))}
                          </select>
                        )}
                        <Button
                          size="sm"
                          type="submit"
                          disabled={!linkId}
                          isLoading={addLink.isPending}
                        >
                          Link
                        </Button>
                      </form>
                      {addLink.isError ? (
                        <p role="alert" className="text-error">
                          {addLink.error.message}
                        </p>
                      ) : null}
                    </section>
                  </div>
                  <section className="rounded-lg border border-border bg-surface p-4">
                    <h3 className="font-semibold">Version history</h3>
                    {versions.isLoading ? (
                      <LoadingState rows={2} />
                    ) : (
                      <ul className="mt-2 space-y-2 text-sm">
                        {versions.data?.map((version) => (
                          <li key={version.id}>
                            Version {version.version} · {version.status.replace('_', ' ')} ·{' '}
                            {new Date(version.createdAt).toLocaleString()}
                            {version.content !== null ? (
                              <details>
                                <summary className="cursor-pointer text-primary">
                                  View content
                                </summary>
                                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-surface-alt p-2">
                                  {version.content}
                                </pre>
                              </details>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </>
              ) : (
                <EmptyState title="Select a document or create one" />
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
