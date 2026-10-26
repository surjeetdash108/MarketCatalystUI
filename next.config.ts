import type { NextConfig } from "next";
import { execSync } from "child_process";

let gitCommit = process.env.NEXT_PUBLIC_GIT_COMMIT || "";
let buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString();
if (!gitCommit) {
  try {
    gitCommit = execSync("git rev-parse HEAD", {
      encoding: "utf8",
      timeout: 1000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    gitCommit = "unknown";
  }
}

const nextConfig: NextConfig = {
  output: "export",
  env: {
    NEXT_PUBLIC_GIT_COMMIT: gitCommit,
    NEXT_PUBLIC_BUILD_TIME: buildTime,
  },
  images: {
    unoptimized: true,
  },
  // The dev server only trusts `localhost` by default; browsing via
  // 127.0.0.1 gets its HMR websocket silently blocked otherwise.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
