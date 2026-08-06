import { NextResponse } from 'next/server'
import { authErrorResponse, requireAdminUser } from '@/lib/server/auth'
import { testAllProviders } from '@/lib/server/provider-test'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** POST /api/admin/provider-configs/test-all — concurrently test all providers and return results. */
export async function POST() {
  try {
    requireAdminUser()
    const results = await testAllProviders()
    return NextResponse.json({ results })
  } catch (error) {
    return (error as { status?: number }).status
      ? authErrorResponse(error)
      : NextResponse.json({ error: error instanceof Error ? error.message : 'Provider test failed' }, { status: 400 })
  }
}
