import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3028";

async function waitForServer(url, timeoutMs = 30_000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);

      if (response.ok || response.status < 500) {
        return true;
      }
    } catch {
      // Keep polling until Next is listening.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
}

async function isServerRunning(url) {
  try {
    const response = await fetch(url);
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

function spawnNode(args, options = {}) {
  return spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: options.stdio ?? "inherit",
    windowsHide: true,
  });
}

const existingServer = await isServerRunning(baseUrl);
const server = existingServer
  ? null
  : spawnNode(["node_modules/next/dist/bin/next", "start", "--port", "3028"], {
      stdio: "ignore",
    });

if (!existingServer) {
  const ready = await waitForServer(baseUrl);

  if (!ready) {
    server?.kill();
    console.error(`Timed out waiting for ${baseUrl}. Run npm run build before npm run test:e2e.`);
    process.exit(1);
  }
}

const playwrightCli = require.resolve("@playwright/test/cli");
const testProcess = spawnNode([playwrightCli, "test"]);

testProcess.on("exit", (code, signal) => {
  if (server) {
    server.kill();
  }

  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
