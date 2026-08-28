import { describe, it, expect } from 'vitest';
import {
  publicPortfolioItemSchema,
  publicPortfolioDetailSchema,
  createPortfolioItemSchema,
} from './portfolio';

describe('publicPortfolioItemSchema', () => {
  it('accepts a valid item with nullable fields', () => {
    const parsed = publicPortfolioItemSchema.safeParse({
      id: 'p1',
      slug: 'school-system',
      title: 'School',
      summary: 'A system',
      client: null,
      coverImage: null,
      order: 1,
    });
    expect(parsed.success).toBe(true);
  });
});

describe('publicPortfolioDetailSchema', () => {
  it('extends the summary with a nullable description', () => {
    const parsed = publicPortfolioDetailSchema.safeParse({
      id: 'p1',
      slug: 'school-system',
      title: 'School',
      summary: 'A system',
      description: 'Full story',
      client: 'Acme',
      coverImage: null,
      order: 1,
    });
    expect(parsed.success).toBe(true);
  });
});

describe('createPortfolioItemSchema', () => {
  it('requires a kebab-case slug and a valid cover URL when present', () => {
    expect(
      createPortfolioItemSchema.safeParse({ slug: 'Bad Slug', title: 't', summary: 's' }).success,
    ).toBe(false);
    expect(
      createPortfolioItemSchema.safeParse({
        slug: 'ok',
        title: 't',
        summary: 's',
        coverImage: 'not-a-url',
      }).success,
    ).toBe(false);
  });
});
