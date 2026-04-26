import { defineDocs, defineConfig } from 'fumadocs-mdx/config'
import {
  remarkAdmonition,
  remarkSteps,
  remarkImage,
  remarkNpm,
  remarkMdxMermaid,
  remarkCodeTab,
  remarkGfm,
  rehypeCode,
  rehypeToc,
} from 'fumadocs-core/mdx-plugins'

export const docs = defineDocs({
  dir: 'content/docs',
})

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [
      remarkGfm,
      remarkAdmonition,
      remarkSteps,
      remarkImage,
      remarkNpm,
      remarkMdxMermaid,
      remarkCodeTab,
    ],
    rehypePlugins: [
      rehypeCode,
      rehypeToc,
    ],
  },
})
