// src/api/client.js
import { useAuth0 } from "@auth0/auth0-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function useApi() {
  const { getAccessTokenSilently } = useAuth0();

  const authed = async (input, init = {}) => {
    const token = await getAccessTokenSilently();
    const res = await fetch(`${API_URL}${input}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
    });

    // успіх
    if (res.ok) return res.status === 204 ? null : res.json();

    // помилка: спробуємо витягти detail
    let msg = `${res.status} ${res.statusText}`;
    const ct = res.headers.get("content-type") || "";
    try {
      if (ct.includes("application/json")) {
        const body = await res.json();
        const detail = body?.detail;
        if (detail) msg += ` — ${typeof detail === "string" ? detail : JSON.stringify(detail)}`;
      } else {
        const txt = await res.text();
        if (txt) msg += ` — ${txt}`;
      }
    } catch { /* ignore parse errors */ }

    throw new Error(msg);
  };

  return {
    get: (url) => authed(url),
    post: (url, body) => authed(url, { method: "POST", body: JSON.stringify(body) }),
    put:  (url, body) => authed(url, { method: "PUT",  body: JSON.stringify(body) }),
    del:  (url) => authed(url, { method: "DELETE" }),
  };
}
