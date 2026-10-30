"use client";
// Strategy Lab (standalone /sl module). Originally ported from the Strategy AI
// Lab prototype; maintained by hand. Every number comes from the backtest
// engine (engine.js) on FMP bars served by the backend:
//  - one engine config per strategy: valCfg() in lab-config.js, used by the
//    multi-stock run, the single-stock report, chart levels, the stale
//    signature and Save / Edit;
//  - the multi-stock run backtests the 50 largest S&P 500 stocks
//    (GET /live/strategy-lab/universe) in a Web Worker, on the same bars the
//    report then uses, so a report's numbers equal its table row;
//  - saved strategies live in the user's account (/live/strategy-lab/saved),
//    localStorage is only an offline cache;
//  - broker automation is behind STRATEGY_LAB_AUTOMATION (off).
import React, { Component } from "react";
import * as Engine from "./engine";
import LabView, { LAB_HOVER_CSS } from "./lab-view";
import { apiDelete, apiGet, apiPost, backendUrl } from "../backend";
import { COST_OPTS, IPER, YEAR_OPTS, exitPlanKeys, exitPlanSummary, periodLabel, periodOf, riskToCfg, runSig, savedCfgOf, valCfg } from "./lab-config";
import { MAX_DAILY_DAYS, MAX_INTRADAY_DAYS, computeRow, engineCfg, fetchSpan, periodOfCfg, prepBars, sortRows, summarize } from "./lab-run";
import { STRATEGY_LAB_AUTOMATION } from "./flags";

const _o=(ind,n,mult)=>{const o={ind};if(n!=null)o.n=n;if(mult!=null)o.mult=mult;return o},_v=v=>({ind:'num',v}),_c=(a,op,b)=>({a,op,b}),CL=_o('close');
const HOLDS=['Intraday','Days','Days–weeks','Weeks','Weeks–months','Months'];
const LIB=[
 {k:'turtle20',fam:'Breakout',name:'Turtle 20-Day Breakout',hold:'Weeks',src:'Richard Dennis · Curtis Faith, Way of the Turtle (2007)',what:'The original Turtle System 1: buy when price closes above its highest close of the prior 20 days, exit on a close below the 10-day low. Catches the start of trends and cuts losers fast; most trades lose small, a few trends pay for everything.',cond:{entry:[_c(CL,'crosses above',_o('hh',20))],exit:[_c(CL,'<',_o('ll',10))]}},
 {k:'turtle55',fam:'Breakout',name:'Turtle 55-Day Breakout',hold:'Months',src:'Richard Dennis · Curtis Faith, Way of the Turtle (2007)',what:'Turtle System 2: a slower breakout above the 55-day high with a 20-day low exit. Fewer false starts than the 20-day version and longer holds, at the cost of giving back more at the end of each trend.',cond:{entry:[_c(CL,'crosses above',_o('hh',55))],exit:[_c(CL,'<',_o('ll',20))]}},
 {k:'donch100',fam:'Trend',name:'Donchian 100-Day Trend',hold:'Months',src:'Richard Donchian channel rules',what:'Long-horizon channel breakout: enter on a new 100-day closing high, exit on a 50-day closing low. Designed to hold only the biggest, most persistent moves.',cond:{entry:[_c(CL,'crosses above',_o('hh',100))],exit:[_c(CL,'<',_o('ll',50))]}},
 {k:'month21',fam:'Breakout',name:'Monthly High Breakout',hold:'Weeks',src:'Classic channel breakout, trend-filtered',what:'Buys a close above the highest close of the past month (21 sessions) while the stock is above its 200-day average; exits on a close below the 10-day low.',cond:{entry:[_c(CL,'crosses above',_o('hh',21)),_c(CL,'>',_o('sma',200))],exit:[_c(CL,'<',_o('ll',10))]}},
 {k:'oneil',fam:'Growth',name:'CAN SLIM Base Breakout',hold:'Weeks–months',src:'William O\'Neil, How to Make Money in Stocks — price & volume rules',what:'The price-and-volume part of CAN SLIM: buy as a stock clears its 50-day closing high on at least 40% above-average volume while above the 200-day. Exits when it loses the 50-day average. The earnings criteria are not applied here.',cond:{entry:[_c(CL,'crosses above',_o('hh',50)),_c(_o('volume'),'≥',_o('avgvol',50,1.4)),_c(CL,'>',_o('sma',200))],exit:[_c(CL,'<',_o('sma',50))]}},
 {k:'minervini',fam:'Growth',name:'Minervini Trend Template',hold:'Weeks–months',src:'Mark Minervini, Trade Like a Stock Market Wizard (2013)',what:'Only owns stocks in a confirmed Stage 2 uptrend: price above the 50-day, the 50 above the 150, the 150 above the 200, and price within 25% of its 52-week high. Exits on a close below the 50-day.',cond:{entry:[_c(CL,'>',_o('sma',50)),_c(_o('sma',50),'>',_o('sma',150)),_c(_o('sma',150),'>',_o('sma',200)),_c(CL,'≥',_o('hh',252,0.75))],exit:[_c(CL,'<',_o('sma',50))]}},
 {k:'weinstein',fam:'Trend',name:'Weinstein Stage 2 Entry',hold:'Months',src:'Stan Weinstein, Secrets for Profiting in Bull and Bear Markets (1988)',what:'Buys the breakout from a Stage 1 base: a close back above the 150-day (30-week) average on at least double normal volume. Holds until price falls back below the 150-day.',cond:{entry:[_c(CL,'crosses above',_o('sma',150)),_c(_o('volume'),'≥',_o('avgvol',50,2))],exit:[_c(CL,'<',_o('sma',150))]}},
 {k:'faber200',fam:'Trend',name:'200-Day Trend Filter',hold:'Months',src:'Meb Faber, A Quantitative Approach to Tactical Asset Allocation (2007) — daily variant',what:'In when price is above its 200-day average, out when it closes below. Not built to beat a bull market — built to sidestep the worst of bear markets.',cond:{entry:[_c(CL,'crosses above',_o('sma',200))],exit:[_c(CL,'crosses below',_o('sma',200))]}},
 {k:'tsmom',fam:'Momentum',name:'Time-Series Momentum',hold:'Months',src:'Moskowitz, Ooi & Pedersen, Time Series Momentum (2012)',what:'Owns the stock while its own 12-month return is positive and steps aside when it turns negative. Unlike cross-sectional momentum it needs no ranking universe — each stock is judged against its own past.',cond:{entry:[_c(_o('roc',252),'crosses above',_v(0))],exit:[_c(_o('roc',252),'crosses below',_v(0))]}},
 {k:'roc20',fam:'Momentum',name:'20-Day Momentum Burst',hold:'Weeks',src:'Rate-of-change momentum',what:'Buys when the 20-day return pushes through +10% while the stock is above its 50-day average; exits once the 20-day return turns negative.',cond:{entry:[_c(_o('roc',20),'crosses above',_v(10)),_c(CL,'>',_o('sma',50))],exit:[_c(_o('roc',20),'<',_v(0))]}},
 {k:'rsi50',fam:'Momentum',name:'RSI 50 Momentum Cross',hold:'Weeks',src:'Andrew Cardwell RSI range rules',what:'In uptrends RSI(14) tends to hold above 40–50. Buys when RSI crosses back above 50 above the 200-day average; exits if RSI drops below 40, the bear-range floor.',cond:{entry:[_c(_o('rsi',14),'crosses above',_v(50)),_c(CL,'>',_o('sma',200))],exit:[_c(_o('rsi',14),'<',_v(40))]}},
 {k:'hh20rsi',fam:'Momentum',name:'Strong-Close Breakout',hold:'Weeks',src:'Breakout with RSI confirmation',what:'Buys a new 20-day closing high only when RSI(14) is above 60, filtering out weak, low-conviction breakouts. Exits on a close below the 21-day EMA.',cond:{entry:[_c(CL,'crosses above',_o('hh',20)),_c(_o('rsi',14),'>',_v(60))],exit:[_c(CL,'<',_o('ema',21))]}},
 {k:'ema921',fam:'Trend',name:'EMA 9 / 21 Crossover',hold:'Days–weeks',src:'Classic short-term moving-average crossover',what:'Fast swing-trend system: long while the 9-day EMA is above the 21-day EMA. Reacts quickly, so it trades often and gets chopped in sideways markets.',cond:{entry:[_c(_o('ema',9),'crosses above',_o('ema',21))],exit:[_c(_o('ema',9),'crosses below',_o('ema',21))]}},
 {k:'ema2050',fam:'Trend',name:'EMA 20 / 50 Swing Trend',hold:'Weeks',src:'Moving-average crossover, 200-day filtered',what:'Long when the 20-day EMA crosses above the 50-day EMA and price is above the 200-day; exits on the reverse cross. A middle ground between the 9/21 and the golden cross.',cond:{entry:[_c(_o('ema',20),'crosses above',_o('ema',50)),_c(CL,'>',_o('sma',200))],exit:[_c(_o('ema',20),'crosses below',_o('ema',50))]}},
 {k:'sma20100',fam:'Trend',name:'SMA 20 / 100 Crossover',hold:'Months',src:'Dual moving-average system',what:'Long while the 20-day average is above the 100-day. Slower than the EMA systems with fewer whipsaws.',cond:{entry:[_c(_o('sma',20),'crosses above',_o('sma',100))],exit:[_c(_o('sma',20),'crosses below',_o('sma',100))]}},
 {k:'fastgc',fam:'Trend',name:'Fast Golden Cross 20 / 50',hold:'Weeks',src:'Short-horizon golden cross',what:'The 20-day average crossing above the 50-day — an earlier, noisier version of the 50/200 golden cross.',cond:{entry:[_c(_o('sma',20),'crosses above',_o('sma',50))],exit:[_c(_o('sma',20),'crosses below',_o('sma',50))]}},
 {k:'macdx',fam:'Trend',name:'MACD Signal Cross',hold:'Weeks',src:'Gerald Appel, MACD (1979)',what:'Buys when MACD crosses above its signal line while the stock is above its 200-day; exits on the cross back down. The 200-day filter skips signals inside downtrends.',cond:{entry:[_c(_o('macd'),'crosses above',_o('macds')),_c(CL,'>',_o('sma',200))],exit:[_c(_o('macd'),'crosses below',_o('macds'))]}},
 {k:'macd0',fam:'Trend',name:'MACD Zero-Line Cross',hold:'Weeks–months',src:'Gerald Appel, MACD (1979)',what:'Long when MACD crosses above zero — the 12-day EMA moving above the 26-day — and out when it crosses below. Slower and cleaner than the signal-line cross.',cond:{entry:[_c(_o('macd'),'crosses above',_v(0))],exit:[_c(_o('macd'),'crosses below',_v(0))]}},
 {k:'macdrsi',fam:'Trend',name:'MACD + RSI Confirmation',hold:'Weeks',src:'Combined momentum confirmation',what:'Requires a MACD bullish cross, price above the 50-day, and RSI(14) under 60 so the entry isn\'t already stretched. Exits when RSI goes above 75.',cond:{entry:[_c(_o('macd'),'crosses above',_o('macds')),_c(CL,'>',_o('sma',50)),_c(_o('rsi',14),'<',_v(60))],exit:[_c(_o('rsi',14),'>',_v(75))]}},
 {k:'rsi14os',fam:'Mean reversion',name:'RSI 30 Oversold Bounce',hold:'Days–weeks',src:'J. Welles Wilder, New Concepts in Technical Trading Systems (1978)',what:'Buys when RSI(14) climbs back above 30 after being oversold, only in stocks above the 200-day. Exits when RSI reaches 70 or after 20 sessions.',cond:{entry:[_c(_o('rsi',14),'crosses above',_v(30)),_c(CL,'>',_o('sma',200))],exit:[_c(_o('rsi',14),'>',_v(70)),_c(_o('bars'),'≥',_v(20))]}},
 {k:'rsi3',fam:'Mean reversion',name:'RSI(3) Deep Pullback',hold:'Days',src:'Connors & Alvarez, Short Term Trading Strategies That Work (2008)',what:'A slightly slower cousin of RSI(2): buys RSI(3) under 15 above the 200-day and sells when RSI(3) rebounds above 70.',cond:{entry:[_c(_o('rsi',3),'<',_v(15)),_c(CL,'>',_o('sma',200))],exit:[_c(_o('rsi',3),'>',_v(70))]}},
 {k:'dbl7',fam:'Mean reversion',name:'Double 7s',hold:'Days',src:'Connors & Alvarez, Short Term Trading Strategies That Work (2008)',what:'Buy a new 7-day closing low while above the 200-day average; sell at a new 7-day closing high. Simple, frequent, short-hold mean reversion.',cond:{entry:[_c(CL,'<',_o('ll',7)),_c(CL,'>',_o('sma',200))],exit:[_c(CL,'>',_o('hh',7))]}},
 {k:'pull3',fam:'Mean reversion',name:'3-Day Pullback in Uptrend',hold:'Days',src:'Connors & Alvarez, Short Term Trading Strategies That Work (2008)',what:'Buys a 5%+ drop over three sessions in a stock above its 200-day; exits on a close back above the 10-day average or after 10 sessions.',cond:{entry:[_c(_o('roc',3),'≤',_v(-5)),_c(CL,'>',_o('sma',200))],exit:[_c(CL,'>',_o('sma',10)),_c(_o('bars'),'≥',_v(10))]}},
 {k:'bblow',fam:'Mean reversion',name:'Lower Bollinger Band Buy',hold:'Days–weeks',src:'John Bollinger, Bollinger on Bollinger Bands (2001)',what:'Buys a close below the lower band (2σ under the 20-day average) in a stock above its 200-day, betting on a return to the middle band, which is the exit.',cond:{entry:[_c(CL,'crosses below',_o('bbl',20)),_c(CL,'>',_o('sma',200))],exit:[_c(CL,'>',_o('sma',20))]}},
 {k:'dist20',fam:'Mean reversion',name:'Stretched Below 20-Day',hold:'Days–weeks',src:'Distance-from-average mean reversion',what:'Buys when price is 10% or more below its 20-day average while still above the 200-day; exits when price gets back to the 20-day.',cond:{entry:[_c(CL,'≤',_o('sma',20,0.9)),_c(CL,'>',_o('sma',200))],exit:[_c(CL,'≥',_o('sma',20))]}},
 {k:'test200',fam:'Mean reversion',name:'200-Day Support Test',hold:'Weeks',src:'Moving-average support buy',what:'In a stock whose 50-day is above its 200-day, buys the day it trades down to the 200-day intraday but closes above it. Exits at a new 20-day closing high or after 20 sessions.',cond:{entry:[_c(_o('low'),'≤',_o('sma',200)),_c(CL,'>',_o('sma',200)),_c(_o('sma',50),'>',_o('sma',200))],exit:[_c(CL,'>',_o('hh',20)),_c(_o('bars'),'≥',_v(20))]}},
 {k:'pb21',fam:'Pullback',name:'Pullback to 21-EMA',hold:'Days–weeks',src:'Trend pullback entry',what:'In an uptrend (50-day above 200-day), buys when the day\'s low tags the 21-day EMA but the close holds above it. Exits below the 50-day or after 15 sessions.',cond:{entry:[_c(_o('low'),'≤',_o('ema',21)),_c(CL,'>',_o('ema',21)),_c(_o('sma',50),'>',_o('sma',200))],exit:[_c(CL,'<',_o('sma',50)),_c(_o('bars'),'≥',_v(15))]}},
 {k:'bbup',fam:'Volatility',name:'Bollinger Band Breakout',hold:'Weeks',src:'John Bollinger, Bollinger on Bollinger Bands (2001)',what:'A close above the upper band on 1.5× normal volume signals expanding volatility in the up direction. Rides it until price loses the 20-day middle band.',cond:{entry:[_c(CL,'crosses above',_o('bbu',20)),_c(_o('volume'),'≥',_o('avgvol',50,1.5))],exit:[_c(CL,'<',_o('sma',20))]}},
 {k:'quiet',fam:'Volatility',name:'Quiet-Trend Breakout',hold:'Weeks',src:'Low-volatility breakout',what:'Buys a new 20-day high only when daily range (ATR) is under 2.5% of price and the stock is above its 50-day — calm, orderly uptrends rather than spikes.',cond:{entry:[_c(CL,'crosses above',_o('hh',20)),_c(_o('atr',14),'<',_o('close',null,0.025)),_c(CL,'>',_o('sma',50))],exit:[_c(CL,'<',_o('sma',50))]}},
 {k:'gapgo',fam:'Event',name:'Gap and Go',hold:'Days',src:'Opening-gap continuation',what:'A 3%+ gap up on at least double normal volume that closes above its open shows real demand. Holds five sessions. Signals use the close, so the entry fills at the next morning\'s open.',cond:{entry:[_c(_o('gap'),'≥',_v(3)),_c(_o('volume'),'≥',_o('avgvol',50,2)),_c(CL,'>',_o('open'))],exit:[_c(_o('bars'),'≥',_v(5))]}},
 {k:'gapdn',fam:'Event',name:'Gap-Down Reversal',hold:'Days',src:'Opening-gap mean reversion',what:'Buys a 3%+ gap down that recovers to close above its open in a stock above the 200-day — sellers exhausted at the open. Holds three sessions. Signals use the close, so the entry fills at the next morning\'s open.',cond:{entry:[_c(_o('gap'),'≤',_v(-3)),_c(CL,'>',_o('open')),_c(CL,'>',_o('sma',200))],exit:[_c(_o('bars'),'≥',_v(3))]}},
 {k:'volsurge',fam:'Volume',name:'Volume Surge Accumulation',hold:'Weeks',src:'Volume-price accumulation signal',what:'A day with 2.5× normal volume and a 2%+ gain above the 50-day average suggests institutional buying. Holds 20 sessions unless price loses the 50-day.',cond:{entry:[_c(_o('volume'),'≥',_o('avgvol',50,2.5)),_c(_o('roc',1),'≥',_v(2)),_c(CL,'>',_o('sma',50))],exit:[_c(CL,'<',_o('sma',50)),_c(_o('bars'),'≥',_v(20))]}},
 {k:'offlow',fam:'Reversal',name:'Off-the-Lows Reversal',hold:'Weeks',src:'Bottom-reversal entry',what:'Buys the first close back above the 50-day average while price is still within 20% of its 52-week low — an early turn from a beaten-down level. Exits below the 20-day or after 40 sessions.',cond:{entry:[_c(CL,'crosses above',_o('sma',50)),_c(CL,'≤',_o('ll',252,1.2))],exit:[_c(CL,'<',_o('sma',20)),_c(_o('bars'),'≥',_v(40))]}},
 {k:'orb30',tf:'5m',fam:'Intraday',name:'30-Min Opening Range Breakout',hold:'Intraday',src:'Toby Crabel, Day Trading with Short Term Price Patterns and Opening Range Breakout (1990)',what:'Marks the high of the first 30 minutes (six 5-min bars) and buys the first close above it within the first two hours. Exits on a close back below VWAP; any open position is closed at the session close.',cond:{entry:[_c(CL,'crosses above',_o('orh',6)),_c(_o('tod'),'≤',_v(120))],exit:[_c(CL,'<',_o('vwap'))]}},
 {k:'orb15',tf:'5m',fam:'Intraday',name:'15-Min ORB on Volume',hold:'Intraday',src:'Opening range breakout, volume-confirmed',what:'A faster ORB: breaks the first 15-minute high on 1.5× the recent 5-min volume. Exits below the opening-range low or at the session close.',cond:{entry:[_c(CL,'crosses above',_o('orh',3)),_c(_o('volume'),'≥',_o('avgvol',20,1.5)),_c(_o('tod'),'≤',_v(90))],exit:[_c(CL,'<',_o('orl',3))]}},
 {k:'vwaprc',tf:'5m',fam:'Intraday',name:'VWAP Reclaim',hold:'Intraday',src:'Institutional VWAP benchmark behavior',what:'Buys when price crosses back above the session VWAP while holding above yesterday\'s close — buyers taking back the day\'s average price. Exits on a cross back below VWAP.',cond:{entry:[_c(CL,'crosses above',_o('vwap')),_c(CL,'>',_o('pdc')),_c(_o('tod'),'≥',_v(30))],exit:[_c(CL,'crosses below',_o('vwap'))]}},
 {k:'vwappb',tf:'5m',fam:'Intraday',name:'Trend-Day VWAP Pullback',hold:'Intraday',src:'Trend-day pullback entry',what:'On a day trading above its open, buys a 5-min bar that dips to VWAP but closes above it after the first hour. Exits below VWAP or after two hours.',cond:{entry:[_c(CL,'>',_o('dayopen')),_c(_o('low'),'≤',_o('vwap')),_c(CL,'>',_o('vwap')),_c(_o('tod'),'≥',_v(60))],exit:[_c(CL,'<',_o('vwap')),_c(_o('bars'),'≥',_v(24))]}},
 {k:'pdhbo',tf:'5m',fam:'Intraday',name:'Prior-Day High Breakout',hold:'Intraday',src:'Floor-trader reference levels',what:'Buys the first 5-min close above yesterday\'s high on 1.5× recent volume. Yesterday\'s high is where many stops and breakout orders sit. Exits below VWAP.',cond:{entry:[_c(CL,'crosses above',_o('pdh')),_c(_o('volume'),'≥',_o('avgvol',20,1.5))],exit:[_c(CL,'<',_o('vwap'))]}},
 {k:'pdlrc',tf:'5m',fam:'Intraday',name:'Failed Breakdown at Prior-Day Low',hold:'Intraday',src:'Failed-breakdown reversal',what:'Price undercuts yesterday\'s low, then closes back above it — sellers trapped. Targets a move back to yesterday\'s close; otherwise exits after two hours.',cond:{entry:[_c(_o('low'),'<',_o('pdl')),_c(CL,'crosses above',_o('pdl'))],exit:[_c(CL,'≥',_o('pdc')),_c(_o('bars'),'≥',_v(24))]}},
 {k:'gapdrive',tf:'5m',fam:'Intraday',name:'Gap-Up Opening Drive',hold:'Intraday',src:'Opening-drive continuation',what:'On a 2%+ gap-up open, buys the break of the first 15-minute high in the first hour while above VWAP. Exits on a close below VWAP.',cond:{entry:[_c(_o('dayopen'),'≥',_o('pdc',null,1.02)),_c(CL,'crosses above',_o('orh',3)),_c(CL,'>',_o('vwap')),_c(_o('tod'),'≤',_v(60))],exit:[_c(CL,'<',_o('vwap'))]}},
 {k:'iema',tf:'5m',fam:'Intraday',name:'5-Min EMA 9 / 20 Trend',hold:'Intraday',src:'Intraday moving-average crossover',what:'Long while the 9-bar EMA is above the 20-bar EMA on 5-minute bars and price is above VWAP. Exits on the reverse cross or at the session close.',cond:{entry:[_c(_o('ema',9),'crosses above',_o('ema',20)),_c(CL,'>',_o('vwap'))],exit:[_c(_o('ema',9),'crosses below',_o('ema',20))]}},
 {k:'irsi',tf:'5m',fam:'Intraday',name:'Intraday RSI Oversold Bounce',hold:'Intraday',src:'Intraday mean reversion',what:'On a day that opened above yesterday\'s close, buys when 5-min RSI(14) climbs back above 30. Exits when RSI reaches 60 or after one hour.',cond:{entry:[_c(_o('rsi',14),'crosses above',_v(30)),_c(_o('dayopen'),'>',_o('pdc'))],exit:[_c(_o('rsi',14),'>',_v(60)),_c(_o('bars'),'≥',_v(12))]}},
 {k:'power',tf:'5m',fam:'Intraday',name:'Power-Hour Breakout',hold:'Intraday',src:'Late-session trend continuation',what:'In the last 90 minutes, buys a new one-hour closing high while price is above VWAP and the opening-range high. Exits on a close below the 9-bar EMA; any open position closes at the bell.',cond:{entry:[_c(_o('tod'),'≥',_v(300)),_c(CL,'crosses above',_o('hh',12)),_c(CL,'>',_o('vwap')),_c(CL,'>',_o('orh',6))],exit:[_c(CL,'<',_o('ema',9))]}},
 {k:'isqz',tf:'5m',fam:'Intraday',name:'5-Min Bollinger Squeeze',hold:'Intraday',src:'John Bollinger — applied to 5-minute bars',what:'When 5-min band width hits its lowest in 60 bars, a close above the upper band starts the move. Exits below the 20-bar average.',cond:{entry:[_c(_o('sqz',60),'>',_v(0)),_c(CL,'crosses above',_o('bbu',20))],exit:[_c(CL,'<',_o('sma',20))]}},
 {k:'f_ema',tf:'15m',fam:'Intraday',name:'15-Min EMA 9 / 21 Cross',hold:'Intraday',src:'Intraday moving-average crossover on 15-minute bars',what:'Buys when the 9-bar EMA crosses above the 21-bar EMA on 15-minute bars while price is above VWAP. Exits on the reverse cross or at the session close.',cond:{entry:[_c(_o('ema',9),'crosses above',_o('ema',21)),_c(CL,'>',_o('vwap'))],exit:[_c(_o('ema',9),'crosses below',_o('ema',21))]}},
 {k:'f_orb',tf:'15m',fam:'Intraday',name:'15-Min Opening Bar Breakout',hold:'Intraday',src:'Opening range breakout, first 15-minute bar',what:'Buys the first 15-min close above the opening 15-minute bar\'s high on 1.5× the recent 15-min volume. Exits on a close back below VWAP or at the session close.',cond:{entry:[_c(CL,'crosses above',_o('orh',1)),_c(_o('volume'),'≥',_o('avgvol',20,1.5))],exit:[_c(CL,'<',_o('vwap'))]}},
 {k:'f_vwap',tf:'15m',fam:'Intraday',name:'15-Min VWAP Trend Pullback',hold:'Intraday',src:'Trend-day pullback entry on 15-minute bars',what:'On a day trading above its open and above the 50-bar EMA, buys a 15-min bar that dips to VWAP but closes above it. Exits on a close below VWAP or after 2 hours.',cond:{entry:[_c(_o('low'),'≤',_o('vwap')),_c(CL,'>',_o('vwap')),_c(CL,'>',_o('dayopen')),_c(CL,'>',_o('ema',50))],exit:[_c(CL,'<',_o('vwap')),_c(_o('bars'),'≥',_v(8))]}},
 {k:'f_rsi',tf:'15m',fam:'Intraday',name:'15-Min RSI(2) Pullback in Uptrend',hold:'Intraday',src:'Connors RSI(2) adapted to 15-minute bars',what:'When price is above the 50-bar EMA, buys a 15-min RSI(2) dip below 10. Exits when RSI(2) rises above 70 or after 90 minutes.',cond:{entry:[_c(_o('rsi',2),'<',_v(10)),_c(CL,'>',_o('ema',50))],exit:[_c(_o('rsi',2),'>',_v(70)),_c(_o('bars'),'≥',_v(6))]}},
 {k:'f_macd',tf:'15m',fam:'Intraday',name:'15-Min MACD Momentum',hold:'Intraday',src:'Gerald Appel MACD on 15-minute bars',what:'Buys when MACD crosses above its signal line on 15-minute bars with price above VWAP. Exits on the reverse cross or at the session close.',cond:{entry:[_c(_o('macd'),'crosses above',_o('macds')),_c(CL,'>',_o('vwap'))],exit:[_c(_o('macd'),'crosses below',_o('macds'))]}},
 {k:'f_pdh',tf:'15m',fam:'Intraday',name:'15-Min Prior-Day High Break',hold:'Intraday',src:'Floor-trader reference levels on 15-minute bars',what:'Buys the first 15-min close above yesterday\'s high on 1.5× recent volume. Exits on a close back below yesterday\'s high or at the session close.',cond:{entry:[_c(CL,'crosses above',_o('pdh')),_c(_o('volume'),'≥',_o('avgvol',20,1.5))],exit:[_c(CL,'<',_o('pdh'))]}},
];

const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CORE=[
      {k:'hi52',cond:{"entry":[{"a":{"ind":"close"},"op":"crosses above","b":{"ind":"hh","n":252}},{"a":{"ind":"volume"},"op":"≥","b":{"ind":"avgvol","n":50,"mult":1.5}}],"exit":[{"a":{"ind":"close"},"op":"<","b":{"ind":"sma","n":20}}]},fam:'Momentum',name:'52-Week High Breakout',hold:'2–8 wks',entry:'Close at a new 52-week high on volume ≥ 1.5× its 50-day average',exit:'Close below the 20-day average',data:'Daily OHLCV bars, adjusted',src:'George & Hwang (2004), Journal of Finance'},
      {k:'rsi2',cond:{"entry":[{"a":{"ind":"rsi","n":2},"op":"<","b":{"ind":"num","v":10}},{"a":{"ind":"close"},"op":">","b":{"ind":"sma","n":200}}],"exit":[{"a":{"ind":"close"},"op":">","b":{"ind":"sma","n":5}}]},fam:'Mean reversion',name:'RSI(2) Pullback',hold:'2–7 days',entry:'RSI(2) below 10 while the close is above the 200-day average',exit:'Close above the 5-day average',data:'Daily OHLCV bars, adjusted',src:'Connors & Alvarez, Short Term Trading Strategies That Work (2008)'},
      {k:'mom',cond:{"entry":[{"a":{"ind":"mom_rank"},"op":"≤","b":{"ind":"num","v":10}}],"exit":[{"a":{"ind":"mom_rank"},"op":">","b":{"ind":"num","v":10}}]},fam:'Momentum',name:'12-1 Momentum Rotation',hold:'1–3 months',entry:'Monthly: buy the top decile by 12-month return, skipping the latest month',exit:'Rebalance monthly; sell names that leave the top decile',data:'Monthly total returns',src:'Jegadeesh & Titman (1993), Journal of Finance'},
      {k:'pead',cond:{"entry":[{"a":{"ind":"eps_surprise"},"op":"≥","b":{"ind":"num","v":5}},{"a":{"ind":"gap"},"op":"≥","b":{"ind":"num","v":2}},{"a":{"ind":"days_er"},"op":"≤","b":{"ind":"num","v":1}}],"exit":[{"a":{"ind":"bars"},"op":"≥","b":{"ind":"num","v":40}}]},fam:'Event',name:'Post-Earnings Drift',hold:'~8 wks',entry:'Day after earnings: EPS surprise ≥ +5% and an opening gap ≥ +2%',exit:'After 40 trading days',data:'Daily bars + earnings surprises',src:'Bernard & Thomas (1989), Journal of Accounting Research'},
      {k:'sqz',cond:{"entry":[{"a":{"ind":"sqz","n":126},"op":">","b":{"ind":"num","v":0}},{"a":{"ind":"close"},"op":"crosses above","b":{"ind":"bbu","n":20}}],"exit":[{"a":{"ind":"close"},"op":"<","b":{"ind":"sma","n":20}}]},fam:'Volatility',name:'Volatility Squeeze Breakout',hold:'1–4 wks',entry:'Bollinger Band width at a 6-month low, then a close above the upper band',exit:'Close below the 20-day average',data:'Daily OHLCV bars, adjusted',src:'Bollinger, Bollinger on Bollinger Bands (2001)'},
      {k:'gc',cond:{"entry":[{"a":{"ind":"sma","n":50},"op":"crosses above","b":{"ind":"sma","n":200}}],"exit":[{"a":{"ind":"sma","n":50},"op":"crosses below","b":{"ind":"sma","n":200}}]},fam:'Trend',name:'Golden Cross',hold:'Months',entry:'50-day average crosses above the 200-day average',exit:'50-day average crosses back below the 200-day',data:'Daily OHLCV bars, adjusted',src:'Brock, Lakonishok & LeBaron (1992), Journal of Finance'}
];
const WHAT={hi52:'Buys a stock the day it closes at a new 52-week high on at least 1.5× normal volume — the 52-week-high momentum effect (George & Hwang, 2004). Stocks near their highs tend to keep outperforming because investors anchor to the old high. It rides the move until price loses the 20-day average.',
      rsi2:'Short-term mean reversion inside an uptrend (Larry Connors). When a stock above its 200-day average sells off hard for two days (RSI(2) under 10), it tends to snap back. Exits on the first close above the 5-day average — trades last days, not weeks.',
      mom:'Cross-sectional momentum (Jegadeesh & Titman, 1993): hold the top 10% of stocks ranked by 12-month return, skipping the most recent month, and rebalance monthly. Winners over the past year tend to keep winning for the next few months.',
      pead:'Post-earnings announcement drift (Bernard & Thomas, 1989): stocks that beat estimates and gap up on the report tend to keep drifting the same way for weeks as the market slowly prices in the surprise. Holds about 8 weeks.',
      sqz:'Volatility compression to expansion (John Bollinger). When the Bollinger Band width hits a 6-month low the stock is coiled; a close above the upper band often starts a directional move. Exits when price loses the 20-day average.',
      gc:'Classic trend filter: buy when the 50-day average crosses above the 200-day, sell on the reverse cross. Few trades, slow signals — aims to sit through major uptrends and step aside in bear markets.',
      mc:'MarketCatalyst\'s own signal: enter when a stock\'s Emergence Score reaches 75, exit when it drops below 60 or after 30 trading days.',
      custom:'Built from your description and translated into the rules below.'};

const ALL_TF = ["1m", "5m", "15m", "30m", "1h", "4h", "d", "1w"];
const INTRA_TF = ["1m", "5m", "15m", "30m", "1h", "4h"];
const LOGO = (t) => backendUrl("/live/logo?ticker=" + encodeURIComponent(t));
const SAVED_CACHE = "mc_lab_saved_v2", OLD_SAVED = "mc_lab_saved_v1", MIGRATED = "mc_lab_saved_migrated_v1", AUTO_KEY = "mc_lab_auto_v1";
const tfL = (tf) => (Engine.TF[tf] || Engine.TF.d).l;
const p1 = (v) => (v == null || !Number.isFinite(v) ? "n/a" : (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(1) + "%");
const fx = (v) => (v == null ? "—" : Number.isFinite(v) ? v.toFixed(2).replace("-", "−") : "∞");
const sc = (v) => (v > 0 ? "#3ddc84" : v < 0 ? "#f0565a" : "#8b9592");
const fmtDt = (d) => { const s = String(d), [y, m, dd] = s.slice(0, 10).split("-"); return `${MON[+m - 1]} ${+dd}, ${y}` + (s.length > 10 ? " " + s.slice(11, 16) : ""); };
const money = (v) => "$" + Math.round(v).toLocaleString("en-US");
const newId = () => (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).slice(0, 20);
const errMsg = (e) => { const m = (e && e.message) || String(e || ""); try { const j = JSON.parse(m); return j.message || m; } catch { return m; } };
const copy = (o) => JSON.parse(JSON.stringify(o));
const etDayNow = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const IDESC = {close:'Last traded price of the candle.',open:'First traded price of the candle.',high:'Highest price reached during the candle.',low:'Lowest price reached during the candle.',volume:'Shares traded during the candle.',
  sma:'Simple moving average — the plain average of the last N closes.',ema:'Exponential moving average — weights recent closes more, so it reacts faster.',rsi:'Relative Strength Index (0–100, Wilder). Below 30 = oversold, above 70 = overbought.',
  roc:'Rate of change — % move in close versus N candles ago.',atr:'Average True Range (Wilder smoothing) — the typical candle range over N candles.',
  hh:'Highest close over the previous N candles, excluding this one. 52W = 252 trading days.',ll:'Lowest close over the previous N candles, excluding this one.',
  avgvol:'Average volume per candle over the last N candles.',bbu:'Upper Bollinger Band — N-candle SMA plus 2 standard deviations.',bbl:'Lower Bollinger Band — N-candle SMA minus 2 standard deviations.',
  sqz:'Squeeze — 1 when the Bollinger Band width is near its lowest in N candles, else 0.',macd:'MACD line — 12-candle EMA minus 26-candle EMA.',macds:'MACD signal — 9-candle EMA of the MACD line.',
  bars:'Candles held in the trade, entry candle included. “≥ 5” exits after holding 5 candles.',num:'A fixed number you type in.',gap:'Opening gap — this open versus the previous close, in %.',eps_surprise:'Reported EPS versus estimate. Needs earnings data.',days_er:'Candles since the last earnings report. Needs earnings dates.',mom_rank:'Rank of 12-month return across a universe. Needs multi-stock ranking.',
  vwap:'Volume-weighted average price for the session.',orh:'Opening-range high — highest price in the first N candles of the session.',orl:'Opening-range low — lowest price in the first N candles of the session.',pdh:'Previous session high.',pdl:'Previous session low.',pdc:'Previous session close.',dayopen:'The session’s first price.',tod:'Minutes since the 9:30 ET open.',emergence:'MarketCatalyst Emergence Score. Needs score history.'};
const ODESC = {'>':'Left side is greater than right side on this candle.','<':'Left side is less than right side on this candle.','≥':'Left side is greater than or equal to right side.','≤':'Left side is less than or equal to right side.','crosses above':'Left was at or below right on the previous candle and is above it now — fires once, on the cross.','crosses below':'Left was at or above right on the previous candle and is below it now — fires once, on the cross.'};
const LOOK = [["20","20D"],["50","50D"],["63","3M"],["126","6M"],["252","52W"]];
const BASE_CSS = `.sl-root{font-family:Manrope,system-ui,sans-serif;font-size:13px;color:#e6ebe8;-webkit-font-smoothing:antialiased}
.sl-root *{box-sizing:border-box}
.sl-root button{font-family:inherit}
.sl-root input,.sl-root select{font-family:inherit}
.sl-root button:focus-visible,.sl-root select:focus-visible,.sl-root input:focus-visible{outline:2px solid #c9a24a;outline-offset:2px}
.sl-main-scroll::-webkit-scrollbar{width:8px;height:8px}.sl-main-scroll::-webkit-scrollbar-track{background:#15130c}.sl-main-scroll::-webkit-scrollbar-thumb{background:#c9a24a;border-radius:8px;border:2px solid #15130c}.sl-main-scroll::-webkit-scrollbar-thumb:hover{background:#f0d68c}`;

/** Bars of history the data layer can serve per candle, and bars a test window uses. */
function barBudget(tf, cfg) {
  if (tf === "d") return { avail: Math.floor((MAX_DAILY_DAYS * 252) / 365.25), test: Math.ceil(cfg.years * 252) };
  if (tf === "1w") return { avail: Math.floor(MAX_DAILY_DAYS / 7), test: Math.ceil(cfg.years * 52) };
  const per = Math.ceil(390 / Engine.TF[tf].min);
  return { avail: Math.floor(((MAX_INTRADAY_DAYS * 5) / 7) * per), test: Math.ceil(((cfg.idays * 5) / 7) * per) };
}

/** Old v1 saved risk ({stop:'8'|'none', tp, trail}) → exit-plan keys. */
function migrateRisk(risk) {
  const r = risk || {}, out = { stopM: "none", tpM: "none", trA: "never", be: "off", maxB: "none" };
  if (r.stop && r.stop !== "none") Object.assign(out, { stopM: "pct", stop: String(r.stop) });
  if (r.tp && r.tp !== "none") Object.assign(out, { tpM: "pct", tp: String(r.tp) });
  if (r.trail && r.trail !== "none") Object.assign(out, { trA: "entry", trD: String(r.trail) });
  return out;
}

export default class StrategyLab extends Component {
  libRef = React.createRef(); aiRef = React.createRef(); detRef = React.createRef(); resRef = React.createRef();
  refsObj = { aiRef: this.aiRef, libRef: this.libRef, detRef: this.detRef };
  state = { labSaved: [], labConds: {}, cfgs: {}, candles: {}, vals: {}, quotes: {}, sorts: {}, xpMore: {}, cmp: {}, vari: {}, libTab: "library", savedNote: "" };
  _bars = new Map(); _rows = new Map(); _rep = new Map(); _runTok = {}; _wk = undefined; _wq = new Map(); _wid = 0;

  // ── lifecycle ────────────────────────────────────────────────────────────
  componentDidMount() { this.loadSaved(); }
  componentWillUnmount() { clearTimeout(this.tt); if (this._wk) this._wk.terminate(); }
  scrollEl() { return typeof document !== "undefined" ? document.querySelector(".sl-main-scroll") : null; }
  scrollTo(el) { const c = this.scrollEl(); if (!c || !el) return; c.scrollTo({ top: el.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop - 90, behavior: "smooth" }); }
  scrollTop() { const c = this.scrollEl(); if (c) c.scrollTo(0, 0); }
  toastMsg(m) { clearTimeout(this.tt); this.setState({ toast: m }); this.tt = setTimeout(() => this.setState({ toast: null }), 2600); }

  // ── strategies ───────────────────────────────────────────────────────────
  strategies() {
    const st = this.state, S = [...CORE, ...LIB.filter((x) => !CORE.some((c) => c.k === x.k))].map((x) => ({ ...x, lib: true }));
    if (st.custom) S.unshift({ k: "custom", tf: "d", cond: st.custom.cond, fam: "Custom", name: st.custom.name || "Your strategy", hold: "—", src: st.custom.src || "Built from your description", what: st.custom.why || "", custom: true });
    for (const v of st.labSaved) S.push({ k: "sv_" + v.id, sv: v, tf: v.tf || "d", cond: v.cond, fam: "Saved", name: v.name, hold: v.hold || "—", src: "Saved " + (v.savedAt ? fmtDt(v.savedAt) : ""), what: v.why || (v.q ? "Built from: “" + v.q + "”" : ""), cfg: v.cfg });
    return S;
  }
  strategyOf(k) { return this.strategies().find((x) => x.k === k) || null; }
  specOf(k) { return this.state.labConds[k] || (this.strategyOf(k) || {}).cond || { entry: [], exit: [] }; }
  candleOpts(spec) { const ID = Engine.IND, ni = [...spec.entry, ...spec.exit].some(function f(c) { return c.any ? c.any.some(f) : [c.a, c.b].some((o) => o && ID[o.ind] && ID[o.ind].intraday); }); return ni ? INTRA_TF : ALL_TF; }
  tfOf(k) { const x = this.strategyOf(k) || {}, want = this.state.candles[k] || x.tf || "d", ok = this.candleOpts(this.specOf(k)); return ok.includes(want) ? want : ok.includes(x.tf) ? x.tf : ok[0]; }
  defaultCfg(x) { return x && x.cfg ? { ...x.cfg } : { ...riskToCfg((x && x.risk) || {}), cost: "5", yrs: "5" }; }
  cfgOf(k) { return this.state.cfgs[k] || this.defaultCfg(this.strategyOf(k)); }
  engCfg(k) { return valCfg(this.cfgOf(k), this.tfOf(k)); }
  setCfg(k, patch) { this.setState((s) => ({ cfgs: { ...s.cfgs, [k]: { ...(s.cfgs[k] || this.defaultCfg(this.strategyOf(k))), ...patch } } })); }
  needsOf(k) { return Engine.checkRules(this.specOf(k), this.tfOf(k)); }
  sigOf(k) { const tf = this.tfOf(k); return runSig(this.specOf(k), tf, valCfg(this.cfgOf(k), tf)); }
  blockedOf(k) {
    const n = this.needsOf(k);
    if (n.length) return "Needs " + n.join(", ") + " — not available in Strategy Lab, so it can't be backtested.";
    if (k === "custom" && this.state.custom && (this.state.custom.unparsed || []).length && !this.state.unparsedAck) return "Review the part that wasn't translated (edit the rules or dismiss it) before running.";
    return "";
  }

  // ── data ─────────────────────────────────────────────────────────────────
  async loadUniverse() {
    if (this._univ && Date.now() - this._univ.at < 6 * 3600e3) return this._univ.stocks;
    const r = await apiGet("/live/strategy-lab/universe");
    if (!r || !Array.isArray(r.stocks) || !r.stocks.length) throw new Error("The stock universe is unavailable.");
    this._univ = { at: Date.now(), stocks: r.stocks, source: r.source };
    return r.stocks;
  }
  barsKey(t, span) { return `${t}|${span.tf}|${span.days}|${span.tf === "d" ? etDayNow() : Math.floor(Date.now() / 300e3)}`; }
  cachedBars(t, span) { const k = this.barsKey(t, span); return this._bars.has(k) ? this._bars.get(k) : undefined; }
  async fetchBars(symbols, span) {
    const need = symbols.filter((t) => !this._bars.has(this.barsKey(t, span)));
    if (need.length) {
      const r = await apiGet(`/live/strategy-lab/bars?symbols=${encodeURIComponent(need.join(","))}&tf=${span.tf}&days=${span.days}`);
      for (const t of need) {
        const rows = r && r.bars && r.bars[t];
        this._bars.set(this.barsKey(t, span), rows && rows.length ? rows.map(([date, open, high, low, close, volume]) => ({ date, open, high, low, close, volume })) : null);
      }
    }
    return Object.fromEntries(symbols.map((t) => [t, this._bars.get(this.barsKey(t, span))]));
  }
  worker() {
    if (this._wk !== undefined) return this._wk;
    try {
      const w = new Worker(new URL("./lab-worker.js", import.meta.url), { type: "module" });
      w.onmessage = (e) => { const p = this._wq.get(e.data.id); if (p) { this._wq.delete(e.data.id); p.res(e.data.row); } };
      w.onerror = () => { this._wk = null; for (const [id, p] of this._wq) { this._wq.delete(id); p.res(computeRow(...p.args)); } };
      this._wk = w;
    } catch { this._wk = null; }
    return this._wk;
  }
  computeAsync(u, bars, spec, cfg, tf) {
    const args = [u.t, u.n, bars, spec, cfg, tf], w = this.worker();
    if (!w) return Promise.resolve(computeRow(...args));
    return new Promise((res) => { const id = ++this._wid; this._wq.set(id, { res, args }); w.postMessage({ id, t: u.t, n: u.n, bars, spec, cfg, tf }); });
  }

  /** Multi-stock run: every universe stock, same rules and engine config; progress as each finishes. */
  async runValidate(k) {
    const spec = copy(this.specOf(k)), tf = this.tfOf(k), cfg = this.engCfg(k), sig = runSig(spec, tf, cfg), tok = (this._runTok[k] = (this._runTok[k] || 0) + 1);
    const put = (p) => this.setState((s) => ({ vals: { ...s.vals, [k]: { ...(s.vals[k] || {}), ...p } } }));
    const blocked = this.blockedOf(k);
    if (blocked) { put({ err: blocked, busy: false, sig, tf, cfg }); return; }
    put({ busy: true, done: 0, total: 0, err: "", rows: [], fail: 0, insuf: 0, asOf: "", sig, tf, cfg, at: null });
    let univ;
    try { univ = await this.loadUniverse(); } catch (e) { put({ busy: false, err: "Can't load the stock universe: " + errMsg(e) }); return; }
    if (this._runTok[k] !== tok) return;
    put({ total: univ.length });
    const span = fetchSpan(spec, tf, cfg), B = Engine.isIntradayTf(tf) ? 4 : 10, q = [...univ], rows = [];
    let fail = 0, insuf = 0, asOf = "", lastErr = "";
    const work = async () => {
      while (q.length) {
        const chunk = q.splice(0, B);
        let data = {};
        try { data = await this.fetchBars(chunk.map((u) => u.t), span); } catch (e) { lastErr = errMsg(e); }
        await Promise.all(chunk.map(async (u) => {
          const raw = data[u.t], bars = raw ? prepBars(raw, tf) : null;
          let row;
          if (!bars || !bars.length) row = { t: u.t, n: u.n, status: "unavailable" };
          else {
            const L = bars[bars.length - 1], ck = `${u.t}|${sig}|${L.date}|${L.close}`;
            row = this._rows.get(ck) || (await this.computeAsync(u, bars, spec, cfg, tf));
            this._rows.set(ck, row);
          }
          if (this._runTok[k] !== tok) return;
          if (row.status === "unavailable") fail++; else if (row.status === "insufficient") insuf++; else rows.push(row);
          if (row.asOf && row.asOf > asOf) asOf = row.asOf;
          this.setState((s) => ({ vals: { ...s.vals, [k]: { ...(s.vals[k] || {}), done: ((s.vals[k] || {}).done || 0) + 1 } } }));
        }));
      }
    };
    await Promise.all([work(), work(), work(), work()]);
    if (this._runTok[k] !== tok) return;
    if (!rows.length && fail === univ.length) { put({ busy: false, err: "Price data unavailable" + (lastErr ? ": " + lastErr : "") + ". No results were computed.", rows: [], fail, insuf }); return; }
    put({ busy: false, rows, fail, insuf, asOf, at: Date.now(), total: univ.length, err: lastErr && fail ? "Some stocks couldn't be loaded: " + lastErr : "" });
    this.loadQuotes(rows.map((r) => r.t));
  }
  async loadQuotes(tickers) {
    if (!tickers.length) return;
    try {
      const r = await apiGet("/live/snapshot?tickers=" + encodeURIComponent(tickers.slice(0, 250).join(",")));
      const q = {};
      for (const x of (r && r.quotes) || []) if (x && x.ticker && Number.isFinite(x.price) && x.price > 0) q[x.ticker] = x.price;
      this.setState((s) => ({ quotes: { ...s.quotes, ...q } }));
    } catch { /* no live quote → the column shows "—" */ }
  }

  // ── saved strategies ─────────────────────────────────────────────────────
  readCache() { try { const v = JSON.parse(localStorage.getItem(SAVED_CACHE) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
  writeCache(arr) { try { localStorage.setItem(SAVED_CACHE, JSON.stringify(arr)); } catch { /* offline cache only */ } }
  async loadSaved() {
    try {
      const r = await apiGet("/live/strategy-lab/saved");
      let arr = (r && r.strategies) || [];
      arr = await this.migrateOld(arr);
      this.writeCache(arr);
      this.setState({ labSaved: arr, savedNote: "" });
    } catch (e) {
      const cached = this.readCache();
      const note = "Saved strategies couldn't be loaded from your account (" + errMsg(e) + ")" + (cached.length ? " — showing the copy on this device." : ".");
      this.setState({ labSaved: cached, savedNote: note });
      this.toastMsg(note);
    }
  }
  async migrateOld(arr) {
    let old = [];
    try { if (localStorage.getItem(MIGRATED)) return arr; old = JSON.parse(localStorage.getItem(OLD_SAVED) || "[]"); } catch { return arr; }
    if (!Array.isArray(old) || !old.length) { try { localStorage.setItem(MIGRATED, "1"); } catch { /* ignore */ } return arr; }
    const have = new Set(arr.map((x) => x.id)), out = [...arr];
    for (const v of old) {
      if (!v || !v.cond || have.has(v.id)) continue;
      const id = /^[a-z0-9]{4,24}$/.test(String(v.id)) ? v.id : newId(), tf = v.tf || "d";
      const doc = { name: v.name || "Saved strategy", tf, cond: v.cond, cfg: savedCfgOf({ ...migrateRisk(v.risk), cost: "5", yrs: "5" }, tf), hold: v.hold || "", q: v.q || "", why: v.why || "" };
      try { out.unshift(await apiPost("/live/strategy-lab/saved/" + id, doc)); } catch { return arr; }
    }
    try { localStorage.setItem(MIGRATED, "1"); } catch { /* ignore */ }
    return out;
  }
  async persist(id, doc) {
    const saved = await apiPost("/live/strategy-lab/saved/" + id, doc);
    const arr = [saved, ...this.state.labSaved.filter((x) => x.id !== id)];
    this.writeCache(arr);
    this.setState({ labSaved: arr });
    return saved;
  }
  docOf(k, name) {
    const x = this.strategyOf(k) || {}, tf = this.tfOf(k), c = this.state.custom || {};
    return { name: (name || x.name || "Your strategy").slice(0, 80), tf, cond: copy(this.specOf(k)), cfg: savedCfgOf(this.cfgOf(k), tf), hold: (x.sv && x.sv.hold) || "", q: (x.sv && x.sv.q) || (k === "custom" ? c.q || "" : ""), why: (x.sv && x.sv.why) || (k === "custom" ? c.why || "" : "") };
  }
  async saveStrategy() {
    const st = this.state;
    if (!st.custom) { this.toastMsg("Build a strategy first"); return; }
    const id = st.customSvId || newId(), upd = !!st.customSvId;
    try {
      await this.persist(id, this.docOf("custom", st.custom.name));
      this.setState({ customSvId: id });
      this.toastMsg((upd ? "Updated “" : "Saved “") + (st.custom.name || "Your strategy") + "” — find it under Saved");
    } catch (e) { this.toastMsg("Couldn't save: " + errMsg(e)); }
  }
  async saveExisting(k) {
    const x = this.strategyOf(k);
    if (!x || !x.sv) return;
    try { await this.persist(x.sv.id, this.docOf(k, x.name)); this.toastMsg("Updated “" + x.name + "”"); } catch (e) { this.toastMsg("Couldn't save: " + errMsg(e)); }
  }
  async setHold(k, hold) {
    const x = this.strategyOf(k);
    if (!x || !x.sv) return;
    try { await this.persist(x.sv.id, { ...this.docOf(k, x.name), hold }); } catch (e) { this.toastMsg("Couldn't save: " + errMsg(e)); }
  }
  async delStrategy(k) {
    const x = this.strategyOf(k);
    if (!x || !x.sv) return;
    try {
      await apiDelete("/live/strategy-lab/saved/" + x.sv.id);
      const arr = this.state.labSaved.filter((v) => v.id !== x.sv.id);
      this.writeCache(arr);
      try { const a = JSON.parse(localStorage.getItem(AUTO_KEY) || "{}"); delete a[x.sv.id]; delete a[k]; localStorage.setItem(AUTO_KEY, JSON.stringify(a)); } catch { /* ignore */ }
      this.setState((s) => {
        const drop = (o) => { const n = { ...o }; delete n[k]; return n; };
        return { labSaved: arr, labPick: null, vals: drop(s.vals), cfgs: drop(s.cfgs), labConds: drop(s.labConds), candles: drop(s.candles), customSvId: s.customSvId === x.sv.id ? null : s.customSvId, rep: s.rep && s.rep.k === k ? null : s.rep };
      });
      this.toastMsg("Deleted “" + x.name + "”");
    } catch (e) { this.toastMsg("Couldn't delete: " + errMsg(e)); }
  }

  // ── strategy text → rules ────────────────────────────────────────────────
  async aiRun(q) {
    q = (q || "").trim();
    if (!q) { this.toastMsg("Describe a strategy first"); return; }
    const BT = Engine, IND = BT.IND;
    this.setState({ ai: { q, loading: true } });
    setTimeout(() => this.scrollTo(this.aiRef.current), 80);
    let spec = null, src = "Rule parser", why = "", risk = {}, unparsed = [];
    try {
      const res = await apiPost("/live/strategy-lab/ai-rules", { q });
      const raw = res && res.raw;
      if (raw) {
        const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
        const ok = (o) => o && IND[o.ind] && (o.ind !== "num" || Number.isFinite(+o.v));
        const one = (c) => (c && ok(c.a) && ok(c.b) && BT.OPS.includes(c.op) ? { a: c.a, op: c.op, b: c.b } : null);
        const cl = (a) => (a || []).map((c) => { if (c && Array.isArray(c.any)) { const s = c.any.map(one).filter(Boolean); return s.length > 1 ? { any: s } : s[0] || null; } return one(c); }).filter(Boolean);
        spec = { entry: cl(j.entry), exit: cl(j.exit), name: j.name, tf: BT.TF[j.timeframe] ? j.timeframe : null };
        why = j.why || "";
        risk = { stop: j.stop ?? null, tp: j.tp ?? null, trail: j.trail ?? null };
        src = "AI → rule engine";
        if (!spec.entry.length) spec = null;
      }
    } catch { spec = null; }
    if (!spec) {
      const r = BT.parseRules(q);
      if (!r.entry.length) { this.setState({ ai: { q, err: "Couldn't turn that into an entry rule. Try “buy when RSI(2) is below 10 and close is above the 200-day SMA”." + (r.unparsed.length ? " Not translated: " + r.unparsed.join(" · ") : "") } }); return; }
      spec = { entry: r.entry, exit: r.exit, name: null };
      unparsed = r.unparsed;
      risk = r.risk || {};
    }
    const p = BT.parseTimeframe(q), tf = p !== "d" ? p : spec.tf || "d";
    this.setState((s) => {
      const drop = (o) => { const n = { ...o }; delete n.custom; return n; };
      return {
        custom: { cond: { entry: spec.entry, exit: spec.exit }, name: spec.name || "Your strategy", q, why, src, unparsed },
        unparsedAck: false, customSvId: null, labConds: drop(s.labConds), vals: drop(s.vals),
        cfgs: { ...s.cfgs, custom: { ...riskToCfg(risk), cost: "5", yrs: "5" } }, candles: { ...s.candles, custom: tf },
        ai: { q, src, name: spec.name || "Your strategy", why },
      };
    }, () => { if (!this.blockedOf("custom")) this.runValidate("custom"); });
  }

  // ── view-model pieces ────────────────────────────────────────────────────
  riskRows(k) {
    const K = exitPlanKeys(this.cfgOf(k)), hasStop = K.stopM !== "none", S = (p) => this.setCfg(k, p), more = !!this.state.xpMore[k];
    const seg = (cur, opts, dis) => ({ opts: opts.map(([key, l, p]) => { const off = !!(dis && dis(key)); return { l, on: cur === key, off, offT: "Needs a stop", onClick: () => S(p) }; }) });
    const withCur = (opts, cur, l) => (opts.some((o) => o[0] === cur) ? opts : [...opts, [cur, l, {}]]);
    const sK = K.stopM === "none" ? "none" : K.stopM === "atr" ? "a" + K.stopA : "p" + K.stop;
    const tK = K.tpM === "none" ? "none" : K.tpM === "r" ? "r" + K.tpR : "p" + K.tp;
    const R = [
      { t: "Stop", segs: [seg(sK, withCur([["p5", "5%", { stopM: "pct", stop: "5" }], ["p8", "8%", { stopM: "pct", stop: "8" }], ["p12", "12%", { stopM: "pct", stop: "12" }], ["a2", "2× ATR", { stopM: "atr", stopA: "2" }], ["none", "None", { stopM: "none" }]], sK, K.stopM === "atr" ? K.stopA + "× ATR" : K.stop + "%"))] },
      { t: "Target", segs: [seg(tK, withCur([["p10", "+10%", { tpM: "pct", tp: "10" }], ["p20", "+20%", { tpM: "pct", tp: "20" }], ["r2", "2R", { tpM: "r", tpR: "2" }], ["none", "None", { tpM: "none" }]], tK, K.tpM === "r" ? K.tpR + "R" : "+" + K.tp + "%"), (x) => x[0] === "r" && !hasStop)] },
      { t: "Trail", segs: [seg(K.trA, withCur([["never", "Off", { trA: "never" }], ["entry", "From entry", { trA: "entry" }], ["10", "Once up +10%", { trA: "10" }], ["1r", "Once up 1R", { trA: "1r" }]], K.trA, "Once up +" + K.trA + "%"), (x) => x === "1r" && !hasStop)].concat(K.trA !== "never" ? [seg(K.trD, withCur([["5", "5%", { trD: "5" }], ["8", "8%", { trD: "8" }], ["atr2", "2× ATR", { trD: "atr2" }]], K.trD, K.trD + "%"))] : []) },
    ];
    if (more || K.be === "on" || K.maxB !== "none") R.push(
      { t: "Breakeven", segs: [seg(K.be, [["off", "Off", { be: "off" }], ["on", "At +1R", { be: "on" }]], (x) => x === "on" && !hasStop)], note: hasStop ? "" : "Needs a stop" },
      { t: "Max hold", segs: [seg(K.maxB, withCur([["none", "None", { maxB: "none" }], ["10", "10 bars", { maxB: "10" }], ["20", "20 bars", { maxB: "20" }], ["40", "40 bars", { maxB: "40" }]], K.maxB, K.maxB + " bars"))] },
    );
    return { riskRows: R, riskSum: exitPlanSummary(this.cfgOf(k)), more: { l: more || K.be === "on" || K.maxB !== "none" ? "Fewer options" : "More options", onClick: () => this.setState((s) => ({ xpMore: { ...s.xpMore, [k]: !more } })) } };
  }
  facts(k) {
    const x = this.strategyOf(k);
    if (!x) return null;
    const spec = this.specOf(k), tf = this.tfOf(k), cfg = this.cfgOf(k), opts = this.candleOpts(spec), BT = Engine;
    const ni = opts === INTRA_TF, p = periodOf(cfg, tf), needs = this.needsOf(k);
    const custom = k === "custom" && this.state.custom, un = custom && (custom.unparsed || []).length && !this.state.unparsedAck ? "Not translated: " + custom.unparsed.join(" · ") : "";
    return {
      entry: spec.entry.map(BT.label).join("  AND  ") || "—",
      exit: spec.exit.map(BT.label).join("  OR  ") || "Exit plan only (stop / target / trail / max hold)",
      ...this.riskRows(k),
      costOpts: COST_OPTS.map((c) => ({ l: c + " bps", on: String(cfg.cost ?? "5") === c, onClick: () => this.setCfg(k, { cost: c }) })),
      candleOpts: ALL_TF.map((t) => ({ l: tfL(t), on: t === tf, off: !opts.includes(t), offT: "These rules use session levels — intraday candles only", onClick: () => this.setState((s) => ({ candles: { ...s.candles, [k]: t } })) })),
      candleNote: ni ? "Uses session levels (VWAP, opening range, prior day) — intraday candles only" : "",
      periodOpts: p.years != null ? YEAR_OPTS.map((y) => ({ l: y + "Y", on: String(p.years) === y, onClick: () => this.setCfg(k, { yrs: y }) })) : (IPER[tf] || []).map((d) => ({ l: periodLabel({ days: d }), on: p.days === d, onClick: () => this.setCfg(k, { ["idays_" + tf]: String(d) }) })),
      src: x.custom ? "" : x.src,
      needs: needs.length ? "Needs " + needs.join(", ") + " — not available in Strategy Lab, so Run is disabled." : "",
      unparsed: un, onDismiss: un ? () => this.setState({ unparsedAck: true }) : null, onEdit: un ? () => this.openEdit(k) : null,
    };
  }
  resultsVm(k, show) {
    if (!show) return { show: false };
    const st = this.state, v = st.vals[k] || {}, sig = this.sigOf(k), blocked = this.blockedOf(k), fresh = !!(v.at && v.sig === sig);
    const rows = v.rows || [], S = summarize(rows), annual = S.annual, sort = st.sorts[k] || { key: "sig", desc: true };
    const isI = Engine.isIntradayTf(v.tf || this.tfOf(k));
    const sorted = sortRows(rows.map((r) => ({ ...r, px: st.quotes[r.t] })), sort.key, sort.desc, annual);
    const setSort = (key) => this.setState((s) => { const cur = s.sorts[k] || { key: "sig", desc: true }; return { sorts: { ...s.sorts, [k]: { key, desc: cur.key === key ? !cur.desc : key !== "t" } } }; });
    const col = (l, key, al, title) => ({ l, key, al, title, on: sort.key === key, desc: sort.desc, onClick: () => setSort(key) });
    const pctRow = (a) => (a == null ? "n/a" : p1(a));
    return {
      show: true,
      head: v.busy ? "Backtesting " + (v.total || "…") + " stocks…" : v.at ? S.tested + " stocks tested · " + rows.filter((r) => r.ago === 0).length + " triggered on the last bar" : "",
      run: { l: v.busy ? "Running…" : v.at ? "Re-run backtest" : "Run backtest →", primary: !fresh, disabled: !!v.busy || !!blocked, title: blocked, onClick: () => this.runValidate(k) },
      busy: !!v.busy, progressT: "Tested " + (v.done || 0) + " / " + (v.total || "…") + " stocks", progressPct: v.total ? Math.round((100 * (v.done || 0)) / v.total) + "%" : "0%",
      err: v.err || (!v.at && !v.busy ? blocked : "") || "",
      stale: !!(v.at && !v.busy && v.sig !== sig), onRerun: () => this.runValidate(k),
      idle: !v.at && !v.busy && !v.err && !blocked, idleT: "Run the backtest to test these rules on the 50 largest S&P 500 stocks, with the settings above.",
      meta: v.at ? `${tfL(v.tf)} · ${periodLabel(periodOfCfg(v.cfg))} · as of ${v.asOf ? fmtDt(v.asOf) : "—"} · ${v.fail || 0} unavailable · ${v.insuf || 0} insufficient history` : "",
      sum: v.at ? [
        ["TESTED", S.tested + " / " + (v.total || S.tested)], ["PROFITABLE", S.profitable + " / " + S.tested, S.profitable > S.tested / 2 ? "#3ddc84" : null], ["BEAT B&H", S.beat + " / " + S.tested],
        [annual ? "MEDIAN CAGR" : "MEDIAN RETURN", pctRow(S.medRet), sc(S.medRet)], ["MEDIAN SHARPE", fx(S.medSharpe), sc(S.medSharpe)], ["MEDIAN MAX DD", pctRow(S.medDd), "#f0565a"],
        ["WIN RATE", S.win == null ? "—" : Math.round(S.win * 100) + "%"], ["TRADES", String(S.trades)],
      ].map(([kk, vv, c]) => ({ k: kk, v: vv, c })) : [],
      cols: [col("Signal", "sig", "left", "Triggered on the last bar, N bars ago, setting up (one condition away or within 3%), or none"), col("Stock", "t", "left"), col("Price", "px", "right", "Live quote"), col(annual ? "CAGR" : "Return", "ret"), col(annual ? "B&H CAGR" : "B&H return", "bret"), col("Excess", "ex"), col("Sharpe", "sh"), col("Max DD", "dd"), col("Win %", "win"), col("Trades", "tr")],
      rows: v.at ? sorted.map((r) => {
        const ret = annual ? r.cagr : r.tot, bret = annual ? r.bcagr : r.btot, ex = ret - bret;
        const sigT = r.ago === 0 ? (isI ? "This bar" : "Today") : r.ago != null ? r.ago + (r.ago === 1 ? " bar ago" : " bars ago") : r.sig === "setup" ? "Setting up" : "—";
        return { t: r.t, n: r.n, logo: LOGO(r.t), sig: sigT, sigC: r.ago != null ? "#3ddc84" : r.sig === "setup" ? "#f08a4b" : "#5f6966", sigBd: r.ago != null ? "#1f4a33" : r.sig === "setup" ? "#6b3a1c" : "#233038",
          px: r.px ? r.px.toFixed(2) : "—", ret: p1(ret), retC: sc(ret), bret: p1(bret), ex: p1(ex), exC: sc(ex), sh: fx(r.sh), dd: p1(r.dd), win: r.closed ? Math.round(r.win * 100) + "%" : "—", tr: String(r.trades),
          onClick: () => this.openReport(k, r.t, r.n) };
      }) : [],
    };
  }
  openReport(k, t, n) { this.setState({ rep: { k, t, n } }); this.scrollTop(); }

  ruleRows(k, side) {
    const st = this.state, spec = this.specOf(k), arr = spec[side], IND = Engine.IND, tf = this.tfOf(k), cfg = valCfg(this.cfgOf(k), tf);
    const bud = barBudget(tf, cfg), maxN = Math.max(2, bud.avail - bud.test - 40);
    const setC = (p) => this.setState((s) => ({ labConds: { ...s.labConds, [k]: { ...this.specOf(k), ...p } } }));
    const indOpts = Object.entries(IND).filter(([v]) => v !== "emergence").map(([v, d]) => ({ v, l: d.l + (d.data ? " — needs data" : d.intraday ? " — intraday" : "") }));
    const fresh = (ind) => (ind === "num" ? { ind, v: 0 } : IND[ind] && IND[ind].n ? { ind, n: IND[ind].n } : { ind });
    const nv = (e) => { const v = parseFloat(e.target.value); return Number.isNaN(v) ? 0 : v; };
    const NEWC = () => ({ a: { ind: "close" }, op: ">", b: { ind: "sma", n: 50 } });
    let tip = 0;
    const tipOf = (id, txt) => ({ open: st.indTip === id, txt, on: () => this.setState({ indTip: id }), off: () => { if (this.state.indTip === id) this.setState({ indTip: null }); } });
    const sideOf = (o, set, id) => {
      const d = IND[o.ind] || {}, isL = o.ind === "hh" || o.ind === "ll", n = o.n ?? d.n;
      const lookOpts = LOOK.map(([v, l]) => ({ v, l })); if (isL && !LOOK.some(([v]) => +v === n)) lookOpts.push({ v: String(n), l: n + " bars" });
      const onN = (e) => { const raw = Math.max(1, Math.round(nv(e))); set({ ...o, n: Math.min(raw, maxN) }); if (raw > maxN) this.toastMsg("Capped at " + maxN + " — the most bars available before a " + periodLabel(periodOfCfg(cfg)) + " " + tfL(tf) + " test window."); };
      return { ind: o.ind, onInd: (e) => set(fresh(e.target.value)), tip: tipOf(id, (d.l || o.ind) + " — " + (IDESC[o.ind] || "")), look: isL, lookOpts, n: n == null ? "" : String(n), onN, hasN: !!d.n && !isL, isNum: o.ind === "num", v: o.v ?? "", onV: (e) => set({ ...o, v: nv(e) }), hasMult: o.ind !== "num" && o.ind !== "bars", mult: o.mult ?? 1, onMult: (e) => set({ ...o, mult: nv(e) || 1 }) };
    };
    const condObj = (c, up, del, join, onOr) => {
      const id = ++tip, big = [c.a, c.b].some((o) => (o.n ?? 0) > maxN);
      return { join, indOpts, opOpts: Engine.OPS, op: c.op, onOp: (e) => up({ ...c, op: e.target.value }), oTip: tipOf(id + "o", c.op + " — " + (ODESC[c.op] || "")), maxN,
        a: sideOf(c.a, (a) => up({ ...c, a }), id + "a"), b: sideOf(c.b, (b) => up({ ...c, b }), id + "b"),
        warn: !!((IND[c.a.ind] || {}).data || (IND[c.b.ind] || {}).data), capMsg: big ? "Period above " + maxN + " — more than the bars available for this candle and period" : "", onDel: del, onOr };
    };
    return arr.map((c, i) => {
      const setI = (v) => setC({ [side]: arr.map((x, y) => (y === i ? v : x)) }), delI = () => setC({ [side]: arr.filter((_, y) => y !== i) }), join = i ? (side === "entry" ? "AND" : "OR") : "IF";
      if (c.any) return { group: true, join, subs: c.any.map((s, j) => condObj(s, (f) => setI({ any: c.any.map((x, y) => (y === j ? f : x)) }), () => { const rest = c.any.filter((_, y) => y !== j); setI(rest.length === 1 ? rest[0] : { any: rest }); }, j ? "OR" : "EITHER", null)), onAddOr: () => setI({ any: [...c.any, NEWC()] }), onDelGroup: delI };
      return condObj(c, setI, delI, join, () => setI({ any: [c, NEWC()] }));
    });
  }
  openEdit(k) {
    const st = this.state, x = this.strategyOf(k);
    if (!x) return;
    this.setState({ edit: { k, bk: { cond: st.labConds[k] ? copy(st.labConds[k]) : null, cfg: st.cfgs[k] ? { ...st.cfgs[k] } : null, tf: st.candles[k] || null, name: x.custom ? (st.custom || {}).name : x.sv ? x.sv.name : null }, name: x.name } });
  }
  closeEdit(mode) {
    const st = this.state, e = st.edit;
    if (!e) return;
    const k = e.k, x = this.strategyOf(k);
    if (mode === "cancel") {
      const put = (o, v) => { const n = { ...o }; if (v == null) delete n[k]; else n[k] = v; return n; };
      this.setState((s) => ({ edit: null, labConds: put(s.labConds, e.bk.cond), cfgs: put(s.cfgs, e.bk.cfg), candles: put(s.candles, e.bk.tf) }));
      return;
    }
    if (!this.specOf(k).entry.length) { this.toastMsg("Add at least one entry condition"); return; }
    const name = (e.name || "").trim() || (x && x.name) || "Your strategy";
    if (k === "custom") this.setState((s) => ({ custom: { ...s.custom, name }, unparsedAck: true }));
    this.setState({ edit: null });
    const after = () => { if (mode === "run") this.runValidate(k); };
    if (x && x.sv) {
      this.persist(x.sv.id, this.docOf(k, name)).then(() => { this.toastMsg("Updated “" + name + "”"); after(); }).catch((err) => this.toastMsg("Couldn't save: " + errMsg(err)));
    } else this.setState({}, after);
  }
  editVm() {
    const st = this.state, e = st.edit;
    if (!e) return { open: false };
    const k = e.k, x = this.strategyOf(k) || {}, f = this.facts(k) || {}, needs = this.needsOf(k);
    const NEW = { entry: { a: { ind: "close" }, op: ">", b: { ind: "sma", n: 50 } }, exit: { a: { ind: "bars" }, op: "≥", b: { ind: "num", v: 20 } } };
    const add = (side) => () => this.setState((s) => ({ labConds: { ...s.labConds, [k]: { ...this.specOf(k), [side]: [...this.specOf(k)[side], NEW[side]] } } }));
    return {
      open: true, title: x.name, nameEditable: !!(x.custom || x.sv), name: e.name, onName: (ev) => this.setState({ edit: { ...e, name: ev.target.value } }),
      entry: this.ruleRows(k, "entry"), exit: this.ruleRows(k, "exit"), addEntry: add("entry"), addExit: add("exit"),
      riskRows: f.riskRows, riskSum: f.riskSum, more: f.more, costOpts: f.costOpts, candleOpts: f.candleOpts, periodOpts: f.periodOpts,
      needs: needs.length ? "Needs " + needs.join(", ") + " — can't be backtested." : "",
      reset: x.lib && st.labConds[k] ? () => this.setState((s) => { const n = { ...s.labConds }; delete n[k]; return { labConds: n }; }) : null,
      cancel: () => this.closeEdit("cancel"), close: () => this.closeEdit("done"), done: () => this.closeEdit("done"), run: () => this.closeEdit("run"),
      doneL: x.sv ? "Save changes" : "Done", runL: x.sv ? "Save & run backtest" : "Done & run backtest", runDisabled: !!needs.length,
    };
  }

  /** Single-stock report: the same bars and engine config as the stock's results row. */
  reportVm() {
    const st = this.state, rp = st.rep;
    if (!rp) return { show: false };
    const BT = Engine, k = rp.k, t = rp.t, x = this.strategyOf(k) || { name: k }, spec = this.specOf(k), tf = this.tfOf(k), cfg = this.engCfg(k), sig = runSig(spec, tf, cfg), span = fetchSpan(spec, tf, cfg), period = periodOfCfg(cfg);
    const base = {
      show: true, t, title: x.name + " · " + t, sub: (rp.n ? rp.n + " · " : "") + "Long-only · " + tfL(tf) + " candles · " + periodLabel(period) + " · " + exitPlanSummary(this.cfgOf(k)) + " · costs " + cfg.costBps + " bps",
      onEdit: () => this.openEdit(k), onMatches: () => this.showMatches(k),
      settings: [["Entry", spec.entry.map(BT.label).join(" AND ") || "—"], ["Exit", spec.exit.map(BT.label).join(" OR ") || "exit plan only"]],
    };
    const raw = this.cachedBars(t, span);
    if (raw === undefined) {
      if (this._repLoading !== t + span.days) { this._repLoading = t + span.days; this.fetchBars([t], span).then(() => this.forceUpdate(), (e) => { this._repErr = errMsg(e); this.forceUpdate(); }).finally(() => { this._repLoading = null; }); }
      return { ...base, busy: this._repErr ? "" : "Loading " + t + " " + tfL(tf).toLowerCase() + " bars…", err: this._repErr || "" };
    }
    this._repErr = null;
    if (raw === null) return { ...base, err: "No " + tfL(tf).toLowerCase() + " bars for " + t + " from the data provider." };
    const needs = BT.checkRules(spec, tf);
    if (needs.length) return { ...base, err: "These rules need " + needs.join(", ") + "." };
    const bars = prepBars(raw, tf), L = bars[bars.length - 1], key = `${t}|${sig}|${L.date}|${L.close}`;
    let R = this._rep.get(key);
    if (!R) { const ec = engineCfg(cfg, bars); R = { r: BT.runRules(bars, spec, ec), bars, ec }; this._rep.set(key, R); }
    const r = R.r;
    if (!r) { const hc = BT.historyCheck(bars, spec, R.ec); return { ...base, err: `Not enough ${tfL(tf).toLowerCase()} history for ${t}: the rules need ${hc.warm} bars before the window and at least ${BT.MIN_TEST_BARS} in it (have ${hc.start} before, ${hc.testBars} in).` }; }
    const ev = BT.buildEvidence(r, { symbol: t, strategy: k, spec, cfg, bars, tf, period });
    const ST = { supported: ["#3ddc84", "#1f4a33", "SUPPORTED"], contradicted: ["#f0565a", "#5a2224", "CONTRADICTED"], unknown: ["#8b9592", "#2a3236", "UNKNOWN"] };
    const ds = (a) => { const step = Math.max(1, Math.floor(a.length / 300)); return a.filter((_, i) => i % step === 0 || i === a.length - 1); };
    const es = ds(r.eq).map((q) => q.v), eb = ds(r.bh).map((q) => q.v), nn = Math.max(es.length - 1, 1), mx = Math.max(...es, ...eb), mn = Math.min(...es, ...eb);
    const X = (i) => (i * 600) / nn, Y = (v) => 190 - ((v - mn) / (mx - mn || 1)) * 175, line = (a) => a.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
    const m = r.m, mb = r.mb;
    const metrics = [
      ["CAGR", m.cagr == null ? "n/a" : p1(m.cagr), m.cagr == null ? "Under a year — see total return" : "Buy & hold " + p1(mb.cagr)], ["TOTAL RETURN", p1(m.tot), "Buy & hold " + p1(mb.tot), sc(m.tot)],
      ["SHARPE", fx(m.sharpe), "Buy & hold " + fx(mb.sharpe) + (tf === "1w" ? " · ×√52" : " · ×√252")], ["SORTINO", fx(m.sortino), "Downside-only risk"], ["MAX DRAWDOWN", p1(m.dd), "Buy & hold " + p1(mb.dd), "#f0565a"],
      ["WIN RATE", m.trades ? Math.round(m.win * 100) + "%" : "—", "Of closed trades"], ["PROFIT FACTOR", Number.isFinite(m.pf) ? m.pf.toFixed(2) : "∞", "Gross win ÷ gross loss"], ["REWARD:RISK", m.rr === 0 ? "—" : fx(m.rr), "Avg win ÷ avg loss"],
      ["TRADES", String(m.trades), "Avg hold " + Math.round(m.hold) + " bars"], ["EXPOSURE", Math.round(m.exposure * 100) + "%", "Bars in a position"],
    ].map(([l, v, s, c]) => ({ l, v, s, c }));
    // Price chart over the test window only, so its buy & hold matches the report.
    const tb = bars.slice(r.start), step = Math.max(1, Math.ceil(tb.length / 1200)), pts = tb.filter((_, i) => i % step === 0 || i === tb.length - 1);
    const N = pts.length, cs = pts.map((q) => q.close), lo = Math.min(...tb.map((q) => q.low)), hi = Math.max(...tb.map((q) => q.high)), pad = (hi - lo) * 0.06 || 1, LL = lo - pad, HH = hi + pad;
    const CX = (i) => (i / Math.max(N - 1, 1)) * 1000, CY = (c) => (1 - (c - LL) / (HH - LL)) * 300, idx = new Map(tb.map((q, i) => [String(q.date), i])), atr = cfg.stopAtr ? BT.series(bars, { ind: "atr", n: 14 }) : null;
    const xi = (d) => { const i = idx.get(String(d)); return i == null ? null : CX(i / step); };
    const levels = [], bands = [];
    for (const tr of r.trades) {
      const a = xi(tr.inDate), b = xi(tr.outDate);
      if (a == null || b == null) continue;
      const win = tr.ret > 0, w = Math.max(2, b - a);
      bands.push({ x: a.toFixed(1), w: w.toFixed(1), fill: win ? "rgba(61,220,132,.14)" : "rgba(240,86,90,.14)", stroke: win ? "rgba(61,220,132,.45)" : "rgba(240,86,90,.45)" });
      const ei = bars.findIndex((q) => String(q.date) === String(tr.inDate)), A = atr && ei > 0 ? atr[ei - 1] : null;
      const sl = cfg.stopAtr && A ? tr.inPx - cfg.stopAtr * A : cfg.stop ? tr.inPx * (1 - cfg.stop) : null, risk = sl ? tr.inPx - sl : null;
      const tp = cfg.tpR && risk ? tr.inPx + cfg.tpR * risk : cfg.tp ? tr.inPx * (1 + cfg.tp) : null;
      if (sl) levels.push({ x1: a, x2: a + w, y: CY(sl), c: "rgba(240,86,90,.8)" });
      if (tp) levels.push({ x1: a, x2: a + w, y: CY(tp), c: "rgba(61,220,132,.8)" });
    }
    const cline = "M" + cs.map((c, i) => CX(i).toFixed(1) + "," + CY(c).toFixed(1)).join("L");
    const vari = st.vari[key] ? this.varianceCells(k, bars, spec) : null;
    return {
      ...base, has: true,
      meta: tfL(tf) + " · " + periodLabel(period) + " · " + fmtDt(r.eq[0].date) + " – " + fmtDt(r.eq[r.eq.length - 1].date) + " · as of " + fmtDt(L.date) + " · warm-up " + r.warm + " bars before the window",
      metrics,
      growth: { lineS: line(es), lineB: line(eb), areaS: line(es) + " L600,200 L0,200 Z", endS: money(es[es.length - 1]), endB: money(eb[eb.length - 1]), bench: t + " buy & hold", axis: [...new Set(r.eq.map((q) => String(q.date).slice(0, 4)))] },
      chart: { sub: tfL(tf) + " candles · " + fmtDt(tb[0].date) + " – " + fmtDt(L.date) + " · test window only", trades: bands, levels, line: cline, area: cline + "L1000,300L0,300Z", hi: hi.toFixed(2), lo: lo.toFixed(2), d0: fmtDt(tb[0].date), d1: fmtDt(L.date), legend: "bands = trades (green win, red loss) · dashed = stop / target from the exit plan" },
      years: { title: "Year by year", note: "* partial year", rows: m.yr.map((o, i) => { const b = mb.yr[i] ? mb.yr[i].r : 0; return { y: o.y + (i === 0 || i === m.yr.length - 1 ? "*" : ""), s: p1(o.r), sc: sc(o.r), b: p1(b), bc: sc(b), e: p1(o.r - b), ec: sc(o.r - b) }; }) },
      trades: { cnt: (r.trades.length > 200 ? "Latest 200 of " : "") + r.trades.length + (r.trades.length === 1 ? " trade" : " trades"), rows: r.trades.slice().reverse().slice(0, 200).map((q) => ({ inD: fmtDt(q.inDate), inP: "$" + q.inPx.toFixed(2), outD: q.why === "Still open" ? "Open" : fmtDt(q.outDate), outP: "$" + q.outPx.toFixed(2), r: p1(q.ret), rc: sc(q.ret), d: String(q.days), why: q.why })) },
      vari: { run: () => this.setState((s) => ({ vari: { ...s.vari, [key]: true } })), head: vari ? vari.head : [], rows: vari ? vari.rows : null },
      cmp: this.compareVm(k, t, tf, cfg, key),
      ev: {
        summary: `${ev.summary.supported} supported · ${ev.summary.contradicted} contradicted · ${ev.summary.unknown} unknown`, id: ev.evidence_id, cov: ev.coverage.status, covC: ev.coverage.status === "complete" ? "#3ddc84" : "#f08a4b",
        covD: `${ev.coverage.bars} bars · ${ev.coverage.from} → ${ev.coverage.to} · span ${ev.coverage.span_days} of ${ev.coverage.requested_days} days · max gap ${ev.coverage.max_calendar_gap_days}d` + (ev.coverage.missing_sessions ? ` · ${ev.coverage.missing_sessions} missing sessions` : ""),
        claims: ev.claims.map((c) => ({ text: c.text, ev: c.reason ? c.evidence + " · " + c.reason : c.evidence, status: ST[c.status][2], col: ST[c.status][0], bd: ST[c.status][1] })),
        lims: ev.limitations, unk: ev.unknowns,
        onExport: () => { const b = new Blob([JSON.stringify(ev, null, 2)], { type: "application/json" }), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = ev.evidence_id + ".json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); },
      },
    };
  }
  varianceCells(k, bars, spec) {
    const base = this.cfgOf(k), tf = this.tfOf(k), K = exitPlanKeys(base);
    const stops = [["p5", "5%", { stopM: "pct", stop: "5" }], ["p8", "8%", { stopM: "pct", stop: "8" }], ["p12", "12%", { stopM: "pct", stop: "12" }], ["a2", "2× ATR", { stopM: "atr", stopA: "2" }], ["none", "None", { stopM: "none" }]];
    const tps = [["none", "No target", { tpM: "none" }], ["p10", "+10%", { tpM: "pct", tp: "10" }], ["p20", "+20%", { tpM: "pct", tp: "20" }], ["r2", "2R", { tpM: "r", tpR: "2" }]];
    const sK = K.stopM === "none" ? "none" : K.stopM === "atr" ? "a" + K.stopA : "p" + K.stop, tK = K.tpM === "none" ? "none" : K.tpM === "r" ? "r" + K.tpR : "p" + K.tp;
    const cells = stops.map(([sk, sl, sp]) => ({ sl, cells: tps.map(([tk, , tp]) => { const c = valCfg({ ...base, ...sp, ...tp }, tf), r = tk === "r2" && sk === "none" ? null : Engine.runRules(bars, spec, engineCfg(c, bars)); return { sk, tk, r, patch: { ...sp, ...tp } }; }) }));
    const all = cells.flatMap((x) => x.cells).filter((x) => x.r).map((x) => x.r.m.sharpe), hiS = Math.max(...all), loS = Math.min(...all);
    return {
      head: tps.map(([, l]) => l),
      rows: cells.map((row) => ({ sl: row.sl, cells: row.cells.map(({ sk, tk, r, patch }) => { const s = r ? r.m.sharpe : 0, f = hiS > loS ? (s - loS) / (hiS - loS) : 0.5; return { sh: r ? fx(s) : "—", cg: r ? p1(r.m.cagr ?? r.m.tot) : tk === "r2" ? "needs a stop" : "", bg: r ? `rgba(201,162,74,${(0.08 + f * 0.5).toFixed(2)})` : "#12171a", bd: sk === sK && tk === tK ? "#f0d68c" : "transparent", onClick: () => { if (r) this.setCfg(k, patch); } }; }) })),
    };
  }
  compareVm(k, t, tf, cfg, key) {
    const st = this.state, c = st.cmp[key];
    const run = async () => {
      this.setState((s) => ({ cmp: { ...s.cmp, [key]: { busy: true } } }));
      const S = this.strategies().filter((x) => x.k === k || Engine.checkRules(this.specOf(x.k), tf).length === 0);
      const all = { entry: S.flatMap((x) => this.specOf(x.k).entry), exit: S.flatMap((x) => this.specOf(x.k).exit) }, span = fetchSpan(all, tf, cfg);
      try {
        const raw = (await this.fetchBars([t], span))[t];
        if (!raw) throw new Error("no bars");
        const bars = prepBars(raw, tf), ec = engineCfg(cfg, bars);
        const rows = S.map((x) => ({ x, r: Engine.runRules(bars, this.specOf(x.k), ec) }));
        this.setState((s) => ({ cmp: { ...s.cmp, [key]: { rows, skipped: this.strategies().length - S.length } } }));
      } catch (e) { this.setState((s) => ({ cmp: { ...s.cmp, [key]: { err: errMsg(e) } } })); }
    };
    if (!c || c.err) return { run, busy: c && c.err ? "Couldn't compare: " + c.err : "", rows: null };
    if (c.busy) return { run, busy: "Running every strategy on " + t + "…", rows: null };
    const sk = (st.sorts["cmp|" + key] || "sh"), annual = c.rows.every((o) => !o.r || o.r.m.cagr != null);
    const val = (o) => (!o.r ? -Infinity : sk === "name" ? 0 : sk === "ret" ? (annual ? o.r.m.cagr : o.r.m.tot) : o.r.m[sk]);
    const rows = [...c.rows].sort((a, b) => (sk === "name" ? a.x.name.localeCompare(b.x.name) : val(b) - val(a)));
    const H = [["Strategy", "name", "left"], [annual ? "CAGR" : "Return", "ret"], ["Sharpe", "sharpe"], ["Sortino", "sortino"], ["Max DD", "dd"], ["Win %", "win"], ["Trades", "trades"]];
    return {
      run, rows: rows.map(({ x, r }) => ({ name: x.name, ret: r ? p1(annual ? r.m.cagr : r.m.tot) : "insufficient history", sh: r ? fx(r.m.sharpe) : "—", so: r ? fx(r.m.sortino) : "—", dd: r ? p1(r.m.dd) : "—", win: r && r.m.trades ? Math.round(r.m.win * 100) + "%" : "—", tr: r ? String(r.m.trades) : "—", bg: x.k === k ? "#1a160c" : "transparent", nc: x.k === k ? "#f0d68c" : "#e6ebe8", onClick: () => this.openReport(x.k, t, this.state.rep && this.state.rep.n) })),
      head: H.map(([l, kk, al]) => ({ l: l + (sk === kk ? " ↓" : ""), k: kk, al: al || "right", on: sk === kk, onClick: () => this.setState((s) => ({ sorts: { ...s.sorts, ["cmp|" + key]: kk } })) })),
      note: c.skipped ? c.skipped + " strategies need data or candles this test doesn't have and were left out." : "",
    };
  }
  showMatches(k) {
    const x = this.strategyOf(k);
    this.setState((s) => ({ rep: null, sorts: { ...s.sorts, [k]: { key: "sig", desc: true } }, libTab: x && x.sv ? "saved" : s.libTab, labPick: k === "custom" ? s.labPick : k, libQ: "" }));
    setTimeout(() => this.scrollTo(k === "custom" ? this.aiRef.current : this.detRef.current), 60);
  }

  aiVals() {
    const st = this.state, ai = st.ai, q = st.aiQ || "", go = (qq) => { const v = qq ?? q; if (qq != null) this.setState({ aiQ: qq }); this.aiRun(v); };
    const chips = ["Buy when RSI(2) is below 10 and close is above the 200-day SMA, exit when close crosses above the 5-day SMA", "Buy breakouts above the 52-week high on 1.5x average volume, exit below the 20-day SMA", "Buy when MACD crosses above its signal line and RSI(14) is under 70, exit when RSI is above 75", "Buy when the 20-day EMA crosses above the 50-day EMA, hold 30 days, 8% stop"];
    const has = !!(ai && st.custom && !ai.loading && !ai.err);
    return {
      aiHeadline: "Describe a strategy. We'll build the rules and backtest it.", aiQ: q, onAiQ: (e) => this.setState({ aiQ: e.target.value }), onAiKey: (e) => { if (e.key === "Enter") go(); }, aiGo: () => go(),
      aiPh: "e.g. buy when price breaks the 52-week high on heavy volume, exit below the 20-day average", aiBtn: ai && ai.loading ? "Working…" : "Build & test", aiChips: chips.map((l) => ({ l, onClick: () => go(l) })),
      aiHas: !!ai, aiLoading: !!(ai && ai.loading), aiLoadingT: "Building rules…", aiErr: (ai && ai.err) || "", aiKind: "STRATEGY", aiTitle: ai ? (st.custom && has ? st.custom.name : ai.loading ? "Building…" : "") : "", aiSrc: (ai && ai.src) || "",
      aiParas: has && st.custom.why ? [st.custom.why] : [], aiF: has ? this.facts("custom") : null, hv: this.resultsVm("custom", has),
      aiHasActs: has, aiActs: has ? [{ l: "Edit rules", bg: "transparent", c: "#fbefc9", bd: "#5a4a22", onClick: () => this.openEdit("custom") }, { l: st.customSvId ? "Update saved strategy" : "Save strategy", bg: "transparent", c: "#fbefc9", bd: "#5a4a22", onClick: () => this.saveStrategy() }] : [],
    };
  }
  pickVals() {
    const st = this.state, BT = Engine, tab = st.libTab || "library", S = this.strategies(), nSaved = st.labSaved.length;
    const tabs = { libTabs: [["library", "Library", ""], ["saved", "Saved", String(nSaved)]].map(([k, l, n]) => ({ l, n, bd: tab === k ? "#c9a24a" : "transparent", c: tab === k ? "#eef2f4" : "#7a8481", onClick: () => this.setState({ libTab: k, labPick: null }) })), libEmpty: tab === "saved" && !nSaved, libHas: !(tab === "saved" && !nSaved) };
    if (st.savedNote && tab === "saved") tabs.libNote = st.savedNote;
    const P0 = S.filter((x) => (tab === "saved" ? x.k.startsWith("sv_") : x.lib));
    const lq = (st.libQ || "").trim().toLowerCase(), P = lq ? P0.filter((x) => [x.name, x.fam, x.what, x.src].join(" ").toLowerCase().includes(lq)) : P0;
    Object.assign(tabs, { libQ: st.libQ || "", onLibQ: (e) => this.setState({ libQ: e.target.value, labPick: null }), libCount: (lq ? P.length + " of " + P0.length : P0.length) + " strategies", libNone: !!lq && !P.length, libClear: () => this.setState({ libQ: "" }), detRef: this.detRef });
    const pk = P.find((x) => x.k === st.labPick);
    const item = (x) => { const need = BT.checkRules(this.specOf(x.k), this.tfOf(x.k)).length, on = pk && x.k === pk.k; return { tfL: tfL(this.tfOf(x.k)), auto: need ? "NOT TESTABLE" : "", name: x.name, fam: x.fam, hold: x.hold, bl: on ? "#5a4a22" : "transparent", bg: on ? "#1a160c" : "transparent", c: on ? "#eef2f4" : need ? "#5f6966" : "#cfd6d3", onClick: () => { this.setState({ labPick: x.k }); setTimeout(() => this.scrollTo(this.detRef.current), 40); } }; };
    tabs.libNoPick = !pk && !!P.length;
    tabs.pickList = P.map(item);
    if (!pk) return { ...tabs, libShowDetail: false, pk: {}, dv: { show: false }, pkF: null };
    const k = pk.k, needs = this.needsOf(k), isSv = k.startsWith("sv_");
    return {
      ...tabs, libShowDetail: true, holdOpts: HOLDS, pkF: this.facts(k), dv: this.resultsVm(k, true),
      pk: {
        whatOpen: st.whatOpen === k, whatBg: st.whatOpen === k ? "#2e2614" : "transparent", toggleWhat: () => this.setState({ whatOpen: st.whatOpen === k ? null : k }), whatIn: () => { if (this.state.whatOpen !== k) this.setState({ whatOpen: k }); }, whatOut: () => { if (this.state.whatOpen) this.setState({ whatOpen: null }); },
        tfL: tfL(this.tfOf(k)).toUpperCase() + " CANDLES", name: pk.name, fam: pk.fam, hold: pk.hold, src: pk.src, what: pk.what || WHAT[k] || pk.src,
        canSave: false, showFam: !isSv, canDel: isSv, canEdit: true, onEdit: () => this.openEdit(k),
        canAuto: STRATEGY_LAB_AUTOMATION && !needs.length, onAuto: () => this.setState({ auOpen: k }), autoL: "Automate with broker", autoBd: "#5a4a22", autoC: "#fbefc9",
        canHold: isSv, noHold: !isSv, onHold: (e) => this.setHold(k, e.target.value),
        onDel: () => this.setState({ delAsk: k }), delAsk: st.delAsk === k, delIdle: st.delAsk !== k, delNo: () => this.setState({ delAsk: null }), delYes: () => { this.setState({ delAsk: null }); this.delStrategy(k); },
      },
    };
  }
  autoVals() {
    // Broker automation is behind STRATEGY_LAB_AUTOMATION (off). Nothing is sent
    // anywhere; see docs/strategy-lab-automation-todo.md for what's missing.
    const st = this.state;
    if (!STRATEGY_LAB_AUTOMATION || !st.auOpen) return { auOpen: false };
    const x = this.strategyOf(st.auOpen) || {}, close = () => this.setState({ auOpen: null });
    return { auOpen: true, auName: x.name, auClose: close, stop: (e) => e.stopPropagation(), auBrokers: [], auHasBroker: false, auModes: [], auTypes: [], auSends: [], auSize: "", onAuSize: () => {}, auPayload: "", auMsg: "Broker automation isn't available yet: it needs a server-side OAuth callback, a bar-close signal runner and an order audit log.", auMsgC: "#f08a4b", auIsOn: false, auTest: close, auSave: close, auSaveL: "Close" };
  }
  buildVm() {
    const st = this.state;
    return {
      ...this.aiVals(), ...this.pickVals(), ...this.autoVals(),
      libRef: this.libRef, aiRef: this.aiRef,
      labS1: !st.rep, labNotS1: !!st.rep, labS3: !!st.rep, labHome: () => { this.setState({ rep: null }); this.scrollTop(); },
      rep: this.reportVm(), edit: this.editVm(),
    };
  }
  render() {
    const vm = this.buildVm();
    return (
      <div className="sl-root">
        <style>{BASE_CSS + "\n" + LAB_HOVER_CSS}</style>
        <div style={{ flex: 1, minWidth: 0, padding: "14px 24px 40px" }}><LabView vm={vm} refs={this.refsObj} /></div>
        {st_toast(this.state.toast)}
      </div>
    );
  }
}

function st_toast(t) {
  return t ? <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", zIndex: 80, background: "#1a1f21", border: "1px solid #2a3235", borderRadius: 10, padding: "10px 16px", fontWeight: 600, boxShadow: "0 10px 30px rgba(0,0,0,.4)" }}>{t}</div> : null;
}
