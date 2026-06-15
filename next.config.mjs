const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`
      },
      {
        source: "/create-checkout-session",
        destination: `${backendUrl}/create-checkout-session`
      }
    ];
  }
};

export default nextConfig;
