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

import { Entity, Index, ManyToOne, Property, Ref } from '@mikro-orm/core';

import { Tool } from './tool/tool.entity';

import { ProjectScopedEntity, ProjectScopedEntityInput } from '@/common/project-scoped.entity';

@Entity()
@Index({
  options: [
    {
      name: 1,
      tool: 1
    },
    {
      unique: true,
      partialFilterExpression: { deletedAt: { $in: [null] } }
    }
  ]
})
export class ToolSecret extends ProjectScopedEntity {
  getIdPrefix(): string {
    return 'tool-secret';
  }

  @Property()
  name: string;

  @Property()
  value: string;

  @ManyToOne()
  tool: Ref<Tool>;

  constructor({ name, value, tool, ...rest }: ToolSecretInput) {
    super(rest);
    this.name = name;
    this.value = value;
    this.tool = tool;
  }
}

type ToolSecretInput = ProjectScopedEntityInput & Pick<ToolSecret, 'name' | 'value' | 'tool'>;
