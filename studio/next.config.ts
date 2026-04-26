import type { NextConfig } from 'next'
import { createMDX } from 'fumadocs-mdx/next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ['@agentflow/core', '@agentflow/cli'],
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
}

const withMDX = createMDX()
export default withMDX(nextConfig)
