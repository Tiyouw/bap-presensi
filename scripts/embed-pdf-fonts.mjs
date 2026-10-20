// Offline runtime assets. Re-run deliberately to update the pinned upstream fonts.
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const revision = "ba95515f1333efe9342c2ad988b9c2f6bef6dbad";
let output = `/* Tinos, SIL OFL; metrics compatible with Times New Roman.\n * Source: google/fonts@${revision}/ofl/tinos. See OFL-Tinos.txt. */\n`;
for (const [key, file] of [["REGULAR", "Tinos-Regular.ttf"], ["BOLD", "Tinos-Bold.ttf"]]) {
  const url = `https://raw.githubusercontent.com/google/fonts/${revision}/ofl/tinos/${file}`;
  const response = await fetch(url);
  if (!response.ok) throw Error(`Font download failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.readUInt32BE(0) !== 0x00010000) throw Error("Expected static TrueType font");
  const hash = createHash("sha256").update(bytes).digest("hex");
  output += `// ${file} sha256:${hash}\nexport const FONT_${key} = "${bytes.toString("base64")}";\n`;
  console.log(file, bytes.length, hash);
}
writeFileSync(new URL("../bap-shared/assets/fonts.js", import.meta.url), output);
