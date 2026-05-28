import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { MessagePersistence } from '../src/main/message-bus/persistence.js';
import { createMessageBus } from '../src/main/message-bus/index.js';

describe('MessagePersistence (SQLite)', () => {
  let db;
  let persistence;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    persistence = new MessagePersistence(db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates message_queue table on init', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='message_queue'").all();
    expect(tables).toHaveLength(1);
  });

  it('enqueue and replay round-trip', async () => {
    const msg = {
      id: 'test-1',
      type: 'event',
      topic: 'agents.status',
      payload: { status: 'running' },
      senderId: 'runtime',
      timestamp: Date.now(),
    };

    await persistence.enqueue(msg);
    const replayed = await persistence.replay('agents.status');

    expect(replayed).toHaveLength(1);
    expect(replayed[0]).toMatchObject({
      id: 'test-1',
      type: 'event',
      topic: 'agents.status',
      payload: { status: 'running' },
      senderId: 'runtime',
    });
  });

  it('replay respects since filter', async () => {
    const now = Date.now();
    await persistence.enqueue({ id: 'old', type: 'event', topic: 't', payload: {}, senderId: 's', timestamp: now - 10000 });
    await persistence.enqueue({ id: 'new', type: 'event', topic: 't', payload: {}, senderId: 's', timestamp: now });

    const result = await persistence.replay('t', { since: now - 5000 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('new');
  });

  it('replay respects limit', async () => {
    for (let i = 0; i < 10; i++) {
      await persistence.enqueue({ id: `m-${i}`, type: 'event', topic: 't', payload: { i }, senderId: 's', timestamp: Date.now() + i });
    }

    const result = await persistence.replay('t', { limit: 3 });
    expect(result).toHaveLength(3);
  });

  it('findByCorrelation returns correlated messages', async () => {
    await persistence.enqueue({ id: 'req-1', type: 'request', topic: 'q', payload: {}, correlationId: 'corr-abc', senderId: 's', timestamp: Date.now() });
    await persistence.enqueue({ id: 'res-1', type: 'response', topic: 'q', payload: {}, correlationId: 'corr-abc', senderId: 's', timestamp: Date.now() });
    await persistence.enqueue({ id: 'other', type: 'event', topic: 'q', payload: {}, senderId: 's', timestamp: Date.now() });

    const result = await persistence.findByCorrelation('corr-abc');
    expect(result).toHaveLength(2);
    expect(result.every(m => m.correlationId === 'corr-abc')).toBe(true);
  });

  it('purge removes old messages', async () => {
    await persistence.enqueue({ id: 'old-1', type: 'event', topic: 't', payload: {}, senderId: 's', timestamp: Date.now() });
    await persistence.enqueue({ id: 'new-1', type: 'event', topic: 't', payload: {}, senderId: 's', timestamp: Date.now() });

    // Backdate the old message's created_at directly
    db.prepare("UPDATE message_queue SET created_at = ? WHERE id = ?").run(Date.now() - 200000, 'old-1');

    const deleted = persistence.purge(50000); // purge older than 50s
    expect(deleted).toBe(1);

    const remaining = await persistence.replay('t');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('new-1');
  });

  it('remove deletes specific message', async () => {
    await persistence.enqueue({ id: 'target', type: 'event', topic: 't', payload: {}, senderId: 's', timestamp: Date.now() });
    expect(persistence.remove('target')).toBe(true);
    expect(persistence.remove('target')).toBe(false);
  });

  it('count returns topic message count', async () => {
    await persistence.enqueue({ id: 'a', type: 'event', topic: 'x', payload: {}, senderId: 's', timestamp: Date.now() });
    await persistence.enqueue({ id: 'b', type: 'event', topic: 'x', payload: {}, senderId: 's', timestamp: Date.now() });
    await persistence.enqueue({ id: 'c', type: 'event', topic: 'y', payload: {}, senderId: 's', timestamp: Date.now() });

    expect(persistence.count('x')).toBe(2);
    expect(persistence.count('y')).toBe(1);
    expect(persistence.count('z')).toBe(0);
  });

  it('handles null correlationId and replyTo', async () => {
    await persistence.enqueue({
      id: 'no-corr',
      type: 'event',
      topic: 't',
      payload: { ok: true },
      senderId: 's',
      timestamp: Date.now(),
    });

    const result = await persistence.replay('t');
    expect(result[0].correlationId).toBeNull();
    expect(result[0].replyTo).toBeNull();
  });
});

describe('createMessageBus with persistence', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
  });

  afterEach(() => {
    db.close();
  });

  it('creates bus with persistence when db provided', () => {
    const bus = createMessageBus({ db });
    expect(bus._persistence).not.toBeNull();
    bus.close();
  });

  it('creates bus without persistence when no db', () => {
    const bus = createMessageBus();
    expect(bus._persistence).toBeNull();
    bus.close();
  });

  it('persists messages through the bus', async () => {
    const bus = createMessageBus({ db });
    bus.publish('test.persist', 'event', { data: 42 });

    // Replay via persistence
    const messages = await bus.replay('test.persist', () => {});
    expect(messages).toHaveLength(1);
    expect(messages[0].payload.data).toBe(42);

    bus.close();
  });
});
