# Repository Guidelines

## Project Structure & Module Organization
The UI entry points live in `index.html`, `index-sim.html`, `index-vr.html`, and `solo.html`, each pulling ES modules from `src/` (for example `swarm_commander.mjs`, `ThreeView.mjs`, and selection helpers). Shared vendor code stays under `third_party/` and `libs/`, while assets are grouped in `imgs/`, `fonts/`, `models/`, and `material-design-icons/`. ROS launch files and configs sit in `launch/`, emulator tooling in `emulator_for_gcs/`, and automation helpers in `scripts/` plus `build.sh`.

## Build, Test, and Development Commands
Run `npm install` once to pull browser dependencies referenced by Electron. Use `electron .` (with `roscore` already running) for the full desktop ground station. `python3 emulator_for_gcs/main.py` publishes deterministic swarm traffic so you can validate UI behavior without hardware. When exercising the ROS side, `roslaunch launch/swarm_simulation.launch` starts the simulated swarm stack used by the HTML dashboards. For a lightweight static preview, `npx http-server -c-1` from the repo root serves the site on localhost:8080, bypassing caching. Package a distributable build with `./build.sh`, which wraps the web assets for release zips.

## Coding Style & Naming Conventions
JavaScript and module files should keep four-space indentation, `const`/`let` declarations, and strict ES module imports (`import {BaseCommander} from "./base_commander.mjs"`). Favor camelCase for functions and variables, PascalCase for classes, and kebab-case for asset filenames. Topic strings and MAVLink identifiers should match the ROS names already used in `swarm_commander.mjs` to avoid mismatched subscriptions. Reuse helper utilities in `src/base_commander.mjs` instead of duplicating logic, and keep UI tweaks localized in `gcs_common.css`.

## Testing Guidelines
Unit-style coverage is sparse, so lean on scenario testing: start the emulator, open `index-sim.html`, and walk through formation changes, path uploads, and selection boxes. When adding commands or visualizations, log sample telemetry to `docs/` and note reproduction steps in your PR. Name any new emulator scripts `test_<feature>.py` and document the expected ROS topics they emit. Before merging, sanity-check WebGL-heavy pages in Chrome and the Electron shell to confirm shaders, textures, and point clouds render consistently.

## Commit & Pull Request Guidelines
Follow the existing history by writing short, present-tense commit subjects (e.g., `Add emulator for simple testing`, `Fix disconnected bug`). Each commit should focus on one concern (UI tweak, ROS hook, build change). Pull requests must call out the scenario, linked issue, required ROS nodes, and any screenshots or short screencasts that prove the UI behavior. Describe how to reproduce the test sequence (emulator command, page opened, buttons pressed) and list any follow-up tasks so reviewers can validate quickly.
