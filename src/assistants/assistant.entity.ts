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

import { Embedded, Entity, Enum, Property } from '@mikro-orm/core';

import { ProjectScopedEntity, ProjectScopedEntityInput } from '@/common/project-scoped.entity';
import { AnyToolUsage } from '@/tools/entities/tool-usages/tool-usage.entity.js';
import { CodeInterpreterUsage } from '@/tools/entities/tool-usages/code-interpreter-usage.entity.js';
import { FileSearchUsage } from '@/tools/entities/tool-usages/file-search-usage.entity.js';
import { FunctionUsage } from '@/tools/entities/tool-usages/function-usage.entity.js';
import { UserUsage } from '@/tools/entities/tool-usages/user-usage.entity.js';
import { SystemUsage } from '@/tools/entities/tool-usages/system-usage.entity.js';
import { CodeInterpreterResource } from '@/tools/entities/tool-resources/code-interpreter-resource.entity.js';
import { AnyToolResource } from '@/tools/entities/tool-resources/tool-resource.entity.js';
import { FileSearchResource } from '@/tools/entities/tool-resources/file-search-resources.entity.js';
import { UserResource } from '@/tools/entities/tool-resources/user-resource.entity';
import { SystemResource } from '@/tools/entities/tool-resources/system-resource.entity';
import { Agent } from '@/runs/execution/constants';

@Entity()
export class Assistant extends ProjectScopedEntity {
  getIdPrefix(): string {
    return 'asst';
  }

  @Enum(() => Agent)
  agent: Agent;

  // Union must be defined in alphabetical order, otherwise Mikro-ORM won't discovered the auto-created virtual polymorphic entity
  @Embedded({ object: true })
  tools!: (CodeInterpreterUsage | FileSearchUsage | FunctionUsage | SystemUsage | UserUsage)[];

  // Union must be defined in alphabetical order, otherwise Mikro-ORM won't discovered the auto-created virtual polymorphic entity
  @Embedded({ object: true })
  toolResources?: (CodeInterpreterResource | FileSearchResource | SystemResource | UserResource)[];

  @Property()
  name?: string;

  @Property()
  description?: string;

  @Property()
  instructions?: string;

  @Property()
  systemPromptOverwrite?: string;

  @Property()
  model!: string;

  @Property()
  topP?: number;

  @Property()
  temperature?: number;

  constructor({
    name,
    description,
    instructions,
    tools,
    toolResources,
    model,
    agent,
    topP,
    temperature,
    systemPromptOverwrite,
    ...rest
  }: AssistantInput) {
    super(rest);

    this.name = name;
    this.description = description;
    this.instructions = instructions;
    this.tools = tools;
    this.toolResources = toolResources;
    this.model = model;
    this.agent = agent;
    this.topP = topP;
    this.temperature = temperature;
    this.systemPromptOverwrite = systemPromptOverwrite;
  }
}

export type AssistantInput = ProjectScopedEntityInput & {
  tools: AnyToolUsage[];
  toolResources?: AnyToolResource[];
} & Pick<
    Assistant,
    'instructions' | 'name' | 'description' | 'model' | 'agent' | 'systemPromptOverwrite'
  > &
  Partial<Pick<Assistant, 'topP' | 'temperature'>>;
