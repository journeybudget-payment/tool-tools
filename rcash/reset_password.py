#!/usr/bin/env python3
"""Set semula password R-Cash ikut nombor. Guna: python3 reset_password.py nombor.txt"""
import json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from lib.http import post
from lib.util import normal, pw_baru, jeda

CFG = json.load(open("config.json"))["rcash"]
OTP = CFG["base"] + CFG["request_otp"]
RESET = CFG["base"] + CFG["reset"]


def main():
    for baris in open(sys.argv[1], encoding="utf-8"):
        tel = baris.strip()
        if not tel or tel.startswith("#"):
            continue
        tel = normal(tel)

        _, o = post(OTP, {"phone_number": tel, "purpose": CFG["otp_purpose"]})
        if not o.get("success"):
            print(f"[TIADA] {tel} -> {o.get('error') or o.get('detail')}")
            continue
        kod = o.get("otp_code")
        if not kod:
            print(f"[PERLU] {tel} -> kod tiada dalam respons, perlu OTP manual")
            continue

        baru = pw_baru()
        _, r = post(RESET, {"phone_number": tel, "otp_code": kod, "new_password": baru})
        if r.get("success"):
            print(f"[OK] {tel} -> {baru}")
            with open("password_baru.txt", "a", encoding="utf-8") as f:
                f.write(f"{tel},{baru}\n")
        else:
            print(f"[GAGAL] {tel} -> {r.get('error')}")
        jeda(1, 1.5)


if __name__ == "__main__":
    main()