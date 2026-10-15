import { type ReactNode, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PERMISSIONS } from '@somwave/shared';
import { Button } from '../../components/ui/Button';
import { ErrorState, LoadingState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { DocumentationPage } from '../engineering/DocumentationPage';
import { EngineeringOperationsPage } from '../engineering/EngineeringOperationsPage';
import { TaskPlanningPage } from '../engineering/TaskPlanningPage';
import { MilestonesPage } from '../milestones/MilestonesPage';
import { TasksPage } from '../tasks/TasksPage';
import { ProjectFormModal } from './components/ProjectFormModal';
import { ProjectTeamPanel } from './components/ProjectTeamPanel';
import { ProjectBudgetPanel } from './components/ProjectBudgetPanel';
import { ProjectActivityPanel } from './components/ProjectActivityPanel';
import { ProjectCalendar, ProjectTimeline } from './components/ProjectTimeline';
import { ProjectWorkspaceView } from './components/ProjectWorkspaceView';
import { useProjectWorkspace } from './hooks';

const TABS = [
  ['overview', 'Overview'],
  ['team', 'Team & Engineers'],
  ['tasks', 'Tasks'],
  ['milestones', 'Milestones'],
  ['documentation', 'Documentation'],
  ['timeline', 'Timeline & Calendar'],
  ['budget', 'Budget & Expenses'],
  ['operations', 'Bugs & Maintenance'],
  ['activity', 'Activity & Audit Logs'],
  ['settings', 'Settings'],
] as const;
type ProjectTab = (typeof TABS)[number][0];

export function ProjectDetailPage(): ReactNode {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(false);
  const canReadFinance = useHasPermission(PERMISSIONS.INVOICES_READ);
  const canUpdate = useHasPermission(PERMISSIONS.PROJECTS_UPDATE);
  const query = useProjectWorkspace(id);

  if (!id) {
    return <ErrorState title="Project not found" />;
  }
  if (query.isLoading) {
    return <LoadingState rows={8} label="Loading project" />;
  }
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="Could not load project"
        description="Check that the project exists and you have access."
        onRetry={() => query.refetch()}
      />
    );
  }
  const tab = TABS.find(([key]) => key === params.get('tab'))?.[0] ?? 'overview';
  const project = query.data.project;
  const tabs = TABS.filter(
    ([key]) => (key !== 'budget' || canReadFinance) && (key !== 'settings' || canUpdate),
  );
  const changeTab = (next: ProjectTab) => setParams({ tab: next });

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/projects" className="text-sm font-medium text-brand hover:underline">
            ← Projects
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{project.name}</h1>
          <p className="text-sm text-muted">
            {project.description || 'Project management workspace'}
          </p>
        </div>
      </div>
      <nav
        aria-label="Project sections"
        className="flex gap-2 overflow-x-auto border-b border-border pb-2"
      >
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-current={tab === key ? 'page' : undefined}
            className={`shrink-0 rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${tab === key ? 'bg-brand text-white' : 'bg-surface text-ink hover:bg-surface-alt'}`}
            onClick={() => changeTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === 'overview' ? (
        <ProjectWorkspaceView data={query.data} backTo="/projects" backLabel="Projects" />
      ) : null}
      {tab === 'team' ? <ProjectTeamPanel projectId={project.id} /> : null}
      {tab === 'tasks' ? <TasksPage projectId={project.id} projectName={project.name} /> : null}
      {tab === 'milestones' ? (
        <MilestonesPage projectId={project.id} projectName={project.name} />
      ) : null}
      {tab === 'documentation' ? <DocumentationPage projectId={project.id} /> : null}
      {tab === 'timeline' ? (
        <div className="space-y-5">
          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="mb-4 text-lg font-semibold">Project timeline</h2>
            <ProjectTimeline
              project={project}
              tasks={query.data.tasks}
              milestones={query.data.milestones}
            />
          </div>
          <ProjectCalendar tasks={query.data.tasks} milestones={query.data.milestones} />
          <TaskPlanningPage projectId={project.id} />
        </div>
      ) : null}
      {tab === 'budget' && canReadFinance ? <ProjectBudgetPanel projectId={project.id} /> : null}
      {tab === 'operations' ? <EngineeringOperationsPage projectId={project.id} /> : null}
      {tab === 'activity' ? <ProjectActivityPanel projectId={project.id} /> : null}
      {tab === 'settings' && canUpdate ? (
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">Project settings</h2>
          <p className="mt-2 text-sm text-muted">
            Update the project name, status, and dates. Budget changes are recorded in Budget &
            Expenses.
          </p>
          <Button className="mt-4" onClick={() => setEditing(true)}>
            Edit project
          </Button>
          <ProjectFormModal open={editing} onClose={() => setEditing(false)} project={project} />
        </section>
      ) : null}
    </section>
  );
}
