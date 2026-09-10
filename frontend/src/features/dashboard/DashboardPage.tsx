import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PERMISSIONS, type PermissionKey } from '@somwave/shared';
import { useCurrentUser } from '../auth/hooks';
import { hasPermission } from '../../lib/rbac';

type Card = { to: string; title: string; description: string; permission: PermissionKey };

const CMS_CARDS: Card[] = [
  {
    to: '/cms/services',
    title: 'CMS · Adeegyada',
    description: 'Maamul nuxurka websaydka.',
    permission: PERMISSIONS.CONTENT_READ,
  },
];

const INTERNAL_CARDS: Card[] = [
  {
    to: '/projects',
    title: 'Mashruucyada',
    description: 'Qorshe, hawl, iyo marxalado.',
    permission: PERMISSIONS.PROJECTS_READ,
  },
  {
    to: '/leads',
    title: 'Lead-yada',
    description: 'Codsiyada foomka xiriirka.',
    permission: PERMISSIONS.LEADS_READ,
  },
  {
    to: '/applications',
    title: 'Qorista',
    description: 'Codsiyada fursadaha shaqo.',
    permission: PERMISSIONS.APPLICATIONS_READ,
  },
  {
    to: '/clients',
    title: 'Macaamiisha',
    description: 'Diiwaanka shirkadaha macaamiisha.',
    permission: PERMISSIONS.CLIENTS_READ,
  },
  {
    to: '/timesheets',
    title: 'Saacadaha',
    description: 'Diiwaangeli saacadaha shaqada.',
    permission: PERMISSIONS.TIMESHEETS_READ,
  },
];

const PORTAL_CARDS: Card[] = [
  {
    to: '/portal/projects',
    title: 'Mashruucyadayda',
    description: 'Mashruucyada ku xiran akoonkaaga.',
    permission: PERMISSIONS.PORTAL_READ,
  },
  {
    to: '/invoices',
    title: 'Biilasha',
    description: 'Liiska iyo qabyo-dhiska biilasha.',
    permission: PERMISSIONS.INVOICES_READ,
  },
  {
    to: '/tickets',
    title: 'Tikidhada',
    description: 'Taageerada iyo codsiyada.',
    permission: PERMISSIONS.TICKETS_READ,
  },
];

const GROUPS: { heading: string; cards: Card[] }[] = [
  { heading: 'Websayd', cards: CMS_CARDS },
  { heading: 'Gudaha', cards: INTERNAL_CARDS },
  { heading: 'Portal', cards: PORTAL_CARDS },
];

export function DashboardPage(): ReactNode {
  const { data: user } = useCurrentUser();
  const groups = GROUPS.map((group) => ({
    ...group,
    cards: group.cards.filter((card) => hasPermission(user, card.permission)),
  })).filter((group) => group.cards.length > 0);

  return (
    <section>
      <h1 className="text-2xl font-semibold text-ink">Soo dhawoow, {user?.name}</h1>
      <p className="mt-1 text-base text-muted">
        Fadhigaaga — kaliya qaybaha aad rukhsad u leedahay ayaa muuqda.
      </p>
      {groups.length === 0 ? (
        <p className="mt-8 rounded-lg border border-border bg-surface p-6 text-muted">
          Weli ma jirto qayb aad geli karto. Fadlan la xidhiidh maamulaha.
        </p>
      ) : (
        groups.map((group) => (
          <div key={group.heading} className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              {group.heading}
            </h2>
            <ul className="mt-3 grid gap-4 sm:grid-cols-2">
              {group.cards.map((card) => (
                <li key={card.to}>
                  <Link
                    to={card.to}
                    className="block rounded-lg border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <h3 className="text-lg font-semibold text-ink">{card.title}</h3>
                    <p className="mt-1 text-sm text-muted">{card.description}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
