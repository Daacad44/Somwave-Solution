import { PERMISSIONS, type PermissionKey } from '@somwave/shared';

export type NavItem = {
  to: string;
  label: string;
  permission: PermissionKey;
};

export type NavGroup = {
  heading: string;
  items: NavItem[];
};

// Sidebar shown on the operations dashboard reference. No extra items.
export const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Website',
    items: [
      { to: '/cms/services', label: 'Services', permission: PERMISSIONS.CONTENT_READ },
      { to: '/cms/posts', label: 'Articles', permission: PERMISSIONS.CONTENT_READ },
      { to: '/cms/portfolio', label: 'Portfolio', permission: PERMISSIONS.CONTENT_READ },
      { to: '/cms/careers', label: 'Careers', permission: PERMISSIONS.CONTENT_READ },
      { to: '/cms/testimonials', label: 'Testimonials', permission: PERMISSIONS.CONTENT_READ },
      { to: '/cms/team', label: 'Team', permission: PERMISSIONS.CONTENT_READ },
      { to: '/cms/faqs', label: 'FAQs', permission: PERMISSIONS.CONTENT_READ },
      { to: '/cms/subscribers', label: 'Newsletter', permission: PERMISSIONS.CONTENT_READ },
    ],
  },
  {
    heading: 'Operations',
    items: [
      { to: '/projects', label: 'Projects', permission: PERMISSIONS.PROJECTS_READ },
      { to: '/tasks', label: 'Tasks', permission: PERMISSIONS.TASKS_READ },
      { to: '/milestones', label: 'Milestones', permission: PERMISSIONS.MILESTONES_READ },
      { to: '/clients', label: 'Clients', permission: PERMISSIONS.CLIENTS_READ },
      { to: '/leads', label: 'Leads', permission: PERMISSIONS.LEADS_READ },
      { to: '/applications', label: 'Applications', permission: PERMISSIONS.APPLICATIONS_READ },
    ],
  },
];
