import { readFile, writeFile } from "node:fs/promises";

const bundlePath = new URL("../libs/mavlink_bundle.js", import.meta.url);
const contents = await readFile(bundlePath, "utf8");
const normalized = contents.replace(/[\t ]+$/gm, "");

if (normalized !== contents) {
    await writeFile(bundlePath, normalized);
}
