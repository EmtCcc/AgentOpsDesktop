import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageBus, VALID_TYPES } from '../src/main/message-bus/message-bus.js';

// ── Helpers ──

function createBus(opts = {}) {
  return new MessageBus({
    defaultTimeout: 500,
    maxQueueSize: 50,
    ...opts,
  });
}

function waitFor(fn, timeout = 1000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      try {
        const result = fn();
        if (result) return resolve(result);
      } catch {}
      if (Date.now() - start > timeout) return reject(new Error('waitFor timeout'));
      setTimeout(check, 5);
    };
    check();
  });
}

// ══════════════════════════════════════════════════════════
// 1. TYPED MESSAGE PROTOCOL
// ══════════════════════════════════════════════════════════

describe('Typed message protocol', () => {
  let bus;

  beforeEach(() => { bus = createBus(); });
  afterEach(() => bus.close());

  it('creates messages with all required fields', () => {
    const msg = bus.publish('test.topic', 'event', { data: 1 }, { senderId: 'agent-1' });
    expect(msg).toMatchObject({
      id: expect.any(String),
      type: 'event',
      topic: 'test.topic',
      payload: { data: 1 },
      senderId: 'agent-1',
      timestamp: expect.any(Number),
    });
    expect(msg.id).toHaveLength(36); // UUID
  });

  it('supports all four message types', () => {
    for (const type of ['request', 'response', 'event', 'heartbeat']) {
      const msg = bus.publish(`test.${type}`, type, {});
      expect(msg.type).toBe(type);
    }
  });

  it('rejects invalid message types', () => {
    expect(() => bus.publish('test', 'invalid', {})).toThrow('Invalid message type');
  });

  it('assigns default senderId as system', () => {
    const msg = bus.publish('test', 'event', {});
    expect(msg.senderId).toBe('system');
  });

  it('includes correlationId when provided', () => {
    const msg = bus.publish('test', 'request', {}, { correlationId: 'corr-123' });
    expect(msg.correlationId).toBe('corr-123');
  });
});

// ══════════════════════════════════════════════════════════
// 2. PUB/SUB WITH TOPIC-BASED ROUTING
// ══════════════════════════════════════════════════════════

describe('Pub/sub topic routing', () => {
  let bus;

  beforeEach(() => { bus = createBus(); });
  afterEach(() => bus.close());

  it('delivers messages to exact topic subscribers', () => {
    const received = [];
    bus.subscribe('agents.status', (msg) => received.push(msg));
    bus.publish('agents.status', 'event', { status: 'running' });
    expect(received).toHaveLength(1);
    expect(received[0].payload.status).toBe('running');
  });

  it('supports wildcard * for single segment', () => {
    const received = [];
    bus.subscribe('agents.*', (msg) => received.push(msg));
    bus.publish('agents.status', 'event', {});
    bus.publish('agents.log', 'event', {});
    bus.publish('tasks.create', 'event', {});
    expect(received).toHaveLength(2);
  });

  it('supports multi-wildcard ** for multiple segments', () => {
    const received = [];
    bus.subscribe('agents.**', (msg) => received.push(msg));
    bus.publish('agents.status', 'event', {});
    bus.publish('agents.sub.deep.topic', 'event', {});
    bus.publish('tasks.create', 'event', {});
    expect(received).toHaveLength(2);
  });

  it('delivers to multiple subscribers on same topic', () => {
    const a = [], b = [];
    bus.subscribe('events', (msg) => a.push(msg));
    bus.subscribe('events', (msg) => b.push(msg));
    bus.publish('events', 'event', {});
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it('unsubscribe stops delivery', () => {
    const received = [];
    const id = bus.subscribe('events', (msg) => received.push(msg));
    bus.publish('events', 'event', { n: 1 });
    bus.unsubscribe(id);
    bus.publish('events', 'event', { n: 2 });
    expect(received).toHaveLength(1);
    expect(received[0].payload.n).toBe(1);
  });

  it('returns false when unsubscribing unknown id', () => {
    expect(bus.unsubscribe('nonexistent')).toBe(false);
  });

  it('ignores messages on unsubscribed topics', () => {
    const received = [];
    bus.subscribe('other', (msg) => received.push(msg));
    bus.publish('events', 'event', {});
    expect(received).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════
// 3. REQUEST/REPLY WITH TIMEOUT AND CORRELATION IDS
// ══════════════════════════════════════════════════════════

describe('Request/reply', () => {
  let bus;

  beforeEach(() => { bus = createBus(); });
  afterEach(() => bus.close());

  it('resolves request when correlated response arrives', async () => {
    bus.subscribe('agents.query', (msg) => {
      if (msg.type === 'request') {
        bus.reply(msg, { result: 'ok' });
      }
    });

    const response = await bus.request('agents.query', { action: 'status' });
    expect(response.payload.result).toBe('ok');
    expect(response.correlationId).toBeDefined();
  });

  it('rejects on timeout when no reply arrives', async () => {
    await expect(
      bus.request('no.handlers', {}, { timeout: 50 })
    ).rejects.toThrow('timed out');
  });

  it('correlates response to the correct request', async () => {
    const results = [];

    bus.subscribe('math', (msg) => {
      if (msg.type === 'request') {
        // Reply with doubled value
        bus.reply(msg, { result: msg.payload.value * 2 });
      }
    });

    // Fire multiple requests concurrently
    const [r1, r2, r3] = await Promise.all([
      bus.request('math', { value: 1 }),
      bus.request('math', { value: 2 }),
      bus.request('math', { value: 3 }),
    ]);

    expect(r1.payload.result).toBe(2);
    expect(r2.payload.result).toBe(4);
    expect(r3.payload.result).toBe(6);
  });

  it('reply throws if message has no correlationId', () => {
    const msg = bus.publish('test', 'event', {});
    expect(() => bus.reply(msg, {})).toThrow('no correlationId');
  });

  it('cleans up pending entry after reply', async () => {
    bus.subscribe('q', (msg) => {
      if (msg.type === 'request') bus.reply(msg, {});
    });

    await bus.request('q', {});
    expect(bus.stats().pendingRequests).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════
// 4. HEARTBEAT
// ══════════════════════════════════════════════════════════

describe('Heartbeat', () => {
  let bus;

  beforeEach(() => { bus = createBus(); });
  afterEach(() => bus.close());

  it('publishes heartbeat messages', () => {
    const received = [];
    bus.subscribe('agents.heartbeat', (msg) => received.push(msg));
    bus.heartbeat('agents.heartbeat', 'agent-1', { cpu: 0.5 });
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('heartbeat');
    expect(received[0].senderId).toBe('agent-1');
    expect(received[0].payload.cpu).toBe(0.5);
  });

  it('uses empty payload when none provided', () => {
    const received = [];
    bus.subscribe('hb', (msg) => received.push(msg));
    bus.heartbeat('hb', 'agent-1');
    expect(received[0].payload).toEqual({});
  });
});

// ══════════════════════════════════════════════════════════
// 5. BACK-PRESSURE HANDLING
// ══════════════════════════════════════════════════════════

describe('Back-pressure handling', () => {
  let bus;

  beforeEach(() => {
    bus = createBus({ maxQueueSize: 5 });
  });
  afterEach(() => bus.close());

  it('queues messages for slow consumers', () => {
    let count = 0;
    const id = bus.subscribe('events', (msg) => {
      count++;
      if (count <= 1) throw new Error('simulated slow'); // First call fails
    });

    bus.publish('events', 'event', { n: 1 }); // triggers error, starts queuing
    bus.publish('events', 'event', { n: 2 }); // queued
    bus.publish('events', 'event', { n: 3 }); // queued

    // All 3 get queued: n=1 fails handler then gets queued, n=2 and n=3 queued directly
    expect(bus.queueDepth(id)).toBe(3);
  });

  it('drops messages when queue is full', () => {
    let count = 0;
    const id = bus.subscribe('events', () => {
      count++;
      if (count <= 1) throw new Error('slow');
    });

    bus.publish('events', 'event', { n: 1 }); // triggers error

    // Fill beyond maxQueueSize (5)
    for (let i = 2; i <= 10; i++) {
      bus.publish('events', 'event', { n: i });
    }

    expect(bus.queueDepth(id)).toBe(5); // capped at maxQueueSize
  });

  it('drain processes queued messages', () => {
    const received = [];
    let failFirst = true;
    const id = bus.subscribe('events', (msg) => {
      if (failFirst) { failFirst = false; throw new Error('slow'); }
      received.push(msg);
    });

    bus.publish('events', 'event', { n: 1 }); // triggers error, queued
    bus.publish('events', 'event', { n: 2 }); // queued
    bus.publish('events', 'event', { n: 3 }); // queued

    const drained = bus.drain(id);
    expect(drained).toBe(3);
    // First drain call triggers handler, which succeeds (failFirst already false from init)
    // so all 3 are processed
    expect(bus.queueDepth(id)).toBe(0);
  });

  it('returns 0 when draining empty queue', () => {
    const id = bus.subscribe('events', () => {});
    expect(bus.drain(id)).toBe(0);
  });

  it('returns 0 when draining unknown subscriber', () => {
    expect(bus.drain('nonexistent')).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════
// 6. PRIORITY QUEUE
// ══════════════════════════════════════════════════════════

describe('Priority queue', () => {
  let bus;

  beforeEach(() => {
    bus = createBus({ maxQueueSize: 3 });
  });
  afterEach(() => bus.close());

  function triggerQueuing(bus) {
    let count = 0;
    const id = bus.subscribe('events', () => {
      count++;
      if (count <= 1) throw new Error('slow');
    });
    bus.publish('events', 'event', { n: 0 }); // trigger error, starts queuing
    return id;
  }

  it('higher-priority messages are delivered first', () => {
    const id = triggerQueuing(bus);

    bus.publish('events', 'event', { n: 1 }, { priority: 'low' });
    bus.publish('events', 'event', { n: 2 }, { priority: 'critical' });
    bus.publish('events', 'event', { n: 3 }, { priority: 'normal' });

    const received = [];
    const origHandler = bus._subscribers.get(id).handler;
    bus._subscribers.get(id).handler = (msg) => received.push(msg.payload.n);
    bus.drain(id, 10);

    // n=0 (normal, from trigger), n=1 (low), n=2 (critical), n=3 (normal)
    // critical > normal(FIFO: 0,3) > low(evicted by n=3 since maxQueueSize=3)
    expect(received).toEqual([2, 0, 3]);
  });

  it('drops lowest-priority message when queue is full', () => {
    const id = triggerQueuing(bus);

    // Fill queue: low, low, low
    bus.publish('events', 'event', { n: 1 }, { priority: 'low' });
    bus.publish('events', 'event', { n: 2 }, { priority: 'low' });
    bus.publish('events', 'event', { n: 3 }, { priority: 'low' });
    expect(bus.queueDepth(id)).toBe(3);

    // Add a critical — should evict a low
    bus.publish('events', 'event', { n: 4 }, { priority: 'critical' });
    expect(bus.queueDepth(id)).toBe(3);

    const received = [];
    bus._subscribers.get(id).handler = (msg) => received.push(msg.payload.n);
    bus.drain(id, 10);

    // critical(4) first, then n=0 (normal, from trigger), n=1 (low). n=2 (low) was evicted.
    expect(received).toEqual([4, 0, 1]);
  });

  it('drops new message when it has lowest priority and queue is full', () => {
    const id = triggerQueuing(bus);

    bus.publish('events', 'event', { n: 1 }, { priority: 'high' });
    bus.publish('events', 'event', { n: 2 }, { priority: 'high' });
    bus.publish('events', 'event', { n: 3 }, { priority: 'normal' });
    expect(bus.queueDepth(id)).toBe(3);

    // low should be dropped
    bus.publish('events', 'event', { n: 4 }, { priority: 'low' });
    expect(bus.queueDepth(id)).toBe(3);

    const received = [];
    bus._subscribers.get(id).handler = (msg) => received.push(msg.payload.n);
    bus.drain(id, 10);

    // n=0 (normal, from trigger), n=1 (high), n=2 (high). n=3 (normal) and n=4 (low) dropped.
    expect(received).toEqual([1, 2, 0]);
  });

  it('defaults to normal priority', () => {
    const id = triggerQueuing(bus);

    bus.publish('events', 'event', { n: 1 }); // no priority → normal
    bus.publish('events', 'event', { n: 2 }, { priority: 'critical' });
    bus.publish('events', 'event', { n: 3 }, { priority: 'low' });

    const received = [];
    bus._subscribers.get(id).handler = (msg) => received.push(msg.payload.n);
    bus.drain(id, 10);

    // n=0 (normal, from trigger), n=1 (default→normal), n=2 (critical). n=3 (low) dropped.
    expect(received).toEqual([2, 0, 1]);
  });

  it('rejects invalid priority', () => {
    expect(() => bus.publish('x', 'event', {}, { priority: 'urgent' })).toThrow('Invalid priority');
  });
});

// ══════════════════════════════════════════════════════════
// 7. TOPIC VALIDATION
// ══════════════════════════════════════════════════════════

describe('Topic validation', () => {
  let bus;

  beforeEach(() => { bus = createBus({ maxTopicDepth: 3 }); });
  afterEach(() => bus.close());

  it('rejects empty topic', () => {
    expect(() => bus.publish('', 'event', {})).toThrow('non-empty string');
  });

  it('rejects non-string topic', () => {
    expect(() => bus.publish(123, 'event', {})).toThrow('non-empty string');
  });

  it('rejects topic exceeding max depth', () => {
    expect(() => bus.publish('a.b.c.d', 'event', {})).toThrow('depth exceeds');
  });

  it('rejects topic with empty segments', () => {
    expect(() => bus.publish('a..b', 'event', {})).toThrow('empty');
  });

  it('rejects topic exceeding max length', () => {
    const longTopic = 'a'.repeat(300);
    expect(() => bus.publish(longTopic, 'event', {})).toThrow('max length');
  });

  it('accepts valid topics', () => {
    expect(() => bus.publish('a', 'event', {})).not.toThrow();
    expect(() => bus.publish('a.b', 'event', {})).not.toThrow();
    expect(() => bus.publish('a.b.c', 'event', {})).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════
// 7. LIFECYCLE
// ══════════════════════════════════════════════════════════

describe('Lifecycle', () => {
  it('close rejects pending requests', async () => {
    const bus = createBus();
    const promise = bus.request('nope', {}, { timeout: 10000 });
    bus.close();
    await expect(promise).rejects.toThrow('closed');
  });

  it('throws on operations after close', () => {
    const bus = createBus();
    bus.close();
    expect(() => bus.publish('t', 'event', {})).toThrow('closed');
    expect(() => bus.subscribe('t', () => {})).toThrow('closed');
    expect(() => bus.request('t', {})).toThrow('closed');
  });

  it('close is idempotent', () => {
    const bus = createBus();
    bus.close();
    bus.close(); // should not throw
  });

  it('stats reflects current state', () => {
    const bus = createBus();
    bus.subscribe('a', () => {});
    bus.subscribe('b', () => {});
    const s = bus.stats();
    expect(s.topics).toBe(2);
    expect(s.subscribers).toBe(2);
    expect(s.closed).toBe(false);
    bus.close();
    expect(bus.stats().closed).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════
// 8. TOPIC MATCHING EDGE CASES
// ══════════════════════════════════════════════════════════

describe('Topic matching', () => {
  let bus;

  beforeEach(() => { bus = createBus(); });
  afterEach(() => bus.close());

  it('exact match works', () => {
    const r = [];
    bus.subscribe('a.b.c', (m) => r.push(m));
    bus.publish('a.b.c', 'event', {});
    expect(r).toHaveLength(1);
  });

  it('* does not match multiple segments', () => {
    const r = [];
    bus.subscribe('a.*', (m) => r.push(m));
    bus.publish('a.b.c', 'event', {});
    expect(r).toHaveLength(0);
  });

  it('* matches exactly one segment', () => {
    const r = [];
    bus.subscribe('a.*', (m) => r.push(m));
    bus.publish('a.b', 'event', {});
    expect(r).toHaveLength(1);
  });

  it('** matches zero or more segments after prefix', () => {
    const r = [];
    bus.subscribe('a.**', (m) => r.push(m));
    bus.publish('a.b', 'event', {});
    bus.publish('a.b.c.d', 'event', {});
    bus.publish('x.y', 'event', {});
    expect(r).toHaveLength(2);
  });

  it('** at start works', () => {
    const r = [];
    bus.subscribe('**.c', (m) => r.push(m));
    bus.publish('a.b.c', 'event', {});
    bus.publish('c', 'event', {});
    bus.publish('a.c', 'event', {});
    expect(r).toHaveLength(3);
  });
});

// ══════════════════════════════════════════════════════════
// 9. LATENCY BENCHMARK
// ══════════════════════════════════════════════════════════

describe('Latency benchmark', () => {
  it('delivers 1KB message in < 1ms', () => {
    const bus = createBus();
    const payload = { data: 'x'.repeat(1024) };
    const received = [];

    bus.subscribe('bench', (msg) => received.push(msg));

    // Warm up
    bus.publish('bench', 'event', payload);

    // Benchmark
    const iterations = 1000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      bus.publish('bench', 'event', payload);
    }
    const elapsed = performance.now() - start;
    const avgUs = (elapsed / iterations) * 1000;

    // Should be well under 1ms per message
    expect(avgUs).toBeLessThan(1000); // < 1000µs = < 1ms

    bus.close();
  });

  it('handles high throughput', () => {
    const bus = createBus();
    let count = 0;
    bus.subscribe('throughput', () => { count++; });

    const n = 10000;
    const start = performance.now();
    for (let i = 0; i < n; i++) {
      bus.publish('throughput', 'event', { i });
    }
    const elapsed = performance.now() - start;

    expect(count).toBe(n);
    // Should process 10k messages in under 1 second
    expect(elapsed).toBeLessThan(1000);

    bus.close();
  });
});

// ══════════════════════════════════════════════════════════
// 10. PERSISTENCE (mock)
// ══════════════════════════════════════════════════════════

describe('Persistence integration', () => {
  it('calls persistence.enqueue on publish', async () => {
    const mockPersistence = {
      enqueue: vi.fn().mockResolvedValue(undefined),
      replay: vi.fn().mockResolvedValue([]),
    };

    const bus = new MessageBus({ persistence: mockPersistence });
    bus.publish('test', 'event', { data: 1 });

    expect(mockPersistence.enqueue).toHaveBeenCalledTimes(1);
    expect(mockPersistence.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'test', type: 'event' })
    );

    bus.close();
  });

  it('replay calls persistence and invokes handler', async () => {
    const messages = [
      { id: '1', type: 'event', topic: 'test', payload: { n: 1 }, senderId: 's', timestamp: 1 },
      { id: '2', type: 'event', topic: 'test', payload: { n: 2 }, senderId: 's', timestamp: 2 },
    ];

    const mockPersistence = {
      enqueue: vi.fn().mockResolvedValue(undefined),
      replay: vi.fn().mockResolvedValue(messages),
    };

    const bus = new MessageBus({ persistence: mockPersistence });
    const received = [];
    const result = await bus.replay('test', (msg) => received.push(msg));

    expect(result).toHaveLength(2);
    expect(received).toHaveLength(2);
    expect(received[0].payload.n).toBe(1);

    bus.close();
  });

  it('replay returns empty array when no persistence', async () => {
    const bus = createBus();
    const result = await bus.replay('test', () => {});
    expect(result).toEqual([]);
    bus.close();
  });
});
