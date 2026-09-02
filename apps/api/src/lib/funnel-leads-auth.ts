import type { FastifyReply, FastifyRequest } from 'fastify'
import {
  FUNNEL_LEADS_DELEGATION_SCOPE,
  parseInternalUserDelegationHeaders,
  verifyInternalUserDelegation,
  WORKSPACE_API_KEY_SCOPE_DATA_EXPORT,
} from '@workspace/database'
import {
  resolveInternalApiSecret,
  verifyInternalApiRequest,
} from './internal-api-secret.js'
import { userCanExportLeadsForLandingPage } from './funnel-leads-permissions.js'
import { verifyWorkspaceApiKeyForLandingPage } from './workspace-api-key-auth.js'
import { consumeDelegationNonce } from './consume-delegation-nonce.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function guardFunnelLeadsRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  landingPageId: string,
): Promise<boolean> {
  if (!UUID_RE.test(landingPageId)) {
    void reply.code(400).send({ error: 'Invalid workspace_id' })
    return false
  }

  if (
    await verifyWorkspaceApiKeyForLandingPage(
      request.headers.authorization,
      landingPageId,
      WORKSPACE_API_KEY_SCOPE_DATA_EXPORT,
    )
  ) {
    return true
  }

  const secret = resolveInternalApiSecret()
  if (!secret) {
    void reply.code(503).send({ error: 'Analytics not configured on this server' })
    return false
  }

  if (!verifyInternalApiRequest(request.headers['x-arohaa-internal'])) {
    void reply.code(401).send({ error: 'Unauthorized' })
    return false
  }

  const delegation = parseInternalUserDelegationHeaders(
    request.headers as Record<string, string | string[] | undefined>,
  )
  if (
    !delegation ||
    delegation.payload.scope !== FUNNEL_LEADS_DELEGATION_SCOPE ||
    delegation.payload.landingPageId !== landingPageId ||
    !verifyInternalUserDelegation(secret, delegation.payload, delegation.signature)
  ) {
    void reply.code(401).send({ error: 'Unauthorized' })
    return false
  }

  const consumed = await consumeDelegationNonce({
    nonce: delegation.payload.nonce,
    userId: delegation.payload.userId,
    expiresAt: new Date(delegation.payload.exp * 1000),
  })
  if (!consumed) {
    void reply.code(401).send({ error: 'Unauthorized' })
    return false
  }

  if (
    !(await userCanExportLeadsForLandingPage({
      userId: delegation.payload.userId,
      landingPageId,
    }))
  ) {
    void reply.code(403).send({ error: 'Forbidden' })
    return false
  }

  return true
}
