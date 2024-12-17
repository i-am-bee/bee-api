/**
 * Copyright 2024 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
