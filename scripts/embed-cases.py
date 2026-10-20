#!/usr/bin/env python3
"""Re-embed the case-study pages into index.html.

index.html opens tamba/personology/routines as in-page overlays (iframes with
srcdoc). The HTML for those comes from a `var C={...}` object near the bottom of
index.html. After editing any case-study .html file, run:

    python3 scripts/embed-cases.py

from the repo root to refresh that object.
"""
import json
import pathlib
import re
import sys

root = pathlib.Path(__file__).resolve().parent.parent
index = root / "index.html"
cases = ["tamba", "personology", "routines"]

css = (root / "assets/vector.css").read_text(encoding="utf-8")
js = (root / "assets/vector.js").read_text(encoding="utf-8")
leads = (root / "assets/leads.js").read_text(encoding="utf-8")
icon = re.compile(r'^<link rel="icon"[^\n]*\n', re.M)

# Inside the overlay, links back to the landing page or to another case study
# are relayed to the parent page instead of navigating the iframe.
BRIDGE = (
    "<script>(function(){function go(m){try{parent.postMessage(Object.assign({vcase:1},m),'*');}catch(e){}}\n"
    "document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;var h=a.getAttribute('href');var m=h.match(/^(tamba|personology|routines)\\.html(#.*)?$/);\n"
    "if(m){e.preventDefault();e.stopImmediatePropagation();go({open:m[1]});return;}\n"
    "if(h==='./'||h==='index.html'||/^\\.\\/#|^index\\.html#/.test(h)){e.preventDefault();e.stopImmediatePropagation();go({home:(h.split('#')[1]?'#'+h.split('#')[1]:'')});}},true);\n"
    "document.addEventListener('keydown',function(e){if(e.key==='Escape')go({home:''});});})();</script>"
)


def embeddable(html: str) -> str:
    """The overlay iframe uses srcdoc, so shared assets are inlined and the
    favicon is dropped (the parent page sets it)."""
    html = icon.sub("", html, count=1)
    html = html.replace('<link rel="stylesheet" href="assets/vector.css">', "<style>" + css + "</style>" + BRIDGE, 1)
    html = html.replace('<script src="assets/leads.js"></script>', "<script>" + leads + "</script>", 1)
    html = html.replace('<script src="assets/vector.js"></script>', "<script>" + js + "</script>", 1)
    return html


obj = {c: embeddable((root / f"{c}.html").read_text(encoding="utf-8")) for c in cases}
# Match the existing encoding: ASCII-only, "<" escaped so "</script>" can't occur.
encoded = json.dumps(obj, ensure_ascii=True).replace("<", "\\u003c")

src = index.read_text(encoding="utf-8")
pattern = re.compile(r"(<script>\(function\(\)\{var C=)(\{.*?\})(;)", re.S)
m = pattern.search(src)
if not m:
    sys.exit("could not find `var C={...}` in index.html")

# The object ends at the first `};` that closes the top-level JSON; locate it by parsing.
start = m.start(2)
dec = json.JSONDecoder()
_, end_rel = dec.raw_decode(src[start:])
end = start + end_rel
new = src[:start] + encoded + src[end:]
if new == src:
    print("index.html already up to date")
else:
    index.write_text(new, encoding="utf-8")
    print(f"embedded {', '.join(cases)} into index.html")
