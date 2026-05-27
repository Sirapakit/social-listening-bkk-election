import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone output bundles only the files needed for production,
  // enabling a minimal Docker image via multi-stage build.
  output: "standalone",
};

export default nextConfig;
