"use client";

import { useEffect, useRef, useState } from "react";

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script";
const TURNSTILE_COOKIE = "bnl_turnstile";
const TURNSTILE_ACTION = "name-search";

type GateStatus = {
  challengeRequired?: boolean;
  paywall?: boolean;
  turnstileConfigured?: boolean;
  turnstileSiteKey?: string;
};

type TurnstileOptions = {
  sitekey: string;
  action?: string;
  theme?: "light" | "dark" | "auto";
  appearance?: "always" | "execute" | "interaction-only";
  callback?: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
};

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileOptions) => string;
      remove: (widgetId: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Unable to load human verification.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load human verification."));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

function setTurnstileCookie(token: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${TURNSTILE_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=300; SameSite=Lax${secure}`;
}

export default function SearchSecurityGate() {
  const [open, setOpen] = useState(false);
  const [siteKey, setSiteKey] = useState("");
  const [message, setMessage] = useState("Verifying that you’re human…");
  const [checking, setChecking] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pendingFormRef = useRef<HTMLFormElement | null>(null);
  const bypassNextSubmitRef = useRef(false);
  const widgetIdRef = useRef<string | null>(null);

  async function inspectAndContinue(form: HTMLFormElement) {
    setChecking(true);
    try {
      const response = await fetch("/api/usage", { cache: "no-store" });
      const status = (await response.json()) as GateStatus & { error?: string };
      if (!response.ok) throw new Error(status.error || "Unable to verify search access.");

      if (!status.challengeRequired || status.paywall) {
        bypassNextSubmitRef.current = true;
        form.requestSubmit();
        return;
      }

      if (!status.turnstileConfigured || !status.turnstileSiteKey) {
        pendingFormRef.current = null;
        setSiteKey("");
        setMessage("Human verification is not configured yet. Add the Turnstile keys before enabling protected searches.");
        setOpen(true);
        return;
      }

      pendingFormRef.current = form;
      setSiteKey(status.turnstileSiteKey);
      setMessage("For security, please complete a quick human verification to continue.");
      setOpen(true);
    } catch (error) {
      pendingFormRef.current = null;
      setSiteKey("");
      setMessage(error instanceof Error ? error.message : "Unable to verify search access.");
      setOpen(true);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    const intercept = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.id !== "search") return;

      if (bypassNextSubmitRef.current) {
        bypassNextSubmitRef.current = false;
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      void inspectAndContinue(form);
    };

    document.addEventListener("submit", intercept, true);
    return () => document.removeEventListener("submit", intercept, true);
  }, []);

  useEffect(() => {
    if (!open || !siteKey || !containerRef.current) return;
    let cancelled = false;

    void loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action: TURNSTILE_ACTION,
          theme: "dark",
          appearance: "always",
          callback: (token) => {
            setTurnstileCookie(token);
            const form = pendingFormRef.current;
            pendingFormRef.current = null;
            setOpen(false);
            if (form) {
              bypassNextSubmitRef.current = true;
              window.setTimeout(() => form.requestSubmit(), 0);
            }
          },
          "expired-callback": () => {
            setMessage("Verification expired. Please complete it again.");
          },
          "error-callback": () => {
            setMessage("Human verification could not load. Please refresh and try again.");
          },
        });
      })
      .catch((error) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load human verification.");
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Widget may already be gone after successful verification.
        }
      }
      widgetIdRef.current = null;
    };
  }, [open, siteKey]);

  if (!open && !checking) return null;

  return (
    <>
      {checking && (
        <div
          aria-live="polite"
          style={{
            position: "fixed",
            right: 18,
            bottom: 18,
            zIndex: 80,
            border: "1px solid rgba(255,255,255,.12)",
            background: "rgba(8,17,27,.94)",
            color: "#dce8f4",
            borderRadius: 12,
            padding: "10px 14px",
            boxShadow: "0 14px 40px rgba(0,0,0,.35)",
            fontSize: 13,
          }}
        >
          Checking security…
        </div>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="human-verification-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "grid",
            placeItems: "center",
            padding: 20,
            background: "rgba(2,8,15,.76)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div
            style={{
              width: "min(440px, 100%)",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,.12)",
              background: "#101d2d",
              color: "#f6f8fb",
              padding: 24,
              boxShadow: "0 28px 90px rgba(0,0,0,.5)",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "#61f2b2", marginBottom: 8 }}>
              Security check
            </div>
            <h2 id="human-verification-title" style={{ margin: "0 0 8px", fontSize: 24, letterSpacing: "-.03em" }}>
              Confirm you’re human
            </h2>
            <p style={{ margin: "0 0 20px", color: "#9db0c4", lineHeight: 1.55, fontSize: 14 }}>
              {message}
            </p>
            {siteKey && <div ref={containerRef} style={{ minHeight: 65, display: "grid", placeItems: "center" }} />}
            <button
              type="button"
              onClick={() => {
                pendingFormRef.current = null;
                setOpen(false);
              }}
              style={{
                marginTop: 18,
                width: "100%",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,.12)",
                background: "rgba(255,255,255,.05)",
                color: "#dce8f4",
                padding: "10px 14px",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
