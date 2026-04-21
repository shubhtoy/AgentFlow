/**
 * Git provider configuration.
 * Single source of truth for auth methods, env vars, and token links.
 */

export interface GitProvider {
  id: string
  name: string
  /** Env vars needed for OAuth redirect flow */
  oauth: { clientId: string; clientSecret: string; scope: string } | null
  /** Env var needed for device flow (GitHub only needs client_id) */
  deviceFlow: { clientId: string; scope: string } | null
  /** URL to create a personal access token */
  tokenUrl: string
  /** Token prefix hint for the input placeholder */
  tokenHint: string
  /** Detect provider from git remote URL */
  matchUrl: (url: string) => boolean
}

export const GIT_PROVIDERS: GitProvider[] = [
  {
    id: 'github', name: 'GitHub',
    oauth: { clientId: 'GITHUB_CLIENT_ID', clientSecret: 'GITHUB_CLIENT_SECRET', scope: 'repo' },
    deviceFlow: { clientId: 'GITHUB_CLIENT_ID', scope: 'repo' },
    tokenUrl: 'https://github.com/settings/tokens/new?scopes=repo&description=AgentFlow',
    tokenHint: 'ghp_...',
    matchUrl: (url) => url.includes('github.com'),
  },
  {
    id: 'gitlab', name: 'GitLab',
    oauth: { clientId: 'GITLAB_CLIENT_ID', clientSecret: 'GITLAB_CLIENT_SECRET', scope: 'read_repository write_repository' },
    deviceFlow: null,
    tokenUrl: 'https://gitlab.com/-/user_settings/personal_access_tokens?name=AgentFlow&scopes=read_repository,write_repository',
    tokenHint: 'glpat-...',
    matchUrl: (url) => url.includes('gitlab.com') || url.includes('gitlab.'),
  },
  {
    id: 'bitbucket', name: 'Bitbucket',
    oauth: { clientId: 'BITBUCKET_CLIENT_ID', clientSecret: 'BITBUCKET_CLIENT_SECRET', scope: 'repository:write' },
    deviceFlow: null,
    tokenUrl: 'https://bitbucket.org/account/settings/app-passwords/',
    tokenHint: 'app password',
    matchUrl: (url) => url.includes('bitbucket.org'),
  },
  {
    id: 'gitea', name: 'Gitea',
    oauth: { clientId: 'GITEA_CLIENT_ID', clientSecret: 'GITEA_CLIENT_SECRET', scope: 'repo' },
    deviceFlow: null,
    tokenUrl: '',
    tokenHint: 'token',
    matchUrl: (url) => url.includes('gitea.') || url.includes(':3000'),
  },
]

/** Detect provider from a git URL */
export function detectProvider(url: string): GitProvider | null {
  return GIT_PROVIDERS.find(p => p.matchUrl(url)) || null
}
