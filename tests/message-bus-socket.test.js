import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MessageBus } from '../src/main/message-bus/message-bus.js';
import { SocketBusServer } from '../src/main/message-bus/socket-server.js';
import { SocketBusClient } from '../src/main/message-bus/socket-client.js';

function tmpSocket() {
  return path.join(os.tmpdir(), `bus-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`);
}

function waitFor(fn, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      try {
        const r = fn();
        if (r) return resolve(r);
      } catch {}
      if (Date.now() - start > timeout) return reject(new Error('waitFor timeout'));
      setTimeout(check, 10);
    };
    check();
  });
}

// ══════════════════════════════════════════════════════════
// 1. SERVER LIFECYCLE
// ══════════════════════════════════════════════════════════

describe('SocketBusServer lifecycle', () => {
  let bus, server, socketPath;

  beforeEach(() => {
    bus = new MessageBus();
    socketPath = tmpSocket();
  });

  afterEach(async () => {
    if (server) await server.close();
    bus.close();
  });

  it('creates socket file on listen', async () => {
    server = new SocketBusServer(bus, { socketPath });
    await server.listen();
    expect(fs.existsSync(socketPath)).toBe(true);
  });

  it('removes socket file on close', async () => {
    server = new SocketBusServer(bus, { socketPath });
    await server.listen();
    expect(fs.existsSync(socketPath)).toBe(true);
    await server.close();
    server = null;
    expect(fs.existsSync(socketPath)).toBe(false);
  });

  it('sets socket permissions to 660', async () => {
    server = new SocketBusServer(bus, { socketPath });
    await server.listen();
    const stat = fs.statSync(socketPath);
    const mode = stat.mode & 0o777;
    expect(mode).toBe(0o660);
  });
});

// ══════════════════════════════════════════════════════════
// 2. HANDSHAKE & AUTHENTICATION
// ══════════════════════════════════════════════════════════

describe('Handshake & authentication', () => {
  let bus, server, socketPath;

  beforeEach(() => {
    bus = new MessageBus();
    socketPath = tmpSocket();
  });

  afterEach(async () => {
    if (server) await server.close();
    bus.close();
  });

  it('accepts valid handshake with agentId and squadId', async () => {
    server = new SocketBusServer(bus, { socketPath });
    await server.listen();

    const client = new SocketBusClient({
      socketPath,
      agentId: 'agent-1',
      squadId: 'squad-alpha',
    });
    await client.connect();
    expect(client.connected).toBe(true);

    client.close();
  });

  it('rejects handshake without agentId', async () => {
    server = new SocketBusServer(bus, { socketPath });
    await server.listen();

    const raw = net.createConnection(socketPath);
    raw.setEncoding('utf8');

    await new Promise((r) => raw.on('connect', r));
    raw.write(JSON.stringify({ type: 'handshake', squadId: 'squad-alpha' }) + '\n');

    const response = await new Promise((resolve) => {
      raw.on('data', (d) => resolve(JSON.parse(d.trim())));
    });

    expect(response.type).toBe('handshake_error');
    raw.destroy();
  });

  it('rejects non-handshake messages before auth', async () => {
    server = new SocketBusServer(bus, { socketPath });
    await server.listen();

    const raw = net.createConnection(socketPath);
    raw.setEncoding('utf8');

    await new Promise((r) => raw.on('connect', r));
    raw.write(JSON.stringify({ type: 'publish', topic: 'test', msgType: 'event', payload: {} }) + '\n');

    const response = await new Promise((resolve) => {
      raw.on('data', (d) => resolve(JSON.parse(d.trim())));
    });

    expect(response.type).toBe('error');
    expect(response.error).toContain('Handshake required');
    raw.destroy();
  });

  it('uses custom authenticate function', async () => {
    server = new SocketBusServer(bus, {
      socketPath,
      authenticate: (agentId, squadId, token) => token === 'valid-token',
    });
    await server.listen();

    const client = new SocketBusClient({
      socketPath,
      agentId: 'agent-1',
      squadId: 'squad-alpha',
      token: 'wrong-token',
    });

    await expect(client.connect()).rejects.toThrow('Authentication failed');
  });

  it('accepts with valid token', async () => {
    server = new SocketBusServer(bus, {
      socketPath,
      authenticate: (agentId, squadId, token) => token === 'valid-token',
    });
    await server.listen();

    const client = new SocketBusClient({
      socketPath,
      agentId: 'agent-1',
      squadId: 'squad-alpha',
      token: 'valid-token',
    });

    await client.connect();
    expect(client.connected).toBe(true);
    client.close();
  });
});

// ══════════════════════════════════════════════════════════
// 3. SQUAD NAMESPACE ISOLATION
// ══════════════════════════════════════════════════════════

describe('Squad namespace isolation', () => {
  let bus, server, socketPath;

  beforeEach(() => {
    bus = new MessageBus();
    socketPath = tmpSocket();
  });

  afterEach(async () => {
    if (server) await server.close();
    bus.close();
  });

  it('publishes with squad namespace prefix on the bus', async () => {
    server = new SocketBusServer(bus, { socketPath });
    await server.listen();

    const received = [];
    bus.subscribe('squad.squad-alpha.**', (msg) => received.push(msg));

    const client = new SocketBusClient({
      socketPath,
      agentId: 'agent-1',
      squadId: 'squad-alpha',
    });
    await client.connect();

    client.publish('task.update', 'event', { status: 'done' });

    await waitFor(() => received.length > 0);
    expect(received[0].topic).toBe('squad.squad-alpha.task.update');
    expect(received[0].payload.status).toBe('done');
    expect(received[0].senderId).toBe('agent-1');

    client.close();
  });

  it('strips namespace prefix when delivering to client', async () => {
    server = new SocketBusServer(bus, { socketPath });
    await server.listen();

    const client = new SocketBusClient({
      socketPath,
      agentId: 'agent-1',
      squadId: 'squad-alpha',
    });
    await client.connect();

    const received = [];
    client.subscribe('task.update', (msg) => received.push(msg));

    // Wait for subscription to propagate
    await new Promise((r) => setTimeout(r, 200));

    // Publish directly on the bus with namespace
    bus.publish('squad.squad-alpha.task.update', 'event', { status: 'running' });

    await waitFor(() => received.length > 0);
    expect(received[0].topic).toBe('task.update');
    expect(received[0].payload.status).toBe('running');

    client.close();
  });

  it('isolates squads: alpha does not see bravo messages', async () => {
    server = new SocketBusServer(bus, { socketPath });
    await server.listen();

    const alpha = new SocketBusClient({
      socketPath,
      agentId: 'agent-a',
      squadId: 'squad-alpha',
    });
    const bravo = new SocketBusClient({
      socketPath,
      agentId: 'agent-b',
      squadId: 'squad-bravo',
    });

    await alpha.connect();
    await bravo.connect();

    const alphaReceived = [];
    const bravoReceived = [];
    alpha.subscribe('task.update', (msg) => alphaReceived.push(msg));
    bravo.subscribe('task.update', (msg) => bravoReceived.push(msg));

    await new Promise((r) => setTimeout(r, 200));

    // Alpha publishes
    alpha.publish('task.update', 'event', { from: 'alpha' });

    await waitFor(() => alphaReceived.length > 0);

    // Bravo should NOT receive alpha's message
    await new Promise((r) => setTimeout(r, 200));
    expect(bravoReceived).toHaveLength(0);

    alpha.close();
    bravo.close();
  });

  it('request/reply works within squad namespace', async () => {
    server = new SocketBusServer(bus, { socketPath });
    await server.listen();

    // Set up a responder on the bus side with namespaced topic
    bus.subscribe('squad.squad-alpha.query.status', (msg) => {
      if (msg.type === 'request') {
        bus.reply(msg, { status: 'ok' });
      }
    });

    const client = new SocketBusClient({
      socketPath,
      agentId: 'agent-1',
      squadId: 'squad-alpha',
    });
    await client.connect();

    const response = await client.request('query.status', { taskId: '123' });
    expect(response.payload.status).toBe('ok');

    client.close();
  });
});

// ══════════════════════════════════════════════════════════
// 4. SOCKET CLEANUP ON AGENT KILL
// ══════════════════════════════════════════════════════════

describe('Socket cleanup on disconnect', () => {
  let bus, server, socketPath;

  beforeEach(() => {
    bus = new MessageBus();
    socketPath = tmpSocket();
  });

  afterEach(async () => {
    if (server) await server.close();
    bus.close();
  });

  it('cleans up bus subscriptions when client disconnects', async () => {
    server = new SocketBusServer(bus, { socketPath });
    await server.listen();

    const client = new SocketBusClient({
      socketPath,
      agentId: 'agent-1',
      squadId: 'squad-alpha',
    });
    await client.connect();

    client.subscribe('task.update', () => {});
    await new Promise((r) => setTimeout(r, 200));

    const subsBefore = bus.stats().subscribers;
    expect(subsBefore).toBeGreaterThan(0);

    // Kill the client connection abruptly
    client.close();

    await new Promise((r) => setTimeout(r, 200));

    const subsAfter = bus.stats().subscribers;
    expect(subsAfter).toBe(0);
  });

  it('emits client-disconnected event', async () => {
    server = new SocketBusServer(bus, { socketPath });
    await server.listen();

    const disconnected = [];
    server.on('client-disconnected', (info) => disconnected.push(info));

    const client = new SocketBusClient({
      socketPath,
      agentId: 'agent-1',
      squadId: 'squad-alpha',
    });
    await client.connect();
    client.close();

    await waitFor(() => disconnected.length > 0);
    expect(disconnected[0].agentId).toBe('agent-1');
    expect(disconnected[0].squadId).toBe('squad-alpha');
  });

  it('tracks connected clients', async () => {
    server = new SocketBusServer(bus, { socketPath });
    await server.listen();

    const c1 = new SocketBusClient({ socketPath, agentId: 'a1', squadId: 's1' });
    const c2 = new SocketBusClient({ socketPath, agentId: 'a2', squadId: 's1' });

    await c1.connect();
    await c2.connect();

    expect(server.clientCount).toBe(2);
    const clients = server.listClients();
    expect(clients.map((c) => c.agentId).sort()).toEqual(['a1', 'a2']);

    c1.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(server.clientCount).toBe(1);

    c2.close();
  });

  it('server close disconnects all clients', async () => {
    server = new SocketBusServer(bus, { socketPath });
    await server.listen();

    const c1 = new SocketBusClient({ socketPath, agentId: 'a1', squadId: 's1' });
    const c2 = new SocketBusClient({ socketPath, agentId: 'a2', squadId: 's1' });

    await c1.connect();
    await c2.connect();

    const disconnected = [];
    c1.on('disconnected', () => disconnected.push('a1'));
    c2.on('disconnected', () => disconnected.push('a2'));

    await server.close();
    server = null;

    await waitFor(() => disconnected.length === 2);
    expect(disconnected.sort()).toEqual(['a1', 'a2']);
  });
});

// ══════════════════════════════════════════════════════════
// 5. PUB/SUB, REQUEST/REPLY THROUGH SOCKET
// ══════════════════════════════════════════════════════════

describe('Pub/sub and request/reply through socket', () => {
  let bus, server, socketPath;

  beforeEach(() => {
    bus = new MessageBus();
    socketPath = tmpSocket();
  });

  afterEach(async () => {
    if (server) await server.close();
    bus.close();
  });

  it('multi-client pub/sub within same squad', async () => {
    server = new SocketBusServer(bus, { socketPath });
    await server.listen();

    const c1 = new SocketBusClient({ socketPath, agentId: 'a1', squadId: 's1' });
    const c2 = new SocketBusClient({ socketPath, agentId: 'a2', squadId: 's1' });

    await c1.connect();
    await c2.connect();

    const received = [];
    c2.subscribe('chat', (msg) => received.push(msg));
    await new Promise((r) => setTimeout(r, 200));

    c1.publish('chat', 'event', { text: 'hello' });

    await waitFor(() => received.length > 0);
    expect(received[0].payload.text).toBe('hello');
    expect(received[0].senderId).toBe('a1');

    c1.close();
    c2.close();
  });

  it('client-to-client request/reply within squad', async () => {
    server = new SocketBusServer(bus, { socketPath });
    await server.listen();

    // Set up bus-side responder with namespaced topic
    bus.subscribe('squad.s1.calc', (msg) => {
      if (msg.type === 'request') {
        bus.reply(msg, { result: msg.payload.a + msg.payload.b });
      }
    });

    const requester = new SocketBusClient({ socketPath, agentId: 'requester', squadId: 's1' });
    await requester.connect();

    const response = await requester.request('calc', { a: 3, b: 4 });
    expect(response.payload.result).toBe(7);

    requester.close();
  });

  it('heartbeat works through socket', async () => {
    server = new SocketBusServer(bus, { socketPath });
    await server.listen();

    const received = [];
    bus.subscribe('squad.s1.hb', (msg) => received.push(msg));

    const client = new SocketBusClient({ socketPath, agentId: 'a1', squadId: 's1' });
    await client.connect();

    client.publish('hb', 'heartbeat', { cpu: 0.5 });

    await waitFor(() => received.length > 0);
    expect(received[0].type).toBe('heartbeat');
    expect(received[0].senderId).toBe('a1');

    client.close();
  });
});

// ══════════════════════════════════════════════════════════
// 6. SQUAD REPOSITORY VALIDATION
// ══════════════════════════════════════════════════════════

describe('Squad repository validation', () => {
  let bus, server, socketPath;

  beforeEach(() => {
    bus = new MessageBus();
    socketPath = tmpSocket();
  });

  afterEach(async () => {
    if (server) await server.close();
    bus.close();
  });

  it('rejects agent not in squad', async () => {
    const mockSquadRepo = {
      getById: (id) => (id === 'squad-alpha' ? { id: 'squad-alpha', name: 'Alpha' } : null),
      listMembers: (squadId) => {
        if (squadId === 'squad-alpha') return [{ agentId: 'agent-1', squadId, role: 'member' }];
        return [];
      },
    };

    server = new SocketBusServer(bus, { socketPath, squadRepo: mockSquadRepo });
    await server.listen();

    const client = new SocketBusClient({
      socketPath,
      agentId: 'agent-999',
      squadId: 'squad-alpha',
    });

    await expect(client.connect()).rejects.toThrow('not a member');
  });

  it('rejects non-existent squad', async () => {
    const mockSquadRepo = {
      getById: () => null,
      listMembers: () => [],
    };

    server = new SocketBusServer(bus, { socketPath, squadRepo: mockSquadRepo });
    await server.listen();

    const client = new SocketBusClient({
      socketPath,
      agentId: 'agent-1',
      squadId: 'nonexistent',
    });

    await expect(client.connect()).rejects.toThrow('Squad not found');
  });
});

// ══════════════════════════════════════════════════════════
// LEADER ROLE & ROSTER IN HANDSHAKE
// ══════════════════════════════════════════════════════════

describe('Leader role & roster in handshake', () => {
  let bus, server, socketPath;

  beforeEach(() => {
    bus = new MessageBus();
    socketPath = tmpSocket();
  });

  afterEach(async () => {
    if (server) await server.close();
    bus.close();
  });

  it('returns role=leader and roster for leader agent', async () => {
    const mockSquadRepo = {
      getById: (id) => (id === 'sq1' ? { id: 'sq1', name: 'Alpha' } : null),
      listMembers: (squadId) => [
        { agentId: 'leader-1', squadId, role: 'leader' },
        { agentId: 'member-1', squadId, role: 'member' },
        { agentId: 'member-2', squadId, role: 'member' },
      ],
    };

    server = new SocketBusServer(bus, { socketPath, squadRepo: mockSquadRepo });
    await server.listen();

    const client = new SocketBusClient({
      socketPath,
      agentId: 'leader-1',
      squadId: 'sq1',
    });

    await client.connect();
    expect(client.role).toBe('leader');
    expect(client.roster).toHaveLength(3);
    expect(client.roster[0]).toEqual({ agentId: 'leader-1', role: 'leader' });
    expect(client.roster[1]).toEqual({ agentId: 'member-1', role: 'member' });

    client.close();
  });

  it('returns role=member and no roster for member agent', async () => {
    const mockSquadRepo = {
      getById: (id) => (id === 'sq1' ? { id: 'sq1', name: 'Alpha' } : null),
      listMembers: (squadId) => [
        { agentId: 'leader-1', squadId, role: 'leader' },
        { agentId: 'member-1', squadId, role: 'member' },
      ],
    };

    server = new SocketBusServer(bus, { socketPath, squadRepo: mockSquadRepo });
    await server.listen();

    const client = new SocketBusClient({
      socketPath,
      agentId: 'member-1',
      squadId: 'sq1',
    });

    await client.connect();
    expect(client.role).toBe('member');
    expect(client.roster).toBeNull();

    client.close();
  });

  it('emits client-connected with role', async () => {
    const mockSquadRepo = {
      getById: (id) => (id === 'sq1' ? { id: 'sq1', name: 'Alpha' } : null),
      listMembers: (squadId) => [
        { agentId: 'leader-1', squadId, role: 'leader' },
      ],
    };

    server = new SocketBusServer(bus, { socketPath, squadRepo: mockSquadRepo });
    await server.listen();

    const events = [];
    server.on('client-connected', (data) => events.push(data));

    const client = new SocketBusClient({
      socketPath,
      agentId: 'leader-1',
      squadId: 'sq1',
    });

    await client.connect();
    await waitFor(() => events.length > 0);

    expect(events[0].role).toBe('leader');
    client.close();
  });

  it('leader can delegate to member via publish', async () => {
    const mockSquadRepo = {
      getById: (id) => (id === 'sq1' ? { id: 'sq1', name: 'Alpha' } : null),
      listMembers: (squadId) => [
        { agentId: 'leader-1', squadId, role: 'leader' },
        { agentId: 'member-1', squadId, role: 'member' },
      ],
    };

    server = new SocketBusServer(bus, { socketPath, squadRepo: mockSquadRepo });
    await server.listen();

    const leader = new SocketBusClient({ socketPath, agentId: 'leader-1', squadId: 'sq1' });
    const member = new SocketBusClient({ socketPath, agentId: 'member-1', squadId: 'sq1' });

    await leader.connect();
    await member.connect();

    const received = [];
    member.subscribe('member.member-1.delegate', (msg) => received.push(msg));

    // Give subscribe time to register
    await new Promise((r) => setTimeout(r, 50));

    leader.delegate('member-1', { task: 'build-widget', priority: 'high' });

    await waitFor(() => received.length > 0);
    expect(received[0].payload.task).toBe('build-widget');

    leader.close();
    member.close();
  });
});

// ══════════════════════════════════════════════════════════
// 7. SQUAD DELEGATION FLOW (delegate / complete / error)
// ══════════════════════════════════════════════════════════

describe('Squad delegation flow (delegate / complete / error)', () => {
  let bus, server, socketPath;

  beforeEach(() => {
    bus = new MessageBus();
    socketPath = tmpSocket();
  });

  afterEach(async () => {
    if (server) await server.close();
    bus.close();
  });

  it('leader publishes to delegate topic, member receives via orchestrator bridge', async () => {
    const mockSquadRepo = {
      getById: (id) => (id === 'sq1' ? { id: 'sq1', name: 'Alpha' } : null),
      listMembers: (squadId) => [
        { agentId: 'leader-1', squadId, role: 'leader' },
        { agentId: 'member-1', squadId, role: 'member' },
      ],
    };

    server = new SocketBusServer(bus, { socketPath, squadRepo: mockSquadRepo });
    await server.listen();

    const leader = new SocketBusClient({ socketPath, agentId: 'leader-1', squadId: 'sq1' });
    await leader.connect();

    // Orchestrator-side: listen on the bus for delegation events
    const delegationEvents = [];
    bus.subscribe('squad.sq1.delegate', (msg) => delegationEvents.push(msg));

    leader.delegateTask('member-1', { task: 'process-data', input: [1, 2, 3] });

    await waitFor(() => delegationEvents.length > 0);
    expect(delegationEvents[0].payload.targetAgentId).toBe('member-1');
    expect(delegationEvents[0].payload.task).toBe('process-data');
    expect(delegationEvents[0].senderId).toBe('leader-1');

    leader.close();
  });

  it('member publishes complete event, leader receives it', async () => {
    const mockSquadRepo = {
      getById: (id) => (id === 'sq1' ? { id: 'sq1', name: 'Alpha' } : null),
      listMembers: (squadId) => [
        { agentId: 'leader-1', squadId, role: 'leader' },
        { agentId: 'member-1', squadId, role: 'member' },
      ],
    };

    server = new SocketBusServer(bus, { socketPath, squadRepo: mockSquadRepo });
    await server.listen();

    const leader = new SocketBusClient({ socketPath, agentId: 'leader-1', squadId: 'sq1' });
    const member = new SocketBusClient({ socketPath, agentId: 'member-1', squadId: 'sq1' });

    await leader.connect();
    await member.connect();

    // Leader subscribes to complete events
    const completions = [];
    leader.subscribe('complete', (msg) => completions.push(msg));
    await new Promise((r) => setTimeout(r, 50));

    member.complete({ result: [2, 4, 6], duration: 1234 });

    await waitFor(() => completions.length > 0);
    expect(completions[0].payload.agentId).toBe('member-1');
    expect(completions[0].payload.result).toEqual([2, 4, 6]);
    expect(completions[0].payload.duration).toBe(1234);

    leader.close();
    member.close();
  });

  it('member publishes error event, leader receives it', async () => {
    const mockSquadRepo = {
      getById: (id) => (id === 'sq1' ? { id: 'sq1', name: 'Alpha' } : null),
      listMembers: (squadId) => [
        { agentId: 'leader-1', squadId, role: 'leader' },
        { agentId: 'member-1', squadId, role: 'member' },
      ],
    };

    server = new SocketBusServer(bus, { socketPath, squadRepo: mockSquadRepo });
    await server.listen();

    const leader = new SocketBusClient({ socketPath, agentId: 'leader-1', squadId: 'sq1' });
    const member = new SocketBusClient({ socketPath, agentId: 'member-1', squadId: 'sq1' });

    await leader.connect();
    await member.connect();

    const errors = [];
    leader.subscribe('error', (msg) => errors.push(msg));
    await new Promise((r) => setTimeout(r, 50));

    member.error('Task failed: out of memory', { code: 'OOM', heapUsed: 512 });

    await waitFor(() => errors.length > 0);
    expect(errors[0].payload.agentId).toBe('member-1');
    expect(errors[0].payload.error).toBe('Task failed: out of memory');
    expect(errors[0].payload.details.code).toBe('OOM');

    leader.close();
    member.close();
  });

  it('full delegation roundtrip: leader delegates, member completes', async () => {
    const mockSquadRepo = {
      getById: (id) => (id === 'sq1' ? { id: 'sq1', name: 'Alpha' } : null),
      listMembers: (squadId) => [
        { agentId: 'leader-1', squadId, role: 'leader' },
        { agentId: 'member-1', squadId, role: 'member' },
      ],
    };

    server = new SocketBusServer(bus, { socketPath, squadRepo: mockSquadRepo });
    await server.listen();

    const leader = new SocketBusClient({ socketPath, agentId: 'leader-1', squadId: 'sq1' });
    const member = new SocketBusClient({ socketPath, agentId: 'member-1', squadId: 'sq1' });

    await leader.connect();
    await member.connect();

    // Simulate orchestrator bridging: subscribe on bus, spawn member, route result
    const delegationEvents = [];
    const completions = [];

    bus.subscribe('squad.sq1.delegate', (msg) => {
      delegationEvents.push(msg);
      // In real orchestrator, this would spawn the member.
      // Here we simulate the member doing work and completing.
    });

    leader.subscribe('complete', (msg) => completions.push(msg));
    await new Promise((r) => setTimeout(r, 50));

    // Step 1: Leader delegates
    leader.delegateTask('member-1', { task: 'sum', data: [10, 20, 30] });

    await waitFor(() => delegationEvents.length > 0);
    expect(delegationEvents[0].payload.targetAgentId).toBe('member-1');

    // Step 2: Member completes (simulating work done)
    member.complete({ result: 60 });

    await waitFor(() => completions.length > 0);
    expect(completions[0].payload.result).toBe(60);
    expect(completions[0].payload.agentId).toBe('member-1');

    leader.close();
    member.close();
  });

  it('delegation topics are squad-isolated', async () => {
    const mockSquadRepo = {
      getById: (id) => (['sq1', 'sq2'].includes(id) ? { id, name: id } : null),
      listMembers: (squadId) => {
        if (squadId === 'sq1') return [{ agentId: 'l1', squadId, role: 'leader' }, { agentId: 'm1', squadId, role: 'member' }];
        if (squadId === 'sq2') return [{ agentId: 'l2', squadId, role: 'leader' }, { agentId: 'm2', squadId, role: 'member' }];
        return [];
      },
    };

    server = new SocketBusServer(bus, { socketPath, squadRepo: mockSquadRepo });
    await server.listen();

    const leader1 = new SocketBusClient({ socketPath, agentId: 'l1', squadId: 'sq1' });
    const leader2 = new SocketBusClient({ socketPath, agentId: 'l2', squadId: 'sq2' });

    await leader1.connect();
    await leader2.connect();

    const sq1Events = [];
    const sq2Events = [];
    leader1.subscribe('complete', (msg) => sq1Events.push(msg));
    leader2.subscribe('complete', (msg) => sq2Events.push(msg));
    await new Promise((r) => setTimeout(r, 50));

    // Only sq1 member completes — sq2 leader should not receive it
    const member1 = new SocketBusClient({ socketPath, agentId: 'm1', squadId: 'sq1' });
    await member1.connect();
    member1.complete({ result: 'done' });

    await waitFor(() => sq1Events.length > 0);
    expect(sq1Events[0].payload.result).toBe('done');

    await new Promise((r) => setTimeout(r, 100));
    expect(sq2Events).toHaveLength(0);

    leader1.close();
    leader2.close();
    member1.close();
  });
});
