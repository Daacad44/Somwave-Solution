import { type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CLIENT_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  TICKET_STATUS_LABELS,
} from '@somwave/shared';
import { Badge } from '../../components/ui/Badge';
import { Table, TBody, Td, Th, THead, Tr } from '../../components/ui/Table';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import { formatLongDate } from '../../lib/date';
import { useClientProfile } from './hooks';

export function ClientDetailPage(): ReactNode {
  const { id } = useParams();
  const query = useClientProfile(id);

  if (!id) return <ErrorState title="Client not found" />;
  if (query.isLoading) return <LoadingState rows={8} label="Loading client" />;
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="Could not load client"
        description="Check that the record exists and you have access."
        onRetry={() => query.refetch()}
      />
    );
  }

  const client = query.data;
  return (
    <section className="flex min-w-0 flex-col gap-5">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link
          to="/clients"
          className="font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          Clients
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-ink">{client.companyName}</span>
      </nav>

      <header className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-ink">{client.companyName}</h1>
            <p className="mt-1 text-sm text-muted">
              {client.email ?? 'No email'}
              {client.phone ? ` · ${client.phone}` : ''}
            </p>
          </div>
          <Badge tone={client.status === 'ACTIVE' ? 'success' : 'neutral'}>
            {CLIENT_STATUS_LABELS[client.status]}
          </Badge>
        </div>
        <p className="mt-3 text-sm text-muted">Registered {formatLongDate(client.createdAt)}</p>
      </header>

      <RecordSection
        title="Projects"
        emptyTitle="No linked projects"
        emptyDescription="Projects linked to this client will appear here."
        isEmpty={client.projects.length === 0}
      >
        <Table>
          <THead>
            <Tr>
              <Th>Name</Th>
              <Th>Status</Th>
              <Th>Progress</Th>
              <Th>Due</Th>
            </Tr>
          </THead>
          <TBody>
            {client.projects.map((project) => (
              <Tr key={project.id}>
                <Td>
                  <Link
                    className="font-medium text-brand hover:underline"
                    to={`/projects/${project.id}`}
                  >
                    {project.name}
                  </Link>
                </Td>
                <Td>{PROJECT_STATUS_LABELS[project.status]}</Td>
                <Td>{project.progress === null ? '—' : `${project.progress}%`}</Td>
                <Td className="text-muted">{formatLongDate(project.dueDate)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </RecordSection>

      <RecordSection
        title="Invoices"
        emptyTitle="No invoices yet"
        emptyDescription="Invoices created on the Invoices page will appear here."
        isEmpty={client.invoices.length === 0}
      >
        <Table>
          <THead>
            <Tr>
              <Th>Number</Th>
              <Th>Status</Th>
              <Th>Total</Th>
              <Th>Due</Th>
            </Tr>
          </THead>
          <TBody>
            {client.invoices.map((invoice) => (
              <Tr key={invoice.id}>
                <Td>
                  <Link
                    className="font-medium text-brand hover:underline"
                    to={`/invoices/${invoice.id}`}
                  >
                    {invoice.number}
                  </Link>
                </Td>
                <Td>{INVOICE_STATUS_LABELS[invoice.status]}</Td>
                <Td>${invoice.total}</Td>
                <Td className="text-muted">{formatLongDate(invoice.dueDate)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </RecordSection>

      <RecordSection
        title="Support"
        emptyTitle="No tickets yet"
        emptyDescription="This client's support tickets will appear here."
        isEmpty={client.tickets.length === 0}
      >
        <Table>
          <THead>
            <Tr>
              <Th>Code</Th>
              <Th>Subject</Th>
              <Th>Status</Th>
            </Tr>
          </THead>
          <TBody>
            {client.tickets.map((ticket) => (
              <Tr key={ticket.id}>
                <Td>
                  <Link
                    className="font-medium text-brand hover:underline"
                    to={`/tickets/${ticket.id}`}
                  >
                    {ticket.code}
                  </Link>
                </Td>
                <Td>{ticket.subject}</Td>
                <Td>{TICKET_STATUS_LABELS[ticket.status]}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </RecordSection>

      <RecordSection
        title="Documents"
        emptyTitle="No documents yet"
        emptyDescription="Files uploaded on the Documents page will appear here."
        isEmpty={client.documents.length === 0}
      >
        <Table>
          <THead>
            <Tr>
              <Th>Title</Th>
              <Th>Date</Th>
            </Tr>
          </THead>
          <TBody>
            {client.documents.map((document) => (
              <Tr key={document.id}>
                <Td className="font-medium">{document.title}</Td>
                <Td className="text-muted">{formatLongDate(document.createdAt)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </RecordSection>
    </section>
  );
}

function RecordSection({
  title,
  emptyTitle,
  emptyDescription,
  isEmpty,
  children,
}: {
  title: string;
  emptyTitle: string;
  emptyDescription: string;
  isEmpty: boolean;
  children: ReactNode;
}): ReactNode {
  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <div className="mt-4">
        {isEmpty ? <EmptyState title={emptyTitle} description={emptyDescription} /> : children}
      </div>
    </section>
  );
}
