# syntax=docker/dockerfile:1
FROM ros:noetic-perception

ENV DEBIAN_FRONTEND=noninteractive \
    SWARM_WS=/opt/swarm_ws \
    SWARM_GCS_ROOT=/opt/swarm_gcs

# Base tooling, ROS bridge utilities, Electron runtime deps, and sudo (needed by LCM build instructions)
RUN apt-get update && apt-get install -y --no-install-recommends \
    apt-transport-https \
    build-essential \
    ca-certificates \
    clang \
    cmake \
    curl \
    git \
    gnupg2 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libglib2.0-dev \
    libarmadillo-dev \
    libnspr4 \
    libnss3 \
    libxcb-dri3-0 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxkbcommon0 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    mesa-utils \
    python3-catkin-tools \
    python3-pip \
    ros-noetic-rosapi \
    ros-noetic-rosbridge-server \
    ros-noetic-tf2-web-republisher \
    ros-noetic-rviz \
    software-properties-common \
    sudo \
    unzip \
    wget \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Install modern Node.js runtime for Electron/http-server
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g http-server

# Build and install LCM v1.4.0 (follows upstream instructions, sudo kept for parity)
WORKDIR /tmp
RUN git clone https://github.com/lcm-proj/lcm.git \
    && cd lcm \
    && git checkout tags/v1.4.0 \
    && mkdir build \
    && cd build \
    && cmake -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=OFF -DBUILD_EXAMPLES=OFF -DBUILD_BENCHMARKS=OFF .. \
    && make -j"$(nproc)" \
    && sudo make install \
    && ldconfig \
    && rm -rf /tmp/lcm

# Build and install nlopt v2.7.1
WORKDIR /tmp
RUN git clone -b v2.7.1 https://github.com/stevengj/nlopt.git \
    && cd nlopt \
    && mkdir build \
    && cd build \
    && cmake .. \
    && make -j"$(nproc)" \
    && sudo make install \
    && ldconfig \
    && rm -rf /tmp/nlopt

# Install LKH-3
WORKDIR /tmp
RUN wget -q http://akira.ruc.dk/~keld/research/LKH-3/LKH-3.0.6.tgz \
    && tar xzf LKH-3.0.6.tgz \
    && cd LKH-3.0.6 \
    && make \
    && sudo cp LKH /usr/local/bin/ \
    && cd /tmp \
    && rm -rf LKH-3.0.6 LKH-3.0.6.tgz

# Prepare catkin workspace for inf_uwb_ros
RUN mkdir -p "$SWARM_WS/src"
WORKDIR $SWARM_WS/src
RUN git clone https://github.com/HKUST-Swarm/inf_uwb_ros.git \
    && git clone https://github.com/HKUST-Swarm/swarm_msgs.git \
    && git clone https://gitee.com/BUAA-SOAR/quadrotor_msgs.git \
    && git clone https://gitee.com/BUAA-SOAR/swarm_exploration.git

RUN . /opt/ros/noetic/setup.sh \
    && rosdep update \
    && rosdep install --from-paths "$SWARM_WS/src" -i -r -y

WORKDIR $SWARM_WS
RUN . /opt/ros/noetic/setup.sh \
    && catkin_make

# Copy Swarm GCS sources and install JS deps
WORKDIR $SWARM_GCS_ROOT
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 8080

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV RUN_MODE=web \
    HTTP_PORT=8080

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["web"]
