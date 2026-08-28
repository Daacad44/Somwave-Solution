import { describe, it, expect } from 'vitest';
import { createJobApplicationSchema, employmentTypeSchema, EMPLOYMENT_TYPE_LABELS } from './job';

describe('createJobApplicationSchema', () => {
  it('accepts a valid application with only the required fields', () => {
    const parsed = createJobApplicationSchema.safeParse({
      name: 'Cali Axmed',
      email: 'cali@example.com',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a bad email', () => {
    expect(createJobApplicationSchema.safeParse({ name: 'Cali', email: 'nope' }).success).toBe(
      false,
    );
  });

  it('rejects an invalid resume URL', () => {
    expect(
      createJobApplicationSchema.safeParse({
        name: 'Cali',
        email: 'cali@example.com',
        resumeUrl: 'not-a-url',
      }).success,
    ).toBe(false);
  });

  it('trims the name and keeps optional fields', () => {
    const parsed = createJobApplicationSchema.parse({
      name: '  Cali  ',
      email: 'cali@example.com',
      phone: '+252 61 000 0000',
      coverLetter: 'Waxaan xiiseynayaa fursaddan.',
      resumeUrl: 'https://example.com/cv.pdf',
    });
    expect(parsed.name).toBe('Cali');
    expect(parsed.phone).toBe('+252 61 000 0000');
    expect(parsed.resumeUrl).toBe('https://example.com/cv.pdf');
  });
});

describe('employmentTypeSchema', () => {
  it('accepts every known employment type and its label', () => {
    for (const value of ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'] as const) {
      expect(employmentTypeSchema.safeParse(value).success).toBe(true);
      expect(EMPLOYMENT_TYPE_LABELS[value]).toBeTruthy();
    }
  });

  it('rejects an unknown employment type', () => {
    expect(employmentTypeSchema.safeParse('TEMPORARY').success).toBe(false);
  });
});
