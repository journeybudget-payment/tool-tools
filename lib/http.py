"""Klien HTTP ringkas dengan backoff untuk 429/5xx."""
import json, time, urllib.error, urllib.request

UA = "Mozilla/5.0 (loan-tools)"


def _buat(url, body=None, token=None, cubaan=4, timeout=25):
    for n in range(cubaan):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data,
                                     method="POST" if body is not None else "GET")
        req.add_header("Accept", "application/json")
        req.add_header("User-Agent", UA)
        if data:
            req.add_header("Content-Type", "application/json")
        if token:
            req.add_header("Authorization", "Bearer " + token)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.status, json.loads(r.read() or b"{}")
        except urllib.error.HTTPError as e:
            teks = e.read().decode("utf-8", "replace")
            try:
                j = json.loads(teks)
            except Exception:
                j = {"error": teks[:200]}
            if e.code in (429, 500, 502, 503) and n < cubaan - 1:
                time.sleep(1.5 * (n + 1))
                continue
            return e.code, j
        except Exception as e:
            if n < cubaan - 1:
                time.sleep(1.5 * (n + 1))
                continue
            return 0, {"error": str(e)}


def post(url, body, token=None, cubaan=4):
    return _buat(url, body=body, token=token, cubaan=cubaan)


def get(url, token=None, cubaan=3):
    return _buat(url, token=token, cubaan=cubaan)


def berjaya(status, j, kunci):
    """Pulangkan True kalau respons menandakan kejayaan."""
    if status != 200 or not isinstance(j, dict):
        return False
    if j.get("success") is False or j.get("error"):
        return False
    for k in kunci:
        if j.get(k):
            return True
    d = j.get("data")
    if isinstance(d, dict):
        for k in kunci:
            if d.get(k):
                return True
    return False