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

import { Embeddable, Property } from '@mikro-orm/core';

export const VectorStoreExpirationAfterAnchor = {
  LAST_ACTIVE_AT: 'last_active_at'
};
export type VectorStoreExpirationAfterAnchor =
  (typeof VectorStoreExpirationAfterAnchor)[keyof typeof VectorStoreExpirationAfterAnchor];

@Embeddable()
export class VectorStoreExpirationAfter {
  @Property()
  anchor: VectorStoreExpirationAfterAnchor = VectorStoreExpirationAfterAnchor.LAST_ACTIVE_AT;

  @Property()
  days!: number;

  constructor(input: VectorStoreExpirationAfterInput) {
    this.anchor = input.anchor;
    this.days = input.days;
  }
}

export type VectorStoreExpirationAfterInput = Pick<VectorStoreExpirationAfter, 'anchor' | 'days'>;