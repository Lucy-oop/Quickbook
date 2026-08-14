import Link from 'next/link'
import { ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-muted">
        <ShieldOff className="size-7 text-muted-foreground" />
      </span>
      <div>
        <h1 className="text-lg font-semibold">ဤစာမျက်နှာကို ဝင်ရောက်ခွင့်မရှိပါ။</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          You do not have permission to view this page. Ask the business owner to grant you access.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">ဒက်ရှ်ဘုတ်သို့ပြန်ရန်</Link>
      </Button>
    </div>
  )
}
