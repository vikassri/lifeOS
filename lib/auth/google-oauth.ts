import { randomBytes, createHash } from 'crypto'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

export interface GoogleUserInfo {
  sub: string
  email: string
  email_verified: boolean
  name: string
  picture: string
}

function getOAuthConfig() {
  const clientId = process.env['GOOGLE_CLIENT_ID']
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET']
  const redirectUri = process.env['GOOGLE_REDIRECT_URI']
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('OAuth environment variables not configured')
  }
  return { clientId, clientSecret, redirectUri }
}

export function generatePkce(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')
  return { codeVerifier, codeChallenge }
}

export function generateState(): string {
  return randomBytes(16).toString('hex')
}

export function buildAuthorizationUrl(state: string, codeChallenge: string): string {
  const { clientId, redirectUri } = getOAuthConfig()
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid email profile',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    prompt: 'select_account',
    access_type: 'online',
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForUserInfo(
  code: string,
  codeVerifier: string,
): Promise<GoogleUserInfo> {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig()

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: codeVerifier,
    }).toString(),
  })

  if (!tokenResponse.ok) {
    // Never log the token response body — may contain secrets
    throw new Error(`Token exchange failed: ${tokenResponse.status}`)
  }

  const tokens = await tokenResponse.json() as { access_token?: string; id_token?: string }
  if (!tokens.access_token) throw new Error('No access_token in token response')

  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })

  if (!userInfoResponse.ok) {
    throw new Error(`UserInfo fetch failed: ${userInfoResponse.status}`)
  }

  const userInfo = await userInfoResponse.json() as GoogleUserInfo
  // Do NOT store tokens — discard immediately after fetching userinfo
  return userInfo
}
