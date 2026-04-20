import type { NextConfig } from 'next'
import path from 'path'
import { createMDX } from 'fumadocs-mdx/next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ['@agentflow/core'],
  serverExternalPackages: [
    'simple-git',
    '@modelcontextprotocol/sdk',
  ],
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
  async rewrites() {
    return [
      {
        source: '/docs/:path*.mdx',
        destination: '/llms.mdx/docs/:path*',
      },
    ]
  },
  webpack: (config, { isServer }) => {
    config.resolve.modules = [
      ...(config.resolve.modules || []),
      path.resolve(__dirname, '..', 'node_modules'),
    ]
    // Suppress langchain dynamic require warnings
    config.module.exprContextCritical = false

    // Stub Node.js built-ins on client side so server-only code doesn't break the bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        child_process: false,
        net: false,
        tls: false,
        dns: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        util: false,
        url: false,
        assert: false,
        buffer: false,
        events: false,
        querystring: false,
        string_decoder: false,
      }
    }

    return config
  },
}

const withMDX = createMDX()
export default withMDX(nextConfig)
