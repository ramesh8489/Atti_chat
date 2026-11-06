import crypto from 'crypto';
import { env } from '../config/env.js';

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * Returns configured ICE servers (STUN and TURN).
 * If a TURN_SECRET is configured, generates short-lived time-limited
 * HMAC-SHA1 credentials per the standard TURN REST API (RFC 5766).
 */
export function getIceServers(userId?: string): IceServer[] {
  const stunUrls = env.STUN_SERVERS.split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  const servers: IceServer[] = [
    {
      urls: stunUrls,
    },
  ];

  if (env.TURN_SERVER_URL) {
    const turnUrls = env.TURN_SERVER_URL.split(',')
      .map((url) => url.trim())
      .filter(Boolean);

    if (env.TURN_SECRET) {
      // Ephemeral time-limited credentials (HMAC-SHA1)
      const expiry = Math.floor(Date.now() / 1000) + env.TURN_TTL_SECONDS;
      const username = `${expiry}:${userId || 'user'}`;
      const hmac = crypto.createHmac('sha1', env.TURN_SECRET);
      hmac.update(username);
      const credential = hmac.digest('base64');

      servers.push({
        urls: turnUrls,
        username,
        credential,
      });
    } else if (env.TURN_USERNAME && env.TURN_CREDENTIAL) {
      // Static credentials
      servers.push({
        urls: turnUrls,
        username: env.TURN_USERNAME,
        credential: env.TURN_CREDENTIAL,
      });
    } else {
      // TURN URL without auth (e.g. for local test relays)
      servers.push({
        urls: turnUrls,
      });
    }
  }

  return servers;
}
