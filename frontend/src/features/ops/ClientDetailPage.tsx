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

  if (!id) return <ErrorState title="Macmiilkan lama helin" />;
  if (query.isLoading) return <LoadingState rows={8} label="Waa la soo rarayaa macmiilka" />;
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="Macmiilka lama soo rari karin"
        description="Hubi in diiwaanku jiro oo aad fasax u leedahay."
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
          Macaamiisha
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-ink">{client.companyName}</span>
      </nav>

      <header className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-ink">{client.companyName}</h1>
            <p className="mt-1 text-sm text-muted">
              {client.email ?? 'Iimayl ma jiro'}
              {client.phone ? ` · ${client.phone}` : ''}
            </p>
          </div>
          <Badge tone={client.status === 'ACTIVE' ? 'success' : 'neutral'}>
            {CLIENT_STATUS_LABELS[client.status]}
          </Badge>
        </div>
        <p className="mt-3 text-sm text-muted">
          La diiwaangeliyay {formatLongDate(client.createdAt)}
        </p>
      </header>

      <RecordSection
        title="Mashruucyada"
        emptyTitle="Mashruuc kuma xirna"
        emptyDescription="Mashruucyada aad macmiilkan ku xirto ayaa halkan ka muuqan doona."
        isEmpty={client.projects.length === 0}
      >
        <Table>
          <THead>
            <Tr>
              <Th>Magaca</Th>
              <Th>Xaalad</Th>
              <Th>Horumar</Th>
              <Th>Dhammaad</Th>
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
        title="Biilasha"
        emptyTitle="Biil ma jiro"
        emptyDescription="Biilasha laga sameeyo bogga Biilasha ayaa halkan ka muuqan doona."
        isEmpty={client.invoices.length === 0}
      >
        <Table>
          <THead>
            <Tr>
              <Th>Lambarka</Th>
              <Th>Xaalad</Th>
              <Th>Wadarta</Th>
              <Th>Dhammaad</Th>
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
        title="Taageerada"
        emptyTitle="Tigidh ma jiro"
        emptyDescription="Tigidhada macmiilkan ayaa halkan ka muuqan doona."
        isEmpty={client.tickets.length === 0}
      >
        <Table>
          <THead>
            <Tr>
              <Th>Koodh</Th>
              <Th>Mawduuc</Th>
              <Th>Xaalad</Th>
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
        title="Dukumeentiyada"
        emptyTitle="Dukumeenti ma jiro"
        emptyDescription="Faylasha laga soo geliyo bogga Dukumeentiyada ayaa halkan ka muuqan doona."
        isEmpty={client.documents.length === 0}
      >
        <Table>
          <THead>
            <Tr>
              <Th>Cinwaan</Th>
              <Th>Taariikh</Th>
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
