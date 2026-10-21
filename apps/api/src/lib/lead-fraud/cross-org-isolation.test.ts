import { describe, expect, it } from 'vitest'

describe('cross-org isolation contract', () => {
  it('related risk SQL requires tenant_workspace_id when resolving LEAD_RISK', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.promises.readFile(
        new URL('./related-submissions.ts', import.meta.url),
        'utf8',
      ),
    )
    expect(src).toContain('tenant_workspace_id = {tenant:String}')
    expect(src).toContain('session_id IN {sids:Array(String)}')
  })

  it('session evidence SQL scopes by workspace_id and optional tenant', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.promises.readFile(
        new URL('../../services/warehouse.service.ts', import.meta.url),
        'utf8',
      ),
    )
    expect(src).toContain('workspace_id = {workspaceId:UUID}')
    expect(src).toContain('session_id = {sessionId:String}')
    expect(src).toContain('tenant_workspace_id = {tenantWorkspaceId:String}')
  })
})
