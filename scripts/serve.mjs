import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const host = process.env.HOST || "127.0.0.1";
const port = Number.parseInt(process.env.HTTP_PORT || process.env.PORT || "8080", 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid HTTP port: ${process.env.HTTP_PORT || process.env.PORT}`);
}

const contentTypes = new Map([
    [".css", "text/css; charset=utf-8"],
    [".html", "text/html; charset=utf-8"],
    [".js", "text/javascript; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".mjs", "text/javascript; charset=utf-8"],
    [".mtl", "text/plain; charset=utf-8"],
    [".obj", "text/plain; charset=utf-8"],
    [".obj3d", "text/plain; charset=utf-8"],
    [".png", "image/png"],
    [".svg", "image/svg+xml"],
]);

const server = createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { Allow: "GET, HEAD" });
        response.end("Method not allowed");
        return;
    }

    let pathname;
    try {
        pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
    } catch {
        response.writeHead(400);
        response.end("Bad request");
        return;
    }

    if (pathname.endsWith("/")) {
        pathname += "index.html";
    }

    const filePath = resolve(root, `.${pathname}`);
    if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
    }

    try {
        const info = await stat(filePath);
        if (!info.isFile()) {
            throw new Error("Not a file");
        }

        response.writeHead(200, {
            "Cache-Control": "no-store",
            "Content-Length": info.size,
            "Content-Type": contentTypes.get(extname(filePath).toLowerCase()) || "application/octet-stream",
            "X-Content-Type-Options": "nosniff",
        });

        if (request.method === "HEAD") {
            response.end();
            return;
        }

        createReadStream(filePath).pipe(response);
    } catch {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
    }
});

server.listen(port, host, () => {
    console.log(`Swarm GCS web server: http://${host}:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => server.close(() => process.exit(0)));
}
