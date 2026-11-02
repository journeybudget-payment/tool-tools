"""Utiliti kongsi: normal nombor, ratakan JSON, eksport."""
import csv, json, os, random, secrets, string

DIR = "data"


def normal(tel):
    tel = "".join(c for c in str(tel) if c.isdigit())
    return "+60" + (tel[2:] if tel.startswith("60") else tel.lstrip("0"))


def flat(o, pre=""):
    rows = []
    for k, v in (o or {}).items():
        key = f"{pre}.{k}" if pre else k
        if isinstance(v, dict):
            rows += flat(v, key)
        elif isinstance(v, list):
            rows.append((key, json.dumps(v, ensure_ascii=False)))
        else:
            rows.append((key, v))
    return rows


def simpan_json(nama, obj):
    os.makedirs(DIR, exist_ok=True)
    with open(os.path.join(DIR, nama), "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)


def baca_json(nama):
    p = os.path.join(DIR, nama)
    if not os.path.exists(p):
        return None
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def pw_baru(n=12):
    abc = string.ascii_letters + string.digits
    return "".join(secrets.choice(abc) for _ in range(n))


def jeda(a=0.4, b=1.0):
    import time
    time.sleep(a + random.random() * (b - a))


def eksport(semua, asas="hasil"):
    semua = [dict(flat(r)) for r in semua]
    if not semua:
        print("Tiada data untuk dieksport.")
        return
    kolum = sorted({k for r in semua for k in r})
    with open(asas + ".csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=kolum)
        w.writeheader()
        w.writerows(semua)
    print(f"-> {asas}.csv")
    try:
        from openpyxl import Workbook
    except ImportError:
        print("-> (xlsx dilangkau: pip install openpyxl)")
        return
    wb = Workbook()
    ws = wb.active
    ws.title = "Ringkasan"
    ws.append(kolum)
    for r in semua:
        ws.append([r.get(k, "") for k in kolum])
    ws.freeze_panes = "A2"
    for i, r in enumerate(semua, 1):
        sh = wb.create_sheet(f"Akaun {i}"[:31])
        sh.append(["Medan", "Nilai"])
        for k, v in r.items():
            sh.append([k, str(v)])
        sh.column_dimensions["A"].width = 34
        sh.column_dimensions["B"].width = 60
    wb.save(asas + ".xlsx")
    print(f"-> {asas}.xlsx")