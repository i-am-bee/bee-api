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
import { entries } from 'remeda';

import { Event } from './dtos/event.js';

export const init = (res: FastifyReply) => {
  res.hijack();
  if (!res.raw.headersSent) {
    const headers = res.getHeaders();
    entries(headers).forEach(([key, value]) => {
      if (value) res.raw.setHeader(key, value);
    });
    res.raw.setHeader('Content-Type', 'text/event-stream');
    res.raw.setHeader('Connection', 'keep-alive');
    res.raw.setHeader('Cache-Control', 'no-cache,no-transform');
    res.raw.setHeader('x-no-compression', 1);
  }
};

export const send = (res: FastifyReply, event: Event) => {
  res.raw.write(createMessage(event));
};

export const end = (res: FastifyReply) => {
  res.raw.end();
};

function createMessage(event: Event): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}
