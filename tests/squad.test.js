'use strict';

import { describe, it } from 'vitest';
import assert from 'assert';
import fs from 'fs';

// ── Structural validation (no native modules needed) ──

describe('Squad Implementation', () => {
  it('migration v12 defines squads and squad_members tables', () => {
    const { migrations } = require('../src/main/db/schema');
    const v12 = migrations.find(m => m.version === 12);
    assert.ok(v12, 'Migration v12 exists');
    assert.strictEqual(v12.name, 'create_squads');
    assert.ok(v12.up.includes('CREATE TABLE IF NOT EXISTS squads'));
    assert.ok(v12.up.includes('CREATE TABLE IF NOT EXISTS squad_members'));
    assert.ok(v12.up.includes('PRIMARY KEY (squad_id, agent_id)'));
  });

  it('migration v19 adds instructions column to squads', () => {
    const { migrations } = require('../src/main/db/schema');
    const v19 = migrations.find(m => m.version === 19);
    assert.ok(v19, 'Migration v19 exists');
    assert.strictEqual(v19.name, 'add_squad_instructions');
    assert.ok(v19.up.includes('ALTER TABLE squads ADD COLUMN instructions TEXT'));
  });

  it('SquadRepository has all required methods', () => {
    const code = fs.readFileSync('./src/main/repositories/squad.repository.js', 'utf8');
    const required = ['create', 'getById', 'getSquadWithMembers', 'update', 'delete',
      'list', 'listWithMembers', 'addMember', 'removeMember', 'updateMemberRole',
      'listMembers', 'listSquadsForAgent'];
    for (const m of required) {
      assert.ok(code.includes(m), `Method ${m} present in SquadRepository`);
    }
  });

  it('SquadRepository maps instructions field', () => {
    const code = fs.readFileSync('./src/main/repositories/squad.repository.js', 'utf8');
    assert.ok(code.includes('instructions'), 'instructions in repository');
    assert.ok(code.includes('row.instructions'), 'maps instructions from DB row');
    assert.ok(code.includes('squad.instructions'), 'maps instructions to DB params');
  });

  it('squad controller has all required methods', () => {
    const code = fs.readFileSync('./src/main/ipc/controllers/squad.controller.js', 'utf8');
    const required = ['list', 'get', 'create', 'update', 'delete',
      'addMember', 'removeMember', 'listMembers', 'batchStart', 'batchStop', 'getAggregatedStatus'];
    for (const m of required) {
      assert.ok(code.includes(`async ${m}(`), `Method ${m} present in squad controller`);
    }
  });

  it('API routes define all squad endpoints', () => {
    const code = fs.readFileSync('./src/main/api/routes/squads.js', 'utf8');
    assert.ok(code.includes("get('/'"), 'GET / route');
    assert.ok(code.includes("get('/:id'"), 'GET /:id route');
    assert.ok(code.includes("post('/'"), 'POST / route');
    assert.ok(code.includes("patch('/:id'"), 'PATCH /:id route');
    assert.ok(code.includes("delete('/:id'"), 'DELETE /:id route');
    assert.ok(code.includes("post('/:id/members'"), 'POST /:id/members route');
    assert.ok(code.includes("delete('/:id/members/:agentId'"), 'DELETE member route');
    assert.ok(code.includes("get('/:id/status'"), 'GET /:id/status route');
    assert.ok(code.includes("post('/:id/start'"), 'POST /:id/start route');
    assert.ok(code.includes("post('/:id/stop'"), 'POST /:id/stop route');
  });

  it('preload exposes squads bridge', () => {
    const code = fs.readFileSync('./src/main/preload.js', 'utf8');
    assert.ok(code.includes('squads:'), 'squads bridge exists');
    assert.ok(code.includes("squads:list"), 'squads:list channel');
    assert.ok(code.includes("squads:create"), 'squads:create channel');
    assert.ok(code.includes("squads:batchStart"), 'squads:batchStart channel');
    assert.ok(code.includes("squads:aggregatedStatus"), 'squads:aggregatedStatus channel');
  });

  it('renderer has squads page', () => {
    const code = fs.readFileSync('./src/renderer/app.js', 'utf8');
    assert.ok(code.includes('renderSquads'), 'renderSquads function exists');
    assert.ok(code.includes('squads: renderSquads'), 'squads registered in renderers map');
    assert.ok(code.includes('mountSquadsPage'), 'React mount function imported');
  });

  it('SquadsPage.jsx exports mount function', () => {
    const code = fs.readFileSync('./src/renderer/pages/SquadsPage.jsx', 'utf8');
    assert.ok(code.includes('export default function SquadsPage'), 'default export');
    assert.ok(code.includes('export function mountSquadsPage'), 'mountSquadsPage export');
    assert.ok(code.includes('SquadCard'), 'SquadCard component');
    assert.ok(code.includes('CreateSquadModal'), 'CreateSquadModal component');
  });

  it('sidebar has squads nav item', () => {
    const code = fs.readFileSync('./src/renderer/index.html', 'utf8');
    assert.ok(code.includes('data-page="squads"'), 'squads sidebar nav item');
  });

  it('repositories/index.js exports SquadRepository', () => {
    const code = fs.readFileSync('./src/main/repositories/index.js', 'utf8');
    assert.ok(code.includes("require('./squad.repository')"), 'imports SquadRepository');
    assert.ok(code.includes('squads: new SquadRepository(db)'), 'creates squads instance');
  });

  it('ipc/index.js registers all squad channels', () => {
    const code = fs.readFileSync('./src/main/ipc/index.js', 'utf8');
    const channels = ['squads:list', 'squads:get', 'squads:create', 'squads:update',
      'squads:delete', 'squads:addMember', 'squads:removeMember', 'squads:listMembers',
      'squads:batchStart', 'squads:batchStop', 'squads:aggregatedStatus'];
    for (const ch of channels) {
      assert.ok(code.includes(`'${ch}'`), `Channel ${ch} registered`);
    }
  });

  it('api/app.js mounts squads route', () => {
    const code = fs.readFileSync('./src/main/api/app.js', 'utf8');
    assert.ok(code.includes("require('./routes/squads')"), 'imports squads routes');
    assert.ok(code.includes("app.route('/api/squads', squads)"), 'mounts /api/squads');
  });

  it('migration v22 adds trigger_rules column to squads', () => {
    const { migrations } = require('../src/main/db/schema');
    const v22 = migrations.find(m => m.version === 22);
    assert.ok(v22, 'Migration v22 exists');
    assert.strictEqual(v22.name, 'add_squad_trigger_rules');
    assert.ok(v22.up.includes('ALTER TABLE squads ADD COLUMN trigger_rules'));
  });

  it('SquadRepository maps triggerRules field', () => {
    const code = fs.readFileSync('./src/main/repositories/squad.repository.js', 'utf8');
    assert.ok(code.includes('DEFAULT_TRIGGER_RULES'), 'DEFAULT_TRIGGER_RULES defined');
    assert.ok(code.includes('triggerRules'), 'triggerRules in repository');
    assert.ok(code.includes('row.trigger_rules'), 'maps trigger_rules from DB row');
    assert.ok(code.includes('JSON.stringify(squad.triggerRules)'), 'serializes triggerRules to JSON');
  });

  it('squad controller has trigger rule methods', () => {
    const code = fs.readFileSync('./src/main/ipc/controllers/squad.controller.js', 'utf8');
    assert.ok(code.includes('async evaluateTriggerRule('), 'evaluateTriggerRule method');
    assert.ok(code.includes('async applyTriggerRule('), 'applyTriggerRule method');
  });

  it('ipc/index.js registers trigger rule channels', () => {
    const code = fs.readFileSync('./src/main/ipc/index.js', 'utf8');
    assert.ok(code.includes("squads:evaluateTriggerRule"), 'evaluateTriggerRule channel');
    assert.ok(code.includes("squads:applyTriggerRule"), 'applyTriggerRule channel');
  });

  it('preload exposes trigger rule bridge methods', () => {
    const code = fs.readFileSync('./src/main/preload.js', 'utf8');
    assert.ok(code.includes('evaluateTriggerRule'), 'evaluateTriggerRule in preload');
    assert.ok(code.includes('applyTriggerRule'), 'applyTriggerRule in preload');
  });

  it('task orchestrator resolves leader for squad tasks', () => {
    const code = fs.readFileSync('./src/main/task-orchestrator.js', 'utf8');
    assert.ok(code.includes("m.role === 'leader'"), 'finds leader by role');
    assert.ok(code.includes('_squadRoster'), 'injects squad roster');
    assert.ok(code.includes('_squadInstructions'), 'injects squad instructions');
    assert.ok(code.includes("role: 'leader'"), 'emits role in squad-resolved event');
  });

  it('agent runtime injects roster env vars', () => {
    const code = fs.readFileSync('./src/main/agent-runtime.js', 'utf8');
    assert.ok(code.includes('AGENT_ROSTER'), 'AGENT_ROSTER env injection');
    assert.ok(code.includes('AGENT_ROLE'), 'AGENT_ROLE env injection');
    assert.ok(code.includes("env.AGENT_ROLE = 'leader'"), 'sets role to leader');
  });

  it('socket server returns role and roster in handshake', () => {
    const code = fs.readFileSync('./src/main/message-bus/socket-server.js', 'utf8');
    assert.ok(code.includes('state.role = role'), 'stores role in state');
    assert.ok(code.includes("role === 'leader'"), 'checks leader role for roster');
    assert.ok(code.includes('response.roster = roster'), 'includes roster in response');
  });

  it('socket client stores role and roster from handshake', () => {
    const code = fs.readFileSync('./src/main/message-bus/socket-client.js', 'utf8');
    assert.ok(code.includes('this._role'), 'stores role');
    assert.ok(code.includes('this._roster'), 'stores roster');
    assert.ok(code.includes('delegate('), 'delegate method for leader');
  });

  it('DEFAULT_TRIGGER_RULES includes overload_threshold', () => {
    const { DEFAULT_TRIGGER_RULES } = require('../src/main/repositories/squad.repository');
    assert.strictEqual(typeof DEFAULT_TRIGGER_RULES.overload_threshold, 'number');
    assert.ok(DEFAULT_TRIGGER_RULES.overload_threshold > 0, 'threshold must be positive');
  });

  it('SquadRepository has load-balancing methods', () => {
    const code = fs.readFileSync('./src/main/repositories/squad.repository.js', 'utf8');
    assert.ok(code.includes('getMemberWorkloads('), 'getMemberWorkloads method');
    assert.ok(code.includes('isAgentOverloaded('), 'isAgentOverloaded method');
  });

  it('resolveWildcardAgent filters overloaded agents', () => {
    const code = fs.readFileSync('./src/main/repositories/squad.repository.js', 'utf8');
    assert.ok(code.includes('a.workload < threshold'), 'filters by overload threshold in resolveWildcardAgent');
  });

  it('orchestrator checks overload before delegation spawn', () => {
    const code = fs.readFileSync('./src/main/task-orchestrator.js', 'utf8');
    assert.ok(code.includes('isAgentOverloaded'), 'orchestrator calls isAgentOverloaded');
    assert.ok(code.includes('orchestrator.delegation-overloaded'), 'logs overloaded delegation');
  });

  it('socket server delegateToRole uses resolveWildcardAgent (inherits overload filter)', () => {
    const code = fs.readFileSync('./src/main/message-bus/socket-server.js', 'utf8');
    assert.ok(code.includes('resolveWildcardAgent'), 'socket server uses resolveWildcardAgent');
  });

  // ── Dynamic Member Discovery (CMPAAA-543) ──

  it('migration v25 widens squad_members role constraint', () => {
    const { migrations } = require('../src/main/db/schema');
    const v25 = migrations.find(m => m.version === 25);
    assert.ok(v25, 'Migration v25 exists');
    assert.strictEqual(v25.name, 'widen_squad_member_roles');
    assert.ok(v25.up.includes('squad_members_new'), 'creates new table without CHECK constraint');
    assert.ok(v25.up.includes('INSERT INTO squad_members_new'), 'migrates data');
  });

  it('SquadRepository has wildcard discovery methods', () => {
    const code = fs.readFileSync('./src/main/repositories/squad.repository.js', 'utf8');
    assert.ok(code.includes('getWildcardMembers'), 'getWildcardMembers method');
    assert.ok(code.includes("m.agentId === '*'"), 'filters wildcard members');
    assert.ok(code.includes('resolveWildcardAgent'), 'resolveWildcardAgent method');
    assert.ok(code.includes('expandRoster'), 'expandRoster method');
    assert.ok(code.includes('getIdleAgentsByWorkload'), 'uses getIdleAgentsByWorkload for resolution');
  });

  it('socket server accepts agentRepo option for wildcard resolution', () => {
    const code = fs.readFileSync('./src/main/message-bus/socket-server.js', 'utf8');
    assert.ok(code.includes('opts.agentRepo'), 'accepts agentRepo option');
    assert.ok(code.includes('this._agentRepo'), 'stores agentRepo');
    assert.ok(code.includes("m.agentId === '*'"), 'checks wildcard members in handshake');
    assert.ok(code.includes('ownerRole'), 'matches agent ownerRole for wildcard');
  });

  it('socket server handles delegateToRole message type', () => {
    const code = fs.readFileSync('./src/main/message-bus/socket-server.js', 'utf8');
    assert.ok(code.includes("'delegateToRole'"), 'handles delegateToRole message type');
    assert.ok(code.includes('_handleDelegateToRole'), 'has _handleDelegateToRole method');
    assert.ok(code.includes('resolveWildcardAgent'), 'resolves wildcard to concrete agent');
    assert.ok(code.includes('delegateToRole_ok'), 'returns delegateToRole_ok response');
    assert.ok(code.includes('delegateToRole_error'), 'returns delegateToRole_error response');
  });

  it('socket client has delegateToRole method', () => {
    const code = fs.readFileSync('./src/main/message-bus/socket-client.js', 'utf8');
    assert.ok(code.includes('delegateToRole('), 'delegateToRole method exists');
    assert.ok(code.includes('targetRole'), 'sends targetRole parameter');
    assert.ok(code.includes('delegateToRole_ok'), 'handles delegateToRole_ok response');
    assert.ok(code.includes('delegateToRole_error'), 'handles delegateToRole_error response');
  });

  it('task orchestrator handles targetRole in delegation', () => {
    const code = fs.readFileSync('./src/main/task-orchestrator.js', 'utf8');
    assert.ok(code.includes('targetRole'), 'extracts targetRole from delegation payload');
    assert.ok(code.includes('resolveWildcardAgent'), 'resolves wildcard agent for role');
    assert.ok(code.includes('delegation-role-unresolved'), 'logs when role cannot be resolved');
    assert.ok(code.includes('resolvedAgentId'), 'uses resolved agent ID for spawning');
  });
});
