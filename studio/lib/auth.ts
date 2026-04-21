import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import GitLab from 'next-auth/providers/gitlab'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({ authorization: { params: { scope: 'repo' } } }),
    GitLab({ authorization: { params: { scope: 'read_repository write_repository' } } }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
        token.provider = account.provider
      }
      return token
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken
      ;(session as any).provider = token.provider
      return session
    },
  },
})
