#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -gt 0 ]; then
  MODE="$1"
  shift
else
  MODE="${RUN_MODE:-web}"
fi

: "${ROS_MASTER_URI:=http://localhost:11311}"
: "${ROS_HOSTNAME:=$(hostname)}"
export ROS_MASTER_URI ROS_HOSTNAME

# Always source ROS and workspace so rosbridge, inf_uwb_ros, etc. are available.
source /opt/ros/noetic/setup.bash
if [ -f "$SWARM_WS/devel/setup.bash" ]; then
  source "$SWARM_WS/devel/setup.bash"
fi
cd "$SWARM_GCS_ROOT"

ROS_PIDS=()
MAIN_PID=""

cleanup() {
  set +e
  if [ -n "$MAIN_PID" ] && kill -0 "$MAIN_PID" 2>/dev/null; then
    kill "$MAIN_PID" 2>/dev/null || true
    wait "$MAIN_PID" 2>/dev/null || true
  fi
  if [ ${#ROS_PIDS[@]} -gt 0 ]; then
    for pid in "${ROS_PIDS[@]}"; do
      if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
        wait "$pid" 2>/dev/null || true
      fi
    done
  fi
}
trap cleanup EXIT INT TERM

ensure_roscore() {
  if ! rosparam list >/dev/null 2>&1; then
    echo "Starting roscore..."
    roscore >/tmp/roscore.log 2>&1 &
    ROS_PIDS+=($!)
    for _ in $(seq 1 30); do
      if rosparam list >/dev/null 2>&1; then
        return
      fi
      sleep 1
    done
    echo "Warning: roscore did not become ready within timeout" >&2
  fi
}

start_inf_uwb() {
  roslaunch --wait inf_uwb_ros uwb_node_gcs.launch ${ROS_LAUNCH_ARGS:-} self_id:=4 &
  ROS_PIDS+=($!)
}

start_racer_ground() {
  roslaunch --wait exploration_manager ground_node.launch ${RACER_LAUNCH_ARGS:-} drone_id:=4 self_id:=4 &
  ROS_PIDS+=($!)
}

start_main() {
  "$@" &
  MAIN_PID=$!
  wait "$MAIN_PID"
}

run_web() {
  local port="${HTTP_PORT:-8080}"
  start_main http-server -a 0.0.0.0 -p "$port" -c-1
}

run_electron() {
  local electron_args=("--no-sandbox")
  if [ -n "${ELECTRON_ARGS:-}" ]; then
    # shellcheck disable=SC2206
    electron_args=($ELECTRON_ARGS)
  fi

  local cmd=(npx electron main.cjs "${electron_args[@]}")

  if [ -n "${USE_XVFB:-}" ]; then
    start_main xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24" "${cmd[@]}"
  else
    start_main "${cmd[@]}"
  fi
}

ensure_roscore
start_inf_uwb
start_racer_ground

case "$MODE" in
  web)
    run_web "$@"
    ;;
  electron)
    run_electron "$@"
    ;;
  *)
    start_main "$MODE" "$@"
    ;;
esac
