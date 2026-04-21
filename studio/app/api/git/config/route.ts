export const dynamic = 'force-dynamic'

/**
 * GET /api/git/config — returns available git auth methods.
 * Client uses this to show the right buttons.
 */
export async function GET() {
  const providers: { id: string; name: string }[] = []

  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)
    providers.push({ id: 'github', name: 'GitHub' })
  if (process.env.GITLAB_CLIENT_ID && process.env.GITLAB_CLIENT_SECRET)
    providers.push({ id: 'gitlab', name: 'GitLab' })
  if (process.env.BITBUCKET_CLIENT_ID && process.env.BITBUCKET_CLIENT_SECRET)
    providers.push({ id: 'bitbucket', name: 'Bitbucket' })
  if (process.env.GITEA_CLIENT_ID && process.env.GITEA_CLIENT_SECRET)
    providers.push({ id: 'gitea', name: 'Gitea' })

  // Local git mode — server-side git with SSH support
  // On by default when running locally (not on Vercel/Railway/Render)
  const isCloud = !!(process.env.VERCEL || process.env.RAILWAY_ENVIRONMENT || process.env.RENDER)
  const localGit = process.env.AF_LOCAL_GIT !== 'false' && !isCloud

  // Device flow — only needs client ID (no secret), best UX for GitHub
  const deviceFlow = !!process.env.GITHUB_CLIENT_ID

  return Response.json({
    providers,
    deviceFlow,
    localGit,
    pat: {
      links: {
        github: 'https://github.com/settings/tokens/new?scopes=repo&description=AgentFlow',
        gitlab: 'https://gitlab.com/-/user_settings/personal_access_tokens?name=AgentFlow&scopes=read_repository,write_repository',
        bitbucket: 'https://bitbucket.org/account/settings/app-passwords/',
        gitea: null,
      }
    }
  })
}
