import type { NextConfig } from "next";
import os from "os";

// Let phones on the same Wi-Fi load the dev app (needed for the table QR codes)
const lanIps = Object.values(os.networkInterfaces())
  .flat()
  .filter((n) => n && n.family === "IPv4" && !n.internal)
  .map((n) => n!.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: [...lanIps, "*.lhr.life", "*.app.lhr.life", "dfbf3652eeb222.app.lhr.life"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
