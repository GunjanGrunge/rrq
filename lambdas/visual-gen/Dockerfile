FROM public.ecr.aws/lambda/nodejs:20

# Install Chromium dependencies + fonts for Remotion rendering
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
    libXScrnSaver \
    libXtst \
    pango \
    xorg-x11-fonts-100dpi \
    xorg-x11-fonts-75dpi \
    xorg-x11-fonts-cyrillic \
    xorg-x11-fonts-misc \
    xorg-x11-fonts-Type1 \
    xorg-x11-utils \
    mesa-libgbm \
    && dnf clean all

# Install FFmpeg (needed for Remotion video rendering)
RUN dnf install -y tar xz && \
    curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz | \
    tar -xJ --strip-components=1 -C /usr/local/bin/ --wildcards '*/ffmpeg' '*/ffprobe' && \
    dnf clean all

# Copy function code
COPY dist/ ${LAMBDA_TASK_ROOT}/

CMD ["handler.handler"]
