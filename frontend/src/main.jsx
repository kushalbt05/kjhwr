import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, ArrowDownRight, ArrowUpRight, CalendarDays, Check, ChevronDown, Clock3, Cloud, Download, ExternalLink, Gauge, Info, Leaf, LoaderCircle, RefreshCw, Wind, Zap } from 'lucide-react';
import './styles.css';
import './responsive-overrides.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const fmt = (value, digits = 0) => value == null ? '—' : new Intl.NumberFormat('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
const localDay = (iso) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(new Date(iso));
const localTime = (iso) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }).format(new Date(iso));

function MetricCard({ label, value, unit, descriptor, icon: Icon, accent, badge }) {
  return <article className={`metric-card ${accent || ''}`}>
    <div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={16} strokeWidth={1.8}/></span></div>
    <div className="metric-value">{value}<small>{unit}</small></div>
    <div className="metric-bottom"><span>{descriptor}</span>{badge && <span className="metric-badge">{badge}</span>}</div>
  </article>;
}

function LineChart({ rows }) {
  const [hoverIndex,setHoverIndex]=useState(null);
  const width = 900, height = 270, left = 48, right = 14, top = 22, bottom = 34;
  const points = rows.filter(r => r.actual != null || r.forecast != null);
  if (!points.length) return <div className="chart-empty">No intervals to plot for this selection.</div>;
  const vals = points.flatMap(r => [r.actual, r.forecast].filter(v => v != null));
  const min = Math.min(0, ...vals), max = Math.max(...vals) * 1.08 || 1, range = max - min || 1;
  const x = i => left + (points.length < 2 ? 0 : i * (width - left - right) / (points.length - 1));
  const y = v => top + (max - v) * (height - top - bottom) / range;
  const path = key => {
    const valid = points.map((r,i)=>({r,i})).filter(({r})=>r[key]!=null);
    return valid.map(({r,i},j)=>`${j?'L':'M'} ${x(i).toFixed(1)} ${y(r[key]).toFixed(1)}`).join(' ');
  };
  const labels = [0, Math.floor((points.length - 1) / 3), Math.floor(2 * (points.length - 1) / 3), points.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  const hover = hoverIndex==null ? null : points[hoverIndex];
  const onPointerMove = e => {
    const bounds=e.currentTarget.getBoundingClientRect();
    const viewX=(e.clientX-bounds.left)/bounds.width*width;
    const index=Math.round(Math.max(0,Math.min(width-left-right,viewX-left))*(points.length-1)/(width-left-right));
    setHoverIndex(index);
  };
  const onKeyDown = e => {
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
      e.preventDefault();
      setHoverIndex(i=>Math.max(0,Math.min(points.length-1,(i??0)+(e.key==='ArrowRight'?1:-1))));
    } else if(e.key==='Escape') setHoverIndex(null);
  };
  return <><div className={`chart-hover-readout ${hover?'has-hover':''}`}>{hover?<><strong className="readout-time">{localTime(hover.startTime)}</strong><span><i className="tooltip-dot forecast-tip"/>Forecast <b>{fmt(hover.forecast,0)} MW</b></span><span><i className="tooltip-dot actual-tip"/>Actual <b>{fmt(hover.actual,0)} MW</b></span><span className="readout-error">Error <b>{hover.error==null?'—':`${hover.error>0?'+':''}${fmt(hover.error,0)} MW`}</b></span><small>Published {hover.publishTime?localTime(hover.publishTime):'no eligible forecast'}</small></>:<span className="readout-hint">Hover over the graph or focus it and use ← / → to inspect an interval</span>}</div><div className="chart-wrap interactive-chart" onPointerMove={onPointerMove} onPointerLeave={()=>setHoverIndex(null)} onKeyDown={onKeyDown} tabIndex={0} role="application" aria-label="Interactive chart. Hover or use left and right arrow keys to inspect delivery intervals.">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Actual and forecast wind generation over time" preserveAspectRatio="none">
      {[0,1,2,3].map(i => { const val=max-(range*i/3); return <g key={i}><line x1={left} x2={width-right} y1={y(val)} y2={y(val)} className="grid-line"/><text x={left-10} y={y(val)+4} textAnchor="end" className="axis-label">{fmt(val/1000,0)}k</text></g>; })}
      <path d={path('forecast')} className="line-forecast"/>{points.map((r,i)=>r.forecast==null?null:<circle key={`forecast-${i}`} cx={x(i)} cy={y(r.forecast)} r="2.2" className="forecast-point"/>)}<path d={path('actual')} className="line-actual"/>
      {hover && <g className="hover-guides"><line x1={x(hoverIndex)} x2={x(hoverIndex)} y1={top} y2={height-bottom} className="hover-crosshair"/>{hover.forecast!=null&&<circle cx={x(hoverIndex)} cy={y(hover.forecast)} r="5" className="hover-forecast-point"/>}{hover.actual!=null&&<circle cx={x(hoverIndex)} cy={y(hover.actual)} r="5" className="hover-actual-point"/>}</g>}
      {labels.map(i=><text key={i} x={x(i)} y={height-9} textAnchor={i===0?'start':i===points.length-1?'end':'middle'} className="axis-label">{localDay(points[i].startTime)}</text>)}
    </svg>
  </div></>;
}

function ErrorChart({ rows }) {
  const [hoverIndex,setHoverIndex]=useState(null);
  const points = rows.filter(r => r.error != null);
  if (!points.length) return <div className="chart-empty">Errors appear once forecast and actual records are matched.</div>;
  const width=900,height=170,left=48,right=14,top=12,bottom=28;
  const max=Math.max(100,...points.map(p=>Math.abs(p.error)))*1.12;
  const x=i=>left+(points.length<2?0:i*(width-left-right)/(points.length-1));
  const y=v=>top+(max-v)*(height-top-bottom)/(2*max);
  const zero=y(0);
  const hover=hoverIndex==null?null:points[hoverIndex];
  const onPointerMove=e=>{
    const bounds=e.currentTarget.getBoundingClientRect();
    const viewX=(e.clientX-bounds.left)/bounds.width*width;
    const index=Math.round(Math.max(0,Math.min(width-left-right,viewX-left))*(points.length-1)/(width-left-right));
    setHoverIndex(index);
  };
  const onKeyDown=e=>{
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
      e.preventDefault();
      setHoverIndex(i=>Math.max(0,Math.min(points.length-1,(i??0)+(e.key==='ArrowRight'?1:-1))));
    } else if(e.key==='Escape') setHoverIndex(null);
  };
  return <><div className={`chart-hover-readout error-readout ${hover?'has-hover':''}`}>{hover?<><strong className="readout-time">{localTime(hover.startTime)}</strong><span>Signed error <b>{hover.error>0?'+':''}{fmt(hover.error,0)} MW</b></span><span>Absolute error <b>{fmt(hover.absoluteError,0)} MW</b></span><span>Forecast / actual <b>{fmt(hover.forecast,0)} / {fmt(hover.actual,0)} MW</b></span><small>Published {hover.publishTime?localTime(hover.publishTime):'no eligible forecast'}</small></>:<span className="readout-hint">Hover over the bars or focus the chart and use ← / → to inspect an interval</span>}</div><div className="chart-wrap error-chart interactive-chart" onPointerMove={onPointerMove} onPointerLeave={()=>setHoverIndex(null)} onKeyDown={onKeyDown} tabIndex={0} role="application" aria-label="Interactive forecast error chart. Hover or use left and right arrow keys to inspect intervals."><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Forecast error by delivery interval" preserveAspectRatio="none">
    <line x1={left} x2={width-right} y1={zero} y2={zero} className="zero-line"/>
    <text x={left-10} y={y(max)+4} textAnchor="end" className="axis-label">+{fmt(max/1000,1)}k</text><text x={left-10} y={zero+4} textAnchor="end" className="axis-label">0</text><text x={left-10} y={y(-max)+4} textAnchor="end" className="axis-label">−{fmt(max/1000,1)}k</text>
    {points.map((p,i)=><line key={i} x1={x(i)} x2={x(i)} y1={zero} y2={y(p.error)} className={`${p.error>=0?'bar-positive':'bar-negative'} ${i===hoverIndex?'selected-error-bar':''}`}/>)}
    {hover&&<line x1={x(hoverIndex)} x2={x(hoverIndex)} y1={top} y2={height-bottom} className="hover-crosshair"/>}
    {[0,Math.floor((points.length-1)/2),points.length-1].filter((v,i,a)=>a.indexOf(v)===i).map(i=><text key={i} x={x(i)} y={height-8} textAnchor={i===0?'start':i===points.length-1?'end':'middle'} className="axis-label">{localDay(points[i].startTime)}</text>)}
  </svg></div></>;
}

function App() {
  const [startDate,setStartDate]=useState('2026-01-01');
  const [endDate,setEndDate]=useState('2026-01-31');
  const [cutoff,setCutoff]=useState(12);
  const [result,setResult]=useState(null);
  const [status,setStatus]=useState('loading');
  const [error,setError]=useState('');
  const [query,setQuery]=useState('');
  const [page,setPage]=useState(0);
  const pageSize=12;

  async function load(overrides = {}) {
    setStatus('loading'); setError(''); setPage(0);
    try {
      const url=new URL(`${API_URL}/api/dashboard`);
      url.searchParams.set('start_date',overrides.startDate ?? startDate); url.searchParams.set('end_date',overrides.endDate ?? endDate); url.searchParams.set('cutoff_hours',String(overrides.cutoff ?? cutoff));
      const res=await fetch(url); const body=await res.json();
      if(!res.ok) throw new Error(body.detail || `Request failed (${res.status})`);
      setResult(body); setStatus('ready');
    } catch(e) { setError(e.message || 'Unable to load data.'); setStatus('error'); }
  }
  useEffect(()=>{load();},[]);
  const filtered=useMemo(()=>{
    const rows=result?.rows||[]; const q=query.trim().toLowerCase();
    return q ? rows.filter(r=>r.startTime.toLowerCase().includes(q) || (r.publishTime||'').toLowerCase().includes(q)) : rows;
  },[result,query]);
  const visible=filtered.slice(page*pageSize,(page+1)*pageSize);
  const matched=(result?.rows||[]).filter(r=>r.error!=null).length;
  const forecastCoverage=(result?.meta?.forecastIntervals||0);
  const trend=useMemo(()=>{
    const valid=(result?.rows||[]).filter(r=>r.error!=null); if(valid.length<2)return null;
    const mid=Math.floor(valid.length/2); const a=valid.slice(0,mid).reduce((s,r)=>s+Math.abs(r.error),0)/mid; const b=valid.slice(mid).reduce((s,r)=>s+Math.abs(r.error),0)/(valid.length-mid);
    return a ? {change:((b-a)/a)*100,first:a,second:b,count:valid.length} : null;
  },[result]);
  function downloadCsv(){
    const rows=result?.rows||[]; const cols=['startTime','publishTime','forecast','actual','error','absoluteError'];
    const csv=[cols.join(','),...rows.map(r=>cols.map(c=>r[c]??'').join(','))].join('\n');
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=`wind-accuracy-${startDate}-to-${endDate}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }
  const fmtDate = value => value ? new Date(value).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'Europe/London'}) : '';
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Wind size={20}/></div><div><strong>fieldnote</strong><span>ENERGY INTELLIGENCE</span></div></div>
      <div className="side-section-label">WORKSPACE</div>
      <button className="side-link selected"><Activity size={17}/><span>Forecast accuracy</span><span className="side-dot"/></button>
      <div className="side-section-label datasets-label">DATA SOURCES</div>
      <div className="source-line"><span className="source-indicator green"/><span>FUELHH · Actuals</span></div>
      <div className="source-line"><span className="source-indicator blue"/><span>WINDFOR · Forecast</span></div>
      <div className="sidebar-bottom"><div className="live-status"><span className="pulse"/><span>{status==='ready'?'Connected to Elexon':'Elexon data feed'}</span></div><div className="sidebar-note">National wind generation<br/>United Kingdom · Europe/London</div></div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div className="breadcrumbs">Analytics <span>/</span> <strong>Forecast accuracy</strong></div><div className="topbar-right"><span className="period-pill"><span className="period-dot"/>JAN 2026 STUDY</span><span className="avatar">UK</span></div></header>
      <div className="content-wrap">
        <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> WIND GENERATION · NATIONAL</div><h1>Forecast accuracy</h1><p className="intro">See how wind generation forecasts perform against what the grid actually delivered.</p></div><button className="refresh-button" onClick={load} disabled={status==='loading'}><RefreshCw size={15} className={status==='loading'?'spin':''}/><span>{status==='loading'?'Fetching data':'Refresh data'}</span></button></section>

        <section className="context-bar"><div className="context-icon"><CalendarDays size={17}/></div><div className="context-copy"><strong>{fmtDate(startDate)} – {fmtDate(endDate)}</strong><span>Delivery period · Half-hourly intervals · Europe/London</span></div><div className="date-range-control"><input type="date" value={startDate} max={endDate} onChange={e=>setStartDate(e.target.value)} aria-label="Start delivery date"/><span>to</span><input type="date" value={endDate} min={startDate} onChange={e=>setEndDate(e.target.value)} aria-label="End delivery date"/><button onClick={load} disabled={status==='loading'}>Apply</button></div><div className="context-divider"/><div className="cutoff-control"><Clock3 size={16}/><span>Cutoff</span><select value={cutoff} onChange={e=>{const next=Number(e.target.value);setCutoff(next);load({cutoff:next});}} aria-label="Forecast cutoff before delivery">{[6,12,18,24,36].map(v=><option key={v} value={v}>{v}h before delivery</option>)}</select><ChevronDown size={13} className="select-chevron"/></div><span className="assumption-note"><Info size={14}/> Assumption</span></section>

        {status==='error' && <div className="alert error-alert"><div className="alert-icon"><Info size={18}/></div><div><strong>We couldn’t load the live dataset</strong><p>{error}</p><span>Check that the Python API is running, then refresh. The dashboard never substitutes demo values for real Elexon data.</span></div><button onClick={load}>Try again <ArrowUpRight size={14}/></button></div>}
        {status==='loading' && !result && <div className="loading-strip"><LoaderCircle className="spin" size={17}/> Connecting to Elexon and preparing the January analysis…</div>}

        <section className="metrics-grid">
          <MetricCard label="Mean absolute error" value={fmt(result?.metrics?.mae,0)} unit=" MW" descriptor="Average forecast deviation" icon={Gauge} accent="metric-forest"/>
          <MetricCard label="Root mean square error" value={fmt(result?.metrics?.rmse,0)} unit=" MW" descriptor="Weights larger misses more" icon={Activity}/>
          <MetricCard label="Mean forecast bias" value={fmt(result?.metrics?.bias,0)} unit=" MW" descriptor="Positive means over-forecast" icon={result?.metrics?.bias>=0?ArrowUpRight:ArrowDownRight} accent="metric-bias"/>
          <MetricCard label="Matched intervals" value={fmt(matched)} unit="" descriptor="Forecast and actual available" icon={Check} badge={result&&matched?`${fmt(matched/(31*48)*100,0)}% of Jan`:undefined}/>
        </section>

        {result && matched===0 && status!=='error' && <div className="alert empty-alert"><div className="alert-icon"><Info size={18}/></div><div><strong>No matched observations for this selection</strong><p>Metrics are intentionally left blank when there are no eligible forecast and actual pairs. Check the date range or cutoff.</p></div></div>}
        {result && (result.rows.length>0 && matched<result.rows.length) && <div className="coverage-note"><Info size={14}/><span>{fmt(result.rows.length-matched)} intervals are missing either a qualifying forecast or an actual. Metrics use matched intervals only.</span></div>}

        <section className="panel chart-panel"><div className="panel-heading"><div><div className="panel-kicker">GENERATION PROFILE</div><h2>Forecast vs actual</h2><p>National wind output across the selected delivery period</p></div><div className="legend"><span><i className="legend-swatch forecast-swatch"/>Forecast</span><span><i className="legend-swatch actual-swatch"/>Actual</span><span className="unit-tag">MW</span></div></div>
          {status==='ready'?<LineChart rows={result?.rows||[]}/>:<div className="chart-empty">{status==='loading'?'Waiting for live data…':'Live chart unavailable until the data API connects.'}</div>}
          {result && <div className="chart-foot"><span><span className="foot-dot"/> {fmt(forecastCoverage)} forecast points; dashed line connects available points</span><span>Latest data fetch {new Date(result.meta.fetchedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})} UK time</span></div>}
        </section>

        <section className="panel error-panel"><div className="panel-heading compact-heading"><div><div className="panel-kicker">SIGNED ERROR · FORECAST − ACTUAL</div><h2>Where the forecast missed</h2><p>Above zero means more wind was forecast than generated.</p></div><span className="error-unit">MW</span></div>{status==='ready'?<ErrorChart rows={result?.rows||[]}/>:<div className="chart-empty small-empty">Error profile will appear with live observations.</div>}
          <div className="error-summary"><span className="summary-mark positive-mark"/><span>Over-forecast</span><strong>{fmt((result?.rows||[]).filter(r=>r.error>0).length)}</strong><span className="summary-sep"/><span className="summary-mark negative-mark"/><span>Under-forecast</span><strong>{fmt((result?.rows||[]).filter(r=>r.error<0).length)}</strong>{trend&&<span className={`trend-chip ${trend.change>0?'trend-up':'trend-down'}`} title={`Compares mean absolute error across the two halves of ${trend.count} matched intervals. First half: ${fmt(trend.first,0)} MW; second half: ${fmt(trend.second,0)} MW. This is an average trend; individual forecasts may improve or worsen.`}>{trend.change<0?`Average absolute error fell ${fmt(Math.abs(trend.change),0)}% in second half`:trend.change>0?`Average absolute error rose ${fmt(trend.change,0)}% in second half`:'Average absolute error was unchanged'}</span>}</div>
          <div className="trend-explanation">The percentage compares average absolute error across matched intervals; individual forecasts can still be more or less accurate.</div>
        </section>

        <section className="panel table-panel"><div className="table-heading"><div><div className="panel-kicker">INTERVAL DETAIL</div><h2>Delivery intervals</h2><p>Inspect the publication selected for each delivery slot.</p></div><div className="table-actions"><label className="search-box"><span>⌕</span><input value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}} placeholder="Search date…"/></label><button className="export-button" onClick={downloadCsv} disabled={!result}><Download size={14}/> Export CSV</button></div></div>
          <div className="table-scroll"><table><thead><tr><th>DELIVERY START <ChevronDown size={12}/></th><th>FORECAST PUBLISHED</th><th className="num">FORECAST <span>(MW)</span></th><th className="num">ACTUAL <span>(MW)</span></th><th className="num">ERROR <span>(MW)</span></th><th className="num">ABS. ERROR</th></tr></thead><tbody>
            {visible.length?visible.map((r,i)=><tr key={r.startTime}><td><span className="date-cell">{localTime(r.startTime)}</span></td><td>{r.publishTime?<span className="published-cell"><span className="published-dot"/>{localTime(r.publishTime)}</span>:<span className="missing-cell">No eligible forecast</span>}</td><td className="num">{fmt(r.forecast,0)}</td><td className="num">{fmt(r.actual,0)}</td><td className={`num ${r.error>0?'error-positive':r.error<0?'error-negative':''}`}>{r.error==null?'—':`${r.error>0?'+':''}${fmt(r.error,0)}`}</td><td className="num abs-cell">{fmt(r.absoluteError,0)}</td></tr>):<tr><td className="no-rows" colSpan="6">{status==='ready'?'No intervals match your search.':'Waiting for interval data.'}</td></tr>}
          </tbody></table></div>
          <div className="table-footer"><span>Showing <strong>{filtered.length? page*pageSize+1:0}–{Math.min((page+1)*pageSize,filtered.length)}</strong> of <strong>{fmt(filtered.length)}</strong> intervals</span><div className="pagination"><button onClick={()=>setPage(Math.max(0,page-1))} disabled={page===0}>←</button><span>{page+1} / {Math.max(1,Math.ceil(filtered.length/pageSize))}</span><button onClick={()=>setPage(Math.min(Math.ceil(filtered.length/pageSize)-1,page+1))} disabled={(page+1)*pageSize>=filtered.length}>→</button></div></div>
        </section>

        <footer className="page-footer"><div className="footer-left"><span className="footer-brand"><Leaf size={14}/> fieldnote</span><span>Built for clearer day-ahead decisions</span></div><div className="footer-right"><span>DATA: ELEXON BMRS</span><a href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream" target="_blank" rel="noreferrer">FUELHH <ExternalLink size={11}/></a><a href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream" target="_blank" rel="noreferrer">WINDFOR <ExternalLink size={11}/></a></div></footer>
        <div className="method-note"><Info size={13}/><span>Forecast cutoff is configured as a number of hours before each delivery interval. This is an analytical assumption, not a verified UK market gate closure. Metrics use only intervals with both values.</span></div>
      </div>
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
