FROM public.ecr.aws/lambda/nodejs:20

# Install FFmpeg
RUN dnf install -y tar xz && \
    curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz | \
    tar -xJ --strip-components=1 -C /usr/local/bin/ --wildcards '*/ffmpeg' '*/ffprobe' && \
    dnf clean all

# Copy function code
COPY dist/ ${LAMBDA_TASK_ROOT}/

CMD ["handler.handler"]
