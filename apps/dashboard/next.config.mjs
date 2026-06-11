/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/database"],
  experimental: {
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    },
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    }
    return config
  },
}

export default nextConfig
