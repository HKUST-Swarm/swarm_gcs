import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const pages = ["index.html", "index-sim.html", "index-vr.html", "solo.html"];
const errors = [];
const localPageAssets = new Set();

const expectedVersions = {
    bootstrap: "4.3.1",
    jquery: "3.7.1",
    "popper.js": "1.14.7",
    rosnodejs: "3.0.2",
    three: "0.129.0",
    vue: "2.6.14",
};

const requiredRuntimeAssets = [
    "node_modules/bootstrap/dist/css/bootstrap.min.css",
    "node_modules/bootstrap/dist/js/bootstrap.min.js",
    "node_modules/jquery/dist/jquery.slim.min.js",
    "node_modules/popper.js/dist/umd/popper.min.js",
    "node_modules/three/build/three.module.js",
    "node_modules/three/examples/jsm/controls/TransformControls.js",
    "node_modules/three/examples/jsm/loaders/3MFLoader.js",
    "node_modules/three/examples/jsm/loaders/MTLLoader.js",
    "node_modules/three/examples/jsm/loaders/OBJLoader.js",
    "node_modules/three/examples/jsm/postprocessing/EffectComposer.js",
    "node_modules/three/examples/jsm/postprocessing/OutlinePass.js",
    "node_modules/three/examples/jsm/postprocessing/RenderPass.js",
    "node_modules/three/examples/jsm/postprocessing/ShaderPass.js",
    "node_modules/three/examples/jsm/shaders/FXAAShader.js",
    "node_modules/vue/dist/vue.min.js",
    "libs/jszip.min.js",
    "libs/mavlink_bundle.js",
    "libs/roslib.min.js",
    "fonts/helvetiker_regular.typeface.json",
    "models/swarm_drone.mtl",
    "models/swarm_drone.obj3d",
    ...Array.from({ length: 10 }, (_, index) => `imgs/4x4_1000-${index}.svg`),
];

async function exists(relativePath) {
    try {
        await access(join(root, relativePath));
        return true;
    } catch {
        return false;
    }
}

for (const page of pages) {
    const html = await readFile(join(root, page), "utf8");
    const staticTag = /<(?:script|link|img)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi;

    for (const match of html.matchAll(staticTag)) {
        const reference = match[1];
        if (/^https?:\/\//i.test(reference) || reference.startsWith("//")) {
            errors.push(`${page} loads a remote runtime asset: ${reference}`);
            continue;
        }
        if (/^(?:#|data:|javascript:)/i.test(reference) || reference.includes("{{")) {
            continue;
        }

        const withoutSuffix = reference.split(/[?#]/, 1)[0];
        const relativePath = resolve(dirname(join(root, page)), withoutSuffix);
        if (relativePath !== root && !relativePath.startsWith(`${root}${sep}`)) {
            errors.push(`${page} references an asset outside the project: ${reference}`);
            continue;
        }

        const projectPath = relativePath.slice(root.length + 1);
        localPageAssets.add(projectPath);
        if (!(await exists(projectPath))) {
            errors.push(`${page} references a missing asset: ${reference}`);
        }
    }

    if (!html.includes('"three": "./node_modules/three/build/three.module.js"')) {
        errors.push(`${page} does not map the npm three module locally`);
    }
    if (!html.includes('"three/examples/jsm/": "./node_modules/three/examples/jsm/"')) {
        errors.push(`${page} does not map npm three examples locally`);
    }
}

for (const asset of requiredRuntimeAssets) {
    if (!(await exists(asset))) {
        errors.push(`Missing runtime asset: ${asset}`);
    }
}

const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
for (const [name, expected] of Object.entries(expectedVersions)) {
    const declared = packageJson.dependencies?.[name];
    if (declared !== expected) {
        errors.push(`package.json must pin ${name} to ${expected}; found ${declared || "missing"}`);
    }

    try {
        const installed = JSON.parse(await readFile(join(root, "node_modules", name, "package.json"), "utf8"));
        if (installed.version !== expected) {
            errors.push(`Installed ${name} is ${installed.version}; expected ${expected}`);
        }
    } catch {
        errors.push(`npm dependency is not installed: ${name}@${expected}`);
    }
}

const sourceRoots = ["src", "libs"];
const sourceFiles = pages.map((page) => join(root, page));
for (const sourceRoot of sourceRoots) {
    const entries = await readdir(join(root, sourceRoot), { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isFile() && /\.(?:js|mjs)$/.test(entry.name)) {
            sourceFiles.push(join(root, sourceRoot, entry.name));
        }
    }
}

for (const file of sourceFiles) {
    const contents = await readFile(file, "utf8");
    for (const obsoletePath of ["material-design-icons/", "third_party/three.js/"]) {
        if (contents.includes(obsoletePath)) {
            errors.push(`${file.slice(root.length + 1)} still references ${obsoletePath}`);
        }
    }
}

if (errors.length > 0) {
    console.error("Offline asset check failed:");
    for (const error of errors) {
        console.error(`- ${error}`);
    }
    process.exitCode = 1;
} else {
    console.log(
        `Offline asset check passed: ${pages.length} pages, ${localPageAssets.size} local page assets, ` +
        `${Object.keys(expectedVersions).length} pinned runtime packages.`,
    );
}
