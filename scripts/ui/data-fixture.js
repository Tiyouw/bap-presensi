// Entirely synthetic: never import a real roster or generated seed into tests.
// Keep 93 rows to exercise the current class size and four group boundaries.
const names = [
  "Alya Demo",
  "Bima Demo",
  "Citra Demo",
  "Damar Demo",
  "Eka Demo",
  "Fajar Demo",
  "Gita Demo",
  "Hana Demo",
  "Intan Demo",
  "Jaya Demo",
];
export const PESERTA = Array.from({ length: 93 }, (_, index) => ({
  nim: index === 70 ? "ALT000001" : `DEMO${String(index + 1).padStart(5, "0")}`,
  nama:
    names[index] || `Mahasiswa Contoh ${String(index + 1).padStart(2, "0")}`,
  golongan: index < 23 ? "A" : index < 47 ? "B" : index < 70 ? "C" : "D",
  urut: index + 1,
}));
