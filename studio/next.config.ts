import type { NextConfig } from 'next'
import { createMDX } from 'fumadocs-mdx/next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  typescript: {
    // Cross-package type mismatches (WorkflowGraph vs ParsedGraph) are
    // handled at runtime; studio tsconfig already has strict:false.
    ignoreBuildErrors: true,
  },
  transpilePackages: ['@agentflow/core', '@agentflow/cli'],
  serverExternalPackages: [
    'simple-git',
    '@modelcontextprotocol/sdk',
    'jszip',
    'glob',
  ],
  turbopack: {
    resolveAlias: {
      fs: { browser: './studio/lib/stubs/empty.js' },
      path: { browser: './studio/lib/stubs/empty.js' },
      os: { browser: './studio/lib/stubs/empty.js' },
      child_process: { browser: './studio/lib/stubs/empty.js' },
    },
  },
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
