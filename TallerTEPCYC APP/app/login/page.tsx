import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LoginCard } from '@/components/auth/login-card'

export const metadata: Metadata = {
  title: 'Entrar · TODOENPCYCONSOLAS',
  robots: { index: false, follow: false },
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginCard />
    </Suspense>
  )
}
