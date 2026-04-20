import { source } from '@/lib/docs-source'
import {
  DocsPage, DocsBody, DocsTitle, DocsDescription,
  PageLastUpdate,
} from 'fumadocs-ui/layouts/docs/page'
import { notFound } from 'next/navigation'
import defaultMdxComponents from 'fumadocs-ui/mdx'
import {
  ComponentPreview, PreviewGrid, DocsShowcase,
  DocsPlayground, Mermaid,
} from '@/components/docs/mdx-components'
import { MarkdownCopyButton, ViewOptionsPopover } from '@/components/ai/page-actions'

const customComponents = {
  ...defaultMdxComponents,
  ComponentPreview, PreviewGrid, DocsShowcase,
  DocsPlayground, Mermaid,
}

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params
  const page = source.getPage(params.slug)
  if (!page) notFound()

  const { body: MDX, toc, lastModified } = page.data as any
  const slug = (params.slug ?? []).join('/')
  const markdownUrl = `/docs/${slug}.mdx`
  const githubUrl = `https://github.com/shubhtoy/agentflow/blob/main/studio/content/docs/${slug}.mdx`

  return (
    <DocsPage toc={toc} tableOfContent={{ style: 'clerk' }}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
      <div className="flex flex-row gap-2 items-center border-b border-fd-border pt-2 pb-6">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover markdownUrl={markdownUrl} githubUrl={githubUrl} />
      </div>
      <DocsBody>
        <MDX components={customComponents} />
      </DocsBody>
      {lastModified && <PageLastUpdate date={new Date(lastModified)} />}
    </DocsPage>
  )
}

export function generateStaticParams() {
  return source.generateParams()
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params
  const page = source.getPage(params.slug)
  if (!page) notFound()
  return { title: page.data.title, description: page.data.description }
}
