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

import {
  BeforeCreate,
  BeforeDelete,
  BeforeUpdate,
  Entity,
  EventArgs,
  Filter,
  ManyToOne,
  Property,
  ref,
  Ref
} from '@mikro-orm/core';
import { requestContext } from '@fastify/request-context';

import { inJob, inSeeder } from '@/context';
import { ProjectPrincipal } from '@/administration/entities/project-principal.entity';
import { BaseEntity, BaseEntityInput } from '@/common/base.entity';

@Entity()
@Filter({
  name: 'EmbeddingsAccess',
  cond: async () => {
    throw new Error('Not Implemented');
  },
  default: true
})
export class Embeddings extends BaseEntity {
  getIdPrefix(): string {
    return 'embeddings';
  }

  @Property()
  model!: string;

  @Property()
  inputs!: string[];

  @Property()
  error?: string;

  @ManyToOne()
  projectPrincipal?: Ref<ProjectPrincipal>;

  constructor({ model, inputs, ...rest }: EmbeddingsInput) {
    super(rest);

    this.model = model;
    this.inputs = inputs;

    const projectPrincipal = requestContext.get('projectPrincipal');
    if (projectPrincipal) {
      this.projectPrincipal = ref(projectPrincipal);
    }
  }

  @BeforeCreate()
  @BeforeUpdate()
  @BeforeDelete()
  async authorize(_: EventArgs<any>) {
    if (inJob() || inSeeder()) return;
    const projectPrincipal = requestContext.get('projectPrincipal');
    if (projectPrincipal && this.projectPrincipal === ref(projectPrincipal)) {
      return;
    }
    throw new Error('Unauthorized');
  }
}

export type EmbeddingsInput = BaseEntityInput & Pick<Embeddings, 'model' | 'inputs'>;
