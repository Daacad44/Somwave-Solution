import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { parseReportQuery } from './reports.routes';

function request(query: Record<string, string>): Request {
  return { query } as unknown as Request;
}

describe('reports query validation', () => {
  it('uses Mogadishu calendar days and an exclusive database end', () => {
    const parsed = parseReportQuery(
      request({ from: '2026-10-01', to: '2026-10-02', status: 'ACTIVE' }),
      'projects',
    );
    expect(parsed.from.toISOString()).toBe('2026-09-30T21:00:00.000Z');
    expect(parsed.to.toISOString()).toBe('2026-10-02T21:00:00.000Z');
    expect(parsed.status).toBe('ACTIVE');
  });

  it('rejects invalid dates, statuses, excessive pages, and unsupported filters', () => {
    expect(() =>
      parseReportQuery(request({ from: '2026-02-30', to: '2026-03-02' }), 'projects'),
    ).toThrow();
    expect(() =>
      parseReportQuery(request({ from: '2026-10-02', to: '2026-10-01' }), 'projects'),
    ).toThrow();
    expect(() => parseReportQuery(request({ status: 'FAKE' }), 'projects')).toThrow();
    expect(() => parseReportQuery(request({ pageSize: '10000' }), 'projects')).toThrow();
    expect(() => parseReportQuery(request({ clientId: 'private' }), 'audit')).toThrow();
  });
});
