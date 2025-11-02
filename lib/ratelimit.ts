import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

type LimitResult = { success: boolean };

interface Limiter {
  limit: (key: string) => Promise<LimitResult>;
}

type DurationUnit = 'ms' | 's' | 'm' | 'h' | 'd';
type DurationString = `${number} ${DurationUnit}` | `${number}${DurationUnit}`;

let warnedAboutLimiter = false;

function createLimiter(requests: number, interval: DurationString): Limiter {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const isProd = process.env.NODE_ENV === 'production';

  if (url && token) {
    const redis = new Redis({ url, token });
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(requests, interval)
    });

    return {
      limit: async (key: string) => {
        const result = await ratelimit.limit(key);
        return { success: result.success };
      }
    };
  }

  if (isProd) {
    throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in production');
  }

  if (process.env.NODE_ENV !== 'test' && !warnedAboutLimiter) {
    console.warn('[ratelimit] Upstash credentials missing; falling back to unlimited requests.');
    warnedAboutLimiter = true;
  }

  return {
    limit: async () => ({ success: true })
  };
}

export const writeLimiter = createLimiter(20, '1 m');
export const loginLimiter = createLimiter(5, '1 m');
