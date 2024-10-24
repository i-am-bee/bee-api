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

import { NotImplementedError } from 'bee-agent-framework';

import { AutoChunkingStrategy } from '../entities/chunking-strategy/auto-chunking.strategy.entity';

import { ChunkingStrategyRequestParam } from '@/vector-store-files/dtos/chunking-strategy.js';
import { AnyChunkingStrategy } from '@/vector-store-files/entities/chunking-strategy/chunking-strategy.entity.js';

export function determineChunkingStrategy(
  param?: ChunkingStrategyRequestParam
): AnyChunkingStrategy {
  if (!param) return new AutoChunkingStrategy();

  switch (param.type) {
    case 'auto':
      return new AutoChunkingStrategy();
    default:
      throw new NotImplementedError('Chunking strategy not supported');
  }
}
