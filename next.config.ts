import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    domains: ["i.pravatar.cc"],
  },
};

export default nextConfig;