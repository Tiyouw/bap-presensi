import { createContext, useContext, useMemo } from "react";
import * as store from "./store.js";
export const StorageScope = createContext("");
export function useScopedStore() {
  const scope = useContext(StorageScope);
  return useMemo(
    () =>
      Object.fromEntries(
        [
          "bacaDetail",
          "bacaDraf",
          "cadangkanDraf",
          "hapusDraf",
          "simpanDetail",
          "simpanDraf",
        ].map((name) => [
          name,
          (id, ...args) => store[name](scope ? `${scope}:${id}` : id, ...args),
        ]),
      ),
    [scope],
  );
}
export const WorkspaceContext = createContext(null);
