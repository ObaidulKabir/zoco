import { Injectable } from '@nestjs/common';

export type RateDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

const DEFAULT_LIMIT = 5;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Sliding window over the credential endpoints, keyed by client IP
 * (SYS-SEC-006, Sprint 1: 5 attempts / 15 min / IP). Limits are read per call
 * so tests can tighten or relax them without rebuilding the container.
 */
@Injectable()
export class AuthRateLimiter {
  private readonly hits = new Map<string, number[]>();

  get limit(): number {
    const configured = Number(process.env.AUTH_RATE_LIMIT);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_LIMIT;
  }

  get windowMs(): number {
    const configured = Number(process.env.AUTH_RATE_WINDOW_MS);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_WINDOW_MS;
  }

  hit(key: string, now = Date.now()): RateDecision {
    const { limit, windowMs } = this;
    const cutoff = now - windowMs;
    const recent = (this.hits.get(key) ?? []).filter((at) => at > cutoff);
    recent.push(now);
    this.hits.set(key, recent);
    const oldest = recent[0] ?? now;
    return {
      allowed: recent.length <= limit,
      limit,
      remaining: Math.max(0, limit - recent.length),
      resetAt: oldest + windowMs,
    };
  }

  clear(): void {
    this.hits.clear();
  }
}
