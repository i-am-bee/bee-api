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

import { Entity, Property } from '@mikro-orm/core';

import { Artifact, ArtifactInput, ArtifactType } from './artifact.entity.js';

@Entity({ discriminatorValue: ArtifactType.APP })
export class AppArtifact extends Artifact {
  type = ArtifactType.APP;

  @Property()
  sourceCode: string;

  constructor({ sourceCode, ...rest }: AppArtifactInput) {
    super(rest);
    this.sourceCode = sourceCode;
  }
}

export type AppArtifactInput = ArtifactInput & Pick<AppArtifact, 'sourceCode'>;
