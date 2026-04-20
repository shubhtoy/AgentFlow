import { source } from '@/lib/docs-source'
import { notFound } from 'next/navigation'

export const revalidate = false

export async function GET(_req: Request, props: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await props.params
  const page = source.getPage(slug)
  if (!page) notFound()

  // Use raw text since processed requires postprocess config
  const text = await (page.data as any).getText('raw')

  return new Response(`# ${page.data.title} (${page.url})\n\n${text}`, {
    headers: { 'Content-Type': 'text/markdown' },
  })
}

export function generateStaticParams() {
  return source.generateParams()
}
