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

import 'dotenv/config';

import { NodeSDK, resources, metrics } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from '@opentelemetry/semantic-conventions/incubating';

const ENV = process.env.ENVIRONMENT;

export const opentelemetrySDK = new NodeSDK({
  resource: new resources.Resource({
    [ATTR_SERVICE_NAME]: `bee-api`,
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: ENV
  }),
  metricReader: new metrics.PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter() }),
  instrumentations: [...getNodeAutoInstrumentations()]
});
opentelemetrySDK.start();
