import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin Turbopack workspace root when multiple lockfiles exist on the machine.
  turbopack: {
    root,
  },
  /**
   * Server Actions default to a 1MB body limit; brand logos allow up to 2MB (`gym-brand-logos-storage.ts`).
   * Without this, multipart submissions can be rejected before the action runs (empty Storage bucket, yet DB text saves still succeed).
   */
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
