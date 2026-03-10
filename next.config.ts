import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    styledComponents: true,
  },
  // On some Windows setups, Next's internal typecheck spawn can fail (EPERM).
  // We run `tsc --noEmit` via `npm run typecheck` instead.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
