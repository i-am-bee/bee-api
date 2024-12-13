import { FastifyReply } from 'fastify';

import { dayjs, getLatestDailyFixedTime } from './datetime';

import { ensureRequestContextData } from '@/context';

function getNumericHeader(res: FastifyReply, header: string, fallback: number) {
  const value = res.getHeader(header);
  if (value === undefined) return fallback;
  if (typeof value !== 'number') throw new Error('Invalid header type');
  return value;
}

const RateLimitHeaders = {
  LIMIT: 'ratelimit-limit',
  REMAINING: 'ratelimit-remaining',
  RESET: 'ratelimit-reset',
  RETRY: 'retry-after'
} as const;

export function updateRateLimitHeadersWithDailyQuota({
  quota,
  used
}: {
  quota: number;
  used: number;
}) {
  const res = ensureRequestContextData('res');
  res.header(
    RateLimitHeaders.LIMIT,
    Math.min(getNumericHeader(res, RateLimitHeaders.LIMIT, Infinity), quota)
  );
  res.header(
    RateLimitHeaders.REMAINING,
    Math.min(getNumericHeader(res, RateLimitHeaders.REMAINING, Infinity), quota - used)
  );
  if (quota === used) {
    const reset = Math.max(
      getNumericHeader(res, RateLimitHeaders.RESET, 0),
      getLatestDailyFixedTime().add(1, 'day').unix() - dayjs().unix()
    );
    res.header(RateLimitHeaders.RESET, reset);
    res.header(RateLimitHeaders.RETRY, reset);
  }
}
