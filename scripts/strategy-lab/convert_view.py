"""Strategy Lab template (x-dc markup) -> JSX, mechanically.

sc-if -> conditional, sc-for -> map, {{ path }} -> vm-bound expressions,
inline style strings -> style objects, style-hover/style-focus-within ->
generated classes. Usage: see build.sh
"""
import html
import json
import re
import sys
from html.parser import HTMLParser

SRC, OUT = sys.argv[1], sys.argv[2]
VOID = {"input", "img", "br", "hr", "meta", "link"}
LITERALS = {"true", "false", "null"}
EVENT = {
    "sc-camel-on-click": "onClick", "sc-camel-on-change": "onChange",
    "sc-camel-on-mouse-enter": "onMouseEnter", "sc-camel-on-mouse-leave": "onMouseLeave",
    "sc-camel-on-key-down": "onKeyDown", "sc-camel-on-focus": "onFocus", "sc-camel-on-blur": "onBlur",
}
RENAME = {
    "sc-camel-view-box": "viewBox", "sc-camel-preserve-aspect-ratio": "preserveAspectRatio",
    "stroke-width": "strokeWidth", "stroke-dasharray": "strokeDasharray", "vector-effect": "vectorEffect",
    "class": "className", "for": "htmlFor", "aria-label": "aria-label", "role": "role",
}
DROP = {"hint-placeholder-count", "hint-placeholder-val"}


class Node:
    def __init__(self, tag, attrs):
        self.tag, self.attrs, self.kids = tag, attrs, []


class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.root = Node("#root", [])
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs)
        self.stack[-1].kids.append(n)
        if tag not in VOID:
            self.stack.append(n)

    def handle_startendtag(self, tag, attrs):
        self.stack[-1].kids.append(Node(tag, attrs))

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return
        raise SystemExit(f"unmatched </{tag}>")

    def handle_data(self, d):
        self.stack[-1].kids.append(d)

    def handle_entityref(self, name):
        self.stack[-1].kids.append(html.unescape(f"&{name};"))

    def handle_charref(self, name):
        self.stack[-1].kids.append(html.unescape(f"&#{name};"))


src = open(SRC).read()
# Copy that described the prototype's fixed 50-stock list; universe runs now cover every tracked stock.
TEXT_FIXES = {"the backtest results across 50 large-cap stocks.": "the backtest results across every tracked US stock."}
for old, new in TEXT_FIXES.items():
    assert src.count(old) == 1, f"prototype text changed: {old}"
    src = src.replace(old, new)
p = P()
p.feed(src)
p.close()

CSS = []
counter = {"h": 0}
BIND = re.compile(r"\{\{\s*([A-Za-z_][\w.]*)\s*\}\}")


def expr(path, scope):
    if path in LITERALS:
        return path
    parts = path.split(".")
    head = parts[0] if parts[0] in scope else f"vm.{parts[0]}"
    return head + "".join(f"?.{x}" for x in parts[1:])


def interp(s, scope):
    """Attribute/style value -> JS expression (string literal or template literal)."""
    if not BIND.search(s):
        return json.dumps(s)
    m = BIND.fullmatch(s.strip())
    if m:
        return expr(m.group(1), scope)
    out = BIND.sub(lambda m: "${" + expr(m.group(1), scope) + " ?? ''}", s.replace("`", "\\`"))
    return "`" + out + "`"


def split_decls(css):
    decls, depth, cur = [], 0, ""
    for ch in css:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == ";" and depth == 0:
            decls.append(cur)
            cur = ""
        else:
            cur += ch
    decls.append(cur)
    return [d.strip() for d in decls if d.strip()]


def camel(prop):
    if prop.startswith("--"):
        return json.dumps(prop)
    prop = re.sub(r"^-webkit-", "Webkit-", prop)
    return re.sub(r"-([a-z])", lambda m: m.group(1).upper(), prop)


def style_obj(css, scope):
    items = []
    for d in split_decls(css):
        if ":" not in d:
            continue
        k, v = d.split(":", 1)
        items.append(f"{camel(k.strip())}: {interp(v.strip(), scope)}")
    return "{{ " + ", ".join(items) + " }}"


def css_rule(cls, pseudo, css):
    if BIND.search(css):
        raise SystemExit(f"dynamic {pseudo} style unsupported: {css}")
    decls = "; ".join(d + " !important" for d in split_decls(css))
    CSS.append(f".{cls}:{pseudo}{{{decls}}}")


def jsx_text(t):
    t = re.sub(r"\s+", " ", t)
    if not t.strip():
        return None
    return "{" + json.dumps(t) + "}"


def text_parts(t, scope):
    out, pos = [], 0
    for m in BIND.finditer(t):
        lit = t[pos:m.start()]
        if lit:
            out.append(jsx_text(lit) if lit.strip() else ("{\" \"}" if lit else None))
        out.append("{" + expr(m.group(1), scope) + "}")
        pos = m.end()
    tail = t[pos:]
    if tail:
        out.append(jsx_text(tail) if tail.strip() else ("{\" \"}" if "\n" not in tail else None))
    return [x for x in out if x]


def attr_val(attrs, name):
    for k, v in attrs:
        if k == name:
            return v
    return None


def emit(node, scope, ind):
    pad = "  " * ind
    if isinstance(node, str):
        return [pad + x for x in text_parts(node, scope)]
    t = node.tag
    if t == "sc-if":
        cond = BIND.fullmatch(attr_val(node.attrs, "value").strip()).group(1)
        body = [l for k in node.kids for l in emit(k, scope, ind + 2)]
        return [f"{pad}{{({expr(cond, scope)}) ? (", f"{pad}  <>", *body, f"{pad}  </>", f"{pad}) : null}}"]
    if t == "sc-for":
        lst = BIND.fullmatch(attr_val(node.attrs, "list").strip()).group(1)
        var = attr_val(node.attrs, "as")
        sc2 = scope | {var}
        body = [l for k in node.kids for l in emit(k, sc2, ind + 2)]
        return [f"{pad}{{({expr(lst, scope)} || []).map(({var}, {var}__i) => (",
                f"{pad}  <Fragment key={{{var}__i}}>", *body, f"{pad}  </Fragment>", f"{pad}))}}"]
    tag = "select" if t == "sc-raw-select" else t
    props, classes, has_change, has_value = [], [], False, False
    for k, v in node.attrs:
        v = v or ""
        if k in DROP:
            continue
        if k == "style":
            props.append(f"style={style_obj(v, scope)}")
        elif k in ("style-hover", "style-focus-within"):
            counter["h"] += 1
            cls = f"slx{counter['h']}"
            css_rule(cls, "hover" if k == "style-hover" else "focus-within", v)
            classes.append(cls)
        elif k in EVENT:
            props.append(f"{EVENT[k]}={{{interp(v, scope)}}}")
            has_change |= EVENT[k] == "onChange"
        elif k == "ref":
            # Refs travel separately from the view model so the React compiler
            # does not treat every vm read as a ref read.
            name = BIND.fullmatch(v.strip()).group(1)
            props.append(f"ref={{{name}}}")
        elif k == "data-logo-src":
            props.append(f"src={{{interp(v, scope)} || undefined}}")
            props.append("onError={hideImg}")
        elif k == "value":
            has_value = True
            val = interp(v, scope)
            props.append(f"value={{{val} ?? ''}}" if tag in ("input", "select", "textarea") else f"value={{{val}}}")
        else:
            name = RENAME.get(k, k)
            if k.startswith("sc-") and k not in RENAME:
                raise SystemExit(f"unhandled attribute {k}")
            props.append(f"{name}={{{interp(v, scope)}}}")
    if classes:
        props.append(f'className="{" ".join(classes)}"')
    if has_value and not has_change and tag in ("input", "select", "textarea"):
        props.append("readOnly")
    open_tag = f"<{tag}" + ("" if not props else " " + " ".join(props))
    if tag in VOID or (not node.kids and tag in ("path", "circle", "rect", "line", "polyline", "polygon")):
        return [pad + open_tag + " />"]
    body = [l for k in node.kids for l in emit(k, scope, ind + 1)]
    return [pad + open_tag + ">", *body, f"{pad}</{tag}>"]


# Skip the outer {{ isLab }} wrapper — the screen is Strategy Lab only.
top = [k for k in p.root.kids if not isinstance(k, str)]
assert len(top) == 1 and top[0].tag == "sc-if", "expected a single isLab wrapper"
lines = [l for k in top[0].kids for l in emit(k, set(), 3)]

out = f"""// GENERATED from the Strategy AI Lab prototype markup by scripts/strategy-lab/build.sh (convert_view.py).
// Edit the markup by re-running the converter rather than by hand where possible.
import {{ Fragment }} from "react";

/** A logo that fails to load is hidden (the prototype's data-logo-src behaviour). */
const hideImg = (e) => {{ e.currentTarget.style.display = "none"; }};

export const LAB_HOVER_CSS = {json.dumps(chr(10).join(CSS))};

export default function LabView({{ vm, refs }}) {{
  const {{ aiRef, libRef, detRef }} = refs;
  return (
    <>
{chr(10).join(lines)}
    </>
  );
}}
"""
open(OUT, "w").write(out)
print("ok", len(out), "chars,", counter["h"], "hover classes")
