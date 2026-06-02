/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Byreal Agent Skills CLI is spawned as a subprocess by the /api/byreal
  // route — keep it external so Next doesn't try to bundle the binary + SDK.
  experimental: {
    serverComponentsExternalPackages: ["@byreal-io/byreal-cli"],
  },
};

export default nextConfig;
