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

import { GoogleSearchTool } from 'bee-agent-framework/tools/search/googleSearch';
import { DuckDuckGoSearchTool } from 'bee-agent-framework/tools/search/duckDuckGoSearch';
import { SearchToolOptions } from 'bee-agent-framework/tools/search/base';

import { SearchToolBackend } from '@/runs/execution/constants';
import { BEE_GOOGLE_SEARCH_API_KEY, BEE_GOOGLE_SEARCH_CSE_ID, SEARCH_TOOL_BACKEND } from '@/config';

export function createSearchTool(options?: SearchToolOptions, backend = SEARCH_TOOL_BACKEND) {
  switch (backend) {
    case SearchToolBackend.GOOGLE:
      if (!BEE_GOOGLE_SEARCH_API_KEY || !BEE_GOOGLE_SEARCH_CSE_ID) {
        throw new Error('Google Search API key or CSE ID not provided');
      }
      return new GoogleSearchTool({
        apiKey: BEE_GOOGLE_SEARCH_API_KEY,
        cseId: BEE_GOOGLE_SEARCH_CSE_ID,
        maxResults: 10,
        ...options
      });
    case SearchToolBackend.DUCK_DUCK_GO:
      return new DuckDuckGoSearchTool({ maxResults: 10, ...options });
  }
}
