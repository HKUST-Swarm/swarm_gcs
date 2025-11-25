#!/usr/bin/env bash
set -euo pipefail

WLAN=${WLAN:-wlx08107bc45a07}
IMAGE=${SWARM_GCS_IMAGE:-swarm-gcs:latest}
CONTAINER_NAME=${SWARM_GCS_CONTAINER:-swarm-gcs}
MODE=${1:-electron}
shift || true
HOST_HTTP_PORT=${HTTP_PORT:-8080}
HOST_ROSBRIDGE_PORT=${ROSBRIDGE_PORT:-9090}
OS_NAME=$(uname -s)

if [[ $(id -u) -ne 0 ]]; then
  SUDO=sudo
else
  SUDO=
fi

configure_network_linux() {
  if ifconfig "$WLAN" >/dev/null 2>&1; then
    echo "Configuring multicast on $WLAN"
    $SUDO ifconfig "$WLAN" multicast || true
    $SUDO route add -net 224.0.0.0 netmask 240.0.0.0 dev "$WLAN" || true
  else
    echo "Warning: interface $WLAN not found; skipping multicast setup" >&2
  fi
}

DOCKER_ARGS=(
  --rm
  -it
  --name "$CONTAINER_NAME"
  -v "$(pwd)":/opt/swarm_gcs
  -v "$(pwd)/docker-entrypoint.sh":/usr/local/bin/docker-entrypoint.sh:ro
  -e RUN_MODE="$MODE"
  -e HTTP_PORT="$HOST_HTTP_PORT"
  -e ROSBRIDGE_PORT="$HOST_ROSBRIDGE_PORT"
)

if [[ -n "${USE_XVFB:-}" ]]; then
  DOCKER_ARGS+=( -e USE_XVFB="$USE_XVFB" )
fi
if [[ -n "${ELECTRON_ARGS:-}" ]]; then
  DOCKER_ARGS+=( -e ELECTRON_ARGS="$ELECTRON_ARGS" )
fi

case "$OS_NAME" in
  Linux)
    configure_network_linux
    DOCKER_ARGS+=( --network host )
    ;;
  Darwin)
    echo "macOS detected: host networking is unavailable; using bridge mode with mapped ports" >&2
    DOCKER_ARGS+=( -p "${HOST_HTTP_PORT}:${HOST_HTTP_PORT}" )
    DOCKER_ARGS+=( -p "${HOST_ROSBRIDGE_PORT}:${HOST_ROSBRIDGE_PORT}" )
    if [[ -n "${ROS_MASTER_URI:-}" ]]; then
      DOCKER_ARGS+=( -e ROS_MASTER_URI )
    fi
    if [[ -n "${ROS_HOSTNAME:-}" ]]; then
      DOCKER_ARGS+=( -e ROS_HOSTNAME )
    fi
    ;;
  *)
    echo "Unknown host OS ${OS_NAME}; defaulting to bridge networking" >&2
    DOCKER_ARGS+=( -p "${HOST_HTTP_PORT}:${HOST_HTTP_PORT}" )
    DOCKER_ARGS+=( -p "${HOST_ROSBRIDGE_PORT}:${HOST_ROSBRIDGE_PORT}" )
    ;;
esac

if [[ "$MODE" == "electron" ]]; then
  : ${DISPLAY:=:0}
  DOCKER_ARGS+=( -e DISPLAY="$DISPLAY" )
  if [[ -n "${XAUTHORITY:-}" && -f "$XAUTHORITY" ]]; then
    DOCKER_ARGS+=( -e XAUTHORITY="$XAUTHORITY" -v "$XAUTHORITY":"$XAUTHORITY":ro )
  fi
  DOCKER_ARGS+=( -v /tmp/.X11-unix:/tmp/.X11-unix:rw )
fi

exec docker run "${DOCKER_ARGS[@]}" "$IMAGE" "$MODE" "$@"
