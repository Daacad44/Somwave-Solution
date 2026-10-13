import type { EmploymentType } from '@somwave/shared';

// Keep public career labels in Somali while showing English in the staff CMS.
export const STAFF_EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
};
