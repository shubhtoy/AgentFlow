import { source } from '@/lib/docs-source'
import { createFromSource } from 'fumadocs-core/search/server'

export const revalidate = false

const searchAPI = createFromSource(source)
export const GET = process.env.NODE_ENV === 'production' ? searchAPI.staticGET : searchAPI.GET
