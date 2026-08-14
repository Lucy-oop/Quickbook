import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/login-form'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata: Metadata = { title: 'Sign in · Myanmar ERP' }

export default function LoginPage() {
  return (
    // useSearchParams() needs a Suspense boundary during static rendering.
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
      <LoginForm />
    </Suspense>
  )
}
