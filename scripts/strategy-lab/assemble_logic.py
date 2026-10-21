"""Assemble app/iq/sl/lab-controller.jsx from the prototype's Strategy Lab logic.

Every change from the prototype is an asserted replacement below, so the port
stays verbatim except where data / AI / scrolling / fabricated samples differ.
Usage: see build.sh
"""
import re
import sys

SRC, OUT = sys.argv[1], sys.argv[2]
L = open(SRC).read().split("\n")


def lines(a, b):  # 1-based inclusive
    return "\n".join(L[a - 1:b])


def rep(s, old, new, count=1):
    n = s.count(old)
    assert n == count, f"expected {count}x, found {n}: {old[:90]}"
    return s.replace(old, new)


consts = "\n".join([lines(4, 5), lines(7, 7), lines(9, 63), lines(103, 103)])

methods = "\n".join([
    lines(171, 172),  # toDet, toAi
    lines(182, 182),  # toastMsg
    lines(227, 228),  # iDays, valCfg
    lines(229, 231),  # fetchLong
    lines(232, 241),  # runValidate
    lines(242, 273),  # valVals
    lines(274, 274),  # openChart
    lines(275, 294),  # chartData
    lines(295, 305),  # chartVals
    lines(306, 321),  # exitPlan
    lines(352, 374),  # aiVals
    lines(375, 377),  # fetchScan
    lines(378, 378),  # fetchIntra
    lines(379, 384),  # runScan
    lines(385, 386),  # inferHold
    lines(387, 397),  # save / hold / edit / delete
    lines(398, 436),  # pickVals
    lines(437, 554),  # labVals
])

# ── Data: the browser never holds an FMP key; bars come from our backend. ──
methods = rep(methods,
    "async fetchLong(s,key,yrs=5){this._sb=this._sb||{};const ck=s+'|'+(yrs+1)+'y';if(this._sb[ck])return this._sb[ck];const f=new Date();f.setFullYear(f.getFullYear()-yrs-1);",
    "async fetchLong(s,key,yrs=5){this._sb=this._sb||{};const ck=s+'|'+(yrs+1)+'y';if(this._sb[ck])return this._sb[ck];")
methods = rep(methods,
    "\n    const r=await fetch('https://financialmodelingprep.com/stable/historical-price-eod/full?symbol='+s+'&from='+f.toISOString().slice(0,10)+'&apikey='+encodeURIComponent(key));const j=await r.json();if(!r.ok||!Array.isArray(j)||!j.length)throw new Error('no data');\n    return(this._sb[ck]=this.BT.normalizeFmp(j.map(x=>({date:x.date,open:x.open,high:x.high,low:x.low,close:x.close,volume:x.volume}))))}",
    "\n    const j=await labBars(s,'d',{years:yrs+1});\n    return(this._sb[ck]=this.BT.normalizeFmp(j))}")
methods = rep(methods,
    "const ck=s+'|'+(tf||'d')+'|'+dd;if(this._sb[ck])return this._sb[ck];const f=new Date();if(iv)f.setDate(f.getDate()-dd);else f.setMonth(f.getMonth()-20);\n    const r=await fetch(iv?'https://financialmodelingprep.com/stable/historical-chart/'+iv+'?symbol='+s+'&from='+f.toISOString().slice(0,10)+'&to='+new Date().toISOString().slice(0,10)+'&apikey='+encodeURIComponent(key):'https://financialmodelingprep.com/stable/historical-price-eod/full?symbol='+s+'&from='+f.toISOString().slice(0,10)+'&apikey='+encodeURIComponent(key));const j=await r.json();if(!r.ok||!Array.isArray(j)||!j.length)throw new Error((j&&j['Error Message'])||'no data');\n    return(this._sb[ck]=(iv?(a=>a.filter(x=>{const t=x.date.slice(11,16);return t>='09:30'&&t<'16:00'})):(a=>a))(this.BT.normalizeFmp(j.map(x=>({date:x.date,open:x.open,high:x.high,low:x.low,close:x.close,volume:x.volume})))))}",
    "const ck=s+'|'+(tf||'d')+'|'+dd;if(this._sb[ck])return this._sb[ck];\n    const j=await labBars(s,iv?tf:'d',iv?{days:dd}:{years:20/12});\n    return(this._sb[ck]=(iv?(a=>a.filter(x=>{const t=x.date.slice(11,16);return t>='09:30'&&t<'16:00'})):(a=>a))(this.BT.normalizeFmp(j)))}")
methods = rep(methods,
    "async fetchIntra(s,tf='5m'){const key=(this.state.fmpKey||'').trim(),ik=s+'|'+tf;this._iReq=this._iReq||{};if(!key||this._iReq[ik])return;",
    "async fetchIntra(s,tf='5m'){const key='',ik=s+'|'+tf;this._iReq=this._iReq||{};if(this._iReq[ik])return;")
methods = rep(methods, "this.toastMsg('FMP intraday: '+e.message)", "this.toastMsg('FMP intraday bars for '+s+': '+e.message)")
methods = rep(methods,
    "async runScan(k,spec,univ,tf){const BT=this.BT,key=(this.state.fmpKey||'').trim(),",
    "async runScan(k,spec,univ,tf){const BT=this.BT,key='',")
methods = rep(methods, "if(!BT)return;if(!key){put({err:'Market scan needs price data — FMP key not configured.',busy:false});return}", "if(!BT)return;")
methods = rep(methods,
    "async runValidate(k,spec,tf){const st=this.state,BT=this.BT,univ=this._univ||[],key=(st.fmpKey||'').trim();if(!BT||!spec)return;",
    "async runValidate(k,spec,tf){const st=this.state,BT=this.BT,univ=this._univ||[],key='';if(!BT||!spec)return;")
# Prototype short-circuited every run into a hard-coded sample table (STATIC_RESULTS).
methods = rep(methods,
    "\n    if(STATIC_RESULTS){this.setState(s=>{const vals={...(s.vals||{})};delete vals[k];return{vals,vSample:{...(s.vSample||{}),[k]:true}}});return}", "")
methods = rep(methods, "\n    if(!key){put({err:'Backtest needs price data — FMP key not configured.',busy:false,sig,rows:null});return}", "")

# ── No fabricated data: drop the sample-table and synthetic-chart branches. ──
methods = rep(methods,
    "const run=()=>{if(v&&v.busy)return;if(true){this.setState(s=>({vSample:{...(s.vSample||{}),[k]:true}}));return}this.setState(s=>({vSample:{...(s.vSample||{}),[k]:false}}));this.runValidate(k,spec,tf)};",
    "const run=()=>{if(v&&v.busy)return;this.runValidate(k,spec,tf)};")
i = methods.index("    if((st.vSample||{})[k]&&!(v&&(v.busy||v.at))){const S=[['NVDA'")
j = methods.index("    const fresh=!!(v&&v.at&&!v.busy&&!stale);", i)
methods = methods[:i] + methods[j:]
methods = rep(methods, "idleT:'Run backtest to see the result.',sample:false,preview:()=>this.setState(s=>({vSample:{...(s.vSample||{}),[k]:true}})),",
              "idleT:'Run backtest to see the result.',sample:false,")
i = methods.index("    let s=0;for(const ch of o.t+o.tf+o.rw)")
j = methods.index("    return{pts,trades,sample:true}}", i) + len("    return{pts,trades,sample:true}}")
methods = methods[:i] + "    return null}" + methods[j:]
methods = rep(methods,
    "const D=this._chartKey===st.chartOpen?this._chartD:(this._chartKey=st.chartOpen,this._chartD=this.chartData(o));",
    "const D=this._chartKey===st.chartOpen?this._chartD:(this._chartKey=st.chartOpen,this._chartD=this.chartData(o));if(!D)return{chOpen:false};")
methods = rep(methods, "aiEditRun:()=>{if(st.editSvId){const id=st.editSvId;this.endEditSaved(true);this.setState(s=>({vSample:{...(s.vSample||{}),['sv_'+id]:true}}));return}",
              "aiEditRun:()=>{if(st.editSvId){const id=st.editSvId;this.endEditSaved(true);setTimeout(()=>{const s2=this.state,sv=(s2.labSaved||[]).find(x=>x.id===id);if(sv)this.runValidate('sv_'+id,sv.cond,sv.tf||'d')},0);return}")

# ── Broker automation is not implemented (needs broker OAuth apps + a server-side signal runner). ──
methods = rep(methods, "...this.autoVals(st,set,S),", "auOpen:false,")
methods = rep(methods, "auto:(()=>{const au=this.getAuto(st,x.k);return au?(au.linking&&!au.linked&&!au.url?'PENDING · '+String(au.broker).toUpperCase():'AUTOMATED · '+(au.mode==='live'?'LIVE':'PAPER')):''})(),", "auto:'',", count=2)
i = methods.index("...(()=>{const au=this.getAuto(st,pk.k);return{canAuto:pk.k!=='custom',")
j = methods.index("autoBd:au?'#1f4a33':'#5a4a22'}})(),", i) + len("autoBd:au?'#1f4a33':'#5a4a22'}})(),")
methods = methods[:i] + "canAuto:false," + methods[j:]

# ── Price-data status: no key box; bars load from the backend on mount. ──
methods = rep(methods,
    "\n      labBadge:st.bars?'5Y DAILY BARS · '+Object.keys(st.bars).join(' · ')+(st.barsAsOf?' · AS OF '+st.barsAsOf:''):st.fmpLoading?'LOADING PRICE DATA…':'PRICE DATA NOT LOADED',labBadgeC:st.bars?'#3ddc84':'#f0d68c',labBadgeBd:st.bars?'#1f4a33':'#5a4a22',\n      fmpKey:st.fmpKey||'',onFmpKey:e=>set({fmpKey:e.target.value}),fmpBtn:st.fmpLoading?'Loading…':st.bars?'Reload':'Load data',loadFmp:()=>this.loadFmp(SYMS),", "")
methods = rep(methods, "labNoResT:curNeed.length?cur.name+' can\\'t run on price data alone':!st.bars?'Price data not loaded':",
              "labNoResT:curNeed.length?cur.name+' can\\'t run on price data alone':!st.bars?(st.barsErr?'Price data unavailable':'Loading price data…'):")
methods = rep(methods, "!st.bars?'Add your FMP API key at the top right to load 6 years of daily bars for AAPL, NVDA and MSFT. Results compute in your browser.':''",
              "!st.bars?(st.barsErr||'Fetching 6 years of FMP daily bars for AAPL, NVDA and MSFT. Results compute in your browser.'):''")

# ── Universe backtests run on the server across every tracked stock (results
#    cached there); the browser sends rules + settings and gets result rows. ──
i = methods.index("  async runValidate(k,spec,tf){")
j = methods.index("\n  valVals(", i)
methods = methods[:i] + r"""  async runValidate(k,spec,tf){const BT=this.BT;if(!BT||!spec)return;
    const cfg=this.valCfg(),sig=JSON.stringify([spec,cfg]),put=p=>this.setState(s=>({vals:{...(s.vals||{}),[k]:{...((s.vals||{})[k]||{}),...p}}}));
    if(BT.checkRules(spec).length){put({err:'These rules need '+BT.checkRules(spec).join(', ')+' — swap them for price-based conditions to backtest.',busy:false,sig});return}
    put({busy:true,err:'',rows:[],sig,tf});
    try{const r=await apiPost('/live/strategy-lab/validate',{spec:{entry:spec.entry,exit:spec.exit},tf,cfg:{stop:cfg.stop,tp:cfg.tp,trail:cfg.trail,costBps:cfg.costBps,years:cfg.years,idays:this.iDays(tf)}});
      put({busy:false,rows:r.rows||[],fail:r.unavailable||0,total:r.universe,tested:r.tested,asOf:r.asOf,at:Date.now()})}
    catch(e){const m=(()=>{try{return JSON.parse(e.message).message}catch(x){return e&&e.message}})();put({busy:false,err:m||'Backtest unavailable right now.',rows:null})}}
  /** Chart for one stock from a universe run: its own bars + the same engine and settings as the server's row. */
  async openChartFor(o){const BT=this.BT,cfg=this.valCfg(),T=BT.TF[o.tf]||{};
    try{let b0=BT.normalizeFmp(T.fmp?await labBars(o.t,o.tf,{days:this.iDays(o.tf)}):await labBars(o.t,'d',{years:(cfg.years||5)+1}));
      if(T.fmp)b0=b0.filter(x=>{const t=String(x.date).slice(11,16);return t>='09:30'&&t<'16:00'});
      const b=o.tf==='1w'?BT.toWeekly(b0):b0;const c={...cfg};if(T.fmp){c.intraday=true;c.flatEOD=T.flat}else{const d=new Date(b[b.length-1].date);d.setFullYear(d.getFullYear()-(cfg.years||5));c.startDate=d.toISOString().slice(0,10)}
      const r=BT.runRules(b,o.spec,c);if(!r){this.toastMsg('Not enough '+o.t+' history to chart');return}this.openChart({t:o.t,n:o.n,k:o.k,tf:o.tf,bars:b,trades:r.trades})}
    catch(e){this.toastMsg('Chart for '+o.t+' unavailable: '+(e&&e.message||'error'))}}""" + methods[j:]
methods = rep(methods,
    "const rows=v&&v.rows?v.rows.map(x=>{const cl=x.r.trades.filter(t=>t.why!=='Still open'),w=cl.filter(t=>t.ret>0).length,ex=x.r.m.cagr-x.r.mb.cagr;return{...x,cl,w,ex}}):[];",
    "const rows=v&&v.rows?v.rows.map(x=>({...x,ev:{status:x.st,ago:x.ago},r:{m:{sharpe:x.sh,tot:x.tot,cagr:x.cagr},mb:{cagr:x.bcagr}},cl:[],ex:x.cagr-x.bcagr,wins:x.w})):[];")
methods = rep(methods,
    "const wstat=x=>{const cs=cutOf(x.r.eq),cl=x.cl.filter(t=>(isMin?String(t.outDate):t.outDate.slice(0,10))>=cs),a=wret(x.r.eq),b=wret(x.r.bh);return{a,b,n:cl.length,w:cl.filter(t=>t.ret>0).length}};",
    "const wstat=x=>{const s=(x.wins||{})[rw]||[0,0,0,0];return{a:s[0],b:s[1],n:s[2],w:s[3]}};")
methods = rep(methods, "busy:!!(v&&v.busy),pct:v&&v.total?Math.round(100*(v.done||0)/v.total)+'%':'0%',", "busy:!!(v&&v.busy),pct:'100%',")
methods = rep(methods, "head:v&&v.busy?'Testing '+(v.done||0)+' of '+(v.total||n)+' stocks…':", "head:v&&v.busy?'Backtesting every tracked stock…':")
methods = rep(methods, "+' · FMP · as of '+(v.asOf||'—')+(v.fail?' · '+v.fail+' unavailable':''):'',", "+' · '+(v.tested||0)+' of '+(v.total||0)+' stocks tested · FMP · as of '+(v.asOf||'—')+(v.fail?' · '+v.fail+' without data':''):'',")
methods = rep(methods, "onClick:()=>this.openChart({t:x.t,n:x.n,k,tf,bars:x.bars,trades:x.r.trades})}})}}", "onClick:()=>this.openChartFor({t:x.t,n:x.n,k,tf,spec})}})}}")

# ── Scrolling: the lab scrolls its own container, not the window. ──
methods = methods.replace("window.scrollTo(", "this.scrollWin(").replace("window.scrollY", "this.scrollY()")
assert "window.claude" not in methods and "apikey" not in methods and "STATIC_RESULTS" not in methods

AI_RUN = r'''  async aiRun(q,mode,S,runSpec){const st=this.state,BT=this.BT,set=p=>this.setState(p);q=(q||'').trim();if(!q){this.toastMsg('Describe a strategy first');return}if(!BT){this.toastMsg('Engine still loading');return}
    set({ai:{mode,q,loading:true}});this.toAi();
    const IND=BT.IND;let spec=null,src='Rule parser',why='',risk={stop:0.08,tp:null,trail:null};
    // The prototype asked window.claude; here the backend's LLM gateway answers with the same JSON contract.
    try{const res=await apiPost('/live/strategy-lab/ai-rules',{q});const raw=res&&res.raw;if(raw){
        const j=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));const ok=o=>o&&IND[o.ind]&&(o.ind!=='num'||isFinite(+o.v));const one=c=>c&&ok(c.a)&&ok(c.b)&&BT.OPS.includes(c.op)?{a:c.a,op:c.op,b:c.b}:null;const cl=a=>(a||[]).map(c=>{if(c&&Array.isArray(c.any)){const s=c.any.map(one).filter(Boolean);return s.length>1?{any:s}:s[0]||null}return one(c)}).filter(Boolean);
        spec={entry:cl(j.entry),exit:cl(j.exit),name:j.name,tf:BT.TF[j.timeframe]?j.timeframe:null};why=j.why||'';risk={stop:j.stop??0.08,tp:j.tp??null,trail:j.trail??null};src='AI → rule engine';if(!spec.entry.length)spec=null}}catch(e){spec=null}
    if(!spec){const r=BT.parseRules(q);if(!r.entry.length){set({ai:{mode,q,err:'Couldn\'t turn that into an entry rule. Try “buy when RSI(2) is below 10 and close is above the 200-day SMA”.'}});return}spec={entry:r.entry,exit:r.exit,name:null,unparsed:r.unparsed}}
    const near=(v,o)=>o.reduce((a,x)=>Math.abs(+x-v)<Math.abs(+a-v)?x:a);
    const cfg={...(st.labCfg||{}),stop:risk.stop?near(risk.stop*100,['5','8','12']):'none',tp:risk.tp?near(risk.tp*100,['10','20']):'none',trail:risk.trail?near(risk.trail*100,['10','15']):'none'};
    this._btc={};set({labConds:{...(st.labConds||{}),custom:{entry:spec.entry,exit:spec.exit}},labK:'custom',aiHold:null,labCustomTf:(()=>{const p=BT.parseTimeframe(q);return p!=='d'?p:(spec.tf||'d')})(),vals:{...(st.vals||{}),custom:null},labCustomName:spec.name||'Your strategy',labUnparsed:spec.unparsed||[],labCfg:cfg,ai:{mode,q,src,name:spec.name||'Your strategy',why,spec,risk:cfg}});this.toAi();setTimeout(()=>{const s2=this.state;this.runValidate('custom',s2.labConds&&s2.labConds.custom,s2.labCustomTf||'d')},0)}'''

# The prototype's create-mode body, minus window.claude (kept to diff against AI_RUN).
proto_ai = lines(202, 213)
assert "window.claude.complete('You convert a trader" in proto_ai

header = r'''"use client";
/* eslint-disable */
// Strategy Lab — logic ported from the Strategy AI Lab prototype
// ("Strategy AI Lab - MarketCatalyst.html") by scripts/strategy-lab/build.sh (assemble_logic.py).
// Differences from the prototype, all deliberate:
//  - price data comes from GET /live/strategy-lab/bars (FMP, server-side key)
//    instead of a browser-side FMP key or the bundled sample file;
//  - the hard-coded sample results table and the synthetic "example data"
//    chart are removed — every number is computed from real bars;
//  - strategy text → rules uses POST /live/strategy-lab/ai-rules (our LLM
//    gateway) instead of window.claude, with the same JSON contract and the
//    same deterministic-parser fallback;
//  - broker automation is not implemented (no broker OAuth apps / signal runner);
//  - scrolling targets the lab's scroll container instead of the window.
import React, { Component } from "react";
import * as Engine from "./engine";
import LabView, { LAB_HOVER_CSS } from "./lab-view";
import { apiGet, apiPost, backendUrl } from "../backend";

'''

helpers = r'''
const LOGO=t=>backendUrl('/live/logo?ticker='+encodeURIComponent(t));
const HIDE=e=>{e.currentTarget.style.display='none'};
/** FMP bars for one symbol via the backend, in the prototype's row shape. */
async function labBars(s,tf,span){const q='symbols='+encodeURIComponent(s)+'&tf='+tf+(span.days!=null?'&days='+span.days:'&years='+span.years);
  const r=await apiGet('/live/strategy-lab/bars?'+q);const rows=r&&r.bars&&r.bars[s];if(!rows||!rows.length)throw new Error('FMP has no '+(tf==='d'?'daily':tf)+' bars for '+s);
  return rows.map(([date,open,high,low,close,volume])=>({date,open,high,low,close,volume}))}
const DEFAULT_SYMS=['AAPL','NVDA','MSFT'];
const SAVED_KEY='mc_lab_saved_v1';
const BASE_CSS=`.sl-root{font-family:Manrope,system-ui,sans-serif;font-size:13px;color:#e6ebe8;-webkit-font-smoothing:antialiased}
.sl-root *{box-sizing:border-box}
.sl-root button{font-family:inherit}
.sl-root input,.sl-root select{font-family:inherit}
.sl-root button:focus-visible,.sl-root select:focus-visible,.sl-root input:focus-visible{outline:2px solid #c9a24a;outline-offset:2px}
.sl-main-scroll::-webkit-scrollbar{width:8px;height:8px}.sl-main-scroll::-webkit-scrollbar-track{background:#15130c}.sl-main-scroll::-webkit-scrollbar-thumb{background:#c9a24a;border-radius:8px;border:2px solid #15130c}.sl-main-scroll::-webkit-scrollbar-thumb:hover{background:#f0d68c}`;
'''

klass = r'''
export default class StrategyLab extends Component {
  libRef=React.createRef();aiRef=React.createRef();detRef=React.createRef();
  BT=Engine;refsObj={aiRef:this.aiRef,libRef:this.libRef,detRef:this.detRef};
  state={labSaved:[]};
  scrollEl(){return typeof document!=='undefined'?document.querySelector('.sl-main-scroll'):null}
  scrollY(){const c=this.scrollEl();return c?c.scrollTop-c.getBoundingClientRect().top:0}
  scrollWin(a,b){const c=this.scrollEl();if(!c)return;if(typeof a==='object')c.scrollTo(a);else c.scrollTo(a||0,b||0)}
  componentDidMount(){try{const sv=JSON.parse(localStorage.getItem(SAVED_KEY)||'[]');if(Array.isArray(sv)&&sv.length)this.setState({labSaved:sv})}catch(e){}this.loadDaily(DEFAULT_SYMS)}
  componentWillUnmount(){clearTimeout(this.tt)}
  /** 6 years of FMP daily bars for the stocks the Backtest step tests on. */
  async loadDaily(syms){this.setState({fmpLoading:true,barsErr:''});const out={};let asOf='';const fails=[];
    await Promise.all(syms.map(async s=>{try{out[s]=await labBars(s,'d',{years:6});const L=out[s][out[s].length-1].date;if(L>asOf)asOf=L}catch(e){fails.push(s)}}));
    if(!Object.keys(out).length){this.setState({fmpLoading:false,barsErr:'Couldn\'t load FMP daily bars ('+fails.join(', ')+'). Try again shortly.'});return}
    this._btc={};this.setState(s=>({bars:{...(s.bars||{}),...out},barsAsOf:asOf,fmpLoading:false}));if(fails.length)this.toastMsg('FMP has no daily bars for '+fails.join(', '))}
  async fetchOne(s){const rows=await labBars(s,'d',{years:6});const bars={...(this.state.bars||{}),[s]:rows};const asOf=this.state.barsAsOf||rows[rows.length-1].date;this._btc={};this.setState({bars,barsAsOf:asOf});return bars[s]}
'''

render = r'''
  render(){const set=p=>this.setState(p);const vm=this.labVals(this.state,set,[]);
    return(<div className="sl-root">
      <style>{BASE_CSS+'\n'+LAB_HOVER_CSS}</style>
      <div style={{flex:1,minWidth:0,padding:'14px 24px 40px'}}><LabView vm={vm} refs={this.refsObj}/></div>
      {this.state.toast?<div style={{position:'fixed',bottom:22,left:'50%',transform:'translateX(-50%)',zIndex:60,background:'#1a1f21',border:'1px solid #2a3235',borderRadius:10,padding:'10px 16px',fontWeight:600,boxShadow:'0 10px 30px rgba(0,0,0,.4)'}}>{this.state.toast}</div>:null}
    </div>)}
}
'''

out = header + consts + "\n" + helpers + klass + AI_RUN + "\n" + methods + "\n" + render
open(OUT, "w").write(out)
print("ok", len(out))
