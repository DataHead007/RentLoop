import Link from 'next/link'
import { BadmintonMatchForm } from '@/components/badminton/BadmintonMatchForm'

export default function NewBadmintonMatchPage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-4">
        <Link href="/badminton/matches" className="text-sm text-muted-foreground hover:underline">
          ← 返回我的比赛
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">记一场比赛</h1>
        <p className="text-sm text-muted-foreground">
          保存后将按报名费、奖金/奖品估值自动生成羽毛球交易记录
        </p>
      </div>
      <BadmintonMatchForm />
    </div>
  )
}
