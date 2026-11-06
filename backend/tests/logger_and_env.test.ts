import { describe, it, expect } from 'vitest';
import { env } from '../src/config/env.js';
import { getIceServers } from '../src/services/webrtcService.js';
import { getStorageConfiguration, generateMediaStorageKey } from '../src/services/storageService.js';

describe('Environment and Services Configuration', () => {
  it('parses environment with default fallback values', () => {
    expect(env.PORT).toBeGreaterThan(0);
    expect(env.DATABASE_URL).toBeDefined();
    expect(typeof env.CORS_ORIGIN).toBe('string');
  });

  it('generates WebRTC STUN ice servers correctly', () => {
    const servers = getIceServers();
    expect(servers.length).toBeGreaterThan(0);
    expect(servers[0].urls).toBeDefined();
  });

  it('generates storage config and safe media keys', () => {
    const config = getStorageConfiguration();
    expect(config.bucket).toBe('atti-media');

    const key = generateMediaStorageKey('user-123', 'avatar photo.png');
    expect(key).toContain('user-123');
    expect(key).toContain('avatar_photo.png');
  });
});

