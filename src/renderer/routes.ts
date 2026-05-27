/**
 * URL Route Map — AgentOps Desktop
 *
 * Defines every in-app route for the renderer (React Router).
 * Maps old/deprecated paths to their canonical equivalents.
 * Used by the router config and any deep-link / command-palette resolver.
 */

export interface RouteEntry {
  /** Canonical path pattern (React Router format) */
  path: string;
  /** Human-readable label (sidebar / breadcrumb) */
  label: string;
  /** Component key for lazy loading */
  component: string;
  /** Old paths that should redirect here */
  aliases: string[];
  /** Whether this route appears in sidebar navigation */
  nav: boolean;
  /** Icon name (Lucide) */
  icon?: string;
}

const routes: RouteEntry[] = [
  {
    path: '/',
    label: 'Dashboard',
    component: 'DashboardPage',
    aliases: ['/home', '/overview', '/dashboard'],
    nav: true,
    icon: 'LayoutDashboard',
  },
  {
    path: '/agents',
    label: 'Agents',
    component: 'AgentsPage',
    aliases: ['/agent', '/workers'],
    nav: true,
    icon: 'Bot',
  },
  {
    path: '/agents/:agentId',
    label: 'Agent Detail',
    component: 'AgentDetailPage',
    aliases: ['/agent/:agentId', '/workers/:agentId'],
    nav: false,
  },
  {
    path: '/tasks',
    label: 'Tasks',
    component: 'TasksPage',
    aliases: ['/task', '/issues', '/work'],
    nav: true,
    icon: 'CheckSquare',
  },
  {
    path: '/tasks/:taskId',
    label: 'Task Detail',
    component: 'TaskDetailPage',
    aliases: ['/task/:taskId', '/issues/:taskId'],
    nav: false,
  },
  {
    path: '/logs',
    label: 'Logs',
    component: 'LogsPage',
    aliases: ['/log', '/terminal', '/console', '/output'],
    nav: true,
    icon: 'Terminal',
  },
  {
    path: '/settings',
    label: 'Settings',
    component: 'SettingsPage',
    aliases: ['/config', '/preferences', '/settings/general'],
    nav: true,
    icon: 'Settings',
  },
  {
    path: '/settings/agents',
    label: 'Agent Settings',
    component: 'AgentSettingsPage',
    aliases: ['/settings/agent-config'],
    nav: false,
  },
  {
    path: '/settings/governance',
    label: 'Governance',
    component: 'GovernanceSettingsPage',
    aliases: ['/settings/approvals', '/settings/policies'],
    nav: false,
  },
  {
    path: '/workflows',
    label: 'Workflows',
    component: 'WorkflowsPage',
    aliases: ['/workflow', '/pipelines', '/pipeline'],
    nav: true,
    icon: 'GitBranch',
  },
  {
    path: '/workflows/:workflowId',
    label: 'Workflow Detail',
    component: 'WorkflowDetailPage',
    aliases: ['/workflow/:workflowId', '/pipelines/:workflowId'],
    nav: false,
  },
];

export default routes;

/**
 * Build a redirect map: old path → canonical path.
 * Useful for router <Redirect> entries or a global catch-all.
 */
export function buildRedirectMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const route of routes) {
    for (const alias of route.aliases) {
      map[alias] = route.path;
    }
  }
  return map;
}
