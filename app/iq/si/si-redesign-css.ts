/* Style blocks of the Stock Intelligence redesign, taken verbatim from the standalone design file.
   Edit them here, not in the components. */

// Light/dark colour pairs used by the light-theme text override below (dark-screen colour -> light-theme colour).
const LIGHT_TEXT_PAIRS: [string, string][] = [
  ["74, 222, 128", "#15803d"],
  ["47, 184, 106", "#15803d"],
  ["245, 176, 49", "#b45309"],
  ["240, 162, 59", "#b45309"],
  ["251, 146, 60", "#c2410c"],
  ["248, 113, 113", "#dc2626"],
  ["79, 179, 255", "#1d6fd8"],
  ["109, 179, 255", "#1d6fd8"],
  ["127, 168, 208", "#4a6f96"],
  ["148, 163, 184", "#64748b"],
  ["244, 246, 245", "#0f172a"],
];

const LIGHT_TEXT_CSS = LIGHT_TEXT_PAIRS.map(([rgb, hex]) => {
  const sel = (root: string) => `${root} [style^="color: rgb(${rgb})"], ${root} [style*="; color: rgb(${rgb})"]`;
  return `${sel('.si-screen[data-theme="light"]')},
${sel('.iq-root[data-theme="light"] .si-screen')} { color: ${hex} !important; }`;
}).join("\n");

export const SI_TOKENS_CSS = `
.si-screen {
  --ov-card: #14171c;
  --ov-card2: #0f1216;
  --ov-line: #232830;
  --ov-track: #262b33;
  --ov-hi: #e8ecf1;
  --ov-body: #c7ced8;
  --ov-mid: #a3acb8;
  --ov-sub: #8a93a0;
  --ov-up: #5ee08a;
  --ov-up-dk: #2f7a4b;
  --ov-dn: #f07a7a;
  --ov-dn-dk: #8a3d3d;
  --ov-warn: #e6b94f;
  --ov-grey: #4b5563;
  --ov-rail-mid: #3a3f47;
  --ov-on-bg: #1a2a20;
  --ov-ref-a: #f5b031;
  --ov-ref-b: #c084fc;
  --ov-ref-c: #38d5f0;
  --ov-eps: #7aa7ff;
  --ov-eps-dk: #3d5a8a;
  --ov-hl: rgba(255, 255, 255, 0.06);
  --ov-hl-edge: rgba(255, 255, 255, 0.08);
  --ov-tick: rgba(255, 255, 255, 0.3);
  --ov-blue: #4fa3ff;
  --ov-blue-bg: rgba(79, 163, 255, 0.18);
  --ov-blue-tx: #a9d3ff;
}
.si-screen[data-theme="light"],
.iq-root[data-theme="light"] .si-screen {
  --ov-card: #ffffff;
  --ov-card2: #f8fafc;
  --ov-line: #e2e8f0;
  --ov-track: #e2e8f0;
  --ov-hi: #07080a;
  --ov-body: #0f172a;
  --ov-mid: #334155;
  --ov-sub: #475569;
  --ov-up: #15803d;
  --ov-up-dk: #4ade80;
  --ov-dn: #dc2626;
  --ov-dn-dk: #fca5a5;
  --ov-warn: #b45309;
  --ov-grey: #94a3b8;
  --ov-rail-mid: #cbd5e1;
  --ov-on-bg: #ecfdf3;
  --ov-ref-a: #b45309;
  --ov-ref-b: #7e22ce;
  --ov-ref-c: #0e7490;
  --ov-eps: #2563eb;
  --ov-eps-dk: #93b4f5;
  --ov-hl: rgba(15, 23, 42, 0.05);
  --ov-hl-edge: rgba(15, 23, 42, 0.09);
  --ov-tick: rgba(15, 23, 42, 0.28);
  --ov-blue: #1d4ed8;
  --ov-blue-bg: rgba(37, 99, 235, 0.1);
  --ov-blue-tx: #1d4ed8;
}
/* White text written for the dark screen: dark slate on the light theme (text on solid accent buttons stays white). */
.si-screen { --si-text-white: #ffffff; }
.si-screen[data-theme="light"],
.iq-root[data-theme="light"] .si-screen { --si-text-white: #0f172a; }
${LIGHT_TEXT_CSS}
/* Every card across the screen takes the curvature of the Overview panels: outer cards 14px, the boxes inside them 10px.
   A card is any element that sets a card background together with a full 1px border. */
.si-screen [style*="var(--si-card,"][style*="border: 1px solid"],
.si-screen [style*="var(--si-card-solid,"][style*="border: 1px solid"],
.si-screen [style*="var(--si-card-tint,"][style*="border: 1px solid"],
.si-screen [style*="rgb(20, 23, 28)"][style*="border: 1px solid"],
.si-screen [style*="rgba(20, 23, 28"][style*="border: 1px solid"] { border-radius: 14px !important; }
.si-screen [style*="var(--si-card-sec,"][style*="border: 1px solid"],
.si-screen [style*="var(--si-card-tert,"][style*="border: 1px solid"],
.si-screen [style*="rgb(15, 18, 22)"][style*="border: 1px solid"],
.si-screen [style*="rgb(26, 30, 36)"][style*="border: 1px solid"] { border-radius: 10px !important; }
.si-screen [style*="var(--si-card,"] [style*="var(--si-card,"][style*="border: 1px solid"] { border-radius: 10px !important; }
/* The design sets prices and levels in JetBrains Mono; the screen's one-typeface rule would otherwise override it. */
.si-screen .ovx-mono { font-family: 'JetBrains Mono', ui-monospace, monospace !important; }
`;

export const SI_TYPE_CSS = `
/* One typeface for the whole screen, on every tab: Inter, with even-width digits so figures line up in columns. */
.si-screen, .si-screen * { font-family: var(--font-inter, 'Inter'), system-ui, sans-serif !important; font-variant-numeric: tabular-nums; }
.si-screen [data-caps] { text-transform: none !important; }
@media screen and (max-width: 980px) { .si-screen .si-read3 { grid-template-columns: minmax(0, 1fr) !important; } }
.si-screen ${"[data-tc]".repeat(24)} { text-transform: none !important; }
.si-screen [style*="letter-spacing"]:not([data-caps]):not([style*="letter-spacing: 0.00em"]):not([style*="letter-spacing:0.00em"]):not([style*="letter-spacing: 0.01em"]):not([style*="letter-spacing:0.01em"]):not([style*="letter-spacing: 0.02em"]):not([style*="letter-spacing:0.02em"]):not([style*="letter-spacing: 0.03em"]):not([style*="letter-spacing:0.03em"]):not([style*="letter-spacing: 0.04em"]):not([style*="letter-spacing:0.04em"]):not([style*="letter-spacing: 0.05em"]):not([style*="letter-spacing:0.05em"]), .si-screen [style*="uppercase"]:not([data-caps]) { text-transform: lowercase !important; letter-spacing: 0.02em !important; zoom: 1.2; font-weight: 600; }
.si-screen [style*="letter-spacing"]:not([data-caps]):not([style*="letter-spacing: 0.00em"]):not([style*="letter-spacing:0.00em"]):not([style*="letter-spacing: 0.01em"]):not([style*="letter-spacing:0.01em"]):not([style*="letter-spacing: 0.02em"]):not([style*="letter-spacing:0.02em"]):not([style*="letter-spacing: 0.03em"]):not([style*="letter-spacing:0.03em"]):not([style*="letter-spacing: 0.04em"]):not([style*="letter-spacing:0.04em"]):not([style*="letter-spacing: 0.05em"]):not([style*="letter-spacing:0.05em"])::first-letter,
.si-screen [style*="uppercase"]:not([data-caps])::first-letter { text-transform: uppercase !important; }
.si-screen [style*="letter-spacing"][style*="font-size: 9"]:not([data-caps]):not([style*="letter-spacing: 0.00em"]):not([style*="letter-spacing:0.00em"]):not([style*="letter-spacing: 0.01em"]):not([style*="letter-spacing:0.01em"]):not([style*="letter-spacing: 0.02em"]):not([style*="letter-spacing:0.02em"]):not([style*="letter-spacing: 0.03em"]):not([style*="letter-spacing:0.03em"]):not([style*="letter-spacing: 0.04em"]):not([style*="letter-spacing:0.04em"]):not([style*="letter-spacing: 0.05em"]):not([style*="letter-spacing:0.05em"]),
.si-screen [style*="uppercase"][style*="font-size: 9"]:not([data-caps]),
.si-screen [style*="letter-spacing"][style*="font-size: 10"]:not([data-caps]):not([style*="letter-spacing: 0.00em"]):not([style*="letter-spacing:0.00em"]):not([style*="letter-spacing: 0.01em"]):not([style*="letter-spacing:0.01em"]):not([style*="letter-spacing: 0.02em"]):not([style*="letter-spacing:0.02em"]):not([style*="letter-spacing: 0.03em"]):not([style*="letter-spacing:0.03em"]):not([style*="letter-spacing: 0.04em"]):not([style*="letter-spacing:0.04em"]):not([style*="letter-spacing: 0.05em"]):not([style*="letter-spacing:0.05em"]),
.si-screen [style*="uppercase"][style*="font-size: 10"]:not([data-caps]) { zoom: 1.6; }
.si-screen [style*="letter-spacing"][style*="font-size: 11"]:not([data-caps]):not([style*="letter-spacing: 0.00em"]):not([style*="letter-spacing:0.00em"]):not([style*="letter-spacing: 0.01em"]):not([style*="letter-spacing:0.01em"]):not([style*="letter-spacing: 0.02em"]):not([style*="letter-spacing:0.02em"]):not([style*="letter-spacing: 0.03em"]):not([style*="letter-spacing:0.03em"]):not([style*="letter-spacing: 0.04em"]):not([style*="letter-spacing:0.04em"]):not([style*="letter-spacing: 0.05em"]):not([style*="letter-spacing:0.05em"]),
.si-screen [style*="uppercase"][style*="font-size: 11"]:not([data-caps]) { zoom: 1.5; }
.si-screen [style*="letter-spacing"][style*="font-size: 12"]:not([data-caps]):not([style*="letter-spacing: 0.00em"]):not([style*="letter-spacing:0.00em"]):not([style*="letter-spacing: 0.01em"]):not([style*="letter-spacing:0.01em"]):not([style*="letter-spacing: 0.02em"]):not([style*="letter-spacing:0.02em"]):not([style*="letter-spacing: 0.03em"]):not([style*="letter-spacing:0.03em"]):not([style*="letter-spacing: 0.04em"]):not([style*="letter-spacing:0.04em"]):not([style*="letter-spacing: 0.05em"]):not([style*="letter-spacing:0.05em"]),
.si-screen [style*="uppercase"][style*="font-size: 12"]:not([data-caps]) { zoom: 1.4; }
.si-screen [style*="letter-spacing"][style*="font-size: 13"]:not([data-caps]):not([style*="letter-spacing: 0.00em"]):not([style*="letter-spacing:0.00em"]):not([style*="letter-spacing: 0.01em"]):not([style*="letter-spacing:0.01em"]):not([style*="letter-spacing: 0.02em"]):not([style*="letter-spacing:0.02em"]):not([style*="letter-spacing: 0.03em"]):not([style*="letter-spacing:0.03em"]):not([style*="letter-spacing: 0.04em"]):not([style*="letter-spacing:0.04em"]):not([style*="letter-spacing: 0.05em"]):not([style*="letter-spacing:0.05em"]),
.si-screen [style*="uppercase"][style*="font-size: 13"]:not([data-caps]),
.si-screen [style*="letter-spacing"][style*="font-size: 14"]:not([data-caps]):not([style*="letter-spacing: 0.00em"]):not([style*="letter-spacing:0.00em"]):not([style*="letter-spacing: 0.01em"]):not([style*="letter-spacing:0.01em"]):not([style*="letter-spacing: 0.02em"]):not([style*="letter-spacing:0.02em"]):not([style*="letter-spacing: 0.03em"]):not([style*="letter-spacing:0.03em"]):not([style*="letter-spacing: 0.04em"]):not([style*="letter-spacing:0.04em"]):not([style*="letter-spacing: 0.05em"]):not([style*="letter-spacing:0.05em"]),
.si-screen [style*="uppercase"][style*="font-size: 14"]:not([data-caps]) { zoom: 1.3; }
.si-screen [style*="letter-spacing"] [style*="letter-spacing"], .si-screen [style*="uppercase"] [style*="uppercase"] { zoom: 1 !important; }
.si-screen .si-switch-wrap .mod-switch-pin [style*="letter-spacing"] { text-transform: none !important; letter-spacing: 0.01em !important; zoom: 1 !important; }
@media screen and (max-width: 760px) { .si-screen [style*="letter-spacing"]:not([data-caps]):not([style*="letter-spacing: 0.00em"]):not([style*="letter-spacing:0.00em"]):not([style*="letter-spacing: 0.01em"]):not([style*="letter-spacing:0.01em"]):not([style*="letter-spacing: 0.02em"]):not([style*="letter-spacing:0.02em"]):not([style*="letter-spacing: 0.03em"]):not([style*="letter-spacing:0.03em"]):not([style*="letter-spacing: 0.04em"]):not([style*="letter-spacing:0.04em"]):not([style*="letter-spacing: 0.05em"]):not([style*="letter-spacing:0.05em"]), .si-screen [style*="uppercase"]:not([data-caps]) { zoom: 1.05 !important; } }
`;

export const OVX_OVERVIEW_CSS = `
.ovx{display:flex;flex-direction:column;gap:20px;color:var(--ov-hi)}
.ovx-top{display:flex;flex-wrap:wrap;gap:16px;align-items:stretch}
.ovx-card{display:flex;flex-direction:column;gap:12px;background:var(--ov-card);border:1px solid var(--ov-line);border-radius:14px;min-width:0}
.ovx-eb{font-size:12.5px;font-weight:700;letter-spacing:.08em;color:var(--ov-sub)}
.ovx-growth{flex:1 1 460px;padding:22px 26px}
.ovx-gh{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.ovx-gh>div:first-child{min-width:0}
.ovx-gt{margin:4px 0 0;font-size:19px;font-weight:700;line-height:1.25}
.ovx-seg{display:flex;align-items:center;gap:4px;padding:3px;border-radius:10px;background:var(--ov-card2);border:1px solid var(--ov-line);flex:none}
.ovx-seg [role="tab"]{padding:5px 14px;border:0;border-radius:7px;background:transparent;font:inherit;font-size:13px;font-weight:600;color:var(--ov-sub);cursor:pointer}
.ovx-seg button[role="tab"]:hover{color:var(--ov-hi)}
.ovx-seg [role="tab"][aria-selected="true"]{background:var(--ov-blue-bg);color:var(--ov-blue-tx);font-weight:700;box-shadow:inset 0 0 0 1px var(--ov-blue);cursor:default}
.ovx-seg button[role="tab"]:focus-visible{outline:2px solid var(--ov-blue);outline-offset:1px}
.ovx-lg{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:13px;color:var(--ov-mid)}
.ovx-lg span{display:inline-flex;align-items:center;gap:7px}
.ovx-lg i{display:inline-block;width:12px;height:12px;border-radius:3px}
.ovx-plot{position:relative;margin-top:4px}
.ovx-grp{position:absolute;top:0;bottom:0}
.ovx-grp.last{background:var(--ov-hl);border-radius:8px;box-shadow:inset 0 0 0 1px var(--ov-hl-edge)}
.ovx-bar{position:absolute;border-radius:3px 3px 0 0}
.ovx-bar.n{border-radius:0 0 3px 3px}
.ovx-bv{position:absolute;text-align:center;font-size:12.5px;font-weight:700;line-height:14px;white-space:nowrap}
.ovx-base{position:absolute;left:0;right:0;height:1px;background:var(--ov-line)}
.ovx-xl{display:flex;margin-top:12px}
.ovx-xl span{flex:1;text-align:center;font-size:12.5px;color:var(--ov-sub)}
.ovx-xl span.last{color:var(--ov-hi);font-weight:700}
.ovx-sigs{flex:1.45 1 600px;flex-direction:row;flex-wrap:wrap;gap:0}
.ovx-mc{flex:0 0 260px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:22px 20px;border-right:1px solid var(--ov-line)}
.ovx-mch{display:flex;align-items:center;gap:6px}
.ovx-cap{margin:0;max-width:170px;text-align:center;font-size:16px;font-weight:700;line-height:1.3}
.ovx-sl{flex:1 1 340px;min-width:0;padding:22px 26px;display:flex;flex-direction:column;gap:6px}
.ovx-sh{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:6px}
.ovx-sk{display:flex;gap:6px 18px;flex-wrap:wrap;font-size:13px;color:var(--ov-mid)}
.ovx-gn{font-size:13px;font-weight:700;margin:6px 0 0}
.ovx-gn.sep{border-top:1px solid var(--ov-line);padding-top:12px;margin-top:8px}
.ovx-sr{display:grid;grid-template-columns:minmax(88px,118px) minmax(0,1fr) 44px 76px;align-items:center;gap:0 16px;width:100%;padding:5px 0;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer;border-radius:6px}
.ovx-sr:hover .ovx-sw{text-decoration:underline}
.ovx-sr:focus-visible{outline:2px solid var(--ov-blue);outline-offset:2px}
.ovx-sn{font-size:15.5px;color:var(--ov-hi)}
.ovx-sbar{position:relative;height:11px;border-radius:6px;background:var(--ov-track);overflow:hidden}
.ovx-sbar i{position:absolute;left:0;top:0;bottom:0;border-radius:6px}
.ovx-sbar u{position:absolute;top:0;bottom:0;width:1px;background:var(--ov-tick)}
.ovx-sv{text-align:right;font-size:16px;font-weight:800}
.ovx-sw{font-size:13.5px;font-weight:700;white-space:nowrap}
.ovx-read{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}
.ovx-nav{flex:1 1 330px;max-width:340px;display:flex;flex-direction:column;gap:8px}
.ovx-nav button{display:flex;justify-content:space-between;align-items:center;gap:10px;min-height:64px;padding:0 18px;border-radius:12px;background:var(--ov-card);border:1px solid var(--ov-line);color:var(--ov-hi);font-size:17px;font-weight:600;text-align:left;cursor:pointer}
.ovx-nav button:hover{border-color:var(--ov-grey)}
.ovx-nav button[aria-current="true"]{background:var(--ov-blue-bg);border-color:color-mix(in srgb,var(--ov-blue-tx) 65%,transparent);font-weight:700}
.ovx-nav button:focus-visible{outline:2px solid var(--ov-blue);outline-offset:2px}
.ovx-nav small{font-size:14.5px;font-weight:500;white-space:nowrap}
.ovx-pane{flex:999 1 560px;min-width:0}
.ovx-art{display:flex;flex-direction:column;gap:18px;padding:24px 28px;background:var(--ov-card);border:1px solid var(--ov-line);border-radius:14px}
.ovx-art{position:relative}
.ovx-art-i{position:absolute;top:18px;right:18px}
.ovx-info{display:inline-grid;place-items:center;width:20px;height:20px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--ov-sub);cursor:pointer}
.ovx-info:hover{color:var(--ov-hi)}
.ovx-h{margin:0;padding-right:28px;font-size:28px;line-height:1.25;font-weight:800;letter-spacing:-.01em;max-width:900px}
.ovx-p{margin:0;font-size:16px;line-height:1.6;color:var(--ov-body);max-width:900px}
.ovx-lv{display:flex;flex-direction:column;gap:10px;padding:18px 20px;background:var(--ov-card2);border:1px solid var(--ov-line);border-radius:12px}
.ovx-lv-t{font-size:13px;font-weight:700;letter-spacing:.06em;color:var(--ov-sub)}
.ovx-rail{position:relative;height:56px;margin:0 40px}
.ovx-rail>i{position:absolute;left:0;right:0;top:26px;height:4px;border-radius:2px;background:linear-gradient(90deg,var(--ov-dn) 0%,var(--ov-rail-mid) 50%,var(--ov-up) 100%)}
.ovx-rail>b{position:absolute;width:4px;margin-left:-2px;border-radius:2px}
.ovx-rail>span{position:absolute;top:44px;transform:translateX(-50%);font-size:12px;font-weight:700;white-space:nowrap}
.ovx-lvl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.ovx-lvb{display:flex;flex-direction:column;gap:4px;padding:14px 16px;border-radius:10px;border:1px solid}
.ovx-lvb.r{text-align:right}
.ovx-lvb>span:first-child{font-size:12px;font-weight:700;letter-spacing:.04em}
.ovx-lvb>strong{font-size:28px;font-weight:800;line-height:1.15}
.ovx-lvb>span:last-child{font-size:13px;color:var(--ov-body)}
@media (max-width:700px){.ovx-nav{max-width:none;flex-basis:100%}.ovx-art{padding:18px 16px}.ovx-h{font-size:23px}.ovx-p{font-size:15px}.ovx-growth{padding:18px 16px}.ovx-mc{flex-basis:100%;border-right:0;border-bottom:1px solid var(--ov-line)}.ovx-sl{padding:18px 16px}.ovx-sr{grid-template-columns:minmax(74px,96px) minmax(0,1fr) 38px 64px;gap:0 10px}.ovx-gt{font-size:17px}}
@media (max-width:640px){.ovx-rail{margin:0 28px}}
@media (max-width:560px){.ovx-lvl{grid-template-columns:minmax(0,1fr) !important}.ovx-lvb.r{text-align:left}}
`;

export const OVX_MAST_CSS = `
.ovx-mast{display:flex;flex-wrap:wrap;align-items:center;gap:20px 40px;padding:18px 24px;background:var(--si-topbar,rgba(8,11,16,.96));color:var(--ov-hi)}
.ovx-id{display:flex;align-items:center;gap:16px}
.ovx-id-t{display:flex;flex-direction:column;gap:2px}
.ovx-id-n{margin:0;font-size:15px;color:var(--ov-mid)}
.ovx-id-n strong{font-size:18px;color:var(--ov-hi)}
.ovx-id-p{margin:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 10px}
.ovx-price{font-size:34px;font-weight:800;line-height:1.1}
.ovx-chg{font-size:15px;font-weight:700}
.ovx-ext{display:inline-flex;align-items:baseline;gap:8px;font-size:13px;color:var(--ov-mid)}
.ovx-ext b{font-size:15px;font-weight:600;color:var(--ov-hi)}
.ovx-stat{display:flex;flex-direction:column;gap:4px}
.ovx-stat>span:first-child{font-size:13px;color:var(--ov-sub)}
.ovx-stat>span:last-child{font-size:24px;font-weight:700;white-space:nowrap}
.ovx-stat em{font-style:normal;color:var(--ov-sub);font-weight:500}
.ovx-range{display:flex;flex-direction:column;gap:8px;width:260px;max-width:100%}
.ovx-range>span{font-size:13px;color:var(--ov-sub)}
.ovx-rtrack{position:relative;height:6px;border-radius:3px;background:var(--ov-track)}
.ovx-rtrack i{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:var(--ov-grey)}
.ovx-rtrack b{position:absolute;top:-5px;width:4px;height:16px;margin-left:-2px;border-radius:2px;background:var(--ov-hi)}
.ovx-rends{display:flex;justify-content:space-between;font-size:13px;color:var(--ov-body)}
.ovx-tabs{display:flex;flex-wrap:nowrap;gap:4px;padding:0 24px;overflow-x:auto}
.ovx-tab{position:relative;padding:12px 14px;border:0;background:transparent;font-size:15px;color:var(--ov-mid);cursor:pointer;white-space:nowrap;border-bottom:2px solid transparent;margin-bottom:-1px}
.ovx-tab:hover{color:var(--ov-hi)}
.ovx-tab[aria-selected="true"]{font-weight:700;color:var(--ov-hi);border-bottom-color:var(--ov-up)}
.ovx-tab:focus-visible{outline:2px solid var(--ov-up);outline-offset:-2px}
@media (max-width:760px){.ovx-mast{padding:14px 12px;gap:16px 24px}.ovx-price{font-size:28px}.ovx-tabs{padding:0 12px}}
`;
