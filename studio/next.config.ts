import type { NextConfig } from 'next'
import { createMDX } from 'fumadocs-mdx/next'

const nextConfig: NextConfig = {
  reactCompiler: true,
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
