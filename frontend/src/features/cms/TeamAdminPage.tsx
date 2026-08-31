// CMS — team members management (W5.2, §9). EDITOR-facing screen; the four states
// (§12) and permission-gated actions (§13). Writes invalidate the public cache.
import { type ReactNode, useState } from 'react';
import type { AdminTeamMember } from '@somwave/shared';
import { PERMISSIONS } from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { useCmsTeam, useDeleteTeamMember } from './hooks';
import { TeamMemberFormModal } from './components/TeamMemberFormModal';

export function TeamAdminPage(): ReactNode {
  const query = useCmsTeam();
  const del = useDeleteTeamMember();

  const canCreate = useHasPermission(PERMISSIONS.CONTENT_CREATE);
  const canUpdate = useHasPermission(PERMISSIONS.CONTENT_UPDATE);
  const canDelete = useHasPermission(PERMISSIONS.CONTENT_DELETE);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminTeamMember | null>(null);
  const [confirming, setConfirming] = useState<AdminTeamMember | null>(null);

  const openCreate = (): void => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (member: AdminTeamMember): void => {
    setEditing(member);
    setFormOpen(true);
  };

  const members = query.data ?? [];

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Kooxda (CMS)</h1>
          <p className="mt-1 text-base text-muted">Maamul xubnaha kooxda ee websaydka.</p>
        </div>
        {canCreate ? <Button onClick={openCreate}>Xubin cusub</Button> : null}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface">
        {query.isLoading ? (
          <LoadingState rows={5} label="Waa la soo rarayaa" />
        ) : query.isError ? (
          <ErrorState description="Kooxda lama soo rari karin." onRetry={() => query.refetch()} />
        ) : members.length === 0 ? (
          <EmptyState
            title="Weli xubin ma jirto"
            action={canCreate ? <Button onClick={openCreate}>Xubin cusub</Button> : undefined}
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Magaca</Th>
                <Th>Jagada</Th>
                <Th>Kala horreyn</Th>
                <Th>Xaalad</Th>
                <Th className="text-end">Ficil</Th>
              </Tr>
            </THead>
            <TBody>
              {members.map((member) => (
                <Tr key={member.id}>
                  <Td className="font-medium">{member.name}</Td>
                  <Td className="text-muted">{member.role}</Td>
                  <Td>{member.order}</Td>
                  <Td>
                    <Badge tone={member.isPublished ? 'success' : 'neutral'}>
                      {member.isPublished ? 'La daabacay' : 'Qabyo'}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                        <Button size="sm" variant="secondary" onClick={() => openEdit(member)}>
                          Wax ka beddel
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button size="sm" variant="danger" onClick={() => setConfirming(member)}>
                          Tirtir
                        </Button>
                      ) : null}
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      {formOpen ? (
        <TeamMemberFormModal
          key={editing?.id ?? 'new'}
          open={formOpen}
          onClose={() => setFormOpen(false)}
          member={editing}
        />
      ) : null}

      <Modal open={Boolean(confirming)} onClose={() => setConfirming(null)} title="Tirtir xubinta">
        <p className="text-base text-ink">
          Ma hubtaa inaad tirtirayso <strong>{confirming?.name}</strong>? Tallaabadan lama soo celin
          karo.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(null)}>
            Maya
          </Button>
          <Button
            variant="danger"
            isLoading={del.isPending}
            onClick={async () => {
              if (!confirming) return;
              await del.mutateAsync(confirming.id);
              setConfirming(null);
            }}
          >
            Haa, tirtir
          </Button>
        </div>
      </Modal>
    </section>
  );
}
