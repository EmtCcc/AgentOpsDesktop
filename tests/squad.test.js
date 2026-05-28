'use strict';

const assert = require('assert');
const fs = require('fs');

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

  it('SquadRepository has all required methods', () => {
    const code = fs.readFileSync('./src/main/repositories/squad.repository.js', 'utf8');
    const required = ['create', 'getById', 'getSquadWithMembers', 'update', 'delete',
      'list', 'listWithMembers', 'addMember', 'removeMember', 'updateMemberRole',
      'listMembers', 'listSquadsForAgent'];
    for (const m of required) {
      assert.ok(code.includes(m), `Method ${m} present in SquadRepository`);
    }
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
    assert.ok(code.includes('loadSquads'), 'loadSquads function exists');
    assert.ok(code.includes('bindSquadActions'), 'bindSquadActions function exists');
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
});
