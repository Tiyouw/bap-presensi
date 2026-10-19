import { useEffect, useState } from "react";
import { useConvexConnectionState } from "convex/react";

export function useNetwork() {
  const [deviceOnline, setDeviceOnline] = useState(() => navigator.onLine);
  const connection = useConvexConnectionState();
  useEffect(() => {
    const update = () => setDeviceOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return {
    deviceOnline,
    online: deviceOnline && connection.isWebSocketConnected,
  };
}
