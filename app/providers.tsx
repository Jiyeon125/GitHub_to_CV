"use client";

// next-auth/react 의 SessionProvider 는 client component 안에서만 동작한다.
// app/layout.tsx (server component) 에서 직접 import 할 수 없으므로 한 단계 감싼다.

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
