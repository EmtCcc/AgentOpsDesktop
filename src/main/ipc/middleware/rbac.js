'use strict';

/**
 * Role-Based Access Control (RBAC) definitions.
 *
 * Roles (hierarchical — higher inherits all lower permissions):
 *   admin   — full access to all resources and operations
 *   operator — can manage agents, tasks, goals; cannot manage system settings
 *   viewer  — read-only access to all resources
 *
 * Permissions are dot-scoped strings: "resource:action"
 * Wildcard "*" matches any action on a resource.
 */

const ROLES = Object.freeze({
  ADMIN: 'admin',
  OPERATOR: 'operator',
  VIEWER: 'viewer',
});

/** Ordered list of valid roles (highest privilege first). */
const ROLE_LIST = Object.freeze([ROLES.ADMIN, ROLES.OPERATOR, ROLES.VIEWER]);

/**
 * Permission map: role → Set of permission strings.
 *
 * Format: "resource:*" (all actions) or "resource:action" (specific).
 * Admin has "*" (superuser wildcard) — authorize() treats it as allow-all.
 */
const PERMISSIONS = Object.freeze({
  [ROLES.ADMIN]: new Set(['*']),
  [ROLES.OPERATOR]: new Set([
    'agents:*',
    'goals:*',
    'tasks:*',
    'orchestrator:*',
    'logs:*',
    'stats:*',
    'skills:*',
    'auth:logout',
    'auth:rotate',
  ]),
  [ROLES.VIEWER]: new Set([
    'agents:list',
    'agents:get',
    'agents:health-check',
    'agents:status',
    'goals:list',
    'goals:get',
    'tasks:list',
    'tasks:get',
    'orchestrator:list',
    'orchestrator:get',
    'orchestrator:progress',
    'logs:list',
    'stats:summary',
    'skills:list',
    'skills:get',
    'skills:listTags',
    'auth:logout',
    'auth:rotate',
  ]),
});

/**
 * Check if a role has a specific permission.
 *
 * @param {string} role - The role to check
 * @param {string} permission - The permission string (e.g. "agents:create")
 * @returns {boolean}
 */
function hasPermission(role, permission) {
  const perms = PERMISSIONS[role];
  if (!perms) return false;
  if (perms.has('*')) return true;

  // Check exact match first
  if (perms.has(permission)) return true;

  // Check wildcard match (e.g. "agents:*" covers "agents:create")
  const [resource] = permission.split(':');
  return perms.has(`${resource}:*`);
}

/**
 * Validate that a string is a known role.
 *
 * @param {string} role
 * @returns {boolean}
 */
function isValidRole(role) {
  return ROLE_LIST.includes(role);
}

module.exports = { ROLES, ROLE_LIST, PERMISSIONS, hasPermission, isValidRole };
