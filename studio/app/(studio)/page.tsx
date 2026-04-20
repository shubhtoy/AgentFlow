'use client'

import dynamic from 'next/dynamic'

const Playground = dynamic(
  () => import('@/components/Playground').then(m => ({ default: m.Playground })),
  { ssr: false }
)

export default function Home() {
  return <Playground />
}
