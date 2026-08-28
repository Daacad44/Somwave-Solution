import { describe, it, expect } from 'vitest';
import { publicServiceSchema, createServiceSchema } from './service';

describe('publicServiceSchema', () => {
  it('accepts a valid public service', () => {
    const parsed = publicServiceSchema.safeParse({
      id: 's1',
      slug: 'web',
      title: 'Web',
      summary: 'Websites',
      order: 1,
    });
    expect(parsed.success).toBe(true);
  });
});

describe('createServiceSchema', () => {
  it('requires a kebab-case slug', () => {
    expect(
      createServiceSchema.safeParse({ slug: 'Not Kebab', title: 't', summary: 's' }).success,
    ).toBe(false);
  });
  it('defaults order and isPublished', () => {
    const parsed = createServiceSchema.parse({ slug: 'web-dev', title: 'Web', summary: 'Sites' });
    expect(parsed.order).toBe(0);
    expect(parsed.isPublished).toBe(true);
  });
});
