// Global test setup — mocks are managed per-file via vi.doMock in test harness
import { vi } from 'vitest';

// Mock electron globally for all tests
vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/agentops-test',
    getName: () => 'AgentOps',
    getVersion: () => '0.1.0',
  },
  ipcMain: {
    on: vi.fn(),
    handle: vi.fn(),
  },
  BrowserWindow: class BrowserWindow {},
  dialog: {
    showMessageBox: vi.fn(() => Promise.resolve({ response: 0 })),
  },
  shell: {
    openExternal: vi.fn(() => Promise.resolve()),
  },
}));
