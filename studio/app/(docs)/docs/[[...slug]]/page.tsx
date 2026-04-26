import { source } from '@/lib/docs-source'
import {
  DocsPage, DocsBody, DocsTitle, DocsDescription,
  PageLastUpdate,
} from 'fumadocs-ui/layouts/docs/page'
import { notFound } from 'next/navigation'
import defaultMdxComponents from 'fumadocs-ui/mdx'
import { Step, Steps } from 'fumadocs-ui/components/steps'
import { Tab, Tabs } from 'fumadocs-ui/components/tabs'
import { File, Folder, Files } from 'fumadocs-ui/components/files'
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion'
import { TypeTable } from 'fumadocs-ui/components/type-table'
import { ImageZoom } from 'fumadocs-ui/components/image-zoom'
import { InlineTOC } from 'fumadocs-ui/components/inline-toc'
import { Banner } from 'fumadocs-ui/components/banner'
import {
  ComponentPreview, PreviewGrid, DocsShowcase,
  DocsPlayground,
} from '@/components/docs/mdx-components'
import { Mermaid } from '@/components/docs/Mermaid'
import { MarkdownCopyButton, ViewOptionsPopover } from '@/components/ai/page-actions'

const customComponents = {
  ...defaultMdxComponents,
  // defaultMdxComponents already includes: Card, Cards, Callout, Heading, CodeBlock, Link, img
  Step, Steps, Tab, Tabs,
  File, Folder, Files,
  Accordion, Accordions,
  TypeTable, ImageZoom, InlineTOC, Banner, Mermaid,
  ComponentPreview, PreviewGrid, DocsShowcase, DocsPlayground,
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
