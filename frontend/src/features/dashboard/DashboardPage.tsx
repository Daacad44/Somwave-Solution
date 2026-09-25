import { type ReactNode, useState } from 'react';
import { DASHBOARD_RANGES, ROLES, type DashboardRange } from '@somwave/shared';
import { useCurrentUser } from '../auth/hooks';
import { ClientDashboard } from './ClientDashboard';
import { InternalDashboard } from './InternalDashboard';
import { useDashboard } from './hooks';

function isRange(value: string): value is DashboardRange {
  return (DASHBOARD_RANGES as readonly string[]).includes(value);
}

export function DashboardPage(): ReactNode {
  const { data: user } = useCurrentUser();
  const [range, setRange] = useState<DashboardRange>('30d');
  const query = useDashboard(range);

  if (user?.roles.includes(ROLES.CLIENT) || query.data?.kind === 'client') {
    return (
      <ClientDashboard
        user={user}
        data={query.data}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
      />
    );
  }

  return (
    <InternalDashboard
      user={user}
      data={query.data}
      range={range}
      onRangeChange={(next) => {
        if (isRange(next)) setRange(next);
      }}
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => void query.refetch()}
    />
  );
}
