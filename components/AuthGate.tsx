"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentCloudUser } from "../lib/cloud-sync";

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    getCurrentCloudUser()
      .then((user) => {
        if (!active) return;
        if (!user) {
          router.replace("/");
          return;
        }
        setReady(true);
      })
      .catch(() => {
        if (!active) return;
        router.replace("/");
      });

    return () => {
      active = false;
    };
  }, [router]);

  if (!ready) {
    return (
      <main className="auth-loading">
        <div className="login-card compact">
          <p className="eyebrow">Monthly Survival</p>
          <h1>Checking login...</h1>
          <p>Preparing your cloud session before opening the app.</p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
