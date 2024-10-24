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

import { Embeddable, Enum } from '@mikro-orm/core';

import { StaticChunkingStrategy } from './static-chunking-strategy.entity.js';
import { AutoChunkingStrategy } from './auto-chunking.strategy.entity.js';

export const ChunkingStrategyType = {
  STATIC: 'static',
  AUTO: 'auto'
} as const;
export type ChunkingStrategyType = (typeof ChunkingStrategyType)[keyof typeof ChunkingStrategyType];

@Embeddable({ abstract: true, discriminatorColumn: 'type' })
export abstract class ChunkingStrategy {
  @Enum(() => ChunkingStrategyType)
  type!: ChunkingStrategyType;
}

export type AnyChunkingStrategy = AutoChunkingStrategy | StaticChunkingStrategy;
