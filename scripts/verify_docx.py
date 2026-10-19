#!/usr/bin/env python3
"""Verifikasi isi docx hasil generate: jumlah form, nomor, nama, sisa placeholder."""
import re
import sys

import docx

PLACEHOLDER = re.compile(r"\+\+\+.*?\+\+\+")


def forms_of(path):
    """Kumpulkan form berdasarkan kemunculan tabel pembimbing 3x4."""
    d = docx.Document(path)
    forms = []
    cur = None
    for ch in d.element.body.iterchildren():
        tag = ch.tag.split("}")[1]
        if tag == "tbl":
            t = docx.table.Table(ch, d)
            if len(t.rows) == 3 and len(t.columns) == 4:
                cur = {"tables": [], "paras": []}
                forms.append(cur)
                continue
            if cur is not None:
                cur["tables"].append(t)
        elif tag == "p" and cur is not None:
            cur["paras"].append(docx.text.paragraph.Paragraph(ch, d).text)
    # judul/metadata ada SEBELUM tabel pembimbing -> ambil dari paragraf global
    return forms, d


def main(path, n_absen):
    forms, d = forms_of(path)
    all_paras = [p.text for p in d.paragraphs]
    judul = [p for p in all_paras if "DAFTAR HADIR PEMBIMBING" in p]
    meta = [p for p in all_paras if p.startswith(("Mata Kuliah", "Hari / Tanggal",
                                                 "Tempat", "Semester / Golongan"))]

    errs = []
    if len(forms) != len(judul):
        errs.append(f"jumlah form {len(forms)} != jumlah judul {len(judul)}")
    if len(forms) != len(meta) // 4:
        errs.append(f"jumlah form {len(forms)} != blok metadata {len(meta)//4}")

    sisa = [p for p in all_paras if PLACEHOLDER.search(p)]
    for f in forms:
        for t in f["tables"]:
            for r in t.rows:
                for c in r.cells:
                    if PLACEHOLDER.search(c.text):
                        sisa.append(c.text)
    if sisa:
        errs.append(f"sisa placeholder: {sisa[:3]}")

    # kumpulkan nomor + nama dari tabel absen (7 baris: 1 header + 6 data)
    nomor, nama = [], []
    for f in forms:
        for t in f["tables"]:
            if len(t.columns) != 8:
                continue  # tabel kop (2 kol) / pembimbing (4 kol) bukan absen
            if len(t.rows) != 7:
                errs.append(f"tabel absen {len(t.rows)} baris (harus 7)")
            for r in list(t.rows)[1:]:
                cs = [c.text.strip() for c in r.cells]
                for no, nm in ((cs[0], cs[1]), (cs[4], cs[5])):
                    if no:
                        nomor.append(no)
                    if nm:
                        nama.append(nm)

    # nomor dikumpulkan baris-per-baris: kiri dulu lalu kanan -> 1,7,2,8,...
    harap_nomor = []
    for f_i in range(len(forms)):
        base = f_i * 12
        for i in range(6):
            harap_nomor.append(f"{base + i + 1}.")
            harap_nomor.append(f"{base + 6 + i + 1}.")
    if nomor != harap_nomor:
        errs.append(f"nomor tidak berurutan: {nomor} != {harap_nomor}")
    if len(nama) != n_absen:
        errs.append(f"nama tertulis {len(nama)}, harusnya {n_absen}: {nama}")

    print(f"--- {path}")
    print(f"    form={len(forms)}  nomor={len(nomor)}  nama={len(nama)}  "
          f"judul={len(judul)}")
    for j in judul:
        print(f"    judul: ...{j[-52:]}")
    for i, f in enumerate(forms):
        tbl = [t for t in f["tables"] if len(t.columns) == 8]
        rows = []
        for t in tbl:
            for r in list(t.rows)[1:]:
                cs = [c.text.strip() for c in r.cells]
                rows.append(cs)
        print(f"    form{i+1}: {len(tbl)} tabel absen, {len(rows)} baris data")
        for cs in rows:
            print(f"       {cs[0]:>3} {cs[1][:26]:26} {cs[2]:3} {cs[3]:2} | "
                  f"{cs[4]:>3} {cs[5][:26]:26} {cs[6]:3} {cs[7]:2}")
    if errs:
        print("    GAGAL:")
        for e in errs:
            print("      -", e)
        return 1
    print("    OK")
    return 0


if __name__ == "__main__":
    rc = 0
    for arg in sys.argv[1:]:
        path, n = arg.split(":")
        rc |= main(path, int(n))
    sys.exit(rc)
