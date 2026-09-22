import { type ReactNode, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { INVOICE_STATUS_LABELS, PERMISSIONS, type InvoiceStatus } from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { formatDate } from '../../lib/date';
import { ApiError } from '../../lib/apiClient';
import { useInvoice, useSendInvoice, useVoidInvoice } from './hooks';

const STATUS_TONE: Record<InvoiceStatus, 'neutral' | 'info' | 'success' | 'warning' | 'error'> = {
  DRAFT: 'neutral',
  SENT: 'info',
  PARTIAL: 'warning',
  PAID: 'success',
  OVERDUE: 'error',
  VOID: 'neutral',
};

export function InvoiceDetailPage(): ReactNode {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const query = useInvoice(id);
  const send = useSendInvoice();
  const voidInv = useVoidInvoice();
  const canUpdate = useHasPermission(PERMISSIONS.INVOICES_UPDATE);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const sendKey = useRef(crypto.randomUUID());

  const invoice = query.data;
  const canSend = canUpdate && invoice?.status === 'DRAFT';
  const canVoid =
    canUpdate && invoice !== undefined && invoice.status !== 'VOID' && invoice.status !== 'PAID';

  const onSend = async (): Promise<void> => {
    if (!invoice) return;
    setActionError(null);
    try {
      await send.mutateAsync({ id: invoice.id, idempotencyKey: sendKey.current });
    } catch (err) {
      sendKey.current = crypto.randomUUID();
      setActionError(err instanceof ApiError ? err.message : 'Wax baa qaldamay.');
    }
  };

  const onVoid = async (): Promise<void> => {
    if (!invoice) return;
    setActionError(null);
    try {
      await voidInv.mutateAsync(invoice.id);
      setConfirmVoid(false);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Wax baa qaldamay.');
    }
  };

  if (query.isLoading) {
    return (
      <section>
        <LoadingState rows={8} label="Waa la soo rarayaa" />
      </section>
    );
  }
  if (query.isError || !invoice) {
    return (
      <section>
        <ErrorState description="Biilkan lama soo rari karin." onRetry={() => query.refetch()} />
        <Link
          to="/invoices"
          className="mt-4 inline-block text-sm text-primary underline-offset-2 hover:underline"
        >
          Ku noqo liiska
        </Link>
      </section>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            <Link to="/invoices" className="underline-offset-2 hover:underline">
              Biilasha
            </Link>
            <span className="mx-1">/</span>
            {invoice.number}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">{invoice.number}</h1>
          <p className="mt-1 text-base text-muted">{invoice.client.companyName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(`/invoices/${invoice.id}/print`)}
          >
            Daabac / PDF
          </Button>
          {canSend ? (
            <Button onClick={onSend} isLoading={send.isPending}>
              Dir biilka
            </Button>
          ) : null}
          {canVoid ? (
            <Button variant="danger" onClick={() => setConfirmVoid(true)}>
              Bur biilka
            </Button>
          ) : null}
        </div>
      </div>

      <dl className="mt-6 grid gap-4 rounded-lg border border-border bg-surface p-5 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted">Xaalad</dt>
          <dd className="mt-1">
            <Badge tone={STATUS_TONE[invoice.status]}>
              {INVOICE_STATUS_LABELS[invoice.status]}
            </Badge>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Mashruuc</dt>
          <dd className="mt-1 text-base text-ink">{invoice.project?.name ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">La soo saaray</dt>
          <dd className="mt-1 text-base text-ink">{formatDate(invoice.issueDate)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Dhicitaanka</dt>
          <dd className="mt-1 text-base text-ink">{formatDate(invoice.dueDate)}</dd>
        </div>
      </dl>

      <div className="mt-6 rounded-lg border border-border bg-surface">
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
        <div className="flex flex-col gap-1 border-t border-border p-4 text-end text-base">
          <p className="text-muted">Hoosaad: ${invoice.subtotal}</p>
          <p className="text-muted">Canshuur: ${invoice.tax}</p>
          <p className="text-muted">Qiimo-dhimis: ${invoice.discount}</p>
          <p className="font-semibold text-ink">Wadarta: ${invoice.total}</p>
          <p className="text-muted">La bixiyay: ${invoice.paidAmount}</p>
        </div>
      </div>

      {actionError ? <p className="mt-4 text-sm text-error">{actionError}</p> : null}

      <Modal open={confirmVoid} onClose={() => setConfirmVoid(false)} title="Bur biilka">
        <p className="text-base text-ink">
          Ma hubtaa inaad burayso <strong>{invoice.number}</strong>? Tallaabadan lama celin karo.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmVoid(false)}>
            Maya
          </Button>
          <Button variant="danger" isLoading={voidInv.isPending} onClick={onVoid}>
            Haa, bur
          </Button>
        </div>
      </Modal>
    </section>
  );
}
