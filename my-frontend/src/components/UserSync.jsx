import { useEffect, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useApi } from "../api/client";

export default function UserSync() {
  const { isAuthenticated, isLoading, user } = useAuth0();
  const { post } = useApi();
  const didSync = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      didSync.current = false;
      return;
    }
    if (didSync.current) return;

    (async () => {
      try {
        await post("/api/users/sync", {
          email: user?.email ?? undefined,
          name: user?.name ?? undefined,
        });
        didSync.current = true;
      } catch (e) {
        console.error("User sync failed:", e);
      }
    })();
  }, [isAuthenticated, isLoading, post, user]);

  return null;
}