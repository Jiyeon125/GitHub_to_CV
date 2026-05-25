// NextAuth (v4) 설정
// - GitHub OAuth Provider 한 가지만 사용한다.
// - private repo 분석을 옵션으로 지원하기 위해 scope 에 'repo' 를 포함시킨다.
//   (필요 최소 권한이라는 점에서 'public_repo' 만으로 충분하긴 하지만, 본 서비스의
//    명시적 목표가 "본인 private repo 도 본인 동의 하에 분석" 이므로 'repo' 로 둔다.
//    실제 분석 시점에 사용자가 'private 포함' 체크를 하지 않으면 visibility=public 으로 호출한다.)
// - access_token 은 JWT 쿠키에만 저장하고, 클라이언트에는 직접 노출하지 않는다.
//   세션 객체에는 access_token 자체 대신 "로그인 여부 + login (username) + avatar" 만 노출.

import type { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      login?: string | null;
    };
    // 클라이언트에는 토큰 자체를 노출하지 않는다.
    // 서버 라우트에서 getServerSession + getAccessToken 으로 우회해 사용할 수도 있지만,
    // 본 프로젝트는 route handler 안에서 getToken() 으로 직접 raw JWT 를 읽는다.
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    login?: string | null;
  }
}

const GITHUB_SCOPE = "read:user repo";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
      authorization: { params: { scope: GITHUB_SCOPE } },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      if (profile && typeof (profile as { login?: string }).login === "string") {
        token.login = (profile as { login: string }).login;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.login) session.user.login = token.login;
      return session;
    },
  },
  pages: {
    // 별도 로그인 페이지를 만들지 않고 NextAuth 기본 화면을 사용한다.
    // (필요해지면 여기서 커스텀 페이지를 가리키도록 변경.)
  },
};

export function isOAuthConfigured(): boolean {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}
