import assert from "node:assert/strict";
import { lockBodyScroll } from "../src/lib/scrollLock.js";
import {
  HELP_TOPICS,
  HELP_AREAS,
  FIELD_HELP,
  helpAllowed,
  helpTopic,
  helpTopics,
  pageHelpArea,
  tourStorageKey,
  readTourProgress,
  saveTourProgress,
} from "../src/lib/helpContent.js";
const admin = {
  userId: "demo-admin",
  role: "ADMIN",
  classId: "demo-class",
  enabled: true,
  capabilities: [
    "schedule",
    "history",
    "identity",
    "roster",
    "template",
    "lifecycle",
    "export",
    "delegate",
  ],
};
const operator = {
  ...admin,
  userId: "demo-op",
  role: "OPERATOR",
  capabilities: [],
};
let count = 0;
const check = (title, fn) => {
  fn();
  count++;
  console.log("OK help", title);
};
check(
  "catalogue covers all planned areas; links and field mappings reference complete, plain content",
  () => {
    assert(Object.keys(HELP_TOPICS).length >= 36);
    for (const [id, t] of Object.entries(HELP_TOPICS)) {
      assert(t.title && t.summary && t.body.length >= 2, id);
      assert(t.areas.length && t.areas.every((a) => HELP_AREAS[a]), id);
      assert(
        !/<script|https?:|passwordHash|recoveryHashes|token[:=]/i.test(
          JSON.stringify(t),
        ),
        id,
      );
    }
    for (const id of Object.values(FIELD_HELP)) assert(HELP_TOPICS[id]);
    for (const area of Object.keys(HELP_AREAS))
      assert(helpTopics(admin, area).length, area);
  },
);
check(
  "anonymous help exposes only login/recovery; class-specific actions require a current class and rights",
  () => {
    assert.deepEqual(
      helpTopics({}, "")
        .map((t) => t.id)
        .sort(),
      ["login", "recovery"],
    );
    assert(!helpAllowed("accounts", operator));
    assert(!helpAllowed("export", operator));
    assert(!helpAllowed("correction", operator));
    assert(!helpAllowed("backupRestore", operator));
    assert(!helpAllowed("export", { ...admin, classId: "" }));
    assert(
      helpAllowed("correction", { ...operator, capabilities: ["history"] }),
    );
    assert(!helpAllowed("export", { ...operator, capabilities: ["history"] }));
  },
);
check(
  "legacy and revised lock guidance agree with the feature state; Operator receives read-only roster explanation",
  () => {
    assert(
      helpTopic("lock", admin)
        .body.join(" ")
        .includes("tidak perlu rangkaian buka kunci"),
    );
    assert(
      helpTopic("lock", { ...operator, enabled: false })
        .body.join(" ")
        .includes("Buka kunci lalu"),
    );
    assert.equal(helpTopic("correction", { ...admin, enabled: false }), null);
    assert(helpTopic("roster", operator).body[0].includes("minta izin roster"));
  },
);
check(
  "search combines words across title/content and respects rights, independent of class data",
  () => {
    assert(
      helpTopics(admin, "", "tanggal presensi").some((t) => t.id === "date"),
    );
    assert(
      helpTopics(admin, "jadwal").every((t) => t.areas.includes("jadwal")),
    );
    assert(!helpTopics(operator, "", "JSON").some((t) => t.id === "export"));
    assert.deepEqual(helpTopics(admin, "", "no-such-explanation-xyz"), []);
  },
);
check(
  "route areas select correction/attendance/documents and normalize the meeting tab",
  () => {
    for (const [path, area] of [
      ["/kelas/k?tab=jadwal&correct=p", "koreksi"],
      ["/kelas/k/pertemuan/p", "presensi"],
      ["/kelas/k?tab=pertemuan", "kelas"],
      ["/kelas/k?tab=mahasiswa", "mahasiswa"],
      ["/dokumen", "dokumen"],
      ["/akun", "akun"],
      ["/pengaturan", "profil"],
      ["/", "home"],
    ])
      assert.equal(pageHelpArea(path), area, path);
  },
);
check(
  "tour progress is separate per account/server/tour/version and distinguishes skip from completion",
  () => {
    const data = new Map(),
      storage = {
        getItem: (k) => data.get(k),
        setItem: (k, v) => data.set(k, v),
      };
    assert(
      saveTourProgress(
        storage,
        "server-a",
        "user-a",
        "correction",
        "started",
        2,
      ),
    );
    assert.equal(
      readTourProgress(storage, "server-a", "user-a", "correction").status,
      "started",
    );
    assert.equal(
      readTourProgress(storage, "server-a", "user-b", "correction"),
      null,
    );
    assert.equal(
      readTourProgress(storage, "server-b", "user-a", "correction"),
      null,
    );
    assert.equal(
      readTourProgress(storage, "server-a", "user-a", "attendance"),
      null,
    );
    saveTourProgress(storage, "server-a", "user-a", "correction", "skipped", 2);
    assert.equal(
      readTourProgress(storage, "server-a", "user-a", "correction").status,
      "skipped",
    );
    saveTourProgress(
      storage,
      "server-a",
      "user-a",
      "correction",
      "completed",
      4,
    );
    assert.equal(
      readTourProgress(storage, "server-a", "user-a", "correction").status,
      "completed",
    );
    data.set(
      tourStorageKey("server-a", "user-a", "correction"),
      '{"version":0,"status":"completed","step":1}',
    );
    assert.equal(
      readTourProgress(storage, "server-a", "user-a", "correction"),
      null,
    );
  },
);
check(
  "corrupt/unavailable storage and invalid progress cannot claim completion or break help",
  () => {
    const broken = {
      getItem: () => {
        throw Error("denied");
      },
      setItem: () => {
        throw Error("quota");
      },
    };
    assert.equal(readTourProgress(broken, "a", "u", "class"), null);
    assert.equal(
      saveTourProgress(broken, "a", "u", "class", "completed", 1),
      false,
    );
    assert.equal(
      saveTourProgress(null, "a", "u", "class", "completed", 1),
      false,
    );
    assert.equal(
      saveTourProgress(broken, "a", "", "class", "completed", 1),
      false,
    );
    const storage = {
      getItem: () => '{"version":1,"status":"completed","step":999}',
      setItem: () => {
        throw Error("must not write");
      },
    };
    assert.equal(readTourProgress(storage, "a", "u", "class"), null);
    assert.equal(
      saveTourProgress(storage, "a", "u", "class", "not-a-status", 1),
      false,
    );
  },
);
check(
  "nested modal/help/sidebar scroll ownership restores the original state in either close order",
  () => {
    const previous = globalThis.document;
    globalThis.document = { body: { style: { overflow: "auto" } } };
    try {
      const a = lockBodyScroll(),
        b = lockBodyScroll();
      a();
      assert.equal(document.body.style.overflow, "hidden");
      b();
      assert.equal(document.body.style.overflow, "auto");
      b();
      assert.equal(document.body.style.overflow, "auto");
      document.body.style.overflow = "clip";
      const c = lockBodyScroll(),
        d = lockBodyScroll();
      d();
      assert.equal(document.body.style.overflow, "hidden");
      c();
      assert.equal(document.body.style.overflow, "clip");
    } finally {
      globalThis.document = previous;
    }
  },
);
console.log(`${count} contextual help groups passed.`);
