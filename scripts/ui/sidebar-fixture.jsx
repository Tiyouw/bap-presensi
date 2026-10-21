import { getFunctionName } from "convex/server";
import * as fixture from "./convex-fixture.jsx";
export { ConvexProvider, ConvexReactClient, useMutation, useAction, useConvex, useConvexConnectionState, usePaginatedQuery } from "./convex-fixture.jsx";

// Only this suite's Vite alias uses this identity override; never bundled in the app.
export function useQuery(reference, args) {
  const value = fixture.useQuery(reference, args);
  if (getFunctionName(reference) === "auth:me" && value) {
    try { return { ...value, ...JSON.parse(localStorage.getItem("ui.sidebar.identity") || "{}") }; } catch {}
  }
  return value;
}
