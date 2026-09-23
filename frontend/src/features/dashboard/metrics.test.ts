import { describe, expect, it } from 'vitest';
import {
  countInvoices,
  countLeads,
  countOpenTasks,
  countOpenTickets,
  formatRoleName,
} from './metrics';

describe('dashboard metrics', () => {
  it('formats stored role names for display', () => {
    expect(formatRoleName('SUPER_ADMIN')).toBe('Super Admin');
    expect(formatRoleName('CLIENT')).toBe('Client');
  });

  it('counts tasks that are not done', () => {
    expect(countOpenTasks(12, 5)).toBe(7);
    expect(countOpenTasks(2, 5)).toBe(0);
  });

  it('counts new leads separately from the full inbox', () => {
    expect(countLeads([{ status: 'NEW' }, { status: 'READ' }, { status: 'NEW' }])).toEqual({
      total: 3,
      fresh: 2,
    });
  });

  it('counts invoices that still need attention', () => {
    expect(
      countInvoices([
        { status: 'DRAFT' },
        { status: 'SENT' },
        { status: 'PAID' },
        { status: 'OVERDUE' },
        { status: 'VOID' },
      ]),
    ).toEqual({ open: 3, overdue: 1 });
  });

  it('counts tickets that are not resolved', () => {
    expect(
      countOpenTickets([{ status: 'OPEN' }, { status: 'RESOLVED' }, { status: 'WAITING' }]),
    ).toBe(2);
  });
});
