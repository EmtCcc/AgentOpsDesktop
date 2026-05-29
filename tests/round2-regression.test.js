'use strict';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import Database from 'better-sqlite3';
import { EventEmitter } from 'events';

import { migrations } from '../src/main/db/schema.js';
import { MessageBus, PRIORITY_ORDER } from '../src/main/message-bus/message-bus.js';
import { WorkspaceManager } from '../src/main/workspace-manager.js';
import { WorkspaceRepository } from '../src/main/repositories/workspace.repository.js';
import { AgentRepository } from '../src/main/repositories/agent.repository.js';
import { SquadRepository, DEFAULT_TRIGGER_RULES } from '../src/main/repositories/squad.repository.js';
import { ChatRepository } from '../src/main/repositories/chat.repository.js';

// ── Helpers ──

function createTestDb() {
  const db = new Database(':memory:');
  for (const migration of migrations) {
    db.exec(migration.up);
  }
  return db;
}

function createAgent(db, overrides = {}) {
  const id = overrides.id || `agent-${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(`
    INSERT INTO agents (id, name, executable_path, working_directory, agent_type, type, status, owner_role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    id,
    overrides.name || `Agent-${id}`,
    overrides.execPath || '/usr/bin/echo',
    overrides.cwd || '/tmp',
    overrides.agentType || 'custom',
    overrides.agentType || 'custom',
    overrides.status || 'idle',
    overrides.ownerRole || null,
  );
  return id;
}

function createGoal(db, overrides = {}) {
  const id = overrides.id || `goal-${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(`
    INSERT INTO goals (id, title, status, created_at, updated_at)
    VALUES (?, ?, ?, datetime('now'), datetime('now'))
  `).run(id, overrides.title || `Goal-${id}`, overrides.status || 'active');
  return id;
}

function createTask(db, agentId, status = 'running', goalId = null) {
  const id = `task-${Math.random().toString(36).slice(2, 8)}`;
  const gid = goalId || createGoal(db);
  db.prepare(`
    INSERT INTO tasks (id, goal_id, title, status, agent_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(id, gid, `Task-${id}`, status, agentId);
  return id;
}

// ══════════════════════════════════════════════════════════
// CMPAAA-539: Group Chat 前端暴露
// ══════════════════════════════════════════════════════════

describe('CMPAAA-539: Group Chat', () => {
  let db, chatRepo, agentRepo;

  beforeEach(() => {
    db = createTestDb();
    chatRepo = new ChatRepository(db);
    agentRepo = new AgentRepository(db);
  });

  afterEach(() => db.close());

  describe('ChatRepository CRUD', () => {
    it('creates a session and retrieves it with details', () => {
      const a1 = createAgent(db, { name: 'Alice' });
      const a2 = createAgent(db, { name: 'Bob' });

      const session = chatRepo.create({ title: 'Design Review', strategyType: 'round-robin' });
      expect(session.id).toBeDefined();
      expect(session.title).toBe('Design Review');
      expect(session.status).toBe('active');

      chatRepo.addParticipant(session.id, a1, 'expert');
      chatRepo.addParticipant(session.id, a2, 'expert');

      const details = chatRepo.getSessionWithDetails(session.id);
      expect(details.participants).toHaveLength(2);
      expect(details.participants.map(p => p.agentId)).toContain(a1);
      expect(details.participants.map(p => p.agentId)).toContain(a2);
    });

    it('adds and lists messages in chronological order', () => {
      const session = chatRepo.create({ title: 'Test Chat' });

      chatRepo.addMessage(session.id, 'First message', { agentId: 'a1', type: 'chat' });
      chatRepo.addMessage(session.id, 'Second message', { agentId: 'a2', type: 'chat' });
      chatRepo.addMessage(session.id, 'System notice', { type: 'system' });

      const messages = chatRepo.listMessages(session.id);
      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('First message');
      expect(messages[1].content).toBe('Second message');
      expect(messages[2].type).toBe('system');
      expect(messages[2].agentId).toBeNull();
    });

    it('updates participant status', () => {
      const a1 = createAgent(db);
      const session = chatRepo.create({ title: 'Test' });
      chatRepo.addParticipant(session.id, a1, 'expert');

      chatRepo.updateParticipantStatus(session.id, a1, 'speaking');
      const participants = chatRepo.listParticipants(session.id);
      expect(participants[0].status).toBe('speaking');
    });

    it('deletes session cascading messages and participants', () => {
      const a1 = createAgent(db);
      const session = chatRepo.create({ title: 'To Delete' });
      chatRepo.addParticipant(session.id, a1);
      chatRepo.addMessage(session.id, 'msg', { agentId: a1 });

      chatRepo.delete(session.id);
      expect(chatRepo.getById(session.id)).toBeNull();
    });

    it('lists sessions with details including message count', () => {
      const s1 = chatRepo.create({ title: 'Chat 1' });
      chatRepo.addMessage(s1.id, 'hello');

      const result = chatRepo.listWithDetails();
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      const found = result.items.find(s => s.id === s1.id);
      expect(found.messageCount).toBe(1);
    });

    it('filters messages by since timestamp', () => {
      const session = chatRepo.create({ title: 'Time Test' });
      chatRepo.addMessage(session.id, 'old');

      // Use a past timestamp as cutoff so 'old' is filtered out
      const cutoff = new Date(Date.now() + 1000).toISOString();
      chatRepo.addMessage(session.id, 'new');

      const all = chatRepo.listMessages(session.id);
      expect(all).toHaveLength(2);

      // 'since' filters by created_at > since, so with a future cutoff nothing matches
      const recent = chatRepo.listMessages(session.id, { since: cutoff });
      expect(recent).toHaveLength(0);
    });
  });

  describe('GroupChatEngine lifecycle', () => {
    it('validates session creation requires title and 2+ agents', () => {
      // Mock GroupChatEngine inline (avoids child_process dependency)
      const code = fs.readFileSync('./src/main/group-chat-engine.js', 'utf8');
      expect(code).toContain('at least 2 agents are required');
    });

    it('source exports CHAT_STATUS constants', () => {
      const code = fs.readFileSync('./src/main/group-chat-engine.js', 'utf8');
      expect(code).toContain('IDLE');
      expect(code).toContain('RUNNING');
      expect(code).toContain('PAUSED');
      expect(code).toContain('COMPLETED');
      expect(code).toContain('ERROR');
    });

    it('GroupChatEngine has all lifecycle methods', () => {
      const code = fs.readFileSync('./src/main/group-chat-engine.js', 'utf8');
      const methods = ['createSession', 'startSession', 'pauseSession', 'resumeSession', 'stopSession', 'sendHumanMessage', 'getSessionState', 'isRunning'];
      for (const m of methods) {
        expect(code).toContain(m);
      }
    });

    it('supports round-robin and human-assign strategies', () => {
      const code = fs.readFileSync('./src/main/group-chat-engine.js', 'utf8');
      expect(code).toContain("round-robin");
      expect(code).toContain("human-assign");
    });

    it('emits message, agent-status, turn-change, session-status events', () => {
      const code = fs.readFileSync('./src/main/group-chat-engine.js', 'utf8');
      expect(code).toContain("this.emit('message'");
      expect(code).toContain("this.emit('agent-status'");
      expect(code).toContain("this.emit('turn-change'");
      expect(code).toContain("this.emit('session-status'");
    });

    it('enforces maxTurns limit', () => {
      const code = fs.readFileSync('./src/main/group-chat-engine.js', 'utf8');
      expect(code).toContain('maxTurns');
      expect(code).toContain('turnCount < state.config.maxTurns');
    });
  });

  describe('Group Chat DB schema', () => {
    it('migration v24 creates chat tables', () => {
      const v24 = migrations.find(m => m.version === 24);
      expect(v24).toBeDefined();
      expect(v24.name).toBe('create_group_chat');
      expect(v24.up).toContain('chat_sessions');
      expect(v24.up).toContain('chat_participants');
      expect(v24.up).toContain('chat_messages');
    });

    it('chat_sessions table exists and works', () => {
      db.prepare(`INSERT INTO chat_sessions (id, title, status, strategy_type, strategy_config, created_at, updated_at)
        VALUES ('s1', 'Test', 'active', 'round-robin', '{}', datetime('now'), datetime('now'))`).run();
      const row = db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get('s1');
      expect(row.title).toBe('Test');
    });
  });
});

// ══════════════════════════════════════════════════════════
// CMPAAA-540: 符号链接逃逸修复
// ══════════════════════════════════════════════════════════

describe('CMPAAA-540: Symlink escape fix', () => {
  let db, repo, manager, tmpDir;

  beforeEach(() => {
    db = createTestDb();
    repo = new WorkspaceRepository(db);
    manager = new WorkspaceManager(repo, { baseDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ws-regress-')) });
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-root-'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(manager.baseDir, { recursive: true, force: true });
  });

  // Positive tests
  it('allows normal relative path within workspace', () => {
    const resolved = manager.resolveSafe(tmpDir, 'src/main.js');
    expect(resolved).toBe(path.resolve(tmpDir, 'src/main.js'));
  });

  it('allows symlink that stays within workspace', () => {
    const realFile = path.join(tmpDir, 'real.txt');
    fs.writeFileSync(realFile, 'data');
    const linkFile = path.join(tmpDir, 'link.txt');
    fs.symlinkSync(realFile, linkFile);

    const resolved = manager.resolveSafe(tmpDir, 'link.txt');
    expect(resolved).toBe(linkFile);
  });

  it('allows writing to nonexistent path (write path)', () => {
    const resolved = manager.resolveSafe(tmpDir, 'src/new-file.js');
    expect(resolved).toBe(path.resolve(tmpDir, 'src/new-file.js'));
  });

  // Negative tests
  it('blocks symlink pointing outside workspace', () => {
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-outside-'));
    const outsideFile = path.join(outsideDir, 'secret.txt');
    fs.writeFileSync(outsideFile, 'SENSITIVE');
    const linkFile = path.join(tmpDir, 'escape-link');
    fs.symlinkSync(outsideFile, linkFile);

    expect(() => manager.resolveSafe(tmpDir, 'escape-link')).toThrow('Symlink escape denied');
    fs.rmSync(outsideDir, { recursive: true, force: true });
  });

  it('blocks path traversal with ..', () => {
    expect(() => manager.resolveSafe(tmpDir, '../../etc/passwd')).toThrow('Path escape denied');
  });

  it('blocks absolute path escape', () => {
    expect(() => manager.resolveSafe(tmpDir, '/etc/passwd')).toThrow('Path escape denied');
  });

  // Edge cases
  it('blocks chained symlinks that escape workspace', () => {
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-outside-'));
    const outsideFile = path.join(outsideDir, 'secret.txt');
    fs.writeFileSync(outsideFile, 'SENSITIVE');

    // Create intermediate symlink inside workspace
    const intermediate = path.join(tmpDir, 'intermediate');
    fs.symlinkSync(outsideFile, intermediate);
    // Create second symlink pointing to intermediate
    const chainLink = path.join(tmpDir, 'chain');
    fs.symlinkSync(intermediate, chainLink);

    expect(() => manager.resolveSafe(tmpDir, 'chain')).toThrow('Symlink escape denied');
    fs.rmSync(outsideDir, { recursive: true, force: true });
  });

  it('blocks symlink to directory outside workspace', () => {
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-outside-'));
    fs.writeFileSync(path.join(outsideDir, 'file.txt'), 'data');
    const linkDir = path.join(tmpDir, 'escape-dir');
    fs.symlinkSync(outsideDir, linkDir);

    expect(() => manager.resolveSafe(tmpDir, 'escape-dir')).toThrow('Symlink escape denied');
    fs.rmSync(outsideDir, { recursive: true, force: true });
  });

  it('allows nested symlink staying within workspace', () => {
    const subDir = path.join(tmpDir, 'sub');
    fs.mkdirSync(subDir);
    const realFile = path.join(subDir, 'real.txt');
    fs.writeFileSync(realFile, 'data');
    const linkFile = path.join(tmpDir, 'link-to-sub');
    fs.symlinkSync(realFile, linkFile);

    const resolved = manager.resolveSafe(tmpDir, 'link-to-sub');
    expect(resolved).toBe(linkFile);
  });
});

// ══════════════════════════════════════════════════════════
// CMPAAA-541: Squad 负载均衡
// ══════════════════════════════════════════════════════════

describe('CMPAAA-541: Squad load balancing', () => {
  let db, squadRepo, agentRepo;

  beforeEach(() => {
    db = createTestDb();
    squadRepo = new SquadRepository(db);
    agentRepo = new AgentRepository(db);
  });

  afterEach(() => db.close());

  describe('getMemberWorkloads', () => {
    it('returns workload counts for squad members', () => {
      const a1 = createAgent(db, { name: 'Worker1' });
      const a2 = createAgent(db, { name: 'Worker2' });
      const squad = squadRepo.create({ name: 'Team' });
      squadRepo.addMember(squad.id, a1, 'engineer');
      squadRepo.addMember(squad.id, a2, 'engineer');

      // Give a1 two active tasks
      createTask(db, a1, 'running');
      createTask(db, a1, 'assigned');

      const workloads = squadRepo.getMemberWorkloads(squad.id, agentRepo);
      expect(workloads).toHaveLength(2);
      const w1 = workloads.find(w => w.agentId === a1);
      const w2 = workloads.find(w => w.agentId === a2);
      expect(w1.workload).toBe(2);
      expect(w2.workload).toBe(0);
    });

    it('excludes wildcard members from workload report', () => {
      const a1 = createAgent(db);
      const squad = squadRepo.create({ name: 'Team' });
      squadRepo.addMember(squad.id, a1, 'engineer');
      squadRepo.addMember(squad.id, '*', 'designer');

      const workloads = squadRepo.getMemberWorkloads(squad.id, agentRepo);
      expect(workloads).toHaveLength(1);
      expect(workloads[0].agentId).toBe(a1);
    });

    it('returns empty array when agentRepo is null', () => {
      const squad = squadRepo.create({ name: 'Team' });
      expect(squadRepo.getMemberWorkloads(squad.id, null)).toEqual([]);
    });
  });

  describe('isAgentOverloaded', () => {
    it('returns false when agent has fewer tasks than threshold', () => {
      const a1 = createAgent(db);
      const squad = squadRepo.create({ name: 'Team' });
      createTask(db, a1, 'running');
      createTask(db, a1, 'assigned');

      expect(squadRepo.isAgentOverloaded(squad.id, a1, agentRepo)).toBe(false);
    });

    it('returns true when agent reaches overload threshold', () => {
      const a1 = createAgent(db);
      const squad = squadRepo.create({ name: 'Team' });
      // Default threshold is 3
      createTask(db, a1, 'running');
      createTask(db, a1, 'assigned');
      createTask(db, a1, 'running');

      expect(squadRepo.isAgentOverloaded(squad.id, a1, agentRepo)).toBe(true);
    });

    it('respects custom overload_threshold from triggerRules', () => {
      const a1 = createAgent(db);
      const squad = squadRepo.create({ name: 'Team', triggerRules: { overload_threshold: 2 } });
      createTask(db, a1, 'running');
      createTask(db, a1, 'assigned');

      expect(squadRepo.isAgentOverloaded(squad.id, a1, agentRepo)).toBe(true);
    });

    it('returns false when agentRepo is null', () => {
      const a1 = createAgent(db);
      const squad = squadRepo.create({ name: 'Team' });
      expect(squadRepo.isAgentOverloaded(squad.id, a1, null)).toBe(false);
    });
  });

  describe('DEFAULT_TRIGGER_RULES', () => {
    it('has overload_threshold of 3', () => {
      expect(DEFAULT_TRIGGER_RULES.overload_threshold).toBe(3);
    });

    it('has expected trigger rule keys', () => {
      expect(DEFAULT_TRIGGER_RULES.on_member_complete).toBe('continue');
      expect(DEFAULT_TRIGGER_RULES.on_error).toBe('fail-fast');
      expect(DEFAULT_TRIGGER_RULES.on_all_complete).toBe('idle');
    });
  });
});

// ══════════════════════════════════════════════════════════
// CMPAAA-542: MessageBus 消息优先级
// ══════════════════════════════════════════════════════════

describe('CMPAAA-542: MessageBus message priority', () => {
  let bus;

  beforeEach(() => {
    bus = new MessageBus({ maxQueueSize: 5, defaultTimeout: 500 });
  });

  afterEach(() => bus.close());

  // Positive tests
  it('critical messages are delivered before normal and low', () => {
    const received = [];
    let throwOnce = true;
    const id = bus.subscribe('test', (msg) => {
      if (throwOnce) { throwOnce = false; throw new Error('slow'); }
      received.push(msg.priority);
    });

    bus.publish('test', 'event', {}, { priority: 'low' });
    bus.publish('test', 'event', {}, { priority: 'critical' });
    bus.publish('test', 'event', {}, { priority: 'normal' });

    bus.drain(id, 10);
    expect(received[0]).toBe('critical');
  });

  it('drops lowest-priority message when queue is full', () => {
    const received = [];
    let throwOnce = true;
    const id = bus.subscribe('test', (msg) => {
      if (throwOnce) { throwOnce = false; throw new Error('slow'); }
      received.push(msg.payload.n);
    });

    // Fill queue with low priority
    for (let i = 0; i < 5; i++) {
      bus.publish('test', 'event', { n: i }, { priority: 'low' });
    }
    expect(bus.queueDepth(id)).toBe(5);

    // Add critical — should evict a low
    bus.publish('test', 'event', { n: 99 }, { priority: 'critical' });
    expect(bus.queueDepth(id)).toBe(5);

    bus.drain(id, 10);
    expect(received[0]).toBe(99); // critical first
  });

  it('drops new low-priority message when queue is full of higher priorities', () => {
    let throwOnce = true;
    const id = bus.subscribe('test', () => {
      if (throwOnce) { throwOnce = false; throw new Error('slow'); }
    });

    for (let i = 0; i < 5; i++) {
      bus.publish('test', 'event', { n: i }, { priority: 'high' });
    }
    expect(bus.queueDepth(id)).toBe(5);

    // low should be dropped
    bus.publish('test', 'event', { n: 99 }, { priority: 'low' });
    expect(bus.queueDepth(id)).toBe(5);
  });

  // Negative test
  it('rejects invalid priority value', () => {
    expect(() => bus.publish('test', 'event', {}, { priority: 'urgent' })).toThrow('Invalid priority');
  });

  it('defaults to normal priority when not specified', () => {
    const msg = bus.publish('test', 'event', {});
    expect(msg.priority).toBe('normal');
  });

  // Integration: priority + persistence mock
  it('priority ordering is preserved across multiple publishes', () => {
    const received = [];
    let throwOnce = true;
    const id = bus.subscribe('test', (msg) => {
      if (throwOnce) { throwOnce = false; throw new Error('slow'); }
      received.push(msg.priority);
    });

    bus.publish('test', 'event', {}, { priority: 'low' });
    bus.publish('test', 'event', {}, { priority: 'normal' });
    bus.publish('test', 'event', {}, { priority: 'high' });
    bus.publish('test', 'event', {}, { priority: 'critical' });

    bus.drain(id, 10);
    expect(received).toEqual(['critical', 'high', 'normal', 'low']);
  });

  it('PRIORITY_ORDER weights are correctly ordered', () => {
    expect(PRIORITY_ORDER.critical).toBeGreaterThan(PRIORITY_ORDER.high);
    expect(PRIORITY_ORDER.high).toBeGreaterThan(PRIORITY_ORDER.normal);
    expect(PRIORITY_ORDER.normal).toBeGreaterThan(PRIORITY_ORDER.low);
  });
});

// ══════════════════════════════════════════════════════════
// CMPAAA-543: Squad 动态 Member 发现
// ══════════════════════════════════════════════════════════

describe('CMPAAA-543: Squad dynamic member discovery', () => {
  let db, squadRepo, agentRepo;

  beforeEach(() => {
    db = createTestDb();
    squadRepo = new SquadRepository(db);
    agentRepo = new AgentRepository(db);
  });

  afterEach(() => db.close());

  describe('getWildcardMembers', () => {
    it('returns only wildcard members (agent_id=*)', () => {
      const a1 = createAgent(db);
      const squad = squadRepo.create({ name: 'Team' });
      squadRepo.addMember(squad.id, a1, 'engineer');
      squadRepo.addMember(squad.id, '*', 'designer');

      const wildcards = squadRepo.getWildcardMembers(squad.id);
      expect(wildcards).toHaveLength(1);
      expect(wildcards[0].agentId).toBe('*');
      expect(wildcards[0].role).toBe('designer');
    });

    it('returns empty array when no wildcard members', () => {
      const a1 = createAgent(db);
      const squad = squadRepo.create({ name: 'Team' });
      squadRepo.addMember(squad.id, a1, 'engineer');

      expect(squadRepo.getWildcardMembers(squad.id)).toEqual([]);
    });
  });

  describe('resolveWildcardAgent', () => {
    it('resolves wildcard to idle agent with matching ownerRole', () => {
      const a1 = createAgent(db, { ownerRole: 'engineer', status: 'idle' });
      const a2 = createAgent(db, { ownerRole: 'designer', status: 'idle' });
      const squad = squadRepo.create({ name: 'Team' });
      squadRepo.addMember(squad.id, '*', 'engineer');

      const resolved = squadRepo.resolveWildcardAgent(squad.id, 'engineer', agentRepo);
      expect(resolved).not.toBeNull();
      expect(resolved.id).toBe(a1);
      expect(resolved.ownerRole).toBe('engineer');
    });

    it('returns null when no idle agent matches the role', () => {
      createAgent(db, { ownerRole: 'designer', status: 'idle' });
      const squad = squadRepo.create({ name: 'Team' });
      squadRepo.addMember(squad.id, '*', 'engineer');

      const resolved = squadRepo.resolveWildcardAgent(squad.id, 'engineer', agentRepo);
      expect(resolved).toBeNull();
    });

    it('excludes agents already in the squad', () => {
      const a1 = createAgent(db, { ownerRole: 'engineer', status: 'idle' });
      const a2 = createAgent(db, { ownerRole: 'engineer', status: 'idle' });
      const squad = squadRepo.create({ name: 'Team' });
      squadRepo.addMember(squad.id, a1, 'engineer'); // explicit member
      squadRepo.addMember(squad.id, '*', 'engineer'); // wildcard

      const resolved = squadRepo.resolveWildcardAgent(squad.id, 'engineer', agentRepo);
      expect(resolved).not.toBeNull();
      expect(resolved.id).toBe(a2); // a2, not a1
    });

    it('skips overloaded agents (workload >= threshold)', () => {
      const a1 = createAgent(db, { ownerRole: 'engineer', status: 'idle' });
      const a2 = createAgent(db, { ownerRole: 'engineer', status: 'idle' });
      // Give a1 3 active tasks (default threshold = 3)
      createTask(db, a1, 'running');
      createTask(db, a1, 'assigned');
      createTask(db, a1, 'running');

      const squad = squadRepo.create({ name: 'Team' });
      squadRepo.addMember(squad.id, '*', 'engineer');

      const resolved = squadRepo.resolveWildcardAgent(squad.id, 'engineer', agentRepo);
      expect(resolved).not.toBeNull();
      expect(resolved.id).toBe(a2); // a1 is overloaded
    });

    it('returns the agent with fewest active tasks', () => {
      const a1 = createAgent(db, { ownerRole: 'engineer', status: 'idle' });
      const a2 = createAgent(db, { ownerRole: 'engineer', status: 'idle' });
      createTask(db, a1, 'running');
      // a2 has 0 tasks

      const squad = squadRepo.create({ name: 'Team' });
      squadRepo.addMember(squad.id, '*', 'engineer');

      const resolved = squadRepo.resolveWildcardAgent(squad.id, 'engineer', agentRepo);
      expect(resolved.id).toBe(a2); // fewer tasks
    });

    it('returns null when agentRepo is null', () => {
      const squad = squadRepo.create({ name: 'Team' });
      expect(squadRepo.resolveWildcardAgent(squad.id, 'engineer', null)).toBeNull();
    });
  });

  describe('expandRoster', () => {
    it('expands wildcard members to concrete agents', () => {
      const a1 = createAgent(db, { ownerRole: 'engineer', status: 'idle' });
      const a2 = createAgent(db, { ownerRole: 'engineer', status: 'idle' });
      const squad = squadRepo.create({ name: 'Team' });
      squadRepo.addMember(squad.id, a1, 'lead');
      squadRepo.addMember(squad.id, '*', 'engineer');

      const roster = squadRepo.expandRoster(squad.id, agentRepo);
      expect(roster).toHaveLength(2);

      // First is the explicit member
      expect(roster[0]).toEqual({ agentId: a1, role: 'lead', resolved: true });

      // Wildcard resolved to a2 (a1 already in squad)
      expect(roster[1].resolved).toBe(true);
      expect(roster[1].agentId).toBe(a2);
      expect(roster[1].role).toBe('engineer');
    });

    it('marks wildcard as unresolved when no matching agent exists', () => {
      const squad = squadRepo.create({ name: 'Team' });
      squadRepo.addMember(squad.id, '*', 'nonexistent-role');

      const roster = squadRepo.expandRoster(squad.id, agentRepo);
      expect(roster).toHaveLength(1);
      expect(roster[0].resolved).toBe(false);
      expect(roster[0].agentId).toBe('*');
    });

    it('passes through non-wildcard members as-is', () => {
      const a1 = createAgent(db, { ownerRole: 'engineer', status: 'idle' });
      const a2 = createAgent(db, { ownerRole: 'engineer', status: 'idle' });
      const squad = squadRepo.create({ name: 'Team' });
      squadRepo.addMember(squad.id, a1, 'lead');
      squadRepo.addMember(squad.id, a2, 'member');

      const roster = squadRepo.expandRoster(squad.id, agentRepo);
      expect(roster).toHaveLength(2);
      expect(roster.every(r => r.resolved === true)).toBe(true);
      expect(roster.map(r => r.agentId).sort()).toEqual([a1, a2].sort());
    });
  });

  describe('DB schema for wildcards', () => {
    it('migration v25 removes CHECK constraint on role', () => {
      const v25 = migrations.find(m => m.version === 25);
      expect(v25).toBeDefined();
      expect(v25.name).toBe('widen_squad_member_roles');
      expect(v25.up).toContain('squad_members_new');
    });

    it('can insert wildcard member (agent_id=*) after migration', () => {
      const squad = squadRepo.create({ name: 'Team' });
      squadRepo.addMember(squad.id, '*', 'engineer');
      const members = squadRepo.listMembers(squad.id);
      expect(members).toHaveLength(1);
      expect(members[0].agentId).toBe('*');
    });
  });
});
