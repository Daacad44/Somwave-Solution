import { PERMISSIONS, type PermissionKey } from '@somwave/shared';

export type NavItem = {
  to: string;
  label: string;
  description: string;
  permission: PermissionKey;
};

export type NavGroup = {
  heading: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Website',
    items: [
      {
        to: '/cms/services',
        label: 'Services',
        description: 'Pages and service descriptions on the public site.',
        permission: PERMISSIONS.CONTENT_READ,
      },
      {
        to: '/cms/posts',
        label: 'Articles',
        description: 'Blog posts published on the website.',
        permission: PERMISSIONS.CONTENT_READ,
      },
      {
        to: '/cms/portfolio',
        label: 'Portfolio',
        description: 'Case studies and completed work.',
        permission: PERMISSIONS.CONTENT_READ,
      },
      {
        to: '/cms/careers',
        label: 'Careers',
        description: 'Open roles and how people apply.',
        permission: PERMISSIONS.CONTENT_READ,
      },
      {
        to: '/cms/testimonials',
        label: 'Testimonials',
        description: 'Client quotes shown on the website.',
        permission: PERMISSIONS.CONTENT_READ,
      },
      {
        to: '/cms/team',
        label: 'Team',
        description: 'People listed on the public team page.',
        permission: PERMISSIONS.CONTENT_READ,
      },
      {
        to: '/cms/faqs',
        label: 'FAQs',
        description: 'Answers to common questions.',
        permission: PERMISSIONS.CONTENT_READ,
      },
      {
        to: '/cms/subscribers',
        label: 'Newsletter',
        description: 'People subscribed to updates.',
        permission: PERMISSIONS.CONTENT_READ,
      },
    ],
  },
  {
    heading: 'Operations',
    items: [
      {
        to: '/projects',
        label: 'Projects',
        description: 'Plans, delivery, and project status.',
        permission: PERMISSIONS.PROJECTS_READ,
      },
      {
        to: '/tasks',
        label: 'Tasks',
        description: 'Work assigned across active projects.',
        permission: PERMISSIONS.TASKS_READ,
      },
      {
        to: '/milestones',
        label: 'Milestones',
        description: 'Delivery checkpoints and due dates.',
        permission: PERMISSIONS.MILESTONES_READ,
      },
      {
        to: '/clients',
        label: 'Clients',
        description: 'Client companies and their accounts.',
        permission: PERMISSIONS.CLIENTS_READ,
      },
      {
        to: '/leads',
        label: 'Leads',
        description: 'Enquiries sent from the contact form.',
        permission: PERMISSIONS.LEADS_READ,
      },
      {
        to: '/applications',
        label: 'Applications',
        description: 'People who applied for open roles.',
        permission: PERMISSIONS.APPLICATIONS_READ,
      },
      {
        to: '/timesheets',
        label: 'Timesheets',
        description: 'Hours logged against project work.',
        permission: PERMISSIONS.TIMESHEETS_READ,
      },
      {
        to: '/users',
        label: 'Users',
        description: 'Staff and client accounts.',
        permission: PERMISSIONS.USERS_READ,
      },
      {
        to: '/roles',
        label: 'Roles & permissions',
        description: 'What each role is allowed to do.',
        permission: PERMISSIONS.ROLES_READ,
      },
    ],
  },
  {
    heading: 'Client portal',
    items: [
      {
        to: '/portal/projects',
        label: 'My projects',
        description: 'Projects linked to your client account.',
        permission: PERMISSIONS.PORTAL_READ,
      },
      {
        to: '/portal/milestones',
        label: 'My milestones',
        description: 'Milestones on your projects.',
        permission: PERMISSIONS.PORTAL_READ,
      },
      {
        to: '/invoices',
        label: 'Invoices',
        description: 'Issued invoices and what is still due.',
        permission: PERMISSIONS.INVOICES_READ,
      },
      {
        to: '/tickets',
        label: 'Support tickets',
        description: 'Requests and replies from clients.',
        permission: PERMISSIONS.TICKETS_READ,
      },
    ],
  },
];
