import type { NextConfig } from 'next'
import path from 'path'
import { createMDX } from 'fumadocs-mdx/next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ['@agentflow/core'],
  serverExternalPackages: [
    'simple-git',
    '@modelcontextprotocol/sdk',
    'jszip',
    'glob',
  ],
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
    return config
  },
}

const withMDX = createMDX()
export default withMDX(nextConfig)
