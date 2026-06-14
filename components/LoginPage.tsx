"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureHousehold, getCurrentCloudUser, loginOrCreateCloudUser } from "../lib/cloud-sync";
import { cloudErrorMessage } from "../lib/cloud-errors";

export function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("Checking cloud session...");

  useEffect(() => {
    let active = true;

    getCurrentCloudUser()
      .then(async (user) => {
        if (!active) return;
        if (!user) {
          setMessage("Login to open Monthly Survival.");
          setBusy(false);
          return;
        }

        await ensureHousehold(user);
        router.replace("/app");
      })
      .catch((error) => {
        if (!active) return;
        setMessage(cloudErrorMessage(error, "setup"));
        setBusy(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email || !password) {
      setMessage("Enter email and password first.");
      return;
    }

    setBusy(true);
    try {
      const user = await loginOrCreateCloudUser(email, password);
      await ensureHousehold(user);
      setMessage("Login ready. Opening the app...");
      router.replace("/app");
    } catch (error) {
      setMessage(cloudErrorMessage(error, "login"));
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="eyebrow">Monthly Survival</p>
        <h1>Login before opening the app</h1>
        <p className="login-copy">Your finance dashboard opens only after Supabase login is ready.</p>

        <form className="login-form" onSubmit={submitLogin}>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" autoComplete="current-password" required />
          </label>
          <button disabled={busy} type="submit">{busy ? "Checking..." : "Login / Create"}</button>
        </form>

        <div className="login-message">{message}</div>
      </section>
    </main>
  );
}
