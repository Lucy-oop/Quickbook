import Link from 'next/link'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="size-7 text-muted-foreground" />
      </span>
      <div>
        <h1 className="text-lg font-semibold">စာမျက်နှာ မတွေ့ပါ</h1>
        <p className="mt-1 text-sm text-muted-foreground">This page could not be found.</p>
      </div>
      <Button asChild>
        <Link href="/dashboard">ဒက်ရှ်ဘုတ်သို့ပြန်ရန်</Link>
      </Button>
    </div>
  )
}
