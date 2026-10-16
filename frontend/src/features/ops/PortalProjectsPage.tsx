import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ProjectStatus } from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { formatDate } from '../../lib/date';
import { ApiError } from '../../lib/apiClient';
import { PROJECT_INQUIRY_STATUS_LABELS } from './api';
import {
  useApproveProjectInquiryProposal,
  useLinkProjectInquiry,
  usePortalProjectInquiries,
  usePortalProjects,
  useUnlinkedProjectInquiries,
} from './hooks';

const STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: 'Planning',
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export function PortalProjectsPage(): ReactNode {
  const query = usePortalProjects();
  const inquiries = usePortalProjectInquiries();
  const approve = useApproveProjectInquiryProposal();
  const unlinked = useUnlinkedProjectInquiries();
  const link = useLinkProjectInquiry();
  const rows = query.data ?? [];

  return (
    <section className="space-y-8">
      <h1 className="text-2xl font-semibold text-ink">My Projects</h1>
      <p className="mt-1 text-base text-muted">Projects linked to your account.</p>
      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={6} label="Loading projects" />
        ) : query.isError ? (
          <ErrorState description="Projects could not be loaded." onRetry={() => query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Approved projects created for your account will appear here."
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Status</Th>
                <Th>Due date</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td>
                    <Link
                      to={`/portal/projects/${row.id}`}
                      className="font-medium text-ink hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      {row.name}
                    </Link>
                  </Td>
                  <Td>
                    <Badge>{STATUS_LABELS[row.status]}</Badge>
                  </Td>
                  <Td>{formatDate(row.dueDate)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>
      <section aria-labelledby="requests-heading">
        <h2 id="requests-heading" className="text-xl font-semibold text-ink">
          My Project Requests
        </h2>
        <p className="mt-1 text-sm text-muted">
          Requests stay separate from managed projects until your proposal is approved and an
          administrator creates the project.
        </p>
        <div className="mt-4 rounded-lg border border-border bg-surface">
          {inquiries.isLoading ? (
            <LoadingState rows={3} label="Loading project requests" />
          ) : inquiries.isError ? (
            <ErrorState
              description="Project requests could not be loaded."
              onRetry={() => inquiries.refetch()}
            />
          ) : !inquiries.data?.length ? (
            <EmptyState
              title="No project requests yet"
              description="Verified requests associated with your account will appear here."
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Project type</Th>
                  <Th>Submitted</Th>
                  <Th>Status</Th>
                  <Th>Proposal</Th>
                </Tr>
              </THead>
              <TBody>
                {inquiries.data.map((request) => (
                  <Tr key={request.id}>
                    <Td>
                      <span className="font-medium text-ink">{request.projectType}</span>
                      <p className="mt-1 max-w-sm text-sm text-muted">{request.description}</p>
                    </Td>
                    <Td>{formatDate(request.createdAt)}</Td>
                    <Td>
                      <Badge>{PROJECT_INQUIRY_STATUS_LABELS[request.status]}</Badge>
                      {request.projectId ? (
                        <p className="mt-1">
                          <Link
                            className="text-sm text-brand hover:underline"
                            to={`/portal/projects/${request.projectId}`}
                          >
                            View project
                          </Link>
                        </p>
                      ) : null}
                    </Td>
                    <Td>
                      {request.proposalSummary ? (
                        <p className="max-w-sm whitespace-pre-wrap text-sm text-ink">
                          {request.proposalSummary}
                        </p>
                      ) : (
                        <span className="text-sm text-muted">No proposal yet</span>
                      )}
                      {request.status === 'PROPOSAL_SENT' ? (
                        <Button
                          className="mt-2"
                          size="sm"
                          type="button"
                          isLoading={approve.isPending && approve.variables === request.id}
                          onClick={() => approve.mutate(request.id)}
                        >
                          Approve proposal
                        </Button>
                      ) : null}
                      {approve.isError && approve.variables === request.id ? (
                        <p role="alert" className="mt-2 text-sm text-error">
                          {approve.error instanceof ApiError
                            ? approve.error.message
                            : 'Could not approve the proposal.'}
                        </p>
                      ) : null}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </div>
        {unlinked.isError ? (
          <ErrorState
            description="Verified requests could not be checked."
            onRetry={() => unlinked.refetch()}
          />
        ) : null}
        {unlinked.data?.length ? (
          <div
            className="mt-4 rounded-lg border border-border bg-surface p-4"
            aria-label="Connect verified requests"
          >
            <h3 className="font-semibold text-ink">Connect verified requests</h3>
            <p className="mt-1 text-sm text-muted">
              These verified requests match your account email. Connect a request to track it here.
            </p>
            <ul className="mt-3 space-y-3">
              {unlinked.data.map((request) => (
                <li
                  key={request.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3"
                >
                  <div>
                    <p className="font-medium text-ink">{request.projectType}</p>
                    <p className="text-sm text-muted">Submitted {formatDate(request.createdAt)}</p>
                  </div>
                  <Button
                    size="sm"
                    type="button"
                    isLoading={link.isPending && link.variables === request.id}
                    onClick={() => link.mutate(request.id)}
                  >
                    Connect request
                  </Button>
                  {link.isError && link.variables === request.id ? (
                    <p role="alert" className="w-full text-sm text-error">
                      {link.error instanceof ApiError
                        ? link.error.message
                        : 'Could not connect request.'}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </section>
  );
}
