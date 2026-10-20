import { useCallback, useMemo, useSyncExternalStore } from "react";
import { getFunctionName } from "convex/server";
import { PESERTA } from "./data-fixture.js";

let version = 0;
const listeners = new Set();
const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const participants = PESERTA.map((p) => ({ ...p, id: p.nim }));
const initial = {
  peserta: participants,
  pertemuan: Array.from({ length: 16 }, (_, i) => ({
    id: `p${i + 1}`,
    numero: i + 1,
    nomor: i + 1,
    tanggal: new Date(Date.UTC(2026, 7, 31 + i * 7)).toISOString().slice(0, 10),
    tempat: "F6",
    tipe: i === 7 ? "UTS" : i === 15 ? "UAS" : "REGULER",
    status: i === 0 ? "KUNCI" : "TERBUKA",
    revision: i === 0 ? 1 : 0,
  })),
  presensi: {},
  docs: {},
};
let server = read("ui-qa.server", initial);
let connected = read("ui-qa.connected", true);
let generationFails = false;
let authExpired = false;
const calls = [];
const heldQueries = new Set();
let requestDelay = 100;
const publish = () => {
  version++;
  localStorage.setItem("ui-qa.server", JSON.stringify(server));
  listeners.forEach((fn) => fn());
};
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const current = () => version;
const wait = () => new Promise((resolve) => setTimeout(resolve, requestDelay));

window.__qa = {
  calls,
  holdQuery(name, held = true) {
    if (held) heldQueries.add(name);
    else heldQueries.delete(name);
    publish();
  },
  setRequestDelay(ms) {
    requestDelay = ms;
  },
  documentReady(id) {
    const p = server.pertemuan.find((p) => p.id === id);
    server.docs[id] = {
      status: "READY",
      url: "https://example.test/bap.docx",
      revision: p.revision,
    };
    publish();
  },
  setConnected(value) {
    connected = value;
    localStorage.setItem("ui-qa.connected", JSON.stringify(value));
    publish();
  },
  failGeneration(value) {
    generationFails = value;
  },
  expireSession() {
    authExpired = true;
    publish();
  },
  advance(id) {
    const p = server.pertemuan.find((p) => p.id === id);
    p.revision++;
    p.status = "KUNCI";
    server.presensi[id] = participants.map((p, i) => ({
      pesertaId: p.id,
      status: i === 2 ? "SAKIT" : "HADIR",
    }));
    publish();
  },
};

export class ConvexReactClient {}
export function ConvexProvider({ children }) {
  return children;
}
export function useConvexConnectionState() {
  useSyncExternalStore(subscribe, current);
  return { isWebSocketConnected: connected };
}
export function useQuery(reference, args) {
  const tick = useSyncExternalStore(subscribe, current);
  const name = getFunctionName(reference);
  return useMemo(() => {
    if (args === "skip" || !connected || heldQueries.has(name))
      return undefined;
    if (authExpired || args?.token !== "ui-test-token") {
      const error = new Error("TOKEN_KEDALUWARSA");
      error.data = "TOKEN_KEDALUWARSA";
      throw error;
    }
    if (name === "bootstrap:get")
      return {
        diambilPada: Date.now(),
        peserta: server.peserta,
        pertemuan: server.pertemuan.map((p) => ({ ...p })),
      };
    if (name === "sesi:detail")
      return {
        pertemuan: {
          ...server.pertemuan.find((p) => p.id === args.pertemuanId),
        },
        presensi: server.presensi[args.pertemuanId] || [],
      };
    if (name === "bap:forSesi") return server.docs[args.pertemuanId] || null;
    if (name === "bap:ringkasanCetak")
      return server.pertemuan
        .filter((p) => p.tipe === "REGULER" && p.status === "KUNCI")
        .map((p) => {
          const jumlahAbsen = (server.presensi[p.id] || []).filter(
            (r) => r.status !== "HADIR",
          ).length;
          return {
            id: p.id,
            nomor: p.nomor,
            tanggal: p.tanggal,
            revision: p.revision,
            jumlahAbsen,
            jumlahForm: Math.max(1, Math.ceil(jumlahAbsen / 12)),
          };
        });
    return null;
  }, [tick, name, args === "skip", args?.pertemuanId, args?.token]);
}
export function useMutation(reference) {
  const name = getFunctionName(reference);
  return useCallback(
    async (args) => {
      calls.push({ name, args });
      await wait();
      if (!connected) throw new Error("offline");
      if (name === "seed:jalan") return { dilewati: true };
      const meeting = server.pertemuan.find((p) => p.id === args.pertemuanId);
      if (name === "sesi:simpanDanKunci") {
        if (meeting.revision !== args.baseRevision) {
          const error = new Error("KONFLIK_REVISI");
          error.data = "KONFLIK_REVISI";
          throw error;
        }
        if (args.statuses.length !== 93) throw new Error("PESERTA_KURANG");
        meeting.revision++;
        meeting.status = "KUNCI";
        server.presensi[args.pertemuanId] = args.statuses;
        publish();
        return { ok: true, revision: meeting.revision };
      }
      if (name === "sesi:bukaKunci") {
        meeting.status = "TERBUKA";
        publish();
        return { ok: true, revision: meeting.revision };
      }
      return { ok: true };
    },
    [name],
  );
}
export function useAction(reference) {
  const name = getFunctionName(reference);
  return useCallback(
    async (args) => {
      calls.push({ name, args });
      await wait();
      if (name === "authNode:login") {
        if (args.password !== "demo") {
          const error = new Error("PASSWORD_SALAH");
          error.data = "PASSWORD_SALAH";
          throw error;
        }
        authExpired = false;
        return { token: "ui-test-token" };
      }
      if (name === "bapNode:generate") {
        if (generationFails) {
          const error = new Error("GENERATE_GAGAL");
          error.data = "GENERATE_GAGAL";
          throw error;
        }
        const meeting = server.pertemuan.find((p) => p.id === args.pertemuanId);
        const result = {
          status: "READY",
          url: "https://example.test/bap.docx",
          revision: meeting.revision,
          sha256: "ui-fixture",
        };
        server.docs[meeting.id] = result;
        publish();
        return result;
      }
      if (name === "bapNode:paketCetak") {
        if (generationFails) throw { data: "PAKET_GAGAL" };
        if (
          args.items.some((item) => {
            const p = server.pertemuan.find((p) => p.id === item.pertemuanId);
            return !p || p.status !== "KUNCI" || p.revision !== item.revision;
          })
        )
          throw { data: "PAKET_BERUBAH" };
        return {
          base64: btoa("Print download transport fixture"),
          fileName: "BAP_PPB_P01-02_2-form-folio.docx",
          revisions: args.items.map((item) => ({
            numero: 0,
            nomor: server.pertemuan.find((p) => p.id === item.pertemuanId)
              .nomor,
            revision: item.revision,
          })),
        };
      }
      return null;
    },
    [name],
  );
}
