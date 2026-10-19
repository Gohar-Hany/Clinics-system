import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // The reception screen used to live at /clinic
    return [{ source: "/clinic", destination: "/reception", permanent: true }];
  },
};

export default nextConfig;
