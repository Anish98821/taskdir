import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Trim the standalone bundle: exclude source dirs, build outputs, dev
  // state, and example projects that Next's tracer otherwise drags in.
  outputFileTracingExcludes: {
    "*": [
      "bin/**",
      "dist/**",
      "examples/**",
      "scripts/**",
      "src/**",
      "tasks/**",
      ".taskdir/**",
      ".browser-sessions/**",
      ".claude/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
    ],
  },
};

export default nextConfig;
