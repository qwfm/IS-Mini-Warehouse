import { jwtDecode } from "jwt-decode"; 
import { useAuth0 } from "@auth0/auth0-react";

const NS = "https://mini-warehouse.example/roles";

export default function useAuthz() {
  const { getAccessTokenSilently } = useAuth0();
  const getPayload = async () => jwtDecode(await getAccessTokenSilently());
  const hasRole = async (r) => (await getPayload())[NS]?.includes(r);
  const hasPerm = async (p) => (await getPayload()).permissions?.includes(p);
  return { hasRole, hasPerm };
}
