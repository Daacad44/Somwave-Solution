import { expect, test } from '@playwright/test';

test('project dashboard and management tabs work on desktop and mobile', async ({ page }) => {
  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  await expect(page.getByText('Total projects')).toBeVisible();
  await expect(page.getByLabel('Search projects')).toBeVisible();
  await page.getByRole('button', { name: /Unassigned projects/i }).click();
  await expect(page).toHaveURL(/assignment=unassigned/);
  await expect(page.getByRole('combobox', { name: 'Assignment' })).toHaveValue('unassigned');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Assignment' })).toHaveValue('unassigned');
  await expect(page.getByText(/matching projects/)).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('button', { name: 'Cards', exact: true }).click();
  const projectLink = page.locator('article a[href^="/projects/"]').first();
  await expect(projectLink).toBeVisible();
  await projectLink.click();
  await expect(page.getByRole('navigation', { name: 'Project sections' })).toBeVisible();

  await page.getByRole('button', { name: 'Team & Engineers' }).click();
  await expect(page.getByRole('heading', { name: 'Project team' })).toBeVisible();
  if (await page.getByRole('heading', { name: 'Assign engineer' }).count()) {
    await expect(page.getByRole('button', { name: 'Invite engineer' })).toBeVisible();
  } else {
    await expect(page.getByRole('button', { name: 'Invite engineer' })).toHaveCount(0);
  }

  await page.getByRole('button', { name: 'Milestones', exact: true }).click();
  const dependenciesButton = page
    .getByRole('button', { name: 'Dependencies', exact: true })
    .first();
  if (await dependenciesButton.count()) {
    await dependenciesButton.click();
    await expect(page.getByRole('dialog', { name: /Milestone dependencies/ })).toBeVisible();
    await expect(page.getByText('No prerequisite milestones.')).toBeVisible();
    await page
      .getByRole('dialog', { name: /Milestone dependencies/ })
      .getByRole('button', { name: 'Close' })
      .click();
  }

  await page.getByRole('button', { name: 'Timeline & Calendar' }).click();
  await expect(page.getByRole('heading', { name: 'Project timeline' }).first()).toBeVisible();
  await expect(page.getByLabel('Project deadline calendar')).toBeVisible();

  await page.getByRole('button', { name: 'Activity & Audit Logs' }).click();
  await expect(page.getByRole('heading', { name: 'Project activity' })).toBeVisible();
});

test('new-project wizard connects planning and multiple engineer invitations', async ({ page }) => {
  const invitations: Array<{ email: string; role: string }> = [];
  const planning: string[] = [];
  const reply = (data: unknown, meta?: unknown) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data, ...(meta ? { meta } : {}) }),
  });
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill(
      reply({
        user: {
          id: 'mock-admin',
          name: 'Admin',
          email: 'admin@example.test',
          roles: ['SUPER_ADMIN'],
          permissions: [
            'projects.read',
            'projects.create',
            'engineering.manage',
            'tasks.create',
            'milestones.create',
            'clients.read',
            'users.read',
          ],
          clientId: null,
          twoFactorEnabled: true,
          twoFactorRequired: true,
        },
      }),
    ),
  );
  await page.route('**/api/v1/clients?*', (route) =>
    route.fulfill(reply([], { page: 1, pageSize: 100, total: 0 })),
  );
  await page.route('**/api/v1/users?*', (route) =>
    route.fulfill(reply([], { page: 1, pageSize: 100, total: 0 })),
  );
  await page.route('**/api/v1/engineering/eligible-engineers?*', (route) =>
    route.fulfill(
      reply([
        {
          id: 'engineer-one',
          name: 'Engineer One',
          email: 'one@example.test',
          skills: [],
          specialization: 'Backend',
          availability: 'AVAILABLE',
          weeklyCapacityHours: 40,
          availableHoursThisWeek: 40,
          estimatedHoursThisWeek: 8,
          estimatedOpenHours: 8,
          overCapacity: false,
          nearCapacity: false,
        },
        {
          id: 'engineer-two',
          name: 'Engineer Two',
          email: 'two@example.test',
          skills: [],
          specialization: 'QA',
          availability: 'AVAILABLE',
          weeklyCapacityHours: 40,
          availableHoursThisWeek: 40,
          estimatedHoursThisWeek: 8,
          estimatedOpenHours: 8,
          overCapacity: false,
          nearCapacity: false,
        },
      ]),
    ),
  );
  await page.route('**/api/v1/projects', (route) =>
    route.fulfill(reply({ id: 'mock-project', name: 'Wizard project' })),
  );
  await page.route('**/api/v1/engineering/projects/mock-project/phases', (route) => {
    planning.push('phase');
    return route.fulfill(reply({ id: 'phase-one' }));
  });
  await page.route('**/api/v1/milestones', (route) => {
    planning.push('milestone');
    return route.fulfill(reply({ id: 'milestone-one' }));
  });
  await page.route('**/api/v1/tasks', (route) => {
    planning.push('task');
    return route.fulfill(reply({ id: 'task-one' }));
  });
  await page.route('**/api/v1/engineering/projects/mock-project/invitations', async (route) => {
    const body = route.request().postDataJSON() as { email: string; role: string };
    invitations.push({ email: body.email, role: body.role });
    await route.fulfill(reply({ id: `invitation-${invitations.length}`, status: 'PENDING' }));
  });

  await page.goto('/projects');
  await page.getByRole('button', { name: 'New project' }).click();
  const dialog = page.getByRole('dialog', { name: 'New project' });
  await dialog.getByLabel('Project name').fill('Wizard project');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.getByText('Step 2 of 4')).toBeVisible();
  await dialog.getByRole('checkbox').nth(0).check();
  await dialog.getByRole('checkbox').nth(1).check();
  await dialog.getByLabel('Project role for Engineer One').selectOption('LEAD_ENGINEER');
  await dialog.getByLabel('Assignment description').fill('Deliver the project');
  await dialog.getByLabel('Start date').fill('2026-10-16');
  await dialog.getByLabel('Expected end date').fill('2026-11-16');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.getByText('Step 3 of 4')).toBeVisible();
  for (const name of ['Phase', 'Milestone', 'Task']) {
    await dialog
      .getByRole('heading', { name, exact: true })
      .locator('..')
      .getByRole('button', { name: 'Add' })
      .click();
    await dialog.getByLabel(`${name} 1`).fill(`${name} one`);
  }
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByRole('button', { name: 'Create project' }).click();
  await expect(dialog.getByText(/Project created. Invitations are pending/)).toBeVisible();
  expect(planning).toEqual(['phase', 'milestone', 'task']);
  expect(invitations).toEqual([
    { email: 'one@example.test', role: 'LEAD_ENGINEER' },
    { email: 'two@example.test', role: 'ENGINEER' },
  ]);
});

test('existing project list opens assignment and sends a pending invitation', async ({ page }) => {
  const respond = (data: unknown) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data }),
  });
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill(
      respond({
        user: {
          id: 'mock-admin',
          name: 'Admin',
          email: 'admin@example.test',
          roles: ['SUPER_ADMIN'],
          permissions: ['projects.read', 'engineering.manage'],
          clientId: null,
          twoFactorEnabled: true,
          twoFactorRequired: true,
        },
      }),
    ),
  );
  await page.route('**/api/v1/projects/portfolio?*', (route) =>
    route.fulfill(
      respond({
        items: [
          {
            id: 'existing-project',
            name: 'Existing project',
            description: null,
            status: 'PLANNING',
            priority: 'MEDIUM',
            startDate: null,
            dueDate: null,
            budget: null,
            clientId: null,
            manager: null,
            createdAt: '2026-10-15T00:00:00Z',
            clientName: null,
            health: 'ON_TRACK',
            progress: null,
            taskCount: 0,
            overdueTasks: 0,
            assignedEngineers: 0,
            pendingInvitations: 0,
            assignmentStatus: 'UNASSIGNED',
          },
        ],
        page: 1,
        pageSize: 20,
        total: 1,
        filters: { managers: [], engineers: [], clients: [] },
        summary: {
          totalProjects: 1,
          activeProjects: 0,
          completedProjects: 0,
          planningProjects: 1,
          delayedProjects: 0,
          atRiskProjects: 0,
          assignedEngineers: 0,
          unassignedProjects: 1,
          projectsWithPendingInvitations: 0,
          projectsWithActiveTeams: 0,
          overdueTasks: 0,
          upcomingDeadlines: 0,
        },
      }),
    ),
  );
  await page.route('**/api/v1/engineering/projects/existing-project/members', (route) =>
    route.fulfill(respond([])),
  );
  await page.route('**/api/v1/engineering/projects/existing-project/invitations', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill(respond([]));
    const body = route.request().postDataJSON() as { email: string; role: string };
    expect(body).toMatchObject({ email: 'one@example.test', role: 'ENGINEER' });
    return route.fulfill(respond({ id: 'invitation-one', status: 'PENDING' }));
  });
  await page.route(
    '**/api/v1/engineering/projects/existing-project/eligible-engineers?*',
    (route) =>
      route.fulfill(
        respond([
          {
            id: 'engineer-one',
            name: 'Engineer One',
            email: 'one@example.test',
            skills: [],
            specialization: 'Backend',
            availability: 'AVAILABLE',
            weeklyCapacityHours: 40,
            availableHoursThisWeek: 40,
            estimatedHoursThisWeek: 8,
            estimatedOpenHours: 8,
            overCapacity: false,
            nearCapacity: false,
          },
        ]),
      ),
  );
  await page.goto('/projects');
  await page.getByRole('button', { name: /Unassigned projects/i }).click();
  await page.getByRole('button', { name: 'Assign engineer' }).click();
  const dialog = page.getByRole('dialog', { name: 'Assign engineers · Existing project' });
  await dialog.getByRole('checkbox').check();
  await dialog.getByLabel('Assignment description').fill('Complete this project');
  await dialog.getByLabel('Start date').fill('2026-10-16');
  await dialog.getByLabel('Expected end date').fill('2026-11-16');
  await dialog.getByRole('button', { name: 'Send invitations' }).click();
  await expect(dialog).toHaveCount(0);
});

test('new project can be created without engineers', async ({ page }) => {
  let invitations = 0;
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          user: {
            id: 'mock-admin',
            name: 'Admin',
            email: 'admin@example.test',
            roles: ['SUPER_ADMIN'],
            permissions: ['projects.read', 'projects.create', 'engineering.manage'],
            clientId: null,
            twoFactorEnabled: true,
            twoFactorRequired: true,
          },
        },
      }),
    }),
  );
  await page.route('**/api/v1/engineering/eligible-engineers?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );
  await page.route('**/api/v1/projects', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { id: 'project-without-engineers', name: 'Unassigned project' },
      }),
    }),
  );
  await page.route(
    '**/api/v1/engineering/projects/project-without-engineers/invitations',
    (route) => {
      invitations += 1;
      return route.fulfill({ status: 500 });
    },
  );
  await page.goto('/projects');
  await page.getByRole('button', { name: 'New project' }).click();
  const dialog = page.getByRole('dialog', { name: 'New project' });
  await dialog.getByLabel('Project name').fill('Unassigned project');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByRole('button', { name: 'Create project' }).click();
  await expect(dialog.getByText(/Project created without engineers/)).toBeVisible();
  expect(invitations).toBe(0);
});
