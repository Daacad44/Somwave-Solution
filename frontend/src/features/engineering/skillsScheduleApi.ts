import { apiFetch } from '../../lib/apiClient';

export type SkillCategory =
  | 'FRONTEND'
  | 'BACKEND'
  | 'MOBILE'
  | 'DEVOPS'
  | 'DESIGN'
  | 'QA'
  | 'DATABASE'
  | 'SECURITY'
  | 'ARCHITECTURE'
  | 'OTHER';
export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
export interface StructuredSkill {
  id?: string;
  category: SkillCategory;
  name: string;
  level: SkillLevel;
  experienceYears: number | string;
  isPrimary: boolean;
}
export interface WeeklySlot {
  id?: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
}
export interface SkillsResponse {
  profile: {
    specialization: string | null;
    secondarySpecializations: string[];
    timezone: string;
    weeklyCapacityHours: number | string;
  };
  skills: StructuredSkill[];
}
export interface ScheduleResponse {
  profile: { timezone: string; weeklyCapacityHours: number | string };
  slots: WeeklySlot[];
}

export const skillCategories: SkillCategory[] = [
  'FRONTEND',
  'BACKEND',
  'MOBILE',
  'DEVOPS',
  'DESIGN',
  'QA',
  'DATABASE',
  'SECURITY',
  'ARCHITECTURE',
  'OTHER',
];
export const skillLevels: SkillLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
export const skillsScheduleApi = {
  search: (filter: { category?: string; level?: string; name?: string }) => {
    const params = new URLSearchParams(
      Object.entries(filter).filter(([, value]) => Boolean(value)) as string[][],
    );
    return apiFetch<Array<{ userId: string; user: { name: string; email: string } }>>(
      `/engineering/engineers/search-skills?${params.toString()}`,
    );
  },
  skills: (userId?: string) =>
    apiFetch<SkillsResponse>(
      userId ? `/engineering/engineers/${userId}/skills` : '/engineering/engineers/me/skills',
    ),
  schedule: (userId?: string) =>
    apiFetch<ScheduleResponse>(
      userId ? `/engineering/engineers/${userId}/schedule` : '/engineering/engineers/me/schedule',
    ),
  saveSkills: (input: { skills: StructuredSkill[]; secondarySpecializations: string[] }) =>
    apiFetch<SkillsResponse>('/engineering/engineers/me/skills', {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  saveSchedule: (input: { slots: WeeklySlot[] }) =>
    apiFetch<ScheduleResponse>('/engineering/engineers/me/schedule', {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
};
