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
  // Suppress type errors from dynamic requires in src/ files
  typescript: {
    ignoreBuildErrors: false,
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
    config.module.exprContextCritical = false
    // Client-side: stub Node.js built-ins
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
        glob: false,
      }
    }
    return config
  },
}

const withMDX = createMDX()
export default withMDX(nextConfig)
