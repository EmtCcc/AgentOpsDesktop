'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { safeStorage, app } = require('electron');
const logger = require('../../logger');

const TOKEN_BYTES = 48;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

class TokenManager {
  constructor() {
    this._session = null; // { token, createdAt, expiresAt }
    this._storagePath = null;
  }

  /**
   * Initialize the token manager. Must be called after app.whenReady().
   * Loads any persisted session from disk.
   */
  init() {
    try {
      this._storagePath = path.join(app.getPath('userData'), 'auth.enc');
    } catch {
      this._storagePath = path.join(process.cwd(), '.auth.enc');
    }
    this._loadSession();
    logger.info('token-manager.init', { hasSession: !!this._session });
  }

  /**
   * Create a new session token. Returns the plaintext token.
   * The token is encrypted and persisted to disk.
   */
  createSession() {
    const token = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
    const now = Date.now();

    this._session = {
      token,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    };

    this._persistSession();
    logger.info('token-manager.session-created', { expiresAt: this._session.expiresAt });

    return {
      token,
      createdAt: this._session.createdAt,
      expiresAt: this._session.expiresAt,
    };
  }

  /**
   * Validate a token against the current session.
   * Returns true if valid and not expired.
   */
  validate(token) {
    if (!this._session) return false;
    if (Date.now() > this._session.expiresAt) {
      this.destroySession();
      return false;
    }
    return crypto.timingSafeEqual(
      Buffer.from(this._session.token, 'utf8'),
      Buffer.from(token, 'utf8')
    );
  }

  /**
   * Check if a valid session exists (without needing the token).
   */
  hasValidSession() {
    if (!this._session) return false;
    if (Date.now() > this._session.expiresAt) {
      this.destroySession();
      return false;
    }
    return true;
  }

  /**
   * Get session metadata (without the token itself).
   */
  getSessionInfo() {
    if (!this._session) return null;
    if (Date.now() > this._session.expiresAt) {
      this.destroySession();
      return null;
    }
    return {
      createdAt: this._session.createdAt,
      expiresAt: this._session.expiresAt,
      isValid: true,
    };
  }

  /**
   * Destroy the current session and remove persisted data.
   */
  destroySession() {
    this._session = null;
    this._clearPersistedSession();
    logger.info('token-manager.session-destroyed');
  }

  /**
   * Rotate the session token (create new, invalidate old).
   */
  rotateSession() {
    this.destroySession();
    return this.createSession();
  }

  // ── Persistence (encrypted via safeStorage / OS keychain) ──

  _persistSession() {
    if (!this._storagePath || !this._session) return;
    try {
      const data = JSON.stringify(this._session);
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(data);
        fs.writeFileSync(this._storagePath, encrypted);
      } else {
        // Fallback: base64 obfuscation (not true encryption, but avoids plaintext)
        const encoded = Buffer.from(data, 'utf8').toString('base64');
        fs.writeFileSync(this._storagePath, encoded, 'utf8');
        logger.warn('token-manager.encryption-unavailable', {
          detail: 'safeStorage not available, using base64 fallback',
        });
      }
    } catch (err) {
      logger.error('token-manager.persist-failed', { err: { message: err.message } });
    }
  }

  _loadSession() {
    if (!this._storagePath) return;
    try {
      if (!fs.existsSync(this._storagePath)) return;

      const raw = fs.readFileSync(this._storagePath);
      let data;

      if (safeStorage.isEncryptionAvailable()) {
        data = safeStorage.decryptString(raw);
      } else {
        data = Buffer.from(raw.toString('utf8'), 'base64').toString('utf8');
      }

      const session = JSON.parse(data);

      // Validate structure
      if (!session.token || !session.createdAt || !session.expiresAt) {
        logger.warn('token-manager.corrupt-session', { detail: 'Invalid session structure' });
        this._clearPersistedSession();
        return;
      }

      // Check expiry
      if (Date.now() > session.expiresAt) {
        logger.info('token-manager.session-expired');
        this._clearPersistedSession();
        return;
      }

      this._session = session;
    } catch (err) {
      logger.warn('token-manager.load-failed', { err: { message: err.message } });
      this._clearPersistedSession();
    }
  }

  _clearPersistedSession() {
    try {
      if (this._storagePath && fs.existsSync(this._storagePath)) {
        fs.unlinkSync(this._storagePath);
      }
    } catch {
      // best effort
    }
  }
}

module.exports = { TokenManager };
