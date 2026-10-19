#!/usr/bin/env python3
"""
Fase 0 — bangun template BAP bersih (1 form) dari template asli prodi.

Sumber: BAP_-_Senin_2.docx (6 form).
Form yang dipakai: form ke-1 (index body 0..14) — satu-satunya form yang
strukturnya sehat setelah diverifikasi.

Yang dilakukan:
  1. Buang semua body child setelah form 1 (form 2..6).
  2. Buang page break supaya file hanya 1 form.
  3. Judul: "SEMESTER GENAP TAHUN AKADEMIK 2024/2025" -> +++semesterLabel+++
  4. Metadata 4 baris -> placeholder.
  5. Tabel absen: 1 baris template ber-loop FOR..END-FOR, 6 baris per form.

Yang TIDAK disentuh: kop, logo, tabel pembimbing, kolom tanda tangan,
font, margin, ukuran halaman, lebar kolom.
"""
import copy
import os
import sys
from pathlib import Path

import docx
from docx.table import Table
from docx.text.paragraph import Paragraph

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "bap-sumber-asli.docx"
OUT = ROOT / "templates" / "bap-template.docx"

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

# ---- batas form 1 (diverifikasi dari inspeksi body) ----
FORM1_LAST_IDX = 11   # inklusif; child 15 = kop form 2. 12..14 paragraf kosong
                      # dibuang: 4 baris kosong membuat form 2 x 2 + jarak
                      # melewati tinggi halaman -> halaman kosong.
FORM1_LAST_IDX = int(os.environ.get("FORM1_LAST_IDX", FORM1_LAST_IDX))


def set_text(el, text):
    """Ganti teks paragraph/sel, pertahankan formatting run pertama."""
    if isinstance(el, Paragraph):
        runs = el.runs
        target = el
    else:
        p = el.paragraphs[0]
        for extra in el.paragraphs[1:]:
            extra._element.getparent().remove(extra._element)
        runs = p.runs
        target = p
    if not runs:
        if text:
            target.add_run(text)
        return
    runs[0].text = text
    for r in runs[1:]:
        r._element.getparent().remove(r._element)


def strip_page_breaks(doc):
    for br in doc.element.body.iter(
        "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}br"
    ):
        if br.get(
            "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}type"
        ) == "page":
            br.getparent().remove(br)


def cut_to_first_form(doc):
    body = doc.element.body
    kids = list(body.iterchildren())
    # sisakan sectPr (selalu child terakhir)
    sect = kids[-1] if kids[-1].tag.endswith("}sectPr") else None
    for ch in kids[FORM1_LAST_IDX + 1:]:
        if sect is not None and ch is sect:
            continue
        body.remove(ch)


def main():
    doc = docx.Document(SRC)
    cut_to_first_form(doc)
    strip_page_breaks(doc)

    kids = list(doc.element.body.iterchildren())

    # --- judul (child 2) ---
    title = Paragraph(kids[2], doc)
    assert "DAFTAR HADIR PEMBIMBING" in title.text, title.text
    set_text(
        title,
        "DAFTAR HADIR PEMBIMBING PRAKTIK LABORATORIUM DAN LAPANG "
        "DAN BERITA ACARA PRAKTIK +++$f.judul+++",
    )

    # --- metadata (child 4..7) ---
    # tab dipertahankan supaya titik dua tetap sejajar seperti aslinya
    meta = [
        "Mata Kuliah\t\t: +++mataKuliah+++",
        "Hari / Tanggal\t\t: +++hariTanggal+++",
        "Tempat\t\t\t: +++tempat+++",
        "Semester / Golongan\t: +++semGol+++",
    ]
    for idx, text in zip((4, 5, 6, 7), meta):
        set_text(Paragraph(kids[idx], doc), text)

    # --- tabel absen (child 10): 7x8 -> header + FOR + data + END-FOR ---
    # Pola yang TERBUKTI bekerja di docx-templates: baris FOR dan baris END-FOR
    # masing-masing menempati barisnya sendiri (selain cell pertama kosong),
    # baris data ada di antara keduanya, dan kedua baris penanda dihapus saat
    # generate. Kalau FOR dan END-FOR ditaruh di SATU baris, loop hanya jalan
    # sekali dan sisa teks bocor ke hasil.
    tbl = Table(kids[10], doc)
    assert len(tbl.columns) == 8, len(tbl.columns)

    header_tr = tbl.rows[0]._tr
    data_tr = tbl.rows[1]._tr
    # buang baris 2..6 (slot contoh), sisakan header + 1 baris data
    for row in list(tbl.rows)[2:]:
        tbl._tbl.remove(row._tr)

    import lxml.etree as etree

    for_tr = etree.fromstring(etree.tostring(data_tr))
    end_tr = etree.fromstring(etree.tostring(data_tr))
    header_tr.addnext(for_tr)   # header | FOR | data
    data_tr.addnext(end_tr)     # header | FOR | data | END-FOR

    def cell_text(tr, idx, text):
        """Set teks sel ke-idx pada elemen <w:tr> mentah, rPr run asli dipertahankan."""
        tc = tr.findall(W + "tc")[idx]
        p = tc.find(W + "p")
        old_runs = p.findall(W + "r")
        # simpan rPr run pertama (font Times New Roman 12pt dsb). Tanpa ini run
        # baru jatuh ke default style -> baris tabel jadi lebih tinggi dan dua
        # form tidak lagi muat satu halaman.
        rpr = None
        for r in old_runs:
            cand = r.find(W + "rPr")
            if cand is not None:
                rpr = cand
                break
        for r in old_runs:
            p.remove(r)
        if not text:
            return
        r = etree.SubElement(p, W + "r")
        if rpr is not None:
            r.append(copy.deepcopy(rpr))
        t = etree.SubElement(r, W + "t")
        t.text = text
        t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")

    # baris FOR: kosongkan semua sel (jebakan: sisa teks terulang tiap iterasi)
    for i in range(8):
        cell_text(for_tr, i, "+++FOR r IN $f.baris+++" if i == 0 else "")
    for i in range(8):
        cell_text(end_tr, i, "+++END-FOR r+++" if i == 0 else "")

    # baris data: placeholder (pakai prefix $ karena berada di dalam block-loop)
    fields = ["no", "nama", "gol", "ket", "rno", "rnama", "rgol", "rket"]
    for i, f in enumerate(fields):
        cell_text(data_tr, i, "+++$r.%s+++" % f)

    # Kolom "No" kiri aslinya 510 twips (0.90 cm) — hanya cukup untuk 1 digit.
    # Di form lanjutan nomornya 2 digit (13..18) sehingga "13." terpecah jadi
    # dua baris dan baris tabel jadi lebih tinggi -> tabel form ke-2 terdorong
    # ke halaman berikutnya. Samakan jadi 567 (1.00 cm) seperti kolom "No"
    # kanan, ambil selisihnya dari kolom Nama supaya lebar total tidak berubah.
    tblGrid = tbl._tbl.find(W + "tblGrid")
    gridCols = tblGrid.findall(W + "gridCol")
    if int(gridCols[0].get(W + "w")) < 567:
        delta = 567 - int(gridCols[0].get(W + "w"))
        gridCols[0].set(W + "w", "567")
        # ambil dari kolom Nama, JANGAN dari Gol./Ket.: lebarnya pas untuk
        # header "Gol."/"Ket." — menyempitkan sedikit saja membuat header
        # terbungkus jadi dua baris. Nama masih lega (6.5 cm -> 6.4 cm).
        gridCols[1].set(W + "w", str(int(gridCols[1].get(W + "w")) - delta))

    # cegah satu baris tabel terbelah antar halaman + ulang header bila tabel
    # terpaksa pecah halaman (kasus >12 absen dengan nama panjang)
    for tr in (data_tr, for_tr, end_tr):
        trPr = tr.find(W + "trPr")
        if trPr is None:
            trPr = etree.SubElement(tr, W + "trPr")
        if trPr.find(W + "cantSplit") is None:
            etree.SubElement(trPr, W + "cantSplit")

    header_pr = header_tr.find(W + "trPr")
    if header_pr is None:
        header_pr = etree.SubElement(header_tr, W + "trPr")
    if header_pr.find(W + "tblHeader") is None:
        etree.SubElement(header_pr, W + "tblHeader")

    # --- loop luar: ulangi seluruh form bila absen > 12 ---
    # Halaman F4 muat TEPAT 2 form (seperti template asli), tanpa sisa ruang.
    # Karena itu page break harus eksplisit di setiap 2 form, bukan mengandalkan
    # pagination otomatis -> tanpa ini tabel form ke-2 terpotong ke halaman
    # berikutnya (sudah terbukti).
    body = doc.element.body
    kop = list(body.iterchildren())[0]
    for_wrap = copy.deepcopy(kids[1])       # paragraf kosong, jaga tata letak
    set_text(Paragraph(for_wrap, doc), "+++FOR f IN forms+++")
    kop.addprevious(for_wrap)

    from docx.enum.text import WD_BREAK

    p_if = copy.deepcopy(kids[1])
    set_text(Paragraph(p_if, doc), "+++IF $f.pageBreak+++")
    p_br = copy.deepcopy(kids[1])
    Paragraph(p_br, doc).add_run().add_break(WD_BREAK.PAGE)
    p_endif = copy.deepcopy(kids[1])
    set_text(Paragraph(p_endif, doc), "+++END-IF+++")
    end_wrap = copy.deepcopy(kids[1])
    set_text(Paragraph(end_wrap, doc), "+++END-FOR f+++")

    last = [c for c in body.iterchildren() if not c.tag.endswith("}sectPr")][-1]
    last.addnext(p_if)
    p_if.addnext(p_br)
    p_br.addnext(p_endif)
    p_endif.addnext(end_wrap)

    # row split: pastikan baris tidak pecah antar halaman
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(OUT))
    print("saved", OUT, OUT.stat().st_size, "bytes")

    # --- verifikasi struktur ---
    chk = docx.Document(str(OUT))
    sec = chk.sections[0]
    print("page %.2f x %.2f cm" % (sec.page_width.cm, sec.page_height.cm))
    print("margin T%.2f B%.2f L%.2f R%.2f" % (
        sec.top_margin.cm, sec.bottom_margin.cm,
        sec.left_margin.cm, sec.right_margin.cm))
    print("tables:", len(chk.tables))
    print("absen table rows:", len(chk.tables[-1].rows))
    for r in chk.tables[-1].rows:
        print("  ", [c.text for c in r.cells])

    body_txt = "\n".join(Paragraph(c, chk).text for c in chk.element.body.iterchildren()
                         if c.tag.endswith("}p"))
    print("--- paragraf ---")
    for line in body_txt.split("\n"):
        if line.strip():
            print("  ", repr(line))


if __name__ == "__main__":
    main()
