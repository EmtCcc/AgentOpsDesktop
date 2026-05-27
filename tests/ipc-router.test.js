import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

import { IpcRouter } from '../src/main/ipc/router.js';

describe('IpcRouter', () => {
  let router;

  beforeEach(() => {
    vi.clearAllMocks();
    router = new IpcRouter();
  });

  it('registers routes', () => {
    router.register('test:channel', async () => 'ok');
    expect(router.listRoutes()).toContain('test:channel');
  });

  it('throws on duplicate route', () => {
    router.register('test:channel', async () => 'ok');
    expect(() => router.register('test:channel', async () => 'dup')).toThrow('Duplicate IPC route');
  });

  it('bootstraps routes on ipcMain', async () => {
    const { ipcMain } = await import('electron');
    const handler = async () => 'result';

    router.register('test:channel', handler);
    router.bootstrap();

    expect(ipcMain.handle).toHaveBeenCalledWith('test:channel', expect.any(Function));
  });

  it('lists all registered routes', () => {
    router.register('route:a', async () => {});
    router.register('route:b', async () => {});
    router.register('route:c', async () => {});

    const routes = router.listRoutes();
    expect(routes).toHaveLength(3);
    expect(routes).toContain('route:a');
    expect(routes).toContain('route:b');
    expect(routes).toContain('route:c');
  });
});
