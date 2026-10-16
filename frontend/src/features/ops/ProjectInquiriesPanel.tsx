import { type ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { PERMISSIONS } from '@somwave/shared';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Table, TBody, Td, Th, THead, Tr } from '../../components/ui/Table';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import { ApiError } from '../../lib/apiClient';
import { formatDate } from '../../lib/date';
import { useHasPermission } from '../../lib/rbac';
import { PROJECT_INQUIRY_STATUS_LABELS } from './api';
import {
  useAdminProjectInquiries,
  useConvertProjectInquiry,
  useReviewProjectInquiry,
} from './hooks';

export function ProjectInquiriesPanel(): ReactNode {
  const query = useAdminProjectInquiries();
  const review = useReviewProjectInquiry();
  const convert = useConvertProjectInquiry();
  const canReview = useHasPermission(PERMISSIONS.LEADS_UPDATE);
  const canCreateProject = useHasPermission(PERMISSIONS.PROJECTS_CREATE);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [proposalSummary, setProposalSummary] = useState('');

  return (
    <section className="mt-10" aria-labelledby="project-inquiries-heading">
      <h2 id="project-inquiries-heading" className="text-xl font-semibold text-ink">
        Project Requests
      </h2>
      <p className="mt-1 text-sm text-muted">
        Verified requests require an explicit proposal, client approval, and project creation.
      </p>
      <div className="mt-4 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={4} label="Loading project requests" />
        ) : query.isError ? (
          <ErrorState
            description="Project requests could not be loaded."
            onRetry={() => query.refetch()}
          />
        ) : !query.data?.length ? (
          <EmptyState title="No project requests yet" />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Requester</Th>
                <Th>Request</Th>
                <Th>Submitted</Th>
                <Th>Status</Th>
                <Th>Action</Th>
              </Tr>
            </THead>
            <TBody>
              {query.data.map((request) => (
                <Tr key={request.id}>
                  <Td>
                    <span className="font-medium text-ink">{request.name}</span>
                    <p className="text-sm text-muted">{request.email}</p>
                    {request.companyName ? (
                      <p className="text-sm text-muted">{request.companyName}</p>
                    ) : null}
                  </Td>
                  <Td>
                    <span className="font-medium text-ink">{request.projectType}</span>
                    <p className="max-w-xs text-sm text-muted">{request.description}</p>
                    {request.estimatedBudget ? (
                      <p className="text-xs text-muted">Budget: {request.estimatedBudget}</p>
                    ) : null}
                  </Td>
                  <Td>{formatDate(request.createdAt)}</Td>
                  <Td>
                    <Badge>{PROJECT_INQUIRY_STATUS_LABELS[request.status]}</Badge>
                  </Td>
                  <Td>
                    {request.projectId ? (
                      <Link
                        className="text-sm text-brand hover:underline"
                        to={`/projects/${request.projectId}`}
                      >
                        Open project
                      </Link>
                    ) : null}
                    {canReview && request.status === 'ACCOUNT_CREATED' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        type="button"
                        isLoading={review.isPending && review.variables?.id === request.id}
                        onClick={() => review.mutate({ id: request.id, status: 'UNDER_REVIEW' })}
                      >
                        Start review
                      </Button>
                    ) : null}
                    {canReview && request.status === 'UNDER_REVIEW' ? (
                      proposalId === request.id ? (
                        <div className="min-w-64 space-y-2">
                          <label
                            className="block text-xs font-medium text-muted"
                            htmlFor={`proposal-${request.id}`}
                          >
                            Proposal summary for client review
                          </label>
                          <textarea
                            id={`proposal-${request.id}`}
                            className="w-full rounded border border-border bg-surface p-2 text-sm text-ink"
                            rows={4}
                            minLength={20}
                            maxLength={5000}
                            value={proposalSummary}
                            onChange={(event) => setProposalSummary(event.target.value)}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              type="button"
                              disabled={proposalSummary.trim().length < 20}
                              isLoading={review.isPending}
                              onClick={() =>
                                review.mutate(
                                  {
                                    id: request.id,
                                    status: 'PROPOSAL_SENT',
                                    proposalSummary: proposalSummary.trim(),
                                  },
                                  {
                                    onSuccess: () => {
                                      setProposalId(null);
                                      setProposalSummary('');
                                    },
                                  },
                                )
                              }
                            >
                              Send proposal
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              type="button"
                              onClick={() => setProposalId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          type="button"
                          onClick={() => {
                            setProposalId(request.id);
                            setProposalSummary(request.proposalSummary ?? '');
                          }}
                        >
                          Write proposal
                        </Button>
                      )
                    ) : null}
                    {canCreateProject && request.status === 'APPROVED' ? (
                      <Button
                        size="sm"
                        type="button"
                        isLoading={convert.isPending && convert.variables === request.id}
                        onClick={() => convert.mutate(request.id)}
                      >
                        Create project
                      </Button>
                    ) : null}
                    {canReview &&
                    ['ACCOUNT_CREATED', 'UNDER_REVIEW', 'PROPOSAL_SENT'].includes(
                      request.status,
                    ) ? (
                      <Button
                        className="ml-2"
                        size="sm"
                        variant="secondary"
                        type="button"
                        onClick={() => review.mutate({ id: request.id, status: 'REJECTED' })}
                      >
                        Reject
                      </Button>
                    ) : null}
                    {review.isError && review.variables?.id === request.id ? (
                      <p role="alert" className="mt-2 text-sm text-error">
                        {review.error instanceof ApiError
                          ? review.error.message
                          : 'Could not update request.'}
                      </p>
                    ) : null}
                    {convert.isError && convert.variables === request.id ? (
                      <p role="alert" className="mt-2 text-sm text-error">
                        {convert.error instanceof ApiError
                          ? convert.error.message
                          : 'Could not create project.'}
                      </p>
                    ) : null}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </section>
  );
}
