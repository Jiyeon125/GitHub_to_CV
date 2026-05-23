// NextAuth App Router 핸들러
// - 동일한 handler 를 GET / POST 양쪽으로 export 해야 한다 (NextAuth v4 규약).
// - 실제 설정은 lib/auth.ts 의 authOptions 에 모아 둔다.

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
