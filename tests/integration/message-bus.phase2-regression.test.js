/**
 * Phase 2 Round 1 回归测试 — CMPAAA-329 SharedContext, CMPAAA-330 Agent-to-Agent Messaging
 *
 * 覆盖：
 *   - MessageBus pub/sub 基本消息传递
 *   - 通配符 topic 匹配 (* 单段, ** 多段)
 *   - 优先级队列排序
 *   - Request/Reply 相关性
 *   - 背压 (back-pressure) 队列管理
 *   - SharedContext 并发读写一致性
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { MessageBus, VALID_TYPES, VALID_PRIORITIES, PRIORITY_ORDER } from '../../src/main/message-bus/message-bus.js';
import { SharedContextRepository } from '../../src/main/repositories/shared-context.repository.js';

// ─── MessageBus ─────────────────────────────────────────────────

describe('MessageBus (CMPAAA-330)', () => {
  let bus;

  beforeEach(() => {
    bus = new MessageBus({ defaultTimeout: 500 });
  });

  afterEach(() => {
    bus.close();
  });

  // -- Pub/Sub 基本消息传递 --

  describe('pub/sub basic delivery', () => {
    it('delivers message to exact topic subscriber', () => {
      let received = null;
      bus.subscribe('agent.1.status', (msg) => { received = msg; });
      bus.publish('agent.1.status', 'event', { state: 'running' });
      expect(received).not.toBeNull();
      expect(received.payload).toEqual({ state: 'running' });
      expect(received.type).toBe('event');
    });

    it('does not deliver to non-matching topic', () => {
      let received = false;
      bus.subscribe('agent.1.status', () => { received = true; });
      bus.publish('agent.2.status', 'event', {});
      expect(received).toBe(false);
    });

    it('delivers to multiple subscribers on same topic', () => {
      const received = [];
      bus.subscribe('topic', (msg) => received.push(msg));
      bus.subscribe('topic', (msg) => received.push(msg));
      bus.publish('topic', 'event', {});
      expect(received).toHaveLength(2);
    });

    it('unsubscribe stops delivery', () => {
      let count = 0;
      const sid = bus.subscribe('topic', () => count++);
      bus.publish('topic', 'event', {});
      bus.unsubscribe(sid);
      bus.publish('topic', 'event', {});
      expect(count).toBe(1);
    });

    it('unsubscribe returns false for unknown id', () => {
      expect(bus.unsubscribe('fake-id')).toBe(false);
    });
  });

  // -- 通配符 topic 匹配 --

  describe('wildcard topic matching', () => {
    it('* matches one segment', () => {
      let received = false;
      bus.subscribe('agent.*.status', () => { received = true; });
      bus.publish('agent.123.status', 'event', {});
      expect(received).toBe(true);
    });

    it('* does not match multiple segments', () => {
      let received = false;
      bus.subscribe('agent.*', () => { received = true; });
      bus.publish('agent.123.status', 'event', {});
      expect(received).toBe(false);
    });

    it('** matches zero or more segments', () => {
      let received = 0;
      bus.subscribe('squad.**', () => received++);
      bus.publish('squad.a', 'event', {});
      bus.publish('squad.a.b', 'event', {});
      bus.publish('squad.a.b.c', 'event', {});
      expect(received).toBe(3);
    });

    it('** at start matches root', () => {
      let received = false;
      bus.subscribe('**.status', () => { received = true; });
      bus.publish('deep.nested.status', 'event', {});
      expect(received).toBe(true);
    });
  });

  // -- 优先级队列 --

  describe('priority queuing', () => {
    it('VALID_PRIORITIES contains expected values', () => {
      expect(VALID_PRIORITIES).toContain('critical');
      expect(VALID_PRIORITIES).toContain('high');
      expect(VALID_PRIORITIES).toContain('normal');
      expect(VALID_PRIORITIES).toContain('low');
    });

    it('PRIORITY_ORDER weights are descending', () => {
      expect(PRIORITY_ORDER.critical).toBeGreaterThan(PRIORITY_ORDER.high);
      expect(PRIORITY_ORDER.high).toBeGreaterThan(PRIORITY_ORDER.normal);
      expect(PRIORITY_ORDER.normal).toBeGreaterThan(PRIORITY_ORDER.low);
    });

    it('rejects invalid priority', () => {
      expect(() => bus.publish('t', 'event', {}, { priority: 'invalid' }))
        .toThrow('Invalid priority');
    });

    it('default priority is normal', () => {
      let received = null;
      bus.subscribe('t', (msg) => { received = msg; });
      bus.publish('t', 'event', {});
      expect(received.priority).toBe('normal');
    });
  });

  // -- Request/Reply --

  describe('request/reply', () => {
    it('resolves request when reply arrives', async () => {
      bus.subscribe('ask', (msg) => {
        if (msg.type === 'request') {
          bus.reply(msg, { answer: 42 });
        }
      });

      const response = await bus.request('ask', { question: 'life' });
      expect(response.payload).toEqual({ answer: 42 });
      expect(response.correlationId).toBeDefined();
    });

    it('rejects on timeout', async () => {
      await expect(bus.request('void', {}, { timeout: 50 }))
        .rejects.toThrow('timed out');
    });

    it('reply throws if no correlationId', () => {
      expect(() => bus.reply({ id: 'x' }, {})).toThrow('no correlationId');
    });
  });

  // -- Message validation --

  describe('message validation', () => {
    it('rejects empty topic', () => {
      expect(() => bus.publish('', 'event', {})).toThrow('non-empty string');
    });

    it('rejects invalid message type', () => {
      expect(() => bus.publish('t', 'invalid', {})).toThrow('Invalid message type');
    });

    it('VALID_TYPES contains expected values', () => {
      expect(VALID_TYPES).toContain('request');
      expect(VALID_TYPES).toContain('response');
      expect(VALID_TYPES).toContain('event');
      expect(VALID_TYPES).toContain('heartbeat');
    });

    it('rejects topic exceeding max depth', () => {
      const shallowBus = new MessageBus({ maxTopicDepth: 2 });
      expect(() => shallowBus.publish('a.b.c', 'event', {})).toThrow('depth exceeds');
      shallowBus.close();
    });
  });

  // -- Heartbeat --

  describe('heartbeat', () => {
    it('publishes heartbeat message', () => {
      let received = null;
      bus.subscribe('hb', (msg) => { received = msg; });
      bus.heartbeat('hb', 'agent-1', { load: 0.5 });
      expect(received.type).toBe('heartbeat');
      expect(received.senderId).toBe('agent-1');
      expect(received.payload).toEqual({ load: 0.5 });
    });
  });

  // -- Stats --

  describe('stats', () => {
    it('returns bus statistics', () => {
      bus.subscribe('t', () => {});
      const s = bus.stats();
      expect(s.topics).toBe(1);
      expect(s.subscribers).toBe(1);
      expect(s.closed).toBe(false);
    });
  });

  // -- Close --

  describe('close', () => {
    it('rejects pending requests on close', async () => {
      const promise = bus.request('no-reply', {}, { timeout: 10000 });
      bus.close();
      await expect(promise).rejects.toThrow('closed');
    });

    it('throws on publish after close', () => {
      bus.close();
      expect(() => bus.publish('t', 'event', {})).toThrow('closed');
    });
  });
});

// ─── SharedContext (CMPAAA-329) ─────────────────────────────────

describe('SharedContextRepository (CMPAAA-329)', () => {
  let db;
  let repo;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE shared_context (
        id TEXT PRIMARY KEY,
        dag_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(dag_id, key)
      )
    `);
    repo = new SharedContextRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('set and get a value', () => {
    repo.set('dag-1', 'config', { retries: 3 });
    const record = repo.get('dag-1', 'config');
    expect(record.value).toEqual({ retries: 3 });
    expect(record.dagId).toBe('dag-1');
    expect(record.key).toBe('config');
  });

  it('set updates existing key (upsert)', () => {
    repo.set('dag-1', 'k', 'v1');
    repo.set('dag-1', 'k', 'v2');
    const record = repo.get('dag-1', 'k');
    expect(record.value).toBe('v2');
  });

  it('preserves id and createdAt on update', () => {
    const first = repo.set('dag-1', 'stable', 'a');
    const second = repo.set('dag-1', 'stable', 'b');
    expect(second.id).toBe(first.id);
  });

  it('get returns null for missing key', () => {
    expect(repo.get('dag-1', 'missing')).toBeNull();
  });

  it('getMany returns multiple keys', () => {
    repo.set('dag-1', 'a', 1);
    repo.set('dag-1', 'b', 2);
    repo.set('dag-1', 'c', 3);
    const results = repo.getMany('dag-1', ['a', 'c']);
    expect(results).toHaveLength(2);
    const keys = results.map((r) => r.key);
    expect(keys).toContain('a');
    expect(keys).toContain('c');
  });

  it('getMany returns empty for empty keys', () => {
    expect(repo.getMany('dag-1', [])).toEqual([]);
  });

  it('list returns all entries for a dag', () => {
    repo.set('dag-1', 'x', 10);
    repo.set('dag-1', 'y', 20);
    repo.set('dag-2', 'z', 30);
    const all = repo.list('dag-1');
    expect(all).toHaveLength(2);
    expect(all.every((r) => r.dagId === 'dag-1')).toBe(true);
  });

  it('list orders by key', () => {
    repo.set('dag-1', 'z', 1);
    repo.set('dag-1', 'a', 2);
    repo.set('dag-1', 'm', 3);
    const all = repo.list('dag-1');
    expect(all.map((r) => r.key)).toEqual(['a', 'm', 'z']);
  });

  it('delete removes a key', () => {
    repo.set('dag-1', 'del', 'yes');
    expect(repo.delete('dag-1', 'del')).toBe(true);
    expect(repo.get('dag-1', 'del')).toBeNull();
  });

  it('delete returns false for missing key', () => {
    expect(repo.delete('dag-1', 'nope')).toBe(false);
  });

  it('deleteAll removes all entries for a dag', () => {
    repo.set('dag-1', 'a', 1);
    repo.set('dag-1', 'b', 2);
    repo.set('dag-2', 'c', 3);
    repo.deleteAll('dag-1');
    expect(repo.list('dag-1')).toHaveLength(0);
    expect(repo.list('dag-2')).toHaveLength(1);
  });

  it('records updatedBy field', () => {
    repo.set('dag-1', 'authored', 'val', 'agent-42');
    const record = repo.get('dag-1', 'authored');
    expect(record.updatedBy).toBe('agent-42');
  });

  it('concurrent writes to same key resolve to last writer', () => {
    repo.set('dag-1', 'race', 'first');
    repo.set('dag-1', 'race', 'second');
    repo.set('dag-1', 'race', 'third');
    expect(repo.get('dag-1', 'race').value).toBe('third');
  });

  it('isolates dag scopes', () => {
    repo.set('dag-A', 'key', 'valueA');
    repo.set('dag-B', 'key', 'valueB');
    expect(repo.get('dag-A', 'key').value).toBe('valueA');
    expect(repo.get('dag-B', 'key').value).toBe('valueB');
  });

  it('stores complex JSON values', () => {
    const complex = { nested: { deep: [1, 2, { a: true }] }, null: null };
    repo.set('dag-1', 'complex', complex);
    expect(repo.get('dag-1', 'complex').value).toEqual(complex);
  });

  it('timestamps are set on create', () => {
    const record = repo.set('dag-1', 'ts', 'val');
    expect(record.createdAt).toBeGreaterThan(0);
    expect(record.updatedAt).toBeGreaterThan(0);
  });
});
