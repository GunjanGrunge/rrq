# Build context: monorepo root (..)
# SST: container.context = "..", container.file = "lambdas/visual-gen/Dockerfile"

FROM --platform=linux/amd64 public.ecr.aws/lambda/nodejs:20 AS builder

WORKDIR /repo

# Copy root workspace manifests first (cache layer)
COPY package.json package-lock.json ./

# Copy workspace package.json files so npm workspaces resolves links
COPY packages/lambda-types/package.json ./packages/lambda-types/
COPY packages/remotion-compositions/package.json ./packages/remotion-compositions/
COPY lambdas/visual-gen/package.json ./lambdas/visual-gen/

# Install all workspace deps (resolves * workspace references, includes optional)
RUN npm install --include=optional

# Now copy actual source
COPY packages/lambda-types/ ./packages/lambda-types/
COPY packages/remotion-compositions/ ./packages/remotion-compositions/
COPY lambdas/tsconfig.base.json ./lambdas/
COPY lambdas/visual-gen/ ./lambdas/visual-gen/

# Compile TypeScript for visual-gen
RUN cd lambdas/visual-gen && npx tsc

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM --platform=linux/amd64 public.ecr.aws/lambda/nodejs:20

# Chromium / Puppeteer system deps on Amazon Linux 2023
RUN dnf install -y \
    atk \
    cups-libs \
    gtk3 \
    libXcomposite \
    libXcursor \
    libXdamage \
    libXext \
    libXi \
    libXrandr \
    libXtst \
    pango \
    mesa-libgbm \
    alsa-lib \
    nss \
    tar xz \
    && dnf clean all

# FFmpeg baked in — no Lambda layer needed
# curl-minimal is already in the base image
RUN curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz | \
    tar -xJ --strip-components=1 -C /usr/local/bin/ --wildcards '*/ffmpeg' '*/ffprobe'

# Copy compiled handler
COPY --from=builder /repo/lambdas/visual-gen/dist/ ${LAMBDA_TASK_ROOT}/

# Copy node_modules (workspace deps resolved during npm install at root)
COPY --from=builder /repo/node_modules/ ${LAMBDA_TASK_ROOT}/node_modules/

CMD ["handler.handler"]
