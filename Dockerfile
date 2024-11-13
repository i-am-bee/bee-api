FROM node:22.2-alpine AS base

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat

ENV APP_DIR=/app

RUN mkdir -p ${APP_DIR}
WORKDIR ${APP_DIR}

# Install dependencies only when needed
FROM base AS deps

ENV CI=1
ENV HUSKY=0

# Install dependencies based on the preferred package manager
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm i --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder

ENV CI=1

COPY --from=deps ${APP_DIR}/node_modules ./node_modules
COPY . .

RUN corepack enable pnpm && pnpm run build;

# Production image, copy all the files and run next
FROM base AS runner

ENV NODE_ENV production

# https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md
RUN deluser --remove-home node \
  && addgroup -S node -g 1001 \
  && adduser -S -G node -u 1001 node

COPY --chown=node:node --from=deps ${APP_DIR}/package.json ./
COPY --chown=node:node --from=deps ${APP_DIR}/node_modules ./node_modules
COPY --chown=node:node --from=builder ${APP_DIR}/dist ./dist

RUN chown -R 1001:0 ${APP_DIR} &&\
  chmod -R g+w ${APP_DIR}

USER node

EXPOSE 4000

ENV PORT 4000
ENV BEE_FRAMEWORK_INSTRUMENTATION_ENABLED true

CMD [ "node", "--enable-source-maps", "--experimental-loader=@opentelemetry/instrumentation/hook.mjs", "--import", "./dist/opentelemetry.js", "./dist/server.js" ]
