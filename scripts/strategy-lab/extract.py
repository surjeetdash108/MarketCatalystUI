"""Decode the Strategy AI Lab prototype bundle into the pieces the port uses.

Writes, into OUT_DIR: engine.js (the btEngine resource), app.js (the page's
logic script) and lab.html (the Strategy Lab section of the markup).
Usage: python3 -I extract.py "<path to Strategy AI Lab - MarketCatalyst.html>" OUT_DIR
"""
import base64
import gzip
import json
import os
import re
import sys
import zlib

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
s = open(src, encoding="utf-8").read()
blocks = {m.group(1): m.group(2) for m in re.finditer(r'<script type="(__bundler/[a-z_]+)">(.*?)</script>', s, re.S)}
manifest = json.loads(blocks["__bundler/manifest"])
ext = {e["id"]: e["uuid"] for e in json.loads(blocks["__bundler/ext_resources"])}


def resource(uuid):
    r = manifest[uuid]
    data = base64.b64decode(r["data"])
    if r.get("compressed"):
        try:
            data = gzip.decompress(data)
        except OSError:
            data = zlib.decompress(data)
    return data


open(os.path.join(out, "engine.js"), "wb").write(resource(ext["btEngine"]))
template = json.loads(blocks["__bundler/template"])
app = re.search(r'<script type="text/x-dc" data-dc-script="">(.*?)</script>', template, re.S).group(1)
open(os.path.join(out, "app.js"), "w").write(app)
body = re.sub(r"<script.*?</script>|<style.*?</style>", "", template, flags=re.S)
start = body.index('<sc-if value="{{ isLab }}"')
depth = 0
for m in re.finditer(r"<sc-if\b|</sc-if>", body[start:]):
    depth += 1 if m.group(0).startswith("<sc-if") else -1
    if depth == 0:
        open(os.path.join(out, "lab.html"), "w").write(body[start:start + m.end()])
        break
print("extracted to", out)
