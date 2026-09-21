import { type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { INVOICE_STATUS_LABELS } from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { LoadingState, ErrorState } from '../../components/states';
import { formatDate } from '../../lib/date';
import { useInvoice } from './hooks';

export function InvoicePrintPage(): ReactNode {
  const { id } = useParams<{ id: string }>();
  const query = useInvoice(id);
  const invoice = query.data;

  if (query.isLoading) {
    return <LoadingState rows={8} label="Waa la soo rarayaa" />;
  }
  if (query.isError || !invoice) {
    return (
      <ErrorState description="Biilkan lama soo rari karin." onRetry={() => query.refetch()} />
    );
  }

  return (
    <section className="mx-auto max-w-3xl bg-surface p-6 print:p-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          to={`/invoices/${invoice.id}`}
          className="text-sm text-primary underline-offset-2 hover:underline"
        >
          Ku noqo biilka
        </Link>
        <Button type="button" onClick={() => window.print()}>
          Daabac
        </Button>
      </div>
      <header className="border-b border-border pb-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">Somwave</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Biil {invoice.number}</h1>
        <p className="mt-1 text-base text-muted">{INVOICE_STATUS_LABELS[invoice.status]}</p>
      </header>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted">Macmiil</dt>
          <dd className="text-base text-ink">{invoice.client.companyName}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Mashruuc</dt>
          <dd className="text-base text-ink">{invoice.project?.name ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">La soo saaray</dt>
          <dd className="text-base text-ink">{formatDate(invoice.issueDate)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Dhicitaanka</dt>
          <dd className="text-base text-ink">{formatDate(invoice.dueDate)}</dd>
        </div>
      </dl>
      <div className="mt-6">
        <Table>
          <THead>
            <Tr>
              <Th>Sharaxaad</Th>
              <Th>Tirada</Th>
              <Th>Qiimaha</Th>
              <Th>Wadarta</Th>
            </Tr>
          </THead>
          <TBody>
            {invoice.items.map((item) => (
              <Tr key={item.id}>
                <Td>{item.description}</Td>
                <Td>{item.quantity}</Td>
                <Td>${item.unitPrice}</Td>
                <Td>${item.lineTotal}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
      <div className="mt-4 flex flex-col items-end gap-1 text-base">
        <p className="text-muted">Hoosaad: ${invoice.subtotal}</p>
        <p className="text-muted">Canshuur: ${invoice.tax}</p>
        <p className="text-muted">Qiimo-dhimis: ${invoice.discount}</p>
        <p className="text-xl font-semibold text-ink">Wadarta: ${invoice.total} USD</p>
        <p className="text-muted">La bixiyay: ${invoice.paidAmount}</p>
      </div>
    </section>
  );
}
