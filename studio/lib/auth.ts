import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import GitLab from 'next-auth/providers/gitlab'
import Bitbucket from 'next-auth/providers/bitbucket'

const providers: any[] = []

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)
  providers.push(GitHub({ authorization: { params: { scope: 'repo' } } }))
if (process.env.GITLAB_CLIENT_ID && process.env.GITLAB_CLIENT_SECRET)
  providers.push(GitLab({ authorization: { params: { scope: 'read_repository write_repository' } } }))
if (process.env.BITBUCKET_CLIENT_ID && process.env.BITBUCKET_CLIENT_SECRET)
  providers.push(Bitbucket({}))

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  callbacks: {
    async jwt({ token, account }) {
      if (account) { token.accessToken = account.access_token; token.provider = account.provider }
      return token
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken
      ;(session as any).provider = token.provider
      return session
    },
  },
})
