import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { getFunctionName } from "convex/server";
import { PESERTA } from "./data-fixture.js";
import { adaPraktikum } from "../../bap-shared/jadwal.js";
import {createControlEngine,restoreControlEngine} from "./control-fixture.js";

let version = 0;
const listeners = new Set();
const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const participants = read("ui-qa.roster", PESERTA.map((p) => ({ ...p, id: p.nim })));
const kelas = {
  id: "k1",
  _id: "k1",
  matkulId: "m1",
  nama: "Kelas Demo",
  matkulNama: "Pengantar Pariwisata Budaya",
  matkulKode: "PPB",
  semester: "GASAL",
  tahunAkademik: "2026/2027",
  dosen: "Dosen Demo",
  asdos: "Marchaenta Demo",
  tempat: "F6",
  revision: 1,
  templateVersion: 1,
  arsip: false,
};
const initial = {
  peserta: participants,
  pertemuan: Array.from({ length: 16 }, (_, i) => ({
    id: `p${i + 1}`,
    numero: i + 1,
    nomor: i + 1,
    tanggal: new Date(Date.UTC(2026, 7, 31 + i * 7)).toISOString().slice(0, 10),
    tempat: "F6",
    // Migrated PPB week 1 remains historical/locked but is theory, excluded from practical counts.
    tipe: i === 0 ? "TEORI" : i === 7 ? "UTS" : i === 15 ? "UAS" : "REGULER",
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
let controlEngine;
function syncControls(){if(!controlEngine)return;Object.assign(kelas,controlEngine.ctx.tabel.get('kelas').get('k1'));
 server.pertemuan=[...controlEngine.ctx.tabel.get('pertemuan')].map(([id,p])=>({...p,id}));
 server.presensi={};for(const s of controlEngine.ctx.tabel.get('presensi')?.values()||[]) (server.presensi[s.pertemuanId]||=[]).push({pesertaId:s.pesertaId,status:s.status});
}
const restoredControls=restoreControlEngine();if(restoredControls)createControlEngine({kelas,participants,server,restore:restoredControls}).then(e=>{controlEngine=e;syncControls();publish()});

window.__qa = {
  calls,
  async enableControls(options={}){controlEngine=await createControlEngine({kelas,participants,server,...options});syncControls();publish();},
  async controlAdvance(id='p3'){await controlEngine.advance(id);syncControls();publish();},
  controlState(){return{meetings:[...controlEngine.ctx.tabel.get('pertemuan')].map(([id,p])=>({...p,id})),jobs:controlEngine.cache.get('scheduleBatches:jobs')||[],revisions:[...controlEngine.ctx.tabel.get('meetingRevision')?.values()||[]]};},
  seedHistory(count) {
    kelas.readModelReady = true;
    server.history = Array.from({ length: count }, (_, i) => ({ id: `archive-${i}`, nomor: 3, tanggal: "2026-10-21", revision: count - i, format: "docx", templateVersion: "kelas-k1-v1", url: "https://example.test/bap.docx", pada: count - i }));
    publish();
  },
  renameParticipant(id, nama) {
    const person = participants.find((p) => p.id === id);
    if (!person) throw new Error("Unknown synthetic participant");
    person.nama = nama;
    localStorage.setItem("ui-qa.roster", JSON.stringify(participants));
    publish();
  },
  addParticipant(person) {
    participants.push(person);
    localStorage.setItem("ui-qa.roster", JSON.stringify(participants));
    publish();
  },
  advanceOpenWithParticipant(person) {
    participants.push(person);
    localStorage.setItem("ui-qa.roster", JSON.stringify(participants));
    const p = server.pertemuan.find(p => p.id === "p3");
    p.revision++;
    p.status = "TERBUKA";
    p.snapshot = { peserta: participants.map(p => ({ ...p })) };
    publish();
  },
  removeParticipant(id) {
    const index = participants.findIndex(p => p.id === id);
    if (index >= 0) participants.splice(index, 1);
    localStorage.setItem("ui-qa.roster", JSON.stringify(participants));
    publish();
  },
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
export function useConvex(){return{query:async(reference,args)=>{if(!controlEngine||!connected)throw Error('offline');calls.push({name:getFunctionName(reference),args});return controlEngine.query(getFunctionName(reference),args)}};}
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
    if (name === "auth:me")
      return authExpired || args?.token !== "ui-test-token"
        ? null
        : {
            id: "qa-user",
            username: "demo",
            nama: "Admin Demo",
            peran: "ADMIN",
            kelasIds: ["k1"],
            aktif: true,
            wajibGanti: false,
          };
    if (authExpired || args?.token !== "ui-test-token") {
      const error = new Error("TOKEN_KEDALUWARSA");
      error.data = "TOKEN_KEDALUWARSA";
      throw error;
    }
    if (name === "kelola:catalog")
      return {
        kelas: [
          {
            ...kelas,
            jumlahPeserta: 93,
            jumlahPraktikum: 13,
            jumlahTerkunci: server.pertemuan.filter(
              (p) => p.nomor !== 1 && p.status === "KUNCI",
            ).length,
          },
        ],
        matkul: [{ id: "m1", nama: kelas.matkulNama, kode: "PPB" }],
      };
    if (name === "kelola:detail")
      return {
        ...(controlEngine?{controls:controlEngine.controls()}:{}),
        kelas,
        peserta: participants,
        pertemuan: server.pertemuan.map((p) => ({ ...p })),
        templates: [],
        impor: [],
        audit: [],
      };
    if (name === "bootstrap:get")
      return {
        diambilPada: Date.now(),
        peserta: server.peserta,
        pertemuan: server.pertemuan.map((p) => ({ ...p })),
      };
    if (name === "sesi:detail")
      return {
        peserta: server.pertemuan.find(p => p.id === args.pertemuanId)?.snapshot?.peserta || participants,
        kelas,
        pertemuan: {
          ...server.pertemuan.find((p) => p.id === args.pertemuanId),
        },
        presensi: server.presensi[args.pertemuanId] || [],
      };
    if(name==='revisions:classAvailability')return controlEngine?{enabled:true}:null;
    if(name==='revisions:historyPage'||name==='revisions:printVersionsPage'){if(!controlEngine)return undefined;const rows=controlEngine.cache.get(name==='revisions:historyPage'?'revisions:historyRows:'+args.pertemuanId:'revisions:printRows')||[],start=Number(args.paginationOpts.cursor||0),count=args.paginationOpts.numItems;return{page:rows.slice(start,start+count),isDone:start+count>=rows.length,continueCursor:String(start+count)};}
    if(name.startsWith('revisions:'))return controlEngine?.cache.get(name+':'+args.pertemuanId);
    if(name==='scheduleBatches:jobsPage'){if(!controlEngine)return undefined;const rows=controlEngine.cache.get('scheduleBatches:jobs')||[],start=Number(args.paginationOpts.cursor||0),count=args.paginationOpts.numItems;return{page:rows.slice(start,start+count),isDone:start+count>=rows.length,continueCursor:String(start+count)};}
    if(name==='scheduleBatches:jobDetail')return controlEngine?.cache.get(name+':'+args.jobId);
    if (name === "bap:forSesi") return server.docs[args.pertemuanId] || null;
    if (name === "bap:historyPage") {
      const start = Number(args.paginationOpts.cursor || 0), count = args.paginationOpts.numItems;
      const rows = server.history || [];
      return { page: rows.slice(start, start + count), isDone: start + count >= rows.length, continueCursor: String(start + count) };
    }
    if (name === "bap:ringkasanCetak")
      return server.pertemuan
        .filter((p) => adaPraktikum(p) && p.status === "KUNCI")
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
  }, [tick, name, args === "skip", args?.pertemuanId, args?.token, args?.id, args?.kelasId,args?.jobId, args?.paginationOpts?.numItems, args?.paginationOpts?.cursor]);
}
export function usePaginatedQuery(reference, args, { initialNumItems }) {
  const [count, setCount] = useState(initialNumItems);
  const value = useQuery(reference, args === "skip" ? "skip" : { ...args, paginationOpts: { cursor: null, numItems: count } });
  const loadMore = useCallback(n => setCount(c => c + n), []);
  return { results: value?.page || [], status: args === "skip" || value?.isDone ? "Exhausted" : value ? "CanLoadMore" : "LoadingFirstPage", loadMore };
}
export function useMutation(reference) {
  const name = getFunctionName(reference);
  return useCallback(
    async (args) => {
      calls.push({ name, args });
      await wait();
      if (!connected) throw new Error("offline");
      if(/^(revisions|scheduleBatches|meetingCommands):/.test(name)&&controlEngine){const result=await controlEngine.mutate(name,args);syncControls();publish();return result;}
      if (name === "seed:jalan") return { dilewati: true };
      const meeting = server.pertemuan.find((p) => p.id === args.pertemuanId);
      if (name === "sesi:simpanDanKunci") {
        if (meeting.revision !== args.baseRevision) {
          const error = new Error("KONFLIK_REVISI");
          error.data = "KONFLIK_REVISI";
          throw error;
        }
        if (args.statuses.length !== (meeting.snapshot?.peserta || participants).length) throw new Error("PESERTA_KURANG");
        meeting.snapshot ||= { peserta: participants.map(p => ({ ...p })) };
        meeting.revision++;
        meeting.status = "KUNCI";
        server.presensi[args.pertemuanId] = args.statuses;
        publish();
        return { ok: true, revision: meeting.revision };
      }
      if (name === "sesi:bukaKunci") {
        if (meeting.revision !== args.expectedRevision) throw { data: "KONFLIK_REVISI" };
        meeting.status = "TERBUKA";
        publish();
        return { ok: true, revision: meeting.revision };
      }
      if (name === "kelola:refreshSnapshot") {
        if (meeting.revision !== args.baseRevision || meeting.status !== "TERBUKA") throw { data: "KONFLIK_REVISI" };
        meeting.revision++;
        meeting.snapshot = { peserta: participants.map(p => ({ ...p })) };
        publish();
        return { pertemuan: { ...meeting }, peserta: meeting.snapshot.peserta, kelas, presensi: server.presensi[meeting.id] || [] };
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
        if(controlEngine){const source=await controlEngine.packet(args);return{base64:btoa('Synthetic packet transport fixture'),fileName:'BAP_QA_packet.docx',revisions:source.map(d=>({nomor:d.pertemuan.nomor,revision:d.pertemuan.revision}))};}
        if (
          args.items.some((item) => {
            const p = server.pertemuan.find((p) => p.id === item.pertemuanId);
            return !p || p.status !== "KUNCI" || p.revision !== item.revision;
          })
        )
          throw { data: "PAKET_BERUBAH" };
        return {
          base64: btoa("Print download transport fixture"),
          fileName: `BAP_PPB_P${args.items.map((item) => String(server.pertemuan.find((p) => p.id === item.pertemuanId).nomor).padStart(2, "0")).join("-")}_2-form-folio.docx`,
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
