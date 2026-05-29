import { useState, useEffect, Fragment } from "react";
import Papa from "papaparse";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// ── URL de tu Apps Script ──────────────────────────────────
var APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwF2KrrM0DgqntqRCf4d55SIEkMRGE2__dWZEh74LsOIQNCF_cB7CvwALEnujWLjEAM/exec";

// ── Sheet IDs & config ─────────────────────────────────────
var DEF_HIST_ID = "1Uzlnt5BtPHB8OwLvS_TrE0H9azaGL5QLd4PYEt5611M";
var DEF_EST_ID  = "1Gt6ohFuEyQeY8hY-URxPLjX4oKGPda1BrXgLuTx3wrc";

var VALID_CLIENTS = new Set([5011124, 8665087, 5901359, 4003984]);

var CMD_COLUMNS = [
  "Razón Social del cliente","Número de cliente","No. de guía","Código de rastreo",
  "Referencia del ítem","Centro de costo","Razón Social Origen","Alias Dirección Origen",
  "Dirección Origen","Razón Social Destino","Alias Dirección Destino","Dirección Destino",
  "Tipo de Destino","Tipo de empaque","Peso","Servicio","Contenido","Cumple con Garantía",
  "Tipo de salida","Usuario que le generó","Fecha de generación","Fecha de vigencia"
];
var CMD_FIELD_DEFS = CMD_COLUMNS.map(function(c) { return { key: c, label: c }; });

var DEFAULT_ORIGEN_RULES = [
  { id:"or1",  field:"Alias Dirección Destino", op:"contains",   val:"CEDISST",      result:"Servicio / Almacén",    active:true },
  { id:"or2",  field:"Alias Dirección Destino", op:"contains",   val:"ALMACEN",      result:"Servicio / Almacén",    active:true },
  { id:"or3",  field:"Centro de costo",         op:"contains",   val:"TICKET",       result:"Garantía Cliente",      active:true },
  { id:"or4",  field:"Alias Dirección Origen",  op:"contains",   val:"GARANTIA",     result:"Garantía Cliente",      active:true },
  { id:"or5",  field:"Razón Social Origen",     op:"contains",   val:"OXXO",         result:"Cadenas Comerciales",   active:true },
  { id:"or6",  field:"Razón Social Origen",     op:"contains",   val:"CHEDRAUI",     result:"Cadenas Comerciales",   active:true },
  { id:"or7",  field:"Razón Social Origen",     op:"contains",   val:"WALMART",      result:"Cadenas Comerciales",   active:true },
  { id:"or8",  field:"Razón Social Origen",     op:"contains",   val:"CEDIS.COM",    result:"Ecommerce",             active:true },
  { id:"or9",  field:"Alias Dirección Origen",  op:"contains",   val:"CEDIS.COM",    result:"Ecommerce",             active:true },
  { id:"or10", field:"Alias Dirección Origen",  op:"startsWith", val:"PALMAS",       result:"Palmas",                active:true },
  { id:"or11", field:"Alias Dirección Origen",  op:"regex",      val:"^T\\d",        result:"Tienda",                active:true }
];
var DEFAULT_DESTINO_RULES = [
  { id:"dr1",  field:"Centro de costo",         op:"contains",   val:"TICKET",        result:"Garantía Cliente",           active:true },
  { id:"dr2",  field:"Alias Dirección Destino", op:"contains",   val:"CEDISST",       result:"Señuelo / Serv. Técnico",    active:true },
  { id:"dr3",  field:"Alias Dirección Destino", op:"contains",   val:"CEDIS.COM",     result:"Ecommerce / Dir. a Cliente", active:true },
  { id:"dr4",  field:"Alias Dirección Destino", op:"contains",   val:"E-COMMERCE",    result:"Ecommerce / Dir. a Cliente", active:true },
  { id:"dr5",  field:"Alias Dirección Destino", op:"contains",   val:"ECOMMERCE",     result:"Ecommerce / Dir. a Cliente", active:true },
  { id:"dr6",  field:"Alias Dirección Destino", op:"startsWith", val:"CAD",           result:"Cadenas Comerciales",        active:true },
  { id:"dr7",  field:"Alias Dirección Destino", op:"startsWith", val:"TMK",           result:"Telemarketing",              active:true },
  { id:"dr8",  field:"Alias Dirección Destino", op:"startsWith", val:"CVTE",          result:"Ventas Empresariales",       active:true },
  { id:"dr9",  field:"Alias Dirección Destino", op:"startsWith", val:"CDIR",          result:"Dirección",                  active:true },
  { id:"dr10", field:"Razón Social Destino",    op:"contains",   val:"DISTRIBUIDORA", result:"Almacén",                   active:true },
  { id:"dr11", field:"Razón Social Destino",    op:"contains",   val:"LEGAL",         result:"Documentos Legal",           active:true }
];
var DEFAULT_WS_CONFIG = {
  trKeywords:            ["TR","tr"],
  camKeywords:           ["Cambio de catalogo"],
  ecPrefixes:            [
    { prefix:"73", accounts:"5901359" },
    { prefix:"72", accounts:"5901359,5011124" },
    { prefix:"74", accounts:"5901359,5011124" }
  ],
  concentradoraAccounts: ["4003656","4003984"]
};
var OPS = [
  { key:"contains",   label:"Contiene"         },
  { key:"startsWith", label:"Empieza con"       },
  { key:"equals",     label:"Igual a"           },
  { key:"regex",      label:"Expresión regular" }
];




// ═══════════════════════════════════════════════════════════
// DESIGN SYSTEM — Enterprise SaaS Dark Navy
// Inspired by: Linear, Vercel, Stripe, Datadog, Supabase
// ═══════════════════════════════════════════════════════════
var T = {
  // Backgrounds
  bgBase:     "#070b14",  // app shell
  bgSurface:  "#0d1424",  // cards, panels
  bgPanel:    "#111827",  // raised surfaces
  bgHover:    "#1a2235",  // interactive hover
  bgActive:   "#1e2d45",  // pressed / active
  bgGlass:    "rgba(255,255,255,0.03)", // glassmorphism
  // Borders
  borderFaint:"rgba(255,255,255,0.06)",
  borderLight:"rgba(255,255,255,0.10)",
  borderMed:  "rgba(255,255,255,0.15)",
  borderBlue: "rgba(59,130,246,0.35)",
  // Text
  textPrimary:"#f0f4ff",
  textSec:    "#8b9ec7",
  textMuted:  "#4a5a78",
  textInv:    "#070b14",
  // Accent — electric blue
  accentBlue: "#3b82f6",
  accentBlueLt:"#60a5fa",
  accentBlueDk:"#1d4ed8",
  accentGlow: "rgba(59,130,246,0.18)",
  // Semantic
  success:    "#10b981",
  successBg:  "rgba(16,185,129,0.10)",
  successBd:  "rgba(16,185,129,0.25)",
  warning:    "#f59e0b",
  warningBg:  "rgba(245,158,11,0.10)",
  warningBd:  "rgba(245,158,11,0.25)",
  danger:     "#ef4444",
  dangerBg:   "rgba(239,68,68,0.10)",
  dangerBd:   "rgba(239,68,68,0.25)",
  purple:     "#8b5cf6",
  purpleBg:   "rgba(139,92,246,0.10)",
  purpleBd:   "rgba(139,92,246,0.25)",
  // Chart palette (accessible, high contrast)
  chartGreen: "#34d399",
  chartAmber: "#fbbf24",
  chartRed:   "#f87171",
  chartPurple:"#a78bfa",
  chartBlue:  "#60a5fa",
  chartTeal:  "#2dd4bf",
  // Radius
  r4:"4px", r6:"6px", r8:"8px", r10:"10px", r12:"12px", r16:"16px",
  // Shadows
  shadowSm:   "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
  shadowMd:   "0 4px 12px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.4)",
  shadowLg:   "0 20px 48px rgba(0,0,0,0.6), 0 8px 16px rgba(0,0,0,0.5)",
  shadowBlue: "0 0 0 1px rgba(59,130,246,0.4), 0 4px 16px rgba(59,130,246,0.15)",
  // Transitions
  ease:       "cubic-bezier(0.16,1,0.3,1)",
  easeOut:    "cubic-bezier(0.0,0.0,0.2,1)",
};

// Status config (updated palette)
var SC = {
  valida:     { l:"Válida",     c:T.success,  bg:T.successBg,  bc:T.successBd,  ic:"✓" },
  sospechosa: { l:"Sospechosa", c:T.warning,  bg:T.warningBg,  bc:T.warningBd,  ic:"⚠" },
  anomalia:   { l:"Anomalía",   c:T.danger,   bg:T.dangerBg,   bc:T.dangerBd,   ic:"✕" },
  autorizada: { l:"Autorizada", c:T.purple,   bg:T.purpleBg,   bc:T.purpleBd,   ic:"●" },
  rechazada:  { l:"Rechazada",  c:"#dc2626",  bg:"rgba(220,38,38,0.12)", bc:"rgba(220,38,38,0.35)", ic:"✕" }
};
var CC  = { "OK":T.success,"Medio":T.warning,"Alto":T.danger,"Crítico":"#dc2626" };
var CBG = { "OK":T.successBg,"Medio":T.warningBg,"Alto":T.dangerBg,"Crítico":T.dangerBg };

// Common style objects
var selSt = {
  padding:"7px 11px", borderRadius:T.r8, border:"1px solid "+T.borderLight,
  fontSize:12, background:T.bgPanel, color:T.textPrimary,
  outline:"none", transition:"border-color 0.15s"
};
var btnSec = {
  padding:"7px 14px", background:T.bgHover, border:"1px solid "+T.borderLight,
  borderRadius:T.r8, fontSize:12, cursor:"pointer", color:T.textPrimary,
  transition:"all 0.15s "+T.ease, fontWeight:500
};
var thSt = {
  padding:"10px 12px", textAlign:"left", fontWeight:600,
  color:T.textMuted, fontSize:10, textTransform:"uppercase", letterSpacing:"0.07em"
};
var tdSt = { padding:"14px 12px", fontSize:12, color:T.textPrimary };

// ── URL de tu Apps Script ──────────────────────────────────
var APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwF2KrrM0DgqntqRCf4d55SIEkMRGE2__dWZEh74LsOIQNCF_cB7CvwALEnujWLjEAM/exec";

// ── Sheet IDs & config ─────────────────────────────────────
var DEF_HIST_ID = "1Uzlnt5BtPHB8OwLvS_TrE0H9azaGL5QLd4PYEt5611M";
var DEF_EST_ID  = "1Gt6ohFuEyQeY8hY-URxPLjX4oKGPda1BrXgLuTx3wrc";

var VALID_CLIENTS = new Set([5011124, 8665087, 5901359, 4003984]);

var CMD_COLUMNS = [
  "Razón Social del cliente","Número de cliente","No. de guía","Código de rastreo",
  "Referencia del ítem","Centro de costo","Razón Social Origen","Alias Dirección Origen",
  "Dirección Origen","Razón Social Destino","Alias Dirección Destino","Dirección Destino",
  "Tipo de Destino","Tipo de empaque","Peso","Servicio","Contenido","Cumple con Garantía",
  "Tipo de salida","Usuario que le generó","Fecha de generación","Fecha de vigencia"
];
var CMD_FIELD_DEFS = CMD_COLUMNS.map(function(c) { return { key: c, label: c }; });

var DEFAULT_ORIGEN_RULES = [
  { id:"or1",  field:"Alias Dirección Destino", op:"contains",   val:"CEDISST",      result:"Servicio / Almacén",    active:true },
  { id:"or2",  field:"Alias Dirección Destino", op:"contains",   val:"ALMACEN",      result:"Servicio / Almacén",    active:true },
  { id:"or3",  field:"Centro de costo",         op:"contains",   val:"TICKET",       result:"Garantía Cliente",      active:true },
  { id:"or4",  field:"Alias Dirección Origen",  op:"contains",   val:"GARANTIA",     result:"Garantía Cliente",      active:true },
  { id:"or5",  field:"Razón Social Origen",     op:"contains",   val:"OXXO",         result:"Cadenas Comerciales",   active:true },
  { id:"or6",  field:"Razón Social Origen",     op:"contains",   val:"CHEDRAUI",     result:"Cadenas Comerciales",   active:true },
  { id:"or7",  field:"Razón Social Origen",     op:"contains",   val:"WALMART",      result:"Cadenas Comerciales",   active:true },
  { id:"or8",  field:"Razón Social Origen",     op:"contains",   val:"CEDIS.COM",    result:"Ecommerce",             active:true },
  { id:"or9",  field:"Alias Dirección Origen",  op:"contains",   val:"CEDIS.COM",    result:"Ecommerce",             active:true },
  { id:"or10", field:"Alias Dirección Origen",  op:"startsWith", val:"PALMAS",       result:"Palmas",                active:true },
  { id:"or11", field:"Alias Dirección Origen",  op:"regex",      val:"^T\\d",        result:"Tienda",                active:true }
];
var DEFAULT_DESTINO_RULES = [
  { id:"dr1",  field:"Centro de costo",         op:"contains",   val:"TICKET",        result:"Garantía Cliente",           active:true },
  { id:"dr2",  field:"Alias Dirección Destino", op:"contains",   val:"CEDISST",       result:"Señuelo / Serv. Técnico",    active:true },
  { id:"dr3",  field:"Alias Dirección Destino", op:"contains",   val:"CEDIS.COM",     result:"Ecommerce / Dir. a Cliente", active:true },
  { id:"dr4",  field:"Alias Dirección Destino", op:"contains",   val:"E-COMMERCE",    result:"Ecommerce / Dir. a Cliente", active:true },
  { id:"dr5",  field:"Alias Dirección Destino", op:"contains",   val:"ECOMMERCE",     result:"Ecommerce / Dir. a Cliente", active:true },
  { id:"dr6",  field:"Alias Dirección Destino", op:"startsWith", val:"CAD",           result:"Cadenas Comerciales",        active:true },
  { id:"dr7",  field:"Alias Dirección Destino", op:"startsWith", val:"TMK",           result:"Telemarketing",              active:true },
  { id:"dr8",  field:"Alias Dirección Destino", op:"startsWith", val:"CVTE",          result:"Ventas Empresariales",       active:true },
  { id:"dr9",  field:"Alias Dirección Destino", op:"startsWith", val:"CDIR",          result:"Dirección",                  active:true },
  { id:"dr10", field:"Razón Social Destino",    op:"contains",   val:"DISTRIBUIDORA", result:"Almacén",                   active:true },
  { id:"dr11", field:"Razón Social Destino",    op:"contains",   val:"LEGAL",         result:"Documentos Legal",           active:true }
];
var DEFAULT_WS_CONFIG = {
  trKeywords:            ["TR","tr"],
  camKeywords:           ["Cambio de catalogo"],
  ecPrefixes:            [
    { prefix:"73", accounts:"5901359" },
    { prefix:"72", accounts:"5901359,5011124" },
    { prefix:"74", accounts:"5901359,5011124" }
  ],
  concentradoraAccounts: ["4003656","4003984"]
};
var OPS = [
  { key:"contains",   label:"Contiene"         },
  { key:"startsWith", label:"Empieza con"       },
  { key:"equals",     label:"Igual a"           },
  { key:"regex",      label:"Expresión regular" }
];

// ═══════════════════════════════════════════════════════════
// DESIGN SYSTEM — Enterprise SaaS Dark Navy
// Inspired by: Linear, Vercel, Stripe, Datadog, Supabase
// ═══════════════════════════════════════════════════════════

// Status config (updated palette)
var SC = {
  valida:     { l:"Válida",     c:T.success,  bg:T.successBg,  bc:T.successBd,  ic:"✓" },
  sospechosa: { l:"Sospechosa", c:T.warning,  bg:T.warningBg,  bc:T.warningBd,  ic:"⚠" },
  anomalia:   { l:"Anomalía",   c:T.danger,   bg:T.dangerBg,   bc:T.dangerBd,   ic:"✕" },
  autorizada: { l:"Autorizada", c:T.purple,   bg:T.purpleBg,   bc:T.purpleBd,   ic:"●" },
  rechazada:  { l:"Rechazada",  c:"#dc2626",  bg:"rgba(220,38,38,0.12)", bc:"rgba(220,38,38,0.35)", ic:"✕" }
};
var CC  = { "OK":T.success,"Medio":T.warning,"Alto":T.danger,"Crítico":"#dc2626" };
var CBG = { "OK":T.successBg,"Medio":T.warningBg,"Alto":T.dangerBg,"Crítico":T.dangerBg };

// Common style objects
var selSt = {
  padding:"7px 11px", borderRadius:T.r8, border:"1px solid "+T.borderLight,
  fontSize:12, background:T.bgPanel, color:T.textPrimary,
  outline:"none", transition:"border-color 0.15s"
};
var btnSec = {
  padding:"7px 14px", background:T.bgHover, border:"1px solid "+T.borderLight,
  borderRadius:T.r8, fontSize:12, cursor:"pointer", color:T.textPrimary,
  transition:"all 0.15s "+T.ease, fontWeight:500
};
var thSt = {
  padding:"10px 12px", textAlign:"left", fontWeight:600,
  color:T.textMuted, fontSize:10, textTransform:"uppercase", letterSpacing:"0.07em"
};
var tdSt = { padding:"14px 12px", fontSize:12, color:T.textPrimary };

// Inject global CSS
if (typeof document !== "undefined") {
  var styleEl = document.getElementById("vge-global-styles") || document.createElement("style");
  styleEl.id = "vge-global-styles";
  styleEl.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; }
    body { margin: 0; background: #070b14; }
    input[type=date]::-webkit-calendar-picker-indicator,
    input[type=month]::-webkit-calendar-picker-indicator { filter: invert(0.5) brightness(1.5); }
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); }
    select option { background: #111827; color: #f0f4ff; }
    .vge-card { transition: box-shadow 0.2s, border-color 0.2s; }
    .vge-card:hover { border-color: rgba(255,255,255,0.14) !important; box-shadow: 0 6px 24px rgba(0,0,0,0.5); }
    .vge-btn-primary { transition: all 0.15s ease; }
    .vge-btn-primary:hover:not(:disabled) { background: #2563eb !important; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(59,130,246,0.35) !important; }
    .vge-btn-primary:active:not(:disabled) { transform: translateY(0); }
    .vge-tab-btn { transition: color 0.15s, border-color 0.15s; }
    .vge-row:hover { background: rgba(255,255,255,0.03) !important; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
    .vge-fade { animation: fadeIn 0.25s cubic-bezier(0.16,1,0.3,1); }
    .vge-pulse { animation: pulse 2s infinite; }
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    .vge-skeleton {
      background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 6px;
    }
  `;
  document.head.appendChild(styleEl);
}

// ── Pure helpers ───────────────────────────────────────────
// ── LocalStorage wrapper ──────────────────────────────────
var LS = {
  get: function(k) { try { return JSON.parse(localStorage.getItem(k)); } catch(e) { return null; } },
  set: function(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} }
};


function gv(row, key) {
  if (!row) return "";
  var k = Object.keys(row).find(function(k2) { return k2.trim().toLowerCase() === key.trim().toLowerCase(); });
  return k ? (row[k] == null ? "" : String(row[k])).trim() : "";
}
function ymdToEst(ymd) {
  if (!ymd) return "";
  var p = ymd.split("-");
  return p[2] + "/" + p[1] + "/" + p[0];
}
function parseFechaDay(str) {
  if (!str) return null;
  var m = str.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return m[1].padStart(2,"0") + "/" + m[2].padStart(2,"0");
  return null;
}
function fmtDate(ymd) {
  if (!ymd) return "—";
  try { return new Date(ymd + "T12:00:00").toLocaleDateString("es-MX", { day:"2-digit", month:"long", year:"numeric" }); }
  catch(e) { return ymd; }
}

// ── JSONP helper ───────────────────────────────────────────
// fetch() es bloqueado por CORS cuando llama a script.google.com.
// JSONP inyecta un <script> que no tiene restricción de origen.
var __jpCount = 0;
function jsonp(url) {
  return new Promise(function(resolve, reject) {
    var cb = "__jp" + (++__jpCount);
    var script = document.createElement("script");
    var timer = setTimeout(function() {
      cleanup(); reject(new Error("Timeout: Apps Script no respondió en 30s"));
    }, 30000);
    function cleanup() {
      clearTimeout(timer);
      delete window[cb];
      if (script.parentNode) script.parentNode.removeChild(script);
    }
    window[cb] = function(data) { cleanup(); resolve(data); };
    script.onerror = function() { cleanup(); reject(new Error("Error de red al conectar con Apps Script")); };
    script.src = url + "&callback=" + cb;
    document.head.appendChild(script);
  });
}

// ── Apps Script API calls ──────────────────────────────────
async function fetchGuias(histId, date, extraCols) {
  var ef  = ymdToEst(date);
  var url = APPS_SCRIPT_URL
    + "?action=fetchGuias"
    + "&histId=" + encodeURIComponent(histId)
    + "&fecha="  + encodeURIComponent(ef)
    + (extraCols && extraCols.length ? "&extraCols=" + encodeURIComponent(extraCols.join("|")) : "");
  var d = await jsonp(url);
  if (d.error) throw new Error(d.error);
  return d;
}

async function fetchGuiasRango(histId, fechaIni, fechaFin, extraCols) {
  var url = APPS_SCRIPT_URL
    + "?action=fetchGuiasRango"
    + "&histId="    + encodeURIComponent(histId)
    + "&fechaIni="  + encodeURIComponent(ymdToEst(fechaIni))
    + "&fechaFin="  + encodeURIComponent(ymdToEst(fechaFin))
    + (extraCols && extraCols.length ? "&extraCols=" + encodeURIComponent(extraCols.join("|")) : "");
  var d = await jsonp(url);
  if (d.error) throw new Error(d.error);
  return d;
}

async function clearCache(fecha) {
  var ef  = ymdToEst(fecha);
  var url = APPS_SCRIPT_URL
    + "?action=clearCache"
    + "&fecha=" + encodeURIComponent(ef);
  var d = await jsonp(url);
  return d;
}

async function fetchEst(estId) {
  var url = APPS_SCRIPT_URL
    + "?action=fetchEst"
    + "&estId=" + encodeURIComponent(estId);
  var d = await jsonp(url);
  if (d.error) throw new Error(d.error);
  return d;
}

async function appendToEst(estId, sheetName, value) {
  var url = APPS_SCRIPT_URL
    + "?action=appendEst"
    + "&estId="  + encodeURIComponent(estId)
    + "&sheet="  + encodeURIComponent(sheetName)
    + "&value="  + encodeURIComponent(value);
  var d = await jsonp(url);
  if (d.error) throw new Error(d.error);
}

// ── Nuevas funciones API para Sheets ──────────────────────
async function fetchAuths(estId) {
  var url = APPS_SCRIPT_URL + "?action=fetchAuths&estId=" + encodeURIComponent(estId);
  var d = await jsonp(url);
  if (d.error) throw new Error(d.error);
  return d.auths || [];
}
async function appendAuth(estId, auth) {
  var url = APPS_SCRIPT_URL
    + "?action=appendAuth"
    + "&estId=" + encodeURIComponent(estId)
    + "&auth="  + encodeURIComponent(JSON.stringify(auth));
  var d = await jsonp(url);
  if (d.error) throw new Error(d.error);
}
async function fetchRulesFromSheet(estId) {
  var url = APPS_SCRIPT_URL + "?action=fetchRules&estId=" + encodeURIComponent(estId);
  var d = await jsonp(url);
  if (d.error) throw new Error(d.error);
  return d;
}
async function saveRulesToSheet(estId, kind, rules) {
  var url = APPS_SCRIPT_URL
    + "?action=saveRules"
    + "&estId=" + encodeURIComponent(estId)
    + "&kind="  + encodeURIComponent(kind)
    + "&rules=" + encodeURIComponent(JSON.stringify(rules));
  var d = await jsonp(url);
  if (d.error) throw new Error(d.error);
}
async function fetchCatalogos(estId) {
  var url = APPS_SCRIPT_URL + "?action=fetchCatalogos&estId=" + encodeURIComponent(estId);
  var d = await jsonp(url);
  if (d.error) throw new Error(d.error);
  return d; // { nombres: [...], motivos: [...] }
}

async function fetchRejectMotivosAPI(estId) {
  var url = APPS_SCRIPT_URL + "?action=fetchRejectMotivos&estId=" + encodeURIComponent(estId);
  var d = await jsonp(url);
  if (d.error) throw new Error(d.error);
  return d.motivos || [];
}

async function fetchWsConfFromSheet(estId) {
  var url = APPS_SCRIPT_URL + "?action=fetchWsConf&estId=" + encodeURIComponent(estId);
  var d = await jsonp(url);
  if (d.error) throw new Error(d.error);
  return d;
}
async function saveWsConfToSheet(estId, conf) {
  var url = APPS_SCRIPT_URL
    + "?action=saveWsConf"
    + "&estId=" + encodeURIComponent(estId)
    + "&conf="  + encodeURIComponent(JSON.stringify(conf));
  var d = await jsonp(url);
  if (d.error) throw new Error(d.error);
}

// ── Rule engine ────────────────────────────────────────────
function evalRule(rule, row) {
  var fv = gv(row, rule.field), fvU = fv.toUpperCase(), rv = (rule.val || "").toUpperCase();
  if (rule.op === "contains")   return fvU.includes(rv);
  if (rule.op === "startsWith") return fvU.startsWith(rv);
  if (rule.op === "equals")     return fvU === rv;
  if (rule.op === "regex") { try { return new RegExp(rule.val,"i").test(fv); } catch(e) { return false; } }
  return false;
}
function evalRules(rules, row) {
  for (var i = 0; i < rules.length; i++) { if (rules[i].active && evalRule(rules[i], row)) return rules[i].result; }
  return "Revisar";
}
function calcTO(rules, row) { return evalRules(rules, row); }
function calcTD(rules, row) {
  var A = gv(row,"Alias Dirección Origen").toUpperCase(), R = gv(row,"Razón Social Destino").toUpperCase();
  if (A.includes("ALMACEN") && (R.includes("OXXO")||R.includes("CHEDRAUI")||R.includes("WALMART"))) return "Cadenas Comerciales";
  return evalRules(rules, row);
}
var SENSIBLE = ["Garantía Cliente","Cadenas Comerciales","Ecommerce","Ecommerce / Dir. a Cliente","Telemarketing"];
function calcCrit(ok, to, td) {
  if (ok) return "OK";
  if (to==="Revisar"&&td==="Revisar") return "Crítico";
  if (to==="Revisar"||td==="Revisar") return "Alto";
  if (SENSIBLE.includes(to)||SENSIBLE.includes(td)) return "Alto";
  return "Medio";
}

// ── Validation ─────────────────────────────────────────────
function validateCmd(row, cGuias, eO, eD, eU, eC, orR, dtR) {
  var guia = gv(row,"No. de guía"), cn = parseFloat(gv(row,"Número de cliente"));
  var ro = gv(row,"Razón Social Origen"), rd = gv(row,"Razón Social Destino");
  var usr = gv(row,"Usuario que le generó"), cont = gv(row,"Contenido");
  var issues = [];
  if (!VALID_CLIENTS.has(cn))   issues.push({ s:"anomalia",   m:"Cliente inválido: "+(isNaN(cn)?"vacío":cn) });
  if (!guia)                    issues.push({ s:"anomalia",   m:"Número de guía vacío" });
  if (guia && cGuias.filter(function(g){return g===guia;}).length>1) issues.push({ s:"anomalia", m:"Guía duplicada en Comando" });
  var origOK = eO.size===0||eO.has(ro.toLowerCase()), destOK = eD.size===0||eD.has(rd.toLowerCase());
  var usrOK  = eU.size===0||eU.has(usr.toLowerCase()), contOK = eC.size===0||eC.has(cont.toLowerCase());
  if (!origOK) issues.push({ s:"sospechosa", m:"AH: Origen no estandarizado: "+(ro||"vacío"),  field:"Razón Social Origen",    sheet:"Orígenes",   value:ro   });
  if (!destOK) issues.push({ s:"sospechosa", m:"AI: Destino no estandarizado: "+(rd||"vacío"),  field:"Razón Social Destino",   sheet:"Destinos",   value:rd   });
  if (!usrOK)  issues.push({ s:"sospechosa", m:"AJ: Usuario no estandarizado: "+(usr||"vacío"), field:"Usuario que le generó",  sheet:"Usuarios",   value:usr  });
  if (!contOK) issues.push({ s:"sospechosa", m:"AK: Contenido no estandarizado: "+(cont||"vacío"),field:"Contenido",            sheet:"Contenidos", value:cont });
  var confOK = origOK&&destOK&&usrOK&&contOK;
  var to=calcTO(orR,row), td=calcTD(dtR,row), crit=calcCrit(confOK,to,td);
  var hasA=issues.some(function(i){return i.s==="anomalia";}), hasS=issues.some(function(i){return i.s==="sospechosa";});
  return {
    id:"CMD-"+guia+"-"+Math.random().toString(36).slice(2), guia:guia, source:"Comando",
    status:hasA?"anomalia":hasS?"sospechosa":"valida",
    issues:issues.map(function(i){return i.m;}),
    pendienteEst:issues.filter(function(i){return i.value;}),
    confirmacion:confOK?"OK":"Revisar", tipoOrigen:to, tipoDestino:td, criticidad:crit,
    razonSocial:gv(row,"Razón Social del cliente"), referencia:gv(row,"Referencia del ítem"),
    cliente:isNaN(cn)?"":String(cn), usuario:usr, fecha:gv(row,"Fecha de generación"), row:row
  };
}
function validateWS(row, cGuiaSet, wsConf) {
  var guia = gv(row,"guía"); if (!guia||cGuiaSet.has(guia)) return null;
  var ref=gv(row,"referencia"), cn=parseFloat(gv(row,"número de cliente"));
  var clientStr=isNaN(cn)?"":String(Math.round(cn));
  var hasTR=wsConf.trKeywords.some(function(k){return ref.indexOf(k)!==-1;});
  var hasCam=wsConf.camKeywords.some(function(k){return ref.toLowerCase().indexOf(k.toLowerCase())!==-1;});
  var ref2=ref.substring(0,2), ecMap={};
  wsConf.ecPrefixes.forEach(function(ep){ecMap[ep.prefix]=ep.accounts.split(",").map(function(a){return a.trim();});});
  var isEcom=(ecMap[ref2]||[]).indexOf(clientStr)!==-1;
  var isConcen=ref===""&&wsConf.concentradoraAccounts.indexOf(clientStr)!==-1;
  var confOK=hasTR||hasCam||isEcom||isConcen;
  var tipo=isEcom?"Ecommerce":isConcen?"Cuenta Concentradora":hasTR?"Traspaso":hasCam?"Cambio Catálogo":"—";
  var issues=[];
  if(!VALID_CLIENTS.has(cn)) issues.push({s:"anomalia",m:"Cliente inválido: "+(clientStr||"vacío")});
  if(!confOK) issues.push({s:"sospechosa",m:"J: Sin patrón autorizado (TR/Cambio catálogo/Ecommerce/Cuenta Concentradora)"});
  var hasA=issues.some(function(i){return i.s==="anomalia";}), hasS=issues.some(function(i){return i.s==="sospechosa";});
  return {
    id:"WS-"+guia+"-"+Math.random().toString(36).slice(2), guia:guia, source:"Web Service",
    status:hasA?"anomalia":hasS?"sospechosa":"valida",
    issues:issues.map(function(i){return i.m;}), pendienteEst:[],
    confirmacion:confOK?"OK":"Revisar", tipoOrigen:tipo, tipoDestino:"—", criticidad:calcCrit(confOK,tipo,"—"),
    razonSocial:gv(row,"razón social"), referencia:ref,
    cliente:clientStr, usuario:gv(row,"razón social"), fecha:gv(row,"fecha recolección"), row:row
  };
}

// ── Sub-components — Enterprise Design System ──────────────

function Empty(props) {
  return (
    <div className="vge-fade" style={{ textAlign:"center", padding:"64px 24px" }}>
      <div style={{
        width:52, height:52, borderRadius:T.r12, background:T.bgHover,
        border:"1px solid "+T.borderLight, display:"flex", alignItems:"center",
        justifyContent:"center", margin:"0 auto 16px"
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="1.5">
          <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M8 2v4M16 2v4M2 10h20"/>
        </svg>
      </div>
      <div style={{ fontSize:14, fontWeight:600, color:T.textSec, marginBottom:4 }}>{props.msg}</div>
      {props.sub && <div style={{ fontSize:12, color:T.textMuted, marginBottom:20 }}>{props.sub}</div>}
      {props.cta && (
        <button onClick={props.onCta} className="vge-btn-primary" style={{
          padding:"9px 20px", background:T.accentBlue, color:"white", border:"none",
          borderRadius:T.r8, fontSize:13, cursor:"pointer", fontWeight:600,
          boxShadow:"0 2px 10px rgba(59,130,246,0.35)"
        }}>{props.cta}</button>
      )}


    </div>
  );
}

// Extrae clave de día "YYYY-MM-DD" desde ISO o DD/MM/YYYY (las fechas de auths/rechazos son ISO)
function dayKeyAny(str) {
  if (!str) return null;
  str = String(str).trim();
  var iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[1] + "-" + iso[2] + "-" + iso[3];
  var dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) return dmy[3] + "-" + dmy[2].padStart(2,"0") + "-" + dmy[1].padStart(2,"0");
  return null;
}
function dayKeyToLabel(k) { if(!k) return ""; var d=k.split("-"); return d[2]+"/"+d[1]+"/"+d[0]; }

// Panel de detalle de una guía (campos del registro crudo). row puede ser undefined.
function GuiaDetalle(props) {
  var row = props.row;
  if (!row) return (
    <div style={{ background:T.bgSurface, border:"1px solid "+T.borderFaint, borderRadius:T.r8, padding:14,
      fontSize:11, color:T.textMuted }}>
      Detalle completo no disponible: la guía no está en el período cargado actualmente. Carga el período correspondiente en Inicio para ver el desglose.
    </div>
  );
  var campos = [
    ["Fecha gen./recol.", gv(row,"Fecha de generación")||gv(row,"fecha recolección")||gv(row,"Fecha de recolección")],
    ["Centro de costo", gv(row,"Centro de costo")],
    ["Razón Social Origen", gv(row,"Razón Social Origen")],
    ["Alias Dirección Origen", gv(row,"Alias Dirección Origen")],
    ["Razón Social Destino", gv(row,"Razón Social Destino")],
    ["Alias Dirección Destino", gv(row,"Alias Dirección Destino")],
    ["Contenido", gv(row,"Contenido")],
    ["Usuario", gv(row,"Usuario que le generó")]
  ];
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:12,
      background:T.bgSurface, border:"1px solid "+T.borderFaint, borderRadius:T.r8, padding:14 }}>
      {campos.map(function(pair,j){
        return (
          <div key={j} style={{ minWidth:0 }}>
            <div style={{ fontSize:9,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:3 }}>{pair[0]}</div>
            <div style={{ fontSize:12,color:T.textPrimary,fontWeight:500,wordBreak:"break-word" }}>{pair[1]||"—"}</div>
          </div>
        );
      })}
    </div>
  );
}

function SBadge(props) {
  var sc = SC[props.s] || SC.valida;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:4, padding:"3px 9px",
      borderRadius:20, fontSize:10, fontWeight:600, letterSpacing:"0.02em",
      background:sc.bg, color:sc.c, border:"1px solid "+sc.bc, whiteSpace:"nowrap"
    }}>
      <span style={{fontSize:9}}>{sc.ic}</span>{sc.l}
    </span>
  );
}

function CBadge(props) {
  var c=CC[props.v]||T.textMuted, bg=CBG[props.v]||T.bgHover;
  return (
    <span style={{
      display:"inline-flex", padding:"2px 8px", borderRadius:20,
      fontSize:10, fontWeight:600, background:bg, color:c,
      border:"1px solid "+c+"40", whiteSpace:"nowrap"
    }}>{props.v||"—"}</span>
  );
}

function StatCard(props) {
  var pct = props.total>0&&props.i>0 ? Math.round(props.v/props.total*100) : null;
  return (
    <div className="vge-card" style={{
      background:T.bgSurface, borderRadius:T.r12, padding:"18px 20px",
      border:"1px solid "+T.borderFaint, position:"relative", overflow:"hidden", cursor:"default",
      boxShadow:"0 2px 8px rgba(0,0,0,0.12)"
    }}>
      <div style={{ position:"absolute",top:0,left:0,right:0,height:2,
        background:"linear-gradient(90deg,transparent,"+props.accent+",transparent)", opacity:0.8 }}/>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
        <div style={{ width:34,height:34,borderRadius:T.r8,background:props.accent+"15",
          border:"1px solid "+props.accent+"30",display:"flex",alignItems:"center",justifyContent:"center" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={props.accent} strokeWidth="2">{props.icon}</svg>
        </div>
        {pct!==null&&<span style={{ fontSize:11,fontWeight:600,color:props.accent,
          background:props.accent+"18",padding:"2px 8px",borderRadius:20 }}>{pct}%</span>}
      </div>
      <div style={{ fontSize:28,fontWeight:700,color:T.textPrimary,lineHeight:1,marginBottom:4,
        fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em" }}>{props.v.toLocaleString()}</div>
      <div style={{ fontSize:11,fontWeight:500,color:T.textSec }}>{props.l}</div>


    </div>
  );
}

function AddKw(props) {
  var st = useState(""); var v = st[0], setV = st[1];
  return (
    <div style={{ display:"flex", gap:8 }}>
      <input value={v} placeholder={props.placeholder||"Agregar…"} style={Object.assign({},selSt,{flex:1})}
        onChange={function(e){setV(e.target.value);}}
        onKeyDown={function(e){if(e.key==="Enter"&&v){props.onAdd(v);setV("");}}} />
      <button onClick={async function(){if(v){await props.onAdd(v);setV("");}}} disabled={!v}
        style={{ padding:"7px 14px",background:v?T.accentBlue:T.bgHover,color:v?"white":T.textMuted,
          border:"1px solid "+(v?T.accentBlue:T.borderLight),borderRadius:T.r8,
          fontSize:12,cursor:v?"pointer":"not-allowed",fontWeight:600,whiteSpace:"nowrap" }}>
        + Agregar
      </button>


    </div>
  );
}

function AddEcPfx(props) {
  var pSt=useState(""); var p=pSt[0],setP=pSt[1];
  var aSt=useState(""); var a=aSt[0],setA=aSt[1];
  return (
    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
      <input value={p} placeholder="Prefijo" style={Object.assign({},selSt,{width:80})} onChange={function(e){setP(e.target.value);}} />
      <input value={a} placeholder="Cuentas: 5901359,5011124" style={Object.assign({},selSt,{flex:1,minWidth:140})} onChange={function(e){setA(e.target.value);}} />
      <button onClick={async function(){if(p&&a){await props.onAdd(p.trim(),a.trim());setP("");setA("");}}} disabled={!p||!a}
        style={{ padding:"7px 14px",background:p&&a?T.accentBlue:T.bgHover,color:p&&a?"white":T.textMuted,
          border:"1px solid "+(p&&a?T.accentBlue:T.borderLight),borderRadius:T.r8,
          fontSize:12,cursor:p&&a?"pointer":"not-allowed",fontWeight:600 }}>
        + Agregar
      </button>


    </div>
  );
}

function RulesTable(props) {
  var emptyN = { field:CMD_FIELD_DEFS[0].key, op:"contains", val:"", result:"" };
  var nSt = useState(emptyN); var nr = nSt[0], setNr = nSt[1];
  function opLabel(k) { var o=OPS.find(function(op){return op.key===k;}); return o?o.label:k; }
  function toggle(id) { props.onSave(props.rules.map(function(r){return r.id===id?Object.assign({},r,{active:!r.active}):r;})); }
  function remove(id) { props.onSave(props.rules.filter(function(r){return r.id!==id;})); }
  function add() {
    if (!nr.val||!nr.result) return;
    props.onSave(props.rules.concat([Object.assign({},nr,{id:"r"+Date.now(),active:true})]));
    setNr(emptyN);
  }
  return (
    <div style={{ marginBottom:28 }}>
      <div style={{ fontWeight:600, fontSize:14, color:T.textPrimary, marginBottom:4 }}>{props.title}</div>
      {props.subtitle && (
        <div style={{ fontSize:11, color:T.warning, marginBottom:12, padding:"10px 14px",
          background:T.warningBg, borderRadius:T.r8, border:"1px solid "+T.warningBd }}>
          ⚠ {props.subtitle}
        </div>
      )}
      <div style={{ borderRadius:T.r10, border:"1px solid "+T.borderFaint, overflow:"hidden", marginBottom:10 }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
          <thead>
            <tr style={{ background:T.bgPanel, borderBottom:"1px solid "+T.borderFaint }}>
              {["#","Campo","Op.","Valor","Resultado","Estado",""].map(function(h,i){
                return <th key={i} style={thSt}>{h}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {props.rules.map(function(r, i) {
              return (
                <tr key={r.id} className="vge-row" style={{
                  borderBottom:"1px solid "+T.borderFaint,
                  opacity:r.active?1:0.45, background:"transparent"
                }}>
                  <td style={Object.assign({},tdSt,{color:T.textMuted,fontSize:11})}>{i+1}</td>
                  <td style={Object.assign({},tdSt,{maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",
                    whiteSpace:"nowrap",color:T.textSec})} title={r.field}>{r.field}</td>
                  <td style={Object.assign({},tdSt,{color:T.textMuted,fontSize:11})}>{opLabel(r.op)}</td>
                  <td style={Object.assign({},tdSt,{fontFamily:"'SF Mono',monospace",fontWeight:600,
                    color:T.accentBlueLt,fontSize:11})}>{r.val}</td>
                  <td style={tdSt}>
                    <span style={{ padding:"2px 9px",borderRadius:20,fontSize:10,fontWeight:600,
                      background:T.accentGlow,color:T.accentBlueLt,border:"1px solid "+T.borderBlue }}>
                      {r.result}
                    </span>
                  </td>
                  <td style={tdSt}>
                    <button onClick={function(){toggle(r.id);}} style={{
                      padding:"3px 10px",borderRadius:20,fontSize:10,cursor:"pointer",border:"1px solid",
                      background:r.active?T.successBg:T.bgHover,
                      color:r.active?T.success:T.textMuted,
                      borderColor:r.active?T.successBd:T.borderLight
                    }}>
                      {r.active?"● Activa":"Pausada"}
                    </button>
                  </td>
                  <td style={tdSt}>
                    <button onClick={function(){remove(r.id);}} style={{
                      padding:"3px 10px",borderRadius:20,fontSize:10,cursor:"pointer",border:"1px solid",
                      background:T.dangerBg,color:T.danger,borderColor:T.dangerBd
                    }}>Eliminar</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Formulario para nueva regla */}
      <div style={{ padding:14,background:T.bgPanel,borderRadius:T.r10,
        border:"1px solid "+T.borderFaint,display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end" }}>
        {[
          { label:"Campo", el:
            <select value={nr.field} style={selSt} onChange={function(e){setNr(function(r){return Object.assign({},r,{field:e.target.value});});}}>
              {CMD_FIELD_DEFS.map(function(f){ return <option key={f.key} value={f.key}>{f.label}</option>; })}
            </select>
          },
          { label:"Operador", el:
            <select value={nr.op} style={selSt} onChange={function(e){setNr(function(r){return Object.assign({},r,{op:e.target.value});});}}>
              {OPS.map(function(o){ return <option key={o.key} value={o.key}>{o.label}</option>; })}
            </select>
          },
          { label:"Valor", el:
            <input value={nr.val} placeholder="ej. CEDISST"
              style={Object.assign({},selSt,{minWidth:120})}
              onChange={function(e){setNr(function(r){return Object.assign({},r,{val:e.target.value});});}} />
          },
          { label:"Resultado", el:
            <input value={nr.result} placeholder="ej. Tienda"
              style={Object.assign({},selSt,{minWidth:140})}
              onChange={function(e){setNr(function(r){return Object.assign({},r,{result:e.target.value});});}} />
          }
        ].map(function(f){
          return (
            <div key={f.label}>
              <div style={{ fontSize:10,fontWeight:600,marginBottom:4,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.06em" }}>{f.label}</div>
              {f.el}
            </div>
          );
        })}
        <button onClick={add} disabled={!nr.val||!nr.result}
          style={{ padding:"8px 18px",color:"white",border:"none",borderRadius:T.r8,fontSize:12,fontWeight:600,
            cursor:nr.val&&nr.result?"pointer":"not-allowed",
            background:nr.val&&nr.result?T.accentBlue:T.bgHover }}>
          + Agregar regla
        </button>
      </div>


    </div>
  );
}

// ── App ────────────────────────────────────────────────────
export default function App() {
  var tabSt  = useState("inicio"); var tab=tabSt[0],setTab=tabSt[1];
  var dateSt    = useState(new Date().toISOString().split("T")[0]); var date=dateSt[0],setDate=dateSt[1];
  var dateEndSt = useState(new Date().toISOString().split("T")[0]); var dateEnd=dateEndSt[0],setDateEnd=dateEndSt[1];
  var modeSt    = useState("dia"); var queryMode=modeSt[0],setQueryMode=modeSt[1]; // dia | rango | mes | anio
  var dashPeriodSt = useState("dia"); var dashPeriod=dashPeriodSt[0],setDashPeriod=dashPeriodSt[1]; // dia | semana | mes | anio
  var hIdSt  = useState(DEF_HIST_ID);  var histId=hIdSt[0],setHistId=hIdSt[1];
  var eIdSt  = useState(DEF_EST_ID);   var estId=eIdSt[0],setEstId=eIdSt[1];
  var resSt  = useState([]); var results=resSt[0],setResults=resSt[1];
  var eOSt   = useState(new Set()); var estOrig=eOSt[0],setEstOrig=eOSt[1];
  var eDSt   = useState(new Set()); var estDest=eDSt[0],setEstDest=eDSt[1];
  var eCxSt  = useState(new Set()); var estCont=eCxSt[0],setEstCont=eCxSt[1];
  var eUSt   = useState(new Set()); var estUsers=eUSt[0],setEstUsers=eUSt[1];
  var authsSt= useState([]); var auths=authsSt[0],setAuths=authsSt[1];
  var histSt = useState([]); var hist=histSt[0],setHist=histSt[1];
  var fltSt  = useState({s:"todos",src:"todos",q:"",f:"todos",to_origen:"todos",to_destino:"todos"}); var flt=fltSt[0],setFlt=fltSt[1];
  var expSt  = useState(null); var expRow=expSt[0],setExpRow=expSt[1];
  var aFltSt = useState({src:"todos",f:"todos",q:""}); var aFlt=aFltSt[0],setAFlt=aFltSt[1];
  var rFltSt = useState({src:"todos",f:"todos",q:""}); var rFlt=rFltSt[0],setRFlt=rFltSt[1];
  var dashFiltSt = useState({mode:"todos",val:"",from:"",to:""}); var dashFilt=dashFiltSt[0],setDashFilt=dashFiltSt[1];
  var modalSt= useState(null); var modal=modalSt[0],setModal=modalSt[1];
  var mmodSt  = useState(null); var mmod=mmodSt[0],setMmod=mmodSt[1];
  var rFormSt = useState({name:"",reason:""}); var rForm=rFormSt[0],setRForm=rFormSt[1];
  var rejectsSt = useState([]); var rejects=rejectsSt[0],setRejects=rejectsSt[1];
  var rLoadingSt = useState(false); var rLoading=rLoadingSt[0],setRLoading=rLoadingSt[1];
  var mfSt   = useState({name:"",reason:""}); var mForm=mfSt[0],setMForm=mfSt[1];
  var eoSt   = useState({}); var estOpts=eoSt[0],setEstOpts=eoSt[1];
  var loadSt = useState(false); var loading=loadSt[0],setLoading=loadSt[1];
  var lmSt   = useState(""); var loadMsg=lmSt[0],setLoadMsg=lmSt[1];
  var noteSt = useState(null); var note=noteSt[0],setNote=noteSt[1];
  var orSt   = useState(DEFAULT_ORIGEN_RULES); var orRules=orSt[0],setOrRules=orSt[1];
  var dtSt   = useState(DEFAULT_DESTINO_RULES); var dtRules=dtSt[0],setDtRules=dtSt[1];
  var wcSt   = useState(DEFAULT_WS_CONFIG); var wsConf=wcSt[0],setWsConf=wcSt[1];
  var showCfgSt = useState(false); var showCfg=showCfgSt[0],setShowCfg=showCfgSt[1];
  var catSt    = useState({nombres:[],motivos:[]}); var catalogos=catSt[0],setCatalogos=catSt[1];
  var motManSt = useState(""); var motManual=motManSt[0],setMotManual=motManSt[1];
  var motRechSt = useState([]); var motivosRech=motRechSt[0],setMotivosRech=motRechSt[1];
  var motRechManSt = useState(""); var motRechManual=motRechManSt[0],setMotRechManual=motRechManSt[1];

  useEffect(function() {
    // IDs guardados localmente
    function loadLS(k, fn) {
      var r = LS.get(k);
      if (r && r.value) { try { fn(JSON.parse(r.value)); } catch(e) {} }
    }
    loadLS("hist",   function(v){setHist(v);});
    loadLS("histId", function(v){setHistId(v);});
    loadLS("estId",  function(v){setEstId(v);});

    // Cargar desde Google Sheets al iniciar
    var eid = (function(){ var r=LS.get("estId"); return r&&r.value?JSON.parse(r.value):DEF_EST_ID; })();

    // Autorizaciones desde Sheet
    fetchAuths(eid).then(function(rows) {
      // Convertir filas del sheet al formato interno
      var parsed = rows.map(function(r) {
        return {
          guia:       r["Guía"]||r["guia"]||"",
          source:     r["Fuente"]||r["source"]||"",
          original:   r["Original"]||r["original"]||"",
          criticidad: r["Criticidad"]||r["criticidad"]||"",
          issues:     (r["Problemas"]||r["issues"]||"").split(";").map(function(s){return s.trim();}).filter(Boolean),
          name:       r["Autorizado por"]||r["name"]||"",
          reason:     r["Motivo"]||r["reason"]||"",
          fecha:      r["Fecha"]||r["fecha"]||""
        };
      });
      setAuths(parsed);
    }).catch(function(){});

    // Rechazadas desde Sheet
    fetchRejections(eid).then(function(rows) {
      var parsed = rows.map(function(r) {
        return {
          guia:       r["Guía"]||r["guia"]||"",
          source:     r["Fuente"]||r["source"]||"",
          original:   r["Original"]||r["original"]||"",
          criticidad: r["Criticidad"]||r["criticidad"]||"",
          problemas:  r["Problemas"]||r["problemas"]||"",
          rejectedBy: r["Rechazada por"]||r["rejectedBy"]||"",
          motivo:     r["Motivo"]||r["motivo"]||"",
          fecha:      r["Fecha"]||r["fecha"]||""
        };
      });
      setRejects(parsed);
    }).catch(function(){});

    // Reglas desde Sheet
    fetchRulesFromSheet(eid).then(function(d) {
      if (d.origenRules  && d.origenRules.length  > 0) setOrRules(d.origenRules);
      if (d.destinoRules && d.destinoRules.length > 0) setDtRules(d.destinoRules);
    }).catch(function(){});

    // Patrones WS desde Sheet
    fetchWsConfFromSheet(eid).then(function(d) {
      if (d && (d.trKeywords||d.camKeywords||d.ecPrefixes||d.concentradoraAccounts)) {
        setWsConf({
          trKeywords:            d.trKeywords            || DEFAULT_WS_CONFIG.trKeywords,
          camKeywords:           d.camKeywords           || DEFAULT_WS_CONFIG.camKeywords,
          ecPrefixes:            d.ecPrefixes            || DEFAULT_WS_CONFIG.ecPrefixes,
          concentradoraAccounts: d.concentradoraAccounts || DEFAULT_WS_CONFIG.concentradoraAccounts
        });
      }
    }).catch(function(){});

    // Catálogos: nombres autorizadores y motivos históricos
    fetchCatalogos(eid).then(function(d) {
      if (d) setCatalogos({ nombres: d.nombres||[], motivos: d.motivos||[] });
    }).catch(function(){});

    // Motivos de rechazo (col Motivo de "Historial de Rechazadas")
    fetchRejectMotivosAPI(eid).then(function(mots) {
      setMotivosRech(mots || []);
    }).catch(function(){});
  }, []);

  function notify(msg, ok) {
    if (ok===undefined) ok=true;
    setNote({msg:msg,ok:ok});
    setTimeout(function(){setNote(null);}, 4000);
  }

  // ── Helpers de agrupación temporal para el Dashboard ──────
  // Convierte "dd/mm/yyyy HH:MM" → clave según granularidad
  function fechaToKey(str, granularity) {
    if (!str) return null;
    var m = str.trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (!m) return null;
    var dd = m[1].padStart(2,"0"), mm = m[2].padStart(2,"0"), yyyy = m[3];
    if (granularity === "dia")    return yyyy + "-" + mm + "-" + dd;
    if (granularity === "mes")    return yyyy + "-" + mm;
    if (granularity === "anio")   return yyyy;
    if (granularity === "semana") {
      // Número de semana ISO
      var d = new Date(parseInt(yyyy), parseInt(mm)-1, parseInt(dd));
      var dayOfWeek = d.getDay() || 7; // lunes=1
      d.setDate(d.getDate() + 4 - dayOfWeek);
      var yearStart = new Date(d.getFullYear(), 0, 1);
      var week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
      return d.getFullYear() + "-S" + String(week).padStart(2,"0");
    }
    return yyyy + "-" + mm + "-" + dd;
  }

  // Etiqueta legible para el eje X según granularidad
  function keyToLabel(key, granularity) {
    if (!key) return key;
    if (granularity === "dia") {
      var p = key.split("-");
      return p[2] + "/" + p[1];
    }
    if (granularity === "semana") return key.replace("-", " ");
    if (granularity === "mes") {
      var meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
      var pm = key.split("-");
      return meses[parseInt(pm[1])-1] + " " + pm[0];
    }
    return key; // año: solo el número
  }

  // Agrupa resultados por granularidad para gráficas de tendencia
  function groupByPeriod(rows, source, granularity) {
    var map = {};
    rows.filter(function(r){ return source === "todos" || r.source === source; })
      .forEach(function(r) {
        var k = fechaToKey(r.fecha, granularity);
        if (!k) return;
        if (!map[k]) map[k] = { total:0, validas:0, sospechosas:0, anomalias:0, autorizadas:0, rechazadas:0 };
        map[k].total++;
        if (r.status === "valida")      map[k].validas++;
        if (r.status === "sospechosa")  map[k].sospechosas++;
        if (r.status === "anomalia")    map[k].anomalias++;
        if (r.status === "autorizada")  map[k].autorizadas++;
        if (r.status === "rechazada")   map[k].rechazadas++;
      });
    return Object.entries(map)
      .sort(function(a,b){ return a[0].localeCompare(b[0]); })
      .map(function(e){ return Object.assign({ key:e[0], label:keyToLabel(e[0],granularity) }, e[1]); });
  }

  // Genera rango de fechas ini/fin según el modo de consulta seleccionado
  function getRangoFromMode() {
    var today = new Date().toISOString().split("T")[0];
    if (queryMode === "dia")   return { ini: date,    fin: date };
    if (queryMode === "rango") return { ini: date,    fin: dateEnd };
    if (queryMode === "mes") {
      var ym = date.slice(0,7); // "yyyy-mm"
      var firstDay = ym + "-01";
      var tmp = new Date(date.slice(0,4), parseInt(date.slice(5,7)), 0); // último día del mes
      var lastDay  = ym + "-" + String(tmp.getDate()).padStart(2,"0");
      return { ini: firstDay, fin: lastDay > today ? today : lastDay };
    }
    if (queryMode === "anio") {
      var yr = date.slice(0,4);
      var lastDayAnio = yr + "-12-31";
      return { ini: yr + "-01-01", fin: lastDayAnio > today ? today : lastDayAnio };
    }
    return { ini: date, fin: date };
  }

  // Genera array de fechas YYYY-MM-DD entre dos fechas
  function getDatesInRange(from, to) {
    var dates = [];
    var cur = new Date(from + "T12:00:00");
    var end = new Date(to   + "T12:00:00");
    if (cur > end) { var tmp=cur; cur=end; end=tmp; } // orden ascendente
    while (cur <= end) {
      dates.push(cur.toISOString().split("T")[0]);
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }

  async function runValidation() {
    if (!date) return;
    setLoading(true);
    try {
      var rango    = getRangoFromMode();
      var rangoIni = rango.ini, rangoFin = rango.fin;
      var dates    = getDatesInRange(rangoIni, rangoFin);
      var esGrande = dates.length > 7; // más de 7 días → llamada única al rango

      // Columnas de reglas activas
      var extraCols = [];
      orRules.concat(dtRules).forEach(function(r){ if(r.active && r.field) extraCols.push(r.field); });
      extraCols = extraCols.filter(function(v,i,a){ return a.indexOf(v)===i; });

      // Cargar estandarizado una sola vez
      setLoadMsg(" Cargando estandarizado…");
      var estData = await fetchEst(estId);
      var nO = new Set(estData.origenes.map(function(v){return String(v).toLowerCase();}));
      var nD = new Set(estData.destinos.map(function(v){return String(v).toLowerCase();}));
      var nC = new Set(estData.contenidos.map(function(v){return String(v).toLowerCase();}));
      var nU = new Set(estData.usuarios.map(function(v){return String(v).toLowerCase();}));
      setEstOrig(nO); setEstDest(nD); setEstCont(nC); setEstUsers(nU);
      LS.set("estOrig",  JSON.stringify(Array.from(nO)));
      LS.set("estDest",  JSON.stringify(Array.from(nD)));
      LS.set("estCont",  JSON.stringify(Array.from(nC)));
      LS.set("estUsers", JSON.stringify(Array.from(nU)));

      var cd = [], wd = [];
      if (esGrande) {
        // Modo eficiente: una sola llamada para mes/año
        setLoadMsg(" Leyendo rango completo (" + dates.length + " días) desde Sheets…");
        var rangoData = await fetchGuiasRango(histId, rangoIni, rangoFin, extraCols);
        cd = rangoData.comando    || [];
        wd = rangoData.webService || [];
      } else {
        // Modo paralelo: una llamada por día (hasta 7 días)
        setLoadMsg(" Leyendo " + dates.length + " día(s) desde Google Sheets…");
        var dayResults = await Promise.all(dates.map(function(d) {
          return fetchGuias(histId, d, extraCols).catch(function(e) {
            return { comando: [], webService: [], error: e.message };
          });
        }));
        dayResults.forEach(function(dr) {
          cd = cd.concat(dr.comando    || []);
          wd = wd.concat(dr.webService || []);
        });
      }

      setLoadMsg("⚙️ Validando " + (cd.length + wd.length) + " guías…");
      var cGuias   = cd.map(function(r){return gv(r,"No. de guía");});
      var cGuiaSet = new Set(cGuias);
      var authSet   = new Set(auths.map(function(a){return a.source+"|"+a.guia;}));
      // Rechazos: matchear por GUÍA (único global). NO filtrar por fecha aquí —
      // results ya viene filtrado por período, igual que con auths.
      var rejectGuiaSet = new Set(rejects.map(function(a){return String(a.guia).trim();}));
      var cmdRes   = cd.map(function(r){return validateCmd(r,cGuias,nO,nD,nU,nC,orRules,dtRules);});
      var wsRaw    = wd.map(function(r){return validateWS(r,cGuiaSet,wsConf);});
      var disc     = wsRaw.filter(function(r){return r===null;}).length;
      var wsRes    = wsRaw.filter(function(r){return r!==null;});
      var all = cmdRes.concat(wsRes).map(function(r){
        if (rejectGuiaSet.has(String(r.guia).trim())) return Object.assign({},r,{status:"rechazada"});
        if (authSet.has(r.source+"|"+r.guia))         return Object.assign({},r,{status:"autorizada"});
        return r;
      });
      setResults(all);

      // Ajustar dashPeriod automáticamente según lo consultado
      if (queryMode === "anio")        setDashPeriod("mes");
      else if (queryMode === "mes")    setDashPeriod("semana");
      else if (dates.length > 1)       setDashPeriod("dia");
      else                             setDashPeriod("dia");
      // Resetear filtro de rango del Dashboard al cargar datos nuevos
      setDashFilt({mode:"todos",val:"",from:"",to:""});

      var modeLabels = { dia:"Día", rango:"Rango", mes:"Mes", anio:"Año" };
      var periodoLabel = queryMode === "dia"
        ? fmtDate(rangoIni)
        : queryMode === "mes"
          ? new Date(rangoIni + "T12:00:00").toLocaleDateString("es-MX",{month:"long",year:"numeric"})
          : queryMode === "anio"
            ? rangoIni.slice(0,4)
            : fmtDate(rangoIni) + " – " + fmtDate(rangoFin);

      var b = {
        id:Date.now(), fecha:new Date().toLocaleString("es-MX"), periodo:periodoLabel,
        modo: modeLabels[queryMode] || queryMode,
        total:all.length, discarded:disc,
        validas:all.filter(function(r){return r.status==="valida";}).length,
        sospechosas:all.filter(function(r){return r.status==="sospechosa";}).length,
        anomalias:all.filter(function(r){return r.status==="anomalia";}).length,
        cmd:cd.length, ws:wsRes.length
      };
      var nh = [b].concat(hist).slice(0,30);
      setHist(nh);
      LS.set("hist", JSON.stringify(nh));
      setTab("dashboard");
      notify(all.length+" guías · " + dates.length + " día(s) · Cmd:"+cd.length+" WS:"+wsRes.length+(disc>0?" · "+disc+" desc.":""));
    } catch(e) {
      notify("Error: "+(e.message||"Verifica la conexión con Apps Script"), false);
      console.error(e);
    }
    setLoadMsg(""); setLoading(false);
  }

  async function fetchRejections(estIdVal) {
    try {
      var url = APPS_SCRIPT_URL + "?action=fetchRejections&estId=" + encodeURIComponent(estIdVal);
      var d = await jsonp(url);
      if (d.error) throw new Error(d.error);
      return d.rechazadas || [];
    } catch(e) { console.warn(e); return []; }
  }

  async function reject() {
    var motivoFinal = rForm.reason === "Otros" ? motRechManual : rForm.reason;
    if (!mmod || !rForm.name || !motivoFinal) return;
    setRLoading(true);
    try {
      var rejection = {
        guia: mmod.guia,
        source: mmod.source,
        original: mmod.status,
        criticidad: mmod.criticidad,
        problemas: (mmod.issues||[]).join("; "),
        rejectedBy: rForm.name,
        motivo: motivoFinal,
        fecha: new Date().toLocaleString("es-MX")
      };
      var url = APPS_SCRIPT_URL 
        + "?action=appendRejection"
        + "&estId=" + encodeURIComponent(estId)
        + "&rejection=" + encodeURIComponent(JSON.stringify(rejection));
      var r = await jsonp(url);
      if (r.error) throw new Error(r.error);
      setResults(function(prev){return prev.map(function(x){return(x.guia===mmod.guia&&x.source===mmod.source)?Object.assign({},x,{status:"rechazada"}):x;});});
      setMmod(null); setRForm({name:"",reason:""}); setMotRechManual(""); setRLoading(false);
      fetchRejections(estId).then(function(d){ setRejects(d); }).catch(function(){});
      // Recargar motivos para que el nuevo aparezca en futuros dropdowns
      fetchRejectMotivosAPI(estId).then(function(mots){ setMotivosRech(mots||[]); }).catch(function(){});
      notify("Guía "+mmod.guia+" rechazada");
    } catch(e) {
      console.error(e);
      setRLoading(false);
    }
  }

  async function authorize() {
    var motivoFinal = mForm.reason === "Otros" ? motManual : mForm.reason;
    if (!mForm.name || !motivoFinal || !modal) return;
    setLoading(true);
    var na = { guia:modal.guia, source:modal.source, original:modal.status, issues:modal.issues,
      tipoOrigen:modal.tipoOrigen, tipoDestino:modal.tipoDestino, criticidad:modal.criticidad,
      name:mForm.name, reason:motivoFinal, fecha:new Date().toLocaleString("es-MX") };
    var newA = [na].concat(auths);
    setAuths(newA);
    // Guardar en Google Sheet
    try { await appendAuth(estId, na); } catch(e) { notify("Advertencia: no se pudo guardar en Sheet: "+e.message, false); }

    var pends = modal.pendienteEst || [];
    for (var i=0; i<pends.length; i++) {
      var p = pends[i];
      if (estOpts[p.field] && p.value) {
        try {
          await appendToEst(estId, p.sheet, p.value);
          var vl = p.value.toLowerCase();
          if (p.sheet==="Orígenes")   setEstOrig(function(s){var n=new Set(s);n.add(vl);return n;});
          if (p.sheet==="Destinos")   setEstDest(function(s){var n=new Set(s);n.add(vl);return n;});
          if (p.sheet==="Contenidos") setEstCont(function(s){var n=new Set(s);n.add(vl);return n;});
          if (p.sheet==="Usuarios")   setEstUsers(function(s){var n=new Set(s);n.add(vl);return n;});
          notify('"' + p.value + '" → ' + p.sheet);
        } catch(e) { notify("Error al actualizar "+p.sheet, false); }
      }
    }
    setResults(function(prev){return prev.map(function(r){return(r.guia===modal.guia&&r.source===modal.source)?Object.assign({},r,{status:"autorizada"}):r;});});
    setModal(null); setMForm({name:"",reason:""}); setEstOpts({}); setMotManual("");
    setLoading(false);
    // Recargar catálogos para que el nuevo motivo aparezca en futuros dropdowns
    fetchCatalogos(estId).then(function(d){ if(d) setCatalogos({nombres:d.nombres||[],motivos:d.motivos||[]}); }).catch(function(){});
    notify("Guía "+modal.guia+" autorizada");
  }

  async function refreshEst() {
    setLoading(true);
    try {
      var d = await fetchEst(estId);
      var nO=new Set(d.origenes.map(function(v){return String(v).toLowerCase();}));
      var nD=new Set(d.destinos.map(function(v){return String(v).toLowerCase();}));
      var nC=new Set(d.contenidos.map(function(v){return String(v).toLowerCase();}));
      var nU=new Set(d.usuarios.map(function(v){return String(v).toLowerCase();}));
      setEstOrig(nO);setEstDest(nD);setEstCont(nC);setEstUsers(nU);
      notify("Estandarizado actualizado ("+d.origenes.length+" orígenes, "+d.destinos.length+" destinos)");
    } catch(e) { notify("Error al conectar con Apps Script: "+e.message, false); }
    setLoading(false);
  }

  async function saveOrRules(r) {
    setOrRules(r);
    LS.set("origenRules", JSON.stringify(r));
    try { await saveRulesToSheet(estId, "origen", r); notify("Reglas Tipo Origen guardadas"); }
    catch(e) { notify("Reglas guardadas localmente (error en Sheet: "+e.message+")", false); }
  }
  async function saveDtRules(r) {
    setDtRules(r);
    LS.set("destinoRules", JSON.stringify(r));
    try { await saveRulesToSheet(estId, "destino", r); notify("Reglas Tipo Destino guardadas"); }
    catch(e) { notify("Reglas guardadas localmente (error en Sheet: "+e.message+")", false); }
  }
  async function saveWsConf(c) {
    setWsConf(c);
    LS.set("wsConf", JSON.stringify(c));
    try { await saveWsConfToSheet(estId, c); notify("Patrones WS guardados"); }
    catch(e) { notify("Patrones guardados localmente (error en Sheet: "+e.message+")", false); }
  }

  function expCsv(rows, name) {
    var csv = Papa.unparse(rows.map(function(r){
      return {"Guía":r.guia,"Referencia":r.referencia,"Razón Social":r.razonSocial,"Fuente":r.source,
        "Estatus":(SC[r.status]||{}).l||r.status,"Confirmación":r.confirmacion,
        "Tipo Origen":r.tipoOrigen,"Tipo Destino":r.tipoDestino,"Criticidad":r.criticidad,
        "Problemas":(r.issues||[]).join("; "),"Cliente":r.cliente,"Usuario":r.usuario,"Fecha":r.fecha};
    }));
    var a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}));
    a.download=name; a.click();
  }

  // Derived data
  // ── Filtro de rango de fecha del Dashboard (client-side, NO re-consulta Sheets) ──
  var dashResults = results.filter(function(r){
    if (!dashFilt || dashFilt.mode==="todos") return true;
    var k = fechaToKey(r.fecha,"dia"); if(!k) return false;
    if (dashFilt.mode==="dia")    return k===dashFilt.val;
    if (dashFilt.mode==="rango")  return (!dashFilt.from||k>=dashFilt.from)&&(!dashFilt.to||k<=dashFilt.to);
    if (dashFilt.mode==="semana") return fechaToKey(r.fecha,"semana")===dashFilt.val;
    if (dashFilt.mode==="mes")    return fechaToKey(r.fecha,"mes")===dashFilt.val;
    if (dashFilt.mode==="anio")   return fechaToKey(r.fecha,"anio")===dashFilt.val;
    return true;
  });
  var stT=dashResults.length, stV=dashResults.filter(function(r){return r.status==="valida";}).length;
  var stS=dashResults.filter(function(r){return r.status==="sospechosa";}).length;
  var stA=dashResults.filter(function(r){return r.status==="anomalia";}).length;
  var stAu=dashResults.filter(function(r){return r.status==="autorizada";}).length;
  var stR=dashResults.filter(function(r){return r.status==="rechazada";}).length;
  // Listas para filtros del Dashboard (distintos valores presentes en results)
  var dDias    = Array.from(new Set(results.map(function(r){return fechaToKey(r.fecha,"dia");}).filter(Boolean))).sort();
  var dSemanas = Array.from(new Set(results.map(function(r){return fechaToKey(r.fecha,"semana");}).filter(Boolean))).sort();
  var dMeses   = Array.from(new Set(results.map(function(r){return fechaToKey(r.fecha,"mes");}).filter(Boolean))).sort();
  var dAnios   = Array.from(new Set(results.map(function(r){return fechaToKey(r.fecha,"anio");}).filter(Boolean))).sort();
  // Mapa de cruce guía → result (para detalle desplegable en Autorizaciones/Rechazadas)
  var resByGuia = {};
  results.forEach(function(r){ var g=String(r.guia).trim(); if(g&&!resByGuia[g]) resByGuia[g]=r; });
  // ── Resultados: filtros (estatus, fuente, fecha, tipo origen, tipo destino, búsqueda) ──
  var fechasDisp = Array.from(new Set(results.map(function(r){return fechaToKey(r.fecha,"dia");}).filter(Boolean))).sort();
  var origenesDisp = Array.from(new Set(results.map(function(r){return r.tipoOrigen;}).filter(function(v){return v&&v!=="—";}))).sort();
  var destinosDisp = Array.from(new Set(results.map(function(r){return r.tipoDestino;}).filter(function(v){return v&&v!=="—";}))).sort();
  var fltd = results.filter(function(r) {
    var q=flt.q.toLowerCase();
    return (flt.s==="todos"||r.status===flt.s)&&(flt.src==="todos"||r.source===flt.src)
      &&(flt.f==="todos"||fechaToKey(r.fecha,"dia")===flt.f)
      &&(flt.to_origen==="todos"||r.tipoOrigen===flt.to_origen)
      &&(flt.to_destino==="todos"||r.tipoDestino===flt.to_destino)
      &&(!flt.q||(r.guia&&r.guia.includes(flt.q))||(r.usuario&&r.usuario.toLowerCase().includes(q))||(r.razonSocial&&r.razonSocial.toLowerCase().includes(q)));
  });
  // ── Autorizaciones: filtros (fuente, fecha, búsqueda) ──
  var authFechas = Array.from(new Set(auths.map(function(a){return dayKeyAny(a.fecha);}).filter(Boolean))).sort();
  var authsF = auths.filter(function(a){
    var q=aFlt.q.toLowerCase();
    return (aFlt.src==="todos"||a.source===aFlt.src)
      &&(aFlt.f==="todos"||dayKeyAny(a.fecha)===aFlt.f)
      &&(!aFlt.q||(a.guia&&String(a.guia).toLowerCase().includes(q))||(a.name&&a.name.toLowerCase().includes(q))||(a.reason&&a.reason.toLowerCase().includes(q)));
  });
  // ── Rechazadas: filtros (fuente, fecha, búsqueda) ──
  var rejFechas = Array.from(new Set(rejects.map(function(r){return dayKeyAny(r.fecha);}).filter(Boolean))).sort();
  var rejectsF = rejects.filter(function(r){
    var q=rFlt.q.toLowerCase();
    return (rFlt.src==="todos"||r.source===rFlt.src)
      &&(rFlt.f==="todos"||dayKeyAny(r.fecha)===rFlt.f)
      &&(!rFlt.q||(r.guia&&String(r.guia).toLowerCase().includes(q))||(r.rejectedBy&&r.rejectedBy.toLowerCase().includes(q))||(r.motivo&&r.motivo.toLowerCase().includes(q)));
  });
  var pieData=[{n:"Válidas",v:stV,f:"#22c55e"},{n:"Sospechosas",v:stS,f:"#f59e0b"},{n:"Anomalías",v:stA,f:"#ef4444"},{n:"Autorizadas",v:stAu,f:"#8b5cf6"},{n:"Rechazadas",v:stR,f:"#dc2626"}].filter(function(d){return d.v>0;});
  var toMap={};dashResults.forEach(function(r){if(r.tipoOrigen&&r.tipoOrigen!=="—")toMap[r.tipoOrigen]=(toMap[r.tipoOrigen]||0)+1;});
  var toCounts=Object.entries(toMap).sort(function(a,b){return b[1]-a[1];}).slice(0,8).map(function(e){return{n:e[0],v:e[1]};});
  var tdMap={};dashResults.forEach(function(r){if(r.tipoDestino&&r.tipoDestino!=="—")tdMap[r.tipoDestino]=(tdMap[r.tipoDestino]||0)+1;});
  var tdCounts=Object.entries(tdMap).sort(function(a,b){return b[1]-a[1];}).slice(0,8).map(function(e){return{n:e[0],v:e[1]};});
  var barData=["Comando","Web Service"].map(function(src){return{name:src==="Comando"?"Comando":"Web Svc",Válidas:dashResults.filter(function(r){return r.source===src&&r.status==="valida";}).length,Sospechosas:dashResults.filter(function(r){return r.source===src&&r.status==="sospechosa";}).length,Anomalías:dashResults.filter(function(r){return r.source===src&&r.status==="anomalia";}).length,Rechazadas:dashResults.filter(function(r){return r.source===src&&r.status==="rechazada";}).length};});
  var critCards=["OK","Medio","Alto","Crítico"].map(function(c){return{l:c,n:dashResults.filter(function(r){return r.criticidad===c;}).length};}).filter(function(x){return x.n>0;});
  var cmdDateMap={};
  dashResults.filter(function(r){return r.source==="Comando";}).forEach(function(r){var d=parseFechaDay(r.fecha);if(d){if(!cmdDateMap[d])cmdDateMap[d]={total:0,validas:0,sospechosas:0,anomalias:0};cmdDateMap[d].total++;if(r.status==="valida")cmdDateMap[d].validas++;if(r.status==="sospechosa")cmdDateMap[d].sospechosas++;if(r.status==="anomalia")cmdDateMap[d].anomalias++;}});
  var cmdDaily=Object.entries(cmdDateMap).sort(function(a,b){return a[0].localeCompare(b[0]);}).map(function(e){return Object.assign({fecha:e[0]},e[1]);});
  var wsDateMap={};
  dashResults.filter(function(r){return r.source==="Web Service";}).forEach(function(r){var d=parseFechaDay(r.fecha);if(d){if(!wsDateMap[d])wsDateMap[d]={total:0,validas:0,sospechosas:0,anomalias:0};wsDateMap[d].total++;if(r.status==="valida")wsDateMap[d].validas++;if(r.status==="sospechosa")wsDateMap[d].sospechosas++;if(r.status==="anomalia")wsDateMap[d].anomalias++;}});
  var wsDaily=Object.entries(wsDateMap).sort(function(a,b){return a[0].localeCompare(b[0]);}).map(function(e){return Object.assign({fecha:e[0]},e[1]);});
  var cmdTipoMap={};dashResults.filter(function(r){return r.source==="Comando"&&r.tipoOrigen;}).forEach(function(r){cmdTipoMap[r.tipoOrigen]=(cmdTipoMap[r.tipoOrigen]||0)+1;});
  var cmdTipo=Object.entries(cmdTipoMap).sort(function(a,b){return b[1]-a[1];}).map(function(e){return{tipo:e[0],n:e[1]};});
  var wsTipoMap={};dashResults.filter(function(r){return r.source==="Web Service"&&r.tipoOrigen&&r.tipoOrigen!=="—";}).forEach(function(r){wsTipoMap[r.tipoOrigen]=(wsTipoMap[r.tipoOrigen]||0)+1;});
  var wsTipo=Object.entries(wsTipoMap).sort(function(a,b){return b[1]-a[1];}).map(function(e){return{tipo:e[0],n:e[1]};});
  // Datos de tendencia según granularidad seleccionada en el Dashboard
  var trendCmd = groupByPeriod(dashResults, "Comando",     dashPeriod);
  var trendWS  = groupByPeriod(dashResults, "Web Service", dashPeriod);

  // ── Render ─────────────────────────────────────────────────
  var TABS = [
    { id:"inicio",         l:"Inicio",          icon:<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>, badge:0 },
    { id:"dashboard",      l:"Dashboard",        icon:<><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>, badge:0 },
    { id:"resultados",     l:"Resultados",       icon:<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>, badge:results.length },
    { id:"autorizaciones", l:"Autorizaciones",   icon:<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>, badge:auths.filter(function(a){return a.source;}).length },
    { id:"rechazadas",     l:"Rechazadas",       icon:<><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></>, badge:rejects.length },
    { id:"historico",      l:"Histórico",        icon:<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>, badge:0 },
    { id:"estandar",       l:"Estándar",         icon:<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>, badge:0 },
    { id:"reglas",         l:"Reglas",           icon:<><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M5.34 18.66l-1.41 1.41M12 2v2M12 20v2M4.93 4.93l1.41 1.41M18.66 18.66l1.41 1.41M2 12h2M20 12h2"/></>, badge:0 },
  ];
  return (
    <div style={{ fontFamily:"'Inter',system-ui,sans-serif", background:T.bgBase,
      position:"relative", minHeight:"100vh", color:T.textPrimary }}>

      {/* ── Navbar Enterprise ── */}
      <div style={{
        background:T.bgSurface, borderBottom:"1px solid "+T.borderFaint,
        padding:"0 24px", display:"flex", alignItems:"center", gap:0,
        position:"sticky", top:0, zIndex:50,
        backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)"
      }}>
        {/* Logo / Brand */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginRight:32, padding:"12px 0" }}>
          <div style={{
            width:32, height:32, borderRadius:T.r8,
            background:"linear-gradient(135deg,"+T.accentBlue+","+T.accentBlueDk+")",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 0 12px rgba(59,130,246,0.4)"
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:13, color:T.textPrimary, letterSpacing:"-0.01em" }}>Validador Estafeta</div>
            <div style={{ fontSize:9, color:T.textMuted, letterSpacing:"0.04em", textTransform:"uppercase" }}>MOBO · Control Tower</div>
          </div>
        </div>

        {/* Tabs nav */}
        <div style={{ display:"flex", flex:1, overflowX:"auto", gap:2 }}>
          {TABS.map(function(t) {
            var active = tab === t.id;
            return (
              <button key={t.id} onClick={function(){setTab(t.id);}} className="vge-tab-btn"
                style={{
                  display:"flex", alignItems:"center", gap:6, padding:"16px 14px",
                  fontSize:12, fontWeight:active?600:400, border:"none", cursor:"pointer",
                  background:"transparent", whiteSpace:"nowrap", flexShrink:0,
                  color:active?T.textPrimary:T.textMuted,
                  borderBottom:"2px solid "+(active?T.accentBlue:"transparent"),
                  position:"relative", transition:"color 0.15s, border-color 0.15s"
                }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke={active?T.accentBlueLt:T.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {t.icon}
                </svg>
                {t.l}
                {t.badge>0 && (
                  <span style={{
                    fontSize:9, fontWeight:700, background:active?T.accentBlue:T.bgHover,
                    color:active?"white":T.textSec, padding:"1px 6px", borderRadius:20,
                    border:"1px solid "+(active?T.accentBlueDk:T.borderLight), minWidth:18,
                    textAlign:"center"
                  }}>{t.badge}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Status indicator + notificaciones */}
        <div style={{ display:"flex", alignItems:"center", gap:12, paddingLeft:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:T.textMuted }}>
            <div className="vge-pulse" style={{ width:6,height:6,borderRadius:"50%",
              background:T.success,boxShadow:"0 0 6px "+T.success }}/>
            <span>Sheets conectado</span>
          </div>
          {note && (
            <div style={{
              padding:"6px 14px", borderRadius:T.r8, fontSize:11, fontWeight:500,
              maxWidth:340, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
              background:note.ok?T.successBg:T.dangerBg,
              color:note.ok?T.success:T.danger,
              border:"1px solid "+(note.ok?T.successBd:T.dangerBd),
              boxShadow:note.ok?"0 0 12px rgba(16,185,129,0.15)":"0 0 12px rgba(239,68,68,0.15)"
            }}>
              {note.ok?"✓":"✕"} {note.msg}
            </div>
          )}
        </div>
      </div>

      {/* ── Page content ── */}
      <div style={{ padding:"24px 24px 60px", maxWidth:1280, margin:"0 auto" }}>

        {/* ═══ INICIO ═══ */}
        {tab === "inicio" && (
          <div className="vge-fade" style={{ maxWidth:520, margin:"0 auto", paddingTop:24 }}>
            {/* Hero header */}
            <div style={{ textAlign:"center", marginBottom:32 }}>
              <div style={{
                display:"inline-flex", alignItems:"center", gap:8, padding:"6px 14px",
                background:T.accentGlow, border:"1px solid "+T.borderBlue, borderRadius:20,
                fontSize:11, color:T.accentBlueLt, fontWeight:600, marginBottom:20, letterSpacing:"0.04em"
              }}>
                <div className="vge-pulse" style={{ width:6,height:6,background:T.accentBlue,borderRadius:"50%" }}/>
                LIVE · MOBO Control Tower
              </div>
              <h2 style={{ fontSize:24, fontWeight:700, color:T.textPrimary, marginBottom:8,
                letterSpacing:"-0.02em", lineHeight:1.2 }}>
                Validación de Guías
              </h2>
              <div style={{ fontSize:13, color:T.textSec, lineHeight:1.6 }}>
                Selecciona el período para cargar y validar<br/>guías directamente desde Google Sheets
              </div>
            </div>

            {/* Selector de período */}
            <div style={{ background:T.bgSurface, borderRadius:T.r16, border:"1px solid "+T.borderFaint,
              padding:24, marginBottom:16 }}>
              <div style={{ fontSize:11,fontWeight:600,color:T.textMuted,textTransform:"uppercase",
                letterSpacing:"0.07em",marginBottom:16 }}>Período de consulta</div>

              {/* Modo selector */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, marginBottom:16 }}>
                {[["dia","Día","M"],["rango","Rango","↔"],["mes","Mes",""],["anio","Año",""]].map(function(m){
                  var active = queryMode===m[0];
                  return (
                    <button key={m[0]} onClick={function(){ setQueryMode(m[0]); }}
                      style={{ padding:"10px 4px", borderRadius:T.r8, border:"1px solid",
                        borderColor: active ? T.accentBlue : T.borderFaint,
                        background:  active ? T.accentGlow : T.bgPanel,
                        color:       active ? T.accentBlueLt : T.textMuted,
                        fontSize:12, fontWeight: active ? 700 : 400,
                        cursor:"pointer", transition:"all 0.15s" }}>
                      {m[1]}
                    </button>
                  );
                })}
              </div>

              {/* Controles de fecha */}
              {queryMode === "dia" && (
                <input type="date" value={date}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={function(e){ setDate(e.target.value); setDateEnd(e.target.value); }}
                  style={Object.assign({},selSt,{width:"100%",fontSize:14,padding:"11px 14px"})} />
              )}
              {queryMode === "rango" && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <div>
                    <div style={{ fontSize:10,color:T.textMuted,marginBottom:5,fontWeight:600,
                      textTransform:"uppercase",letterSpacing:"0.06em" }}>Desde</div>
                    <input type="date" value={date} max={new Date().toISOString().split("T")[0]}
                      onChange={function(e){ setDate(e.target.value); if(dateEnd<e.target.value) setDateEnd(e.target.value); }}
                      style={Object.assign({},selSt,{width:"100%",fontSize:13,padding:"10px 12px"})} />
                  </div>
                  <div>
                    <div style={{ fontSize:10,color:T.textMuted,marginBottom:5,fontWeight:600,
                      textTransform:"uppercase",letterSpacing:"0.06em" }}>Hasta</div>
                    <input type="date" value={dateEnd} min={date} max={new Date().toISOString().split("T")[0]}
                      onChange={function(e){ setDateEnd(e.target.value); }}
                      style={Object.assign({},selSt,{width:"100%",fontSize:13,padding:"10px 12px"})} />
                  </div>
                </div>
              )}
              {queryMode === "mes" && (
                <input type="month" value={date.slice(0,7)} max={new Date().toISOString().slice(0,7)}
                  onChange={function(e){ var v=e.target.value+"-01"; setDate(v); setDateEnd(v); }}
                  style={Object.assign({},selSt,{width:"100%",fontSize:14,padding:"11px 14px"})} />
              )}
              {queryMode === "anio" && (
                <select value={date.slice(0,4)}
                  onChange={function(e){ var v=e.target.value+"-01-01"; setDate(v); setDateEnd(v); }}
                  style={Object.assign({},selSt,{width:"100%",fontSize:14,padding:"11px 14px"})}>
                  {Array.from({length:5},function(_,i){ var y=new Date().getFullYear()-i; return (
                    <option key={y} value={y}>{y}</option>
                  );})}
                </select>
              )}

              {/* Resumen período */}
              {date && (function(){
                var r=getRangoFromMode(), dias=getDatesInRange(r.ini,r.fin).length;
                if(dias>1) return (
                  <div style={{ marginTop:10, padding:"8px 12px", background:T.accentGlow,
                    borderRadius:T.r8, border:"1px solid "+T.borderBlue,
                    display:"flex", alignItems:"center", gap:8 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.accentBlueLt} strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span style={{ fontSize:11, color:T.accentBlueLt, fontWeight:500 }}>
                      {dias} días · {fmtDate(r.ini)} → {fmtDate(r.fin)}
                    </span>
                  </div>
                );
                return null;
              })()}
            </div>

            {/* CTA principal */}
            <button onClick={runValidation} disabled={loading||!date} className="vge-btn-primary"
              style={{ width:"100%", padding:"15px", color:"white", border:"none", borderRadius:T.r12,
                fontSize:14, fontWeight:700, letterSpacing:"0.01em",
                background:loading||!date?"rgba(59,130,246,0.3)":
                  "linear-gradient(135deg,"+T.accentBlue+","+T.accentBlueDk+")",
                cursor:loading||!date?"not-allowed":"pointer",
                boxShadow:loading||!date?"none":"0 4px 20px rgba(59,130,246,0.35)",
                marginBottom:10, display:"flex", alignItems:"center", justifyContent:"center", gap:10
              }}>
              {loading ? (
                <><div className="vge-pulse" style={{ width:8,height:8,background:"white",borderRadius:"50%" }}/>
                  {loadMsg || "Cargando…"}</>
              ) : (function(){
                if(!date) return <span>Selecciona un período</span>;
                var r=getRangoFromMode(), dias=getDatesInRange(r.ini,r.fin).length;
                if(queryMode==="dia") return <span>Validar guías del {fmtDate(r.ini)}</span>;
                if(queryMode==="mes") return <span>Validar mes de {new Date(r.ini+"T12:00:00").toLocaleDateString("es-MX",{month:"long",year:"numeric"})}</span>;
                if(queryMode==="anio") return <span>Validar año {r.ini.slice(0,4)} · {dias} días</span>;
                return <span>Validar {dias} días ({fmtDate(r.ini)} – {fmtDate(r.fin)})</span>;
              })()}
            </button>

            {/* Limpiar caché */}
            <button onClick={async function(){
                if(!date){notify("Selecciona un período primero",false);return;}
                var r=getRangoFromMode(), dates=getDatesInRange(r.ini,r.fin);
                setLoading(true); setLoadMsg("Limpiando caché…");
                try {
                  await Promise.all(dates.map(function(d){return clearCache(d).catch(function(){});}));
                  notify("Caché limpiado para "+dates.length+" día(s)");
                } catch(e){notify("Error: "+e.message,false);}
                setLoadMsg(""); setLoading(false);
              }} disabled={loading||!date}
              style={{ width:"100%", padding:"10px", border:"1px solid "+T.borderFaint,
                borderRadius:T.r10, fontSize:12, cursor:loading||!date?"not-allowed":"pointer",
                background:"transparent", color:T.textMuted, marginBottom:20,
                transition:"all 0.15s" }}>
              ↺ Limpiar caché del período seleccionado
            </button>

            {/* Fuentes */}
            <div style={{ background:T.bgSurface, borderRadius:T.r12, border:"1px solid "+T.borderFaint, padding:16 }}>
              <div style={{ fontSize:10,fontWeight:600,color:T.textMuted,textTransform:"uppercase",
                letterSpacing:"0.07em",marginBottom:12 }}>Fuentes conectadas</div>
              {[
                { label:"Histórico", desc:"Guías por Comando (col AF) · Guías por Web Service (col W)" },
                { label:"Estandarizado", desc:"Orígenes, Destinos, Contenidos, Usuarios" }
              ].map(function(f){
                return (
                  <div key={f.label} style={{ display:"flex",gap:10,alignItems:"flex-start",marginBottom:10 }}>
                    <div style={{ width:6,height:6,borderRadius:"50%",background:T.success,
                      marginTop:4,flexShrink:0,boxShadow:"0 0 6px "+T.success }}/>
                    <div>
                      <div style={{ fontSize:12,fontWeight:600,color:T.textPrimary }}>{f.label}</div>
                      <div style={{ fontSize:11,color:T.textMuted }}>{f.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Config IDs */}
            <div style={{ marginTop:14 }}>
              <button onClick={function(){setShowCfg(!showCfg);}}
                style={Object.assign({},btnSec,{fontSize:11,width:"100%",
                  borderRadius:T.r10,padding:"10px"})}>
                {showCfg?"▲ Ocultar":"⚙ Configurar"} IDs de Google Sheets
              </button>
              {showCfg && (
                <div style={{ marginTop:10,padding:18,background:T.bgSurface,borderRadius:T.r12,
                  border:"1px solid "+T.borderFaint }}>
                  {[{label:"ID Histórico Guías",val:histId,set:setHistId},
                    {label:"ID Estandarizado",val:estId,set:setEstId}].map(function(f){
                    return (
                      <div key={f.label} style={{ marginBottom:12 }}>
                        <label style={{ fontSize:11,fontWeight:600,display:"block",marginBottom:5,
                          color:T.textSec,textTransform:"uppercase",letterSpacing:"0.06em" }}>{f.label}</label>
                        <input value={f.val} onChange={function(e){f.set(e.target.value);}}
                          style={Object.assign({},selSt,{width:"100%",boxSizing:"border-box",
                            fontFamily:"'SF Mono',monospace",fontSize:10})} />
                      </div>
                    );
                  })}
                  <button onClick={async function(){
                    window.localStorage.setItem("histId",histId);
                    window.localStorage.setItem("estId",estId);
                    notify("IDs guardados");setShowCfg(false);
                  }} style={{ padding:"8px 18px",background:T.accentBlue,color:"white",
                    border:"none",borderRadius:T.r8,fontSize:12,cursor:"pointer",fontWeight:600 }}>
                    Guardar IDs
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ DASHBOARD ═══ */}
        {tab==="dashboard" && results.length===0 && (
          <div className="vge-fade">
            <Empty msg="No hay datos para mostrar" sub="Selecciona un período y valida para ver el dashboard" cta="Ir a Inicio" onCta={function(){setTab("inicio");}} />
          </div>
        )}
        {tab==="dashboard" && results.length>0 && (
          <div className="vge-fade">
            {/* ── Top bar ── */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
              <div>
                <h1 style={{ fontSize:20, fontWeight:700, color:T.textPrimary, marginBottom:4,
                  letterSpacing:"-0.02em" }}>Control Tower</h1>
                <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:12, color:T.textSec }}>
                  <span>{hist[0]&&hist[0].periodo}</span>
                  {hist[0]&&hist[0].modo&&(
                    <span style={{ padding:"2px 8px",background:T.accentGlow,color:T.accentBlueLt,
                      borderRadius:20,fontSize:10,fontWeight:600,border:"1px solid "+T.borderBlue }}>
                      {hist[0].modo}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={function(){expCsv(results,"validacion_completa.csv");}}
                style={Object.assign({},btnSec,{display:"flex",alignItems:"center",gap:7,
                  borderRadius:T.r8,padding:"8px 16px"})}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Exportar completo
              </button>
            </div>

            {/* ── Filtro de rango del Dashboard (client-side, sin re-consultar Sheets) ── */}
            <div style={{ background:T.bgSurface, borderRadius:T.r12, border:"1px solid "+T.borderFaint,
              padding:"12px 16px", marginBottom:16, display:"flex", flexWrap:"wrap", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:11,fontWeight:600,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.06em" }}>Filtrar período</span>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                {[["todos","Todas"],["dia","Día"],["rango","Entre días"],["semana","Semana"],["mes","Mes"],["anio","Año"]].map(function(m){
                  var active=dashFilt.mode===m[0];
                  return (
                    <button key={m[0]} onClick={function(){
                      if(m[0]==="todos") setDashFilt({mode:"todos",val:"",from:"",to:""});
                      else if(m[0]==="dia") setDashFilt({mode:"dia",val:dDias[dDias.length-1]||"",from:"",to:""});
                      else if(m[0]==="rango") setDashFilt({mode:"rango",val:"",from:dDias[0]||"",to:dDias[dDias.length-1]||""});
                      else if(m[0]==="semana") setDashFilt({mode:"semana",val:dSemanas[dSemanas.length-1]||"",from:"",to:""});
                      else if(m[0]==="mes") setDashFilt({mode:"mes",val:dMeses[dMeses.length-1]||"",from:"",to:""});
                      else if(m[0]==="anio") setDashFilt({mode:"anio",val:dAnios[dAnios.length-1]||"",from:"",to:""});
                    }}
                      style={{ padding:"6px 12px", borderRadius:T.r8, border:"1px solid",
                        borderColor:active?T.accentBlue:T.borderFaint, background:active?T.accentGlow:T.bgPanel,
                        color:active?T.accentBlueLt:T.textMuted, fontSize:11, fontWeight:active?700:500, cursor:"pointer" }}>
                      {m[1]}
                    </button>
                  );
                })}
              </div>
              {dashFilt.mode==="dia" && (
                <select value={dashFilt.val} style={selSt} onChange={function(e){var v=e.target.value;setDashFilt(function(p){return Object.assign({},p,{val:v});});}}>
                  {dDias.map(function(k){return <option key={k} value={k}>{dayKeyToLabel(k)}</option>;})}
                </select>
              )}
              {dashFilt.mode==="rango" && (
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <select value={dashFilt.from} style={selSt} onChange={function(e){var v=e.target.value;setDashFilt(function(p){return Object.assign({},p,{from:v});});}}>
                    {dDias.map(function(k){return <option key={k} value={k}>{dayKeyToLabel(k)}</option>;})}
                  </select>
                  <span style={{ fontSize:11,color:T.textMuted }}>→</span>
                  <select value={dashFilt.to} style={selSt} onChange={function(e){var v=e.target.value;setDashFilt(function(p){return Object.assign({},p,{to:v});});}}>
                    {dDias.map(function(k){return <option key={k} value={k}>{dayKeyToLabel(k)}</option>;})}
                  </select>
                </div>
              )}
              {dashFilt.mode==="semana" && (
                <select value={dashFilt.val} style={selSt} onChange={function(e){var v=e.target.value;setDashFilt(function(p){return Object.assign({},p,{val:v});});}}>
                  {dSemanas.map(function(k){var p=k.split("-S");return <option key={k} value={k}>{"Semana "+p[1]+" · "+p[0]}</option>;})}
                </select>
              )}
              {dashFilt.mode==="mes" && (
                <select value={dashFilt.val} style={selSt} onChange={function(e){var v=e.target.value;setDashFilt(function(p){return Object.assign({},p,{val:v});});}}>
                  {dMeses.map(function(k){var p=k.split("-");return <option key={k} value={k}>{p[1]+"/"+p[0]}</option>;})}
                </select>
              )}
              {dashFilt.mode==="anio" && (
                <select value={dashFilt.val} style={selSt} onChange={function(e){var v=e.target.value;setDashFilt(function(p){return Object.assign({},p,{val:v});});}}>
                  {dAnios.map(function(k){return <option key={k} value={k}>{k}</option>;})}
                </select>
              )}
              <span style={{ fontSize:11,color:T.textMuted,marginLeft:"auto",whiteSpace:"nowrap" }}>
                {dashResults.length.toLocaleString()} de {results.length.toLocaleString()} guías
              </span>
            </div>

            {/* ── KPI Cards ── */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:16, marginBottom:20 }}>
              <StatCard l="Total" v={stT} i={0} total={stT} accent={T.accentBlue}
                icon={<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}/>
              <StatCard l="Válidas" v={stV} i={1} total={stT} accent={T.success}
                icon={<><polyline points="20 6 9 17 4 12"/></>}/>
              <StatCard l="Sospechosas" v={stS} i={2} total={stT} accent={T.warning}
                icon={<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>}/>
              <StatCard l="Anomalías" v={stA} i={3} total={stT} accent={T.danger}
                icon={<><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></>}/>
              <StatCard l="Autorizadas" v={stAu} i={4} total={stT} accent={T.purple}
                icon={<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>}/>
              <StatCard l="Rechazadas" v={stR} i={5} total={stT} accent="#dc2626"
                icon={<><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></>}/>
            </div>

            {/* ── Row 1: Pie + Bar fuente (con tablas) ── */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>

              {/* Donut estatus + tabla */}
              <div className="vge-card" style={{ background:T.bgSurface,borderRadius:T.r12,
                border:"1px solid "+T.borderFaint, overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.12)" }}>
                <div style={{ height:3, background:"linear-gradient(90deg,#22d65e,#8b5cf6,#dc2626)" }}/>
                <div style={{ padding:18 }}>
                  <div style={{ fontWeight:600,fontSize:12,color:T.textPrimary,marginBottom:14,
                    display:"flex",alignItems:"center",gap:8 }}>
                    <span style={{ width:6,height:6,borderRadius:"50%",background:T.accentBlue }}/>
                    Distribución de estatus
                  </div>
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={64}
                        dataKey="v" nameKey="n" strokeWidth={2} stroke={T.bgSurface}
                        animationDuration={600} animationEasing="ease-out">
                        {pieData.map(function(e,i){return <Cell key={i} fill={e.f}/>;}) }
                      </Pie>
                      <Tooltip contentStyle={{ background:T.bgPanel,border:"1px solid "+T.borderLight,
                        borderRadius:T.r8,fontSize:12,color:T.textPrimary }} itemStyle={{ color:T.textSec }}/>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Tabla de datos */}
                  <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11,marginTop:12 }}>
                    <thead>
                      <tr style={{ borderBottom:"1px solid "+T.borderFaint }}>
                        <th style={{ textAlign:"left",padding:"6px 4px",color:T.textMuted,fontWeight:500,fontSize:10 }}>Estatus</th>
                        <th style={{ textAlign:"right",padding:"6px 4px",color:T.textMuted,fontWeight:500,fontSize:10 }}>Cant.</th>
                        <th style={{ textAlign:"right",padding:"6px 4px",color:T.textMuted,fontWeight:500,fontSize:10 }}>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pieData.map(function(e,i){
                        var pct = stT>0?Math.round(e.v/stT*100):0;
                        return (
                          <tr key={i} className="vge-row" style={{ borderBottom:"1px solid "+T.borderFaint+"66" }}>
                            <td style={{ padding:"6px 4px",color:T.textSec }}>
                              <span style={{ display:"inline-flex",alignItems:"center",gap:6 }}>
                                <span style={{ width:8,height:8,borderRadius:2,background:e.f,display:"inline-block" }}/>
                                {e.n}
                              </span>
                            </td>
                            <td style={{ padding:"6px 4px",textAlign:"right",color:T.textPrimary,fontWeight:700,fontVariantNumeric:"tabular-nums" }}>{e.v.toLocaleString()}</td>
                            <td style={{ padding:"6px 4px",textAlign:"right",color:e.f,fontWeight:600,fontVariantNumeric:"tabular-nums" }}>{pct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Barras por fuente + tabla */}
              <div className="vge-card" style={{ background:T.bgSurface,borderRadius:T.r12,
                border:"1px solid "+T.borderFaint, overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.12)" }}>
                <div style={{ height:3, background:"linear-gradient(90deg,#3b82f6,#2dd4bf)" }}/>
                <div style={{ padding:18 }}>
                  <div style={{ fontWeight:600,fontSize:12,color:T.textPrimary,marginBottom:14,
                    display:"flex",alignItems:"center",gap:8 }}>
                    <span style={{ width:6,height:6,borderRadius:"50%",background:T.chartTeal }}/>
                    Por fuente
                  </div>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={barData} barGap={6} margin={{top:8,right:12,left:0,bottom:4}}>
                      <XAxis dataKey="name" tick={{fontSize:11,fill:T.textSec,fontWeight:500}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fontSize:9,fill:T.textMuted}} axisLine={false} tickLine={false} allowDecimals={false}/>
                      <Tooltip contentStyle={{ background:T.bgPanel,border:"1px solid "+T.borderLight,
                        borderRadius:T.r8,fontSize:12,color:T.textPrimary }} cursor={{fill:"rgba(255,255,255,0.05)"}}/>
                      <Bar dataKey="Válidas" fill="#22d65e" radius={[3,3,0,0]} animationDuration={600}/>
                      <Bar dataKey="Sospechosas" fill="#f59e0b" radius={[3,3,0,0]} animationDuration={600}/>
                      <Bar dataKey="Anomalías" fill="#ef4444" radius={[3,3,0,0]} animationDuration={600}/>
                      <Bar dataKey="Rechazadas" fill="#dc2626" radius={[3,3,0,0]} animationDuration={600}/>
                    </BarChart>
                  </ResponsiveContainer>
                  {/* Tabla de datos */}
                  <table style={{ width:"100%",borderCollapse:"collapse",fontSize:10,marginTop:12 }}>
                    <thead>
                      <tr style={{ borderBottom:"1px solid "+T.borderFaint }}>
                        {["Fuente","Vál","Sosp","Anom","Rech"].map(function(h,hi){
                          return <th key={h} style={{ textAlign:hi===0?"left":"right",padding:"6px 3px",color:T.textMuted,fontWeight:500,fontSize:9 }}>{h}</th>;
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {barData.map(function(b,i){
                        return (
                          <tr key={i} className="vge-row" style={{ borderBottom:"1px solid "+T.borderFaint+"66" }}>
                            <td style={{ padding:"6px 3px",color:T.textSec,fontWeight:500 }}>{b.name}</td>
                            <td style={{ padding:"6px 3px",textAlign:"right",color:"#22d65e",fontWeight:600,fontVariantNumeric:"tabular-nums" }}>{b["Válidas"]}</td>
                            <td style={{ padding:"6px 3px",textAlign:"right",color:"#f59e0b",fontWeight:600,fontVariantNumeric:"tabular-nums" }}>{b["Sospechosas"]}</td>
                            <td style={{ padding:"6px 3px",textAlign:"right",color:"#ef4444",fontWeight:600,fontVariantNumeric:"tabular-nums" }}>{b["Anomalías"]}</td>
                            <td style={{ padding:"6px 3px",textAlign:"right",color:"#dc2626",fontWeight:600,fontVariantNumeric:"tabular-nums" }}>{b["Rechazadas"]}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ── Row 2: Tipo Origen + Tipo Destino (mismo nivel) ── */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>

              {/* Tipo de Origen + tabla */}
              <div className="vge-card" style={{ background:T.bgSurface,borderRadius:T.r12,
                border:"1px solid "+T.borderFaint, overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.12)" }}>
                <div style={{ height:3, background:"linear-gradient(90deg,#60a5fa,#3b82f6)" }}/>
                <div style={{ padding:18 }}>
                  <div style={{ fontWeight:600,fontSize:12,color:T.textPrimary,marginBottom:14,
                    display:"flex",alignItems:"center",gap:8 }}>
                    <span style={{ width:6,height:6,borderRadius:"50%",background:T.chartBlue }}/>
                    Tipo de Origen
                  </div>
                  {toCounts.length===0
                    ? <div style={{ textAlign:"center",padding:24,fontSize:11,color:T.textMuted }}>Sin datos</div>
                    : <ResponsiveContainer width="100%" height={150}>
                        <BarChart data={toCounts} layout="vertical" margin={{top:0,right:12,left:0,bottom:0}}>
                          <XAxis type="number" tick={{fontSize:9,fill:T.textMuted}} axisLine={false} tickLine={false} allowDecimals={false}/>
                          <YAxis type="category" dataKey="n" tick={{fontSize:9,fill:T.textSec}} width={120} axisLine={false} tickLine={false}/>
                          <Tooltip contentStyle={{ background:T.bgPanel,border:"1px solid "+T.borderLight,
                            borderRadius:T.r8,fontSize:12,color:T.textPrimary }} cursor={{fill:"rgba(255,255,255,0.05)"}}/>
                          <Bar dataKey="v" fill={T.chartBlue} radius={[0,4,4,0]} animationDuration={600}/>
                        </BarChart>
                      </ResponsiveContainer>}
                  {/* Tabla de datos */}
                  {toCounts.length>0 && (
                    <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11,marginTop:12 }}>
                      <thead>
                        <tr style={{ borderBottom:"1px solid "+T.borderFaint }}>
                          <th style={{ textAlign:"left",padding:"6px 4px",color:T.textMuted,fontWeight:500,fontSize:10 }}>Tipo de Origen</th>
                          <th style={{ textAlign:"right",padding:"6px 4px",color:T.textMuted,fontWeight:500,fontSize:10 }}>Cant.</th>
                          <th style={{ textAlign:"right",padding:"6px 4px",color:T.textMuted,fontWeight:500,fontSize:10 }}>%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {toCounts.map(function(e,i){
                          var totalTo = toCounts.reduce(function(s,x){return s+x.v;},0);
                          var pct = totalTo>0?Math.round(e.v/totalTo*100):0;
                          return (
                            <tr key={i} className="vge-row" style={{ borderBottom:"1px solid "+T.borderFaint+"66" }}>
                              <td style={{ padding:"6px 4px",color:T.textSec,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }} title={e.n}>{e.n}</td>
                              <td style={{ padding:"6px 4px",textAlign:"right",color:T.textPrimary,fontWeight:700,fontVariantNumeric:"tabular-nums" }}>{e.v.toLocaleString()}</td>
                              <td style={{ padding:"6px 4px",textAlign:"right",color:T.chartBlue,fontWeight:600,fontVariantNumeric:"tabular-nums" }}>{pct}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Tipo de Destino (Comando) + tabla */}
              <div className="vge-card" style={{ background:T.bgSurface,borderRadius:T.r12,
                border:"1px solid "+T.borderFaint, overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.12)" }}>
              <div style={{ height:3, background:"linear-gradient(90deg,#2dd4bf,#14b8a6)" }}/>
              <div style={{ padding:18 }}>
                <div style={{ fontWeight:600,fontSize:12,color:T.textPrimary,marginBottom:2,
                  display:"flex",alignItems:"center",gap:8 }}>
                  <span style={{ width:6,height:6,borderRadius:"50%",background:T.chartTeal }}/>
                  Tipo de Destino (Comando)
                </div>
                <div style={{ fontSize:10,color:T.textMuted,marginBottom:14,marginLeft:14 }}>Clasifica según reglas de Destino · Ajusta en Reglas</div>
                {tdCounts.length===0
                  ? <div style={{ textAlign:"center",padding:24,fontSize:11,color:T.textMuted }}>Sin datos</div>
                  : <ResponsiveContainer width="100%" height={Math.max(150, tdCounts.length*28)}>
                      <BarChart data={tdCounts} layout="vertical" margin={{top:0,right:12,left:0,bottom:0}}>
                        <XAxis type="number" tick={{fontSize:9,fill:T.textMuted}} axisLine={false} tickLine={false} allowDecimals={false}/>
                        <YAxis type="category" dataKey="n" tick={{fontSize:9,fill:T.textSec}} width={150} axisLine={false} tickLine={false}/>
                        <Tooltip contentStyle={{ background:T.bgPanel,border:"1px solid "+T.borderLight,
                          borderRadius:T.r8,fontSize:12,color:T.textPrimary }} cursor={{fill:"rgba(255,255,255,0.05)"}}/>
                        <Bar dataKey="v" fill={T.chartTeal} radius={[0,4,4,0]} animationDuration={600}/>
                      </BarChart>
                    </ResponsiveContainer>}
                {/* Tabla de datos */}
                {tdCounts.length>0 && (
                  <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11,marginTop:12 }}>
                    <thead>
                      <tr style={{ borderBottom:"1px solid "+T.borderFaint }}>
                        <th style={{ textAlign:"left",padding:"6px 4px",color:T.textMuted,fontWeight:500,fontSize:10 }}>Tipo de Destino</th>
                        <th style={{ textAlign:"right",padding:"6px 4px",color:T.textMuted,fontWeight:500,fontSize:10 }}>Cant.</th>
                        <th style={{ textAlign:"right",padding:"6px 4px",color:T.textMuted,fontWeight:500,fontSize:10 }}>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tdCounts.map(function(e,i){
                        var totalTd = tdCounts.reduce(function(s,x){return s+x.v;},0);
                        var pct = totalTd>0?Math.round(e.v/totalTd*100):0;
                        return (
                          <tr key={i} className="vge-row" style={{ borderBottom:"1px solid "+T.borderFaint+"66" }}>
                            <td style={{ padding:"6px 4px",color:T.textSec,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }} title={e.n}>{e.n}</td>
                            <td style={{ padding:"6px 4px",textAlign:"right",color:T.textPrimary,fontWeight:700,fontVariantNumeric:"tabular-nums" }}>{e.v.toLocaleString()}</td>
                            <td style={{ padding:"6px 4px",textAlign:"right",color:T.chartTeal,fontWeight:600,fontVariantNumeric:"tabular-nums" }}>{pct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            </div>

            {/* ── Tendencia temporal con toggle ── */}
            <div className="vge-card" style={{ background:T.bgSurface,borderRadius:T.r12,padding:18,
              border:"1px solid "+T.borderFaint,marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <div>
                  <div style={{ fontWeight:600,fontSize:12,color:T.textPrimary,marginBottom:2 }}>Tendencia temporal</div>
                  <div style={{ fontSize:10,color:T.textMuted }}>Guías por período · apilado por estatus</div>
                </div>
                <div style={{ display:"flex", gap:4, background:T.bgPanel, borderRadius:T.r8,
                  padding:3, border:"1px solid "+T.borderFaint }}>
                  {[["dia","Día"],["semana","Semana"],["mes","Mes"],["anio","Año"]].map(function(g){
                    var days=(function(){
                      var r=getRangoFromMode(); return getDatesInRange(r.ini,r.fin).length;
                    })();
                    var ok=(g[0]==="dia")||(g[0]==="semana"&&days>=7)||(g[0]==="mes"&&days>=28)||(g[0]==="anio"&&days>=90);
                    var active=dashPeriod===g[0];
                    return (
                      <button key={g[0]} onClick={function(){if(ok)setDashPeriod(g[0]);}} disabled={!ok}
                        style={{ padding:"5px 12px",borderRadius:T.r6,border:"none",
                          background:active?T.bgActive:"transparent",
                          color:active?T.textPrimary:ok?T.textMuted:"rgba(255,255,255,0.2)",
                          fontSize:11,fontWeight:active?600:400,cursor:ok?"pointer":"default",
                          transition:"all 0.15s" }}>
                        {g[1]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                {[["Comando",trendCmd],["Web Service",trendWS]].map(function(pair){
                  return (
                    <div key={pair[0]}>
                      <div style={{ fontSize:11,fontWeight:600,color:T.textSec,marginBottom:8 }}>
                        {pair[0]}
                        <span style={{ marginLeft:8,fontSize:10,color:T.textMuted,fontWeight:400 }}>
                          ({pair[1].reduce(function(s,r){return s+r.total;},0)} guías)
                        </span>
                      </div>
                      {pair[1].length===0
                        ? <div style={{ textAlign:"center",padding:24,fontSize:11,color:T.textMuted }}>Sin datos</div>
                        : <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={pair[1]} animationDuration={600} animationEasing="ease-out">
                              <XAxis dataKey="label" tick={{fontSize:8,fill:T.textMuted}} axisLine={false} tickLine={false}
                                interval={pair[1].length>20?Math.floor(pair[1].length/8):0}/>
                              <YAxis tick={{fontSize:8,fill:T.textMuted}} axisLine={false} tickLine={false} allowDecimals={false}/>
                              <Tooltip contentStyle={{ background:T.bgPanel,border:"1px solid "+T.borderLight,
                                borderRadius:T.r8,fontSize:11,color:T.textPrimary }}
                                labelStyle={{ color:T.textSec,marginBottom:4 }}/>
                              <Bar dataKey="validas" name="Válidas" fill="#22d65e" stackId="s" radius={[3,3,0,0]}/>
                              <Bar dataKey="sospechosas" name="Sosp." fill="#f59e0b" stackId="s" radius={[3,3,0,0]}/>
                              <Bar dataKey="anomalias" name="Anomalías" fill="#ef4444" stackId="s" radius={[3,3,0,0]}/>
                              <Bar dataKey="autorizadas" name="Autorizadas" fill="#8b5cf6" stackId="s" radius={[3,3,0,0]}/>
                              <Bar dataKey="rechazadas" name="Rechazadas" fill="#dc2626" stackId="s" radius={[3,3,0,0]}/>
                            </BarChart>
                          </ResponsiveContainer>}
                    </div>
                  );
                })}
              </div>
              <div style={{ display:"flex",gap:14,justifyContent:"center",marginTop:8 }}>
                {[[T.chartGreen,"Válidas"],[T.chartAmber,"Sospechosas"],[T.chartRed,"Anomalías"],[T.purple,"Autorizadas"],["#dc2626","Rechazadas"]].map(function(x){
                  return <div key={x[1]} style={{ display:"flex",gap:5,alignItems:"center",fontSize:10 }}>
                    <div style={{ width:8,height:8,borderRadius:2,background:x[0] }}/><span style={{ color:T.textSec }}>{x[1]}</span>
                  </div>;
                })}
              </div>
            </div>

            {/* ── Tabla resumen diario ── */}
            <div className="vge-card" style={{ background:T.bgSurface,borderRadius:T.r12,padding:18,
              border:"1px solid "+T.borderFaint,marginBottom:14 }}>
              <div style={{ fontWeight:600,fontSize:12,color:T.textPrimary,marginBottom:4 }}>Resumen por día</div>
              <div style={{ fontSize:10,color:T.textMuted,marginBottom:14 }}>Desglose diario de todas las guías del período seleccionado</div>
              {(function(){
                var allDays = {};
                dashResults.forEach(function(r){
                  var k = fechaToKey(r.fecha,"dia");
                  if(!k) return;
                  if(!allDays[k]) allDays[k]={dia:k,total:0,validas:0,sospechosas:0,anomalias:0,autorizadas:0,rechazadas:0};
                  allDays[k].total++;
                  if(r.status==="valida")      allDays[k].validas++;
                  if(r.status==="sospechosa")  allDays[k].sospechosas++;
                  if(r.status==="anomalia")    allDays[k].anomalias++;
                  if(r.status==="autorizada")  allDays[k].autorizadas++;
                  if(r.status==="rechazada")   allDays[k].rechazadas++;
                });
                var rows = Object.values(allDays).sort(function(a,b){return a.dia.localeCompare(b.dia);});
                if(rows.length===0) return <div style={{ textAlign:"center",padding:24,fontSize:11,color:T.textMuted }}>Sin datos de fechas</div>;
                return (
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                      <thead>
                        <tr style={{ borderBottom:"1px solid "+T.borderFaint }}>
                          {["Fecha","Total","Válidas","Sospechosas","Anomalías","Autorizadas","Rechazadas","% Ok"].map(function(h){
                            return <th key={h} style={Object.assign({},thSt,{paddingBottom:10})}>{h}</th>;
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(function(row){
                          var pOk = row.total>0?Math.round((row.validas+row.autorizadas)/row.total*100):0;
                          var d = row.dia.split("-");
                          var label = d[2]+"/"+d[1]+"/"+d[0];
                          return (
                            <tr key={row.dia} className="vge-row" style={{ borderBottom:"1px solid "+T.borderFaint+"88", verticalAlign:"middle" }}>
                              <td style={Object.assign({},tdSt,{fontWeight:600,color:T.textPrimary,
                                fontFamily:"'SF Mono',monospace",fontSize:11})}>{label}</td>
                              <td style={Object.assign({},tdSt,{fontWeight:700,color:T.textPrimary,
                                fontVariantNumeric:"tabular-nums"})}>{row.total}</td>
                              <td style={Object.assign({},tdSt,{color:T.success,fontWeight:600})}>{row.validas}</td>
                              <td style={Object.assign({},tdSt,{color:T.warning,fontWeight:600})}>{row.sospechosas}</td>
                              <td style={Object.assign({},tdSt,{color:T.danger,fontWeight:600})}>{row.anomalias}</td>
                              <td style={Object.assign({},tdSt,{color:T.purple,fontWeight:600})}>{row.autorizadas}</td>
                              <td style={Object.assign({},tdSt,{color:"#dc2626",fontWeight:600})}>{row.rechazadas||0}</td>
                              <td style={tdSt}>
                                <div style={{ display:"flex",alignItems:"center",gap:7 }}>
                                  <div style={{ flex:1,height:4,background:T.bgHover,borderRadius:4,overflow:"hidden",minWidth:50 }}>
                                    <div style={{ height:"100%",width:pOk+"%",
                                      background:pOk>=90?T.success:pOk>=70?T.warning:T.danger,
                                      borderRadius:4,transition:"width 0.5s" }}/>
                                  </div>
                                  <span style={{ fontSize:10,fontWeight:600,
                                    color:pOk>=90?T.success:pOk>=70?T.warning:T.danger,
                                    minWidth:28,textAlign:"right" }}>{pOk}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {/* Totales */}
                        <tr style={{ borderTop:"1px solid "+T.borderLight,background:T.bgPanel }}>
                          <td style={Object.assign({},tdSt,{fontWeight:700,color:T.textPrimary,fontSize:11})}>TOTAL</td>
                          <td style={Object.assign({},tdSt,{fontWeight:700,color:T.textPrimary})}>{stT}</td>
                          <td style={Object.assign({},tdSt,{fontWeight:700,color:T.success})}>{stV}</td>
                          <td style={Object.assign({},tdSt,{fontWeight:700,color:T.warning})}>{stS}</td>
                          <td style={Object.assign({},tdSt,{fontWeight:700,color:T.danger})}>{stA}</td>
                          <td style={Object.assign({},tdSt,{fontWeight:700,color:T.purple})}>{stAu}</td>
                          <td style={Object.assign({},tdSt,{fontWeight:700,color:"#dc2626"})}>{stR}</td>
                          <td style={Object.assign({},tdSt,{fontWeight:700,
                            color:stT>0&&Math.round((stV+stAu)/stT*100)>=90?T.success:T.warning})}>
                            {stT>0?Math.round((stV+stAu)/stT*100):0}%
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* ── Row 3: Tipo guía Cmd + WS ── */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
              {[["Tipo de guía (Comando)", cmdTipo, T.chartPurple, T.purple, "Clasifica según Tipo Origen · Ajusta en Reglas"],
                ["Tipo de operación (WS)", wsTipo, T.chartTeal, T.chartTeal, "TR · Ecommerce · Cambio Catálogo · Concentradora"]
               ].map(function(cfg){
                return (
                  <div key={cfg[0]} className="vge-card" style={{ background:T.bgSurface,borderRadius:T.r12,
                    border:"1px solid "+T.borderFaint, overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.12)" }}>
                    <div style={{ height:3, background:cfg[2] }}/>
                    <div style={{ padding:18 }}>
                      <div style={{ fontWeight:600,fontSize:12,color:T.textPrimary,marginBottom:3,
                        display:"flex",alignItems:"center",gap:8 }}>
                        <span style={{ width:6,height:6,borderRadius:"50%",background:cfg[2] }}/>
                        {cfg[0]}
                      </div>
                      <div style={{ fontSize:10,color:T.textMuted,marginBottom:14 }}>{cfg[4]}</div>
                      {cfg[1].length===0
                        ? <div style={{ textAlign:"center",padding:24,fontSize:11,color:T.textMuted }}>Sin clasificaciones</div>
                        : <>
                            <ResponsiveContainer width="100%" height={Math.max(cfg[1].length*32+20,130)}>
                              <BarChart data={cfg[1]} layout="vertical" margin={{top:0,right:12,left:0,bottom:0}}>
                                <XAxis type="number" tick={{fontSize:9,fill:T.textMuted}} axisLine={false} tickLine={false} allowDecimals={false}/>
                                <YAxis type="category" dataKey="tipo" tick={{fontSize:9,fill:T.textSec}} width={148} axisLine={false} tickLine={false}/>
                                <Tooltip contentStyle={{ background:T.bgPanel,border:"1px solid "+T.borderLight,
                                  borderRadius:T.r8,fontSize:11,color:T.textPrimary }} cursor={{fill:"rgba(255,255,255,0.05)"}}/>
                                <Bar dataKey="n" name="Guías" fill={cfg[2]} radius={[0,4,4,0]} animationDuration={600}/>
                              </BarChart>
                            </ResponsiveContainer>
                            <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11,marginTop:12 }}>
                              <thead>
                                <tr style={{ borderBottom:"1px solid "+T.borderFaint }}>
                                  <th style={{ textAlign:"left",padding:"6px 4px",color:T.textMuted,fontWeight:500,fontSize:10 }}>Tipo</th>
                                  <th style={{ textAlign:"right",padding:"6px 4px",color:T.textMuted,fontWeight:500,fontSize:10 }}>Guías</th>
                                  <th style={{ textAlign:"right",padding:"6px 4px",color:T.textMuted,fontWeight:500,fontSize:10 }}>%</th>
                                </tr>
                              </thead>
                              <tbody>
                                {cfg[1].map(function(e,i){
                                  var totT = cfg[1].reduce(function(s,x){return s+x.n;},0);
                                  var pct = totT>0?Math.round(e.n/totT*100):0;
                                  return (
                                    <tr key={i} className="vge-row" style={{ borderBottom:"1px solid "+T.borderFaint+"66" }}>
                                      <td style={{ padding:"6px 4px",color:T.textSec,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }} title={e.tipo}>{e.tipo}</td>
                                      <td style={{ padding:"6px 4px",textAlign:"right",color:T.textPrimary,fontWeight:700,fontVariantNumeric:"tabular-nums" }}>{e.n.toLocaleString()}</td>
                                      <td style={{ padding:"6px 4px",textAlign:"right",color:cfg[2],fontWeight:600,fontVariantNumeric:"tabular-nums" }}>{pct}%</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Criticidad row ── */}
            {critCards.length>0 && (
              <div style={{ display:"flex",gap:10,marginBottom:14,flexWrap:"wrap" }}>
                {critCards.map(function(x){
                  return (
                    <div key={x.l} className="vge-card" style={{ background:CBG[x.l],borderRadius:T.r10,
                      padding:"14px 20px",border:"1px solid "+(CC[x.l]||T.textMuted)+"35",
                      minWidth:120 }}>
                      <div style={{ fontSize:24,fontWeight:700,color:CC[x.l]||T.textPrimary,
                        letterSpacing:"-0.02em" }}>{x.n}</div>
                      <div style={{ fontSize:11,fontWeight:500,color:CC[x.l]||T.textSec,marginTop:2 }}>
                        Criticidad {x.l}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Alerta atención ── */}
            {(stS+stA)>0 && (
              <div style={{ padding:"14px 18px",background:T.dangerBg,borderRadius:T.r10,
                border:"1px solid "+T.dangerBd,display:"flex",gap:14,alignItems:"center",flexWrap:"wrap" }}>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.danger} strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <span style={{ fontSize:13,color:T.danger,fontWeight:600 }}>{stS+stA} guías requieren atención</span>
                </div>
                <div style={{ display:"flex",gap:8 }}>
                  {stA>0&&<button onClick={function(){setFlt(function(f){return Object.assign({},f,{s:"anomalia"});});setTab("resultados");}}
                    style={{ padding:"6px 14px",background:T.danger,color:"white",border:"none",borderRadius:T.r8,
                      fontSize:11,cursor:"pointer",fontWeight:600 }}>Ver {stA} anomalías →</button>}
                  {stS>0&&<button onClick={function(){setFlt(function(f){return Object.assign({},f,{s:"sospechosa"});});setTab("resultados");}}
                    style={{ padding:"6px 14px",background:T.warning,color:T.textInv,border:"none",borderRadius:T.r8,
                      fontSize:11,cursor:"pointer",fontWeight:600 }}>Ver {stS} sospechosas →</button>}
                </div>
              </div>
            )}
          </div>
        )}

                {/* ═══ RESULTADOS ═══ */}
        {tab==="resultados" && (
          <div className="vge-fade">
            {/* Toolbar */}
            <div style={{ display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center" }}>
              <h2 style={{ fontSize:18,fontWeight:700,color:T.textPrimary,letterSpacing:"-0.02em",marginRight:4 }}>
                Resultados
              </h2>
              {/* Filtro estatus */}
              <select value={flt.s} style={selSt} onChange={function(e){setFlt(function(p){return Object.assign({},p,{s:e.target.value});});}}>
                <option value="todos">Todos los estatus</option>
                <option value="valida">✓ Válidas</option>
                <option value="sospechosa">⚠ Sospechosas</option>
                <option value="anomalia">✕ Anomalías</option>
                <option value="autorizada">● Autorizadas</option>
                <option value="rechazada">✕ Rechazadas</option>
              </select>
              {/* Filtro fuente */}
              <select value={flt.src} style={selSt} onChange={function(e){setFlt(function(p){return Object.assign({},p,{src:e.target.value});});}}>
                <option value="todos">Todas las fuentes</option>
                <option value="Comando">Comando</option>
                <option value="Web Service">Web Service</option>
              </select>
              {/* Filtro fecha */}
              <select value={flt.f} style={selSt} onChange={function(e){setFlt(function(p){return Object.assign({},p,{f:e.target.value});});}}>
                <option value="todos">Todas las fechas</option>
                {fechasDisp.map(function(fk){
                  var d=fk.split("-"); var lbl=d[2]+"/"+d[1]+"/"+d[0];
                  return <option key={fk} value={fk}>{lbl}</option>;
                })}
              </select>
              {/* Filtro tipo origen */}
              <select value={flt.to_origen} style={selSt} onChange={function(e){setFlt(function(p){return Object.assign({},p,{to_origen:e.target.value});});}}>
                <option value="todos">Todo origen</option>
                {origenesDisp.map(function(v){ return <option key={v} value={v}>{v}</option>; })}
              </select>
              {/* Filtro tipo destino */}
              <select value={flt.to_destino} style={selSt} onChange={function(e){setFlt(function(p){return Object.assign({},p,{to_destino:e.target.value});});}}>
                <option value="todos">Todo destino</option>
                {destinosDisp.map(function(v){ return <option key={v} value={v}>{v}</option>; })}
              </select>
              {/* Búsqueda */}
              <div style={{ position:"relative",flex:1,minWidth:200 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2"
                  style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",pointerEvents:"none" }}>
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input placeholder="Buscar guía, usuario, razón social…" value={flt.q}
                  style={Object.assign({},selSt,{width:"100%",boxSizing:"border-box",paddingLeft:32})}
                  onChange={function(e){setFlt(function(p){return Object.assign({},p,{q:e.target.value});});}} />
              </div>
              <span style={{ fontSize:11,color:T.textMuted,whiteSpace:"nowrap" }}>
                {fltd.length} / {results.length}
              </span>
              <button onClick={function(){expCsv(fltd,"guias_"+flt.s+".csv");}}
                style={Object.assign({},btnSec,{display:"flex",alignItems:"center",gap:6,borderRadius:T.r8})}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Exportar
              </button>
            </div>

            {fltd.length===0 ? <Empty msg="Sin resultados para este filtro" /> : (
              <div style={{ borderRadius:T.r12,border:"1px solid "+T.borderFaint,overflow:"hidden" }}>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
                    <thead>
                      <tr style={{ background:T.bgPanel,borderBottom:"1px solid "+T.borderFaint,
                        position:"sticky",top:0,zIndex:10 }}>
                        {["Guía","Referencia","Razón Social","Fuente","Estatus","Confirm.","Tipo Origen","Tipo Destino","Criticidad","Problemas",""].map(function(h,i){
                          return <th key={i} style={thSt}>{h}</th>;
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {fltd.slice(0,300).map(function(r,i){
                        var srcColor=r.source==="Comando"?T.accentBlueLt:T.purple;
                        var srcBg=r.source==="Comando"?T.accentGlow:T.purpleBg;
                        var open=expRow===r.id;
                        return (
                          <Fragment key={r.id}>
                          <tr className="vge-row"
                            style={{ borderBottom:"1px solid "+T.borderFaint+"66",
                              background:open?T.accentGlow:(i%2===0?T.bgSurface:T.bgPanel) }}>
                            <td style={{ padding:"10px 12px",fontFamily:"'SF Mono',monospace",fontSize:11,
                              fontWeight:600,color:T.textPrimary,whiteSpace:"nowrap" }}>{r.guia}</td>
                            <td style={{ padding:"10px 12px",fontSize:11,color:T.textSec,
                              maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}
                              title={r.referencia}>{r.referencia||"—"}</td>
                            <td style={{ padding:"10px 12px",fontSize:11,color:T.textSec,
                              maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}
                              title={r.razonSocial}>{r.razonSocial||"—"}</td>
                            <td style={{ padding:"10px 12px" }}>
                              <span style={{ padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:600,
                                background:srcBg,color:srcColor,border:"1px solid "+srcColor+"30" }}>
                                {r.source==="Comando"?"Cmd":"WS"}
                              </span>
                            </td>
                            <td style={{ padding:"10px 12px" }}><SBadge s={r.status}/></td>
                            <td style={{ padding:"10px 12px" }}>
                              <span style={{ fontSize:11,fontWeight:600,
                                color:r.confirmacion==="OK"?T.success:T.danger }}>
                                {r.confirmacion==="OK"?"✓ OK":"✕ Revisar"}
                              </span>
                            </td>
                            <td style={{ padding:"10px 12px",fontSize:11,color:T.textSec,whiteSpace:"nowrap" }}>
                              {r.tipoOrigen||"—"}
                            </td>
                            <td style={{ padding:"10px 12px",fontSize:11,color:T.textSec,whiteSpace:"nowrap" }}>
                              {r.tipoDestino||"—"}
                            </td>
                            <td style={{ padding:"10px 12px" }}><CBadge v={r.criticidad}/></td>
                            <td style={{ padding:"10px 12px",maxWidth:180 }}>
                              {r.issues&&r.issues.length>0
                                ? <ul style={{ margin:0,padding:"0 0 0 12px",color:T.danger,fontSize:10,lineHeight:1.6 }}>
                                    {r.issues.map(function(m,j){return <li key={j}>{m}</li>;})}
                                  </ul>
                                : <span style={{ color:T.success,fontSize:10 }}>✓ Sin problemas</span>}
                            </td>
                            <td style={{ padding:"10px 12px",display:"flex",gap:6,whiteSpace:"nowrap" }}>
                              <button onClick={function(){setExpRow(open?null:r.id);}}
                                style={{ padding:"4px 10px",background:open?T.accentBlue:"transparent",
                                  color:open?"white":T.textSec,border:"1px solid "+(open?T.accentBlue:T.borderLight),
                                  borderRadius:T.r6,fontSize:10,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap" }}>
                                {open?"▾ Detalle":"▸ Detalle"}
                              </button>
                              {(r.status==="sospechosa"||r.status==="anomalia") && (
                                <>
                                  <button onClick={function(){setModal(r);setMForm({name:"",reason:""});setEstOpts({});}}
                                    style={{ padding:"4px 10px",background:T.accentBlue,color:"white",border:"none",
                                      borderRadius:T.r6,fontSize:10,cursor:"pointer",fontWeight:600,
                                      whiteSpace:"nowrap" }}>
                                    ✓ Autorizar
                                  </button>
                                  <button onClick={function(){setMmod(r);setRForm({name:"",reason:""});}}
                                    style={{ padding:"4px 10px",background:T.danger,color:"white",border:"none",
                                      borderRadius:T.r6,fontSize:10,cursor:"pointer",fontWeight:600,
                                      whiteSpace:"nowrap" }}>
                                    ✕ Rechazar
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                          {open && (
                            <tr key={r.id+"-det"} style={{ background:T.bgPanel }}>
                              <td colSpan={11} style={{ padding:"2px 12px 16px" }}>
                                <GuiaDetalle row={r.row} />
                              </td>
                            </tr>
                          )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {fltd.length>300 && (
                  <div style={{ padding:"10px 16px",fontSize:11,color:T.textMuted,
                    borderTop:"1px solid "+T.borderFaint,background:T.bgPanel }}>
                    Mostrando 300 de {fltd.length}. Exporta CSV para ver todos.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

                {/* ═══ AUTORIZACIONES ═══ */}
        {tab==="autorizaciones" && (
          <div className="vge-fade">
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
              <div>
                <h2 style={{ fontSize:18,fontWeight:700,color:T.textPrimary,letterSpacing:"-0.02em",marginBottom:4 }}>Autorizaciones</h2>
                <div style={{ fontSize:12,color:T.textMuted }}>{auths.length} registros históricos</div>
              </div>
              {auths.length>0 && (
                <button onClick={function(){expCsv(auths.map(function(a){
                  return {"Guía":a.guia,"Fuente":a.source,"Estatus":a.original,"Criticidad":a.criticidad,
                    "Problemas":(a.issues||[]).join("; "),"Autorizado por":a.name,"Motivo":a.reason,"Fecha":a.fecha};
                }),"autorizaciones.csv");}} style={Object.assign({},btnSec,{borderRadius:T.r8,display:"flex",alignItems:"center",gap:6})}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Exportar
                </button>
              )}
            </div>
            {auths.length===0 ? <Empty msg="No hay autorizaciones registradas" sub="Las autorizaciones aparecerán aquí cuando apruebes guías sospechosas o con anomalías" /> : (
              <>
                {/* Toolbar filtros */}
                <div style={{ display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center" }}>
                  <select value={aFlt.src} style={selSt} onChange={function(e){setAFlt(function(p){return Object.assign({},p,{src:e.target.value});});}}>
                    <option value="todos">Todas las fuentes</option>
                    <option value="Comando">Comando</option>
                    <option value="Web Service">Web Service</option>
                  </select>
                  <select value={aFlt.f} style={selSt} onChange={function(e){setAFlt(function(p){return Object.assign({},p,{f:e.target.value});});}}>
                    <option value="todos">Todas las fechas</option>
                    {authFechas.map(function(k){return <option key={k} value={k}>{dayKeyToLabel(k)}</option>;})}
                  </select>
                  <div style={{ position:"relative",flex:1,minWidth:200 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2"
                      style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",pointerEvents:"none" }}>
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input placeholder="Buscar guía, usuario, motivo…" value={aFlt.q}
                      style={Object.assign({},selSt,{width:"100%",boxSizing:"border-box",paddingLeft:32})}
                      onChange={function(e){setAFlt(function(p){return Object.assign({},p,{q:e.target.value});});}} />
                  </div>
                  <span style={{ fontSize:11,color:T.textMuted,whiteSpace:"nowrap" }}>{authsF.length} / {auths.length}</span>
                </div>
                {authsF.length===0 ? <Empty msg="Sin resultados para este filtro" /> : (
                  <div style={{ borderRadius:T.r12,border:"1px solid "+T.borderFaint,overflow:"hidden" }}>
                    <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
                      <thead>
                        <tr style={{ background:T.bgPanel,borderBottom:"1px solid "+T.borderFaint }}>
                          {["Guía","Fuente","Original","Criticidad","Problemas","Autorizado por","Motivo","Fecha",""].map(function(h,i){
                            return <th key={i} style={thSt}>{h}</th>;
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {authsF.map(function(a,i){
                          var aopen=expRow==="auth-"+i;
                          return (
                            <Fragment key={"auth-"+i}>
                            <tr className="vge-row" style={{ borderBottom:"1px solid "+T.borderFaint+"66",
                              background:aopen?T.accentGlow:(i%2===0?T.bgSurface:T.bgPanel) }}>
                              <td style={{ padding:"10px 12px",fontFamily:"'SF Mono',monospace",fontSize:11,fontWeight:600,color:T.textPrimary }}>{a.guia}</td>
                              <td style={{ padding:"10px 12px",fontSize:11,color:T.textSec }}>{a.source}</td>
                              <td style={{ padding:"10px 12px" }}><SBadge s={a.original}/></td>
                              <td style={{ padding:"10px 12px" }}><CBadge v={a.criticidad}/></td>
                              <td style={{ padding:"10px 12px",fontSize:10,color:T.danger,maxWidth:160,lineHeight:1.5 }}>{(a.issues||[]).join("; ")||"—"}</td>
                              <td style={{ padding:"10px 12px",fontWeight:600,fontSize:12,color:T.textPrimary }}>{a.name}</td>
                              <td style={{ padding:"10px 12px",color:T.textSec,fontSize:11,maxWidth:160 }}>{a.reason}</td>
                              <td style={{ padding:"10px 12px",fontSize:10,color:T.textMuted,whiteSpace:"nowrap" }}>{a.fecha}</td>
                              <td style={{ padding:"10px 12px" }}>
                                <button onClick={function(){setExpRow(aopen?null:"auth-"+i);}}
                                  style={{ padding:"4px 10px",background:aopen?T.accentBlue:"transparent",
                                    color:aopen?"white":T.textSec,border:"1px solid "+(aopen?T.accentBlue:T.borderLight),
                                    borderRadius:T.r6,fontSize:10,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap" }}>
                                  {aopen?"▾ Detalle":"▸ Detalle"}
                                </button>
                              </td>
                            </tr>
                            {aopen && (
                              <tr style={{ background:T.bgPanel }}>
                                <td colSpan={9} style={{ padding:"2px 12px 16px" }}>
                                  <GuiaDetalle row={(resByGuia[String(a.guia).trim()]||{}).row} />
                                </td>
                              </tr>
                            )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}
              </>
            )}
            <div style={{ marginTop:14,padding:14,background:T.successBg,borderRadius:T.r8,
              border:"1px solid "+T.successBd,fontSize:11,color:T.success,display:"flex",gap:8,alignItems:"center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.success} strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Las autorizaciones con "Agregar al estandarizado" actualizan automáticamente tu Google Sheet.
            </div>
          </div>
        )}

        {/* ═══ HISTÓRICO ═══ */}
        {tab==="historico" && (
          <div className="vge-fade">
            <h2 style={{ fontSize:18,fontWeight:700,color:T.textPrimary,letterSpacing:"-0.02em",marginBottom:4 }}>Histórico</h2>
            <p style={{ fontSize:12,color:T.textMuted,marginBottom:20 }}>Últimas {hist.length} validaciones guardadas.</p>
            {hist.length===0 ? <Empty msg="Sin validaciones registradas" sub="Ejecuta tu primera validación para ver el historial aquí" /> : (
              <div style={{ display:"grid",gap:10 }}>
                {hist.map(function(b,i){
                  var pOk=b.total>0?Math.round(b.validas/b.total*100):0;
                  return (
                    <div key={b.id} className="vge-card" style={{ background:T.bgSurface,borderRadius:T.r12,
                      padding:"16px 20px",border:"1px solid "+T.borderFaint,display:"flex",alignItems:"center",gap:16 }}>
                      <div style={{ width:36,height:36,background:T.bgHover,borderRadius:T.r8,
                        border:"1px solid "+T.borderLight,display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:12,fontWeight:700,color:T.accentBlueLt,flexShrink:0 }}>{hist.length-i}</div>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontWeight:600,fontSize:13,color:T.textPrimary,marginBottom:3 }}>{b.periodo}</div>
                        <div style={{ fontSize:10,color:T.textMuted }}>
                          {b.fecha} · Cmd:{b.cmd} WS:{b.ws}
                          {b.modo&&<span style={{ marginLeft:8,padding:"1px 6px",background:T.accentGlow,
                            color:T.accentBlueLt,borderRadius:20,fontSize:9,fontWeight:600,
                            border:"1px solid "+T.borderBlue }}>{b.modo}</span>}
                          {b.discarded>0&&<span style={{ marginLeft:8,color:T.warning }}>{b.discarded} desc.</span>}
                        </div>
                      </div>
                      <div style={{ width:80,flexShrink:0 }}>
                        <div style={{ height:4,background:T.bgHover,borderRadius:4,overflow:"hidden",marginBottom:3 }}>
                          <div style={{ height:"100%",width:pOk+"%",
                            background:pOk>=90?T.success:pOk>=70?T.warning:T.danger,borderRadius:4 }}/>
                        </div>
                        <div style={{ fontSize:9,color:pOk>=90?T.success:pOk>=70?T.warning:T.danger,
                          fontWeight:600,textAlign:"right" }}>{pOk}% OK</div>
                      </div>
                      <div style={{ display:"flex",gap:14,flexShrink:0 }}>
                        {[{l:"Total",v:b.total,c:T.textSec},{l:"Válidas",v:b.validas,c:T.success},
                          {l:"Sosp.",v:b.sospechosas,c:T.warning},{l:"Anom.",v:b.anomalias,c:T.danger}].map(function(x){
                          return <div key={x.l} style={{ textAlign:"center" }}>
                            <div style={{ fontSize:16,fontWeight:700,color:x.c }}>{x.v}</div>
                            <div style={{ fontSize:9,color:x.c,opacity:0.7 }}>{x.l}</div>
                          </div>;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ RECHAZADAS ═══ */}
        {tab==="rechazadas" && (
          <div className="vge-fade">
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
              <div>
                <h2 style={{ fontSize:18,fontWeight:700,color:T.textPrimary,letterSpacing:"-0.02em",marginBottom:4 }}>Guías Rechazadas</h2>
                <div style={{ fontSize:12,color:T.textMuted }}>{rejects.length} rechazos registrados</div>
              </div>
              {rejects.length>0 && (
                <button onClick={function(){expCsv(rejects.map(function(r){
                  return {"Guía":r.guia,"Fuente":r.source,"Estatus":r.original,"Criticidad":r.criticidad,
                    "Problemas":r.problemas,"Rechazado por":r.rejectedBy,"Motivo":r.motivo,"Fecha":r.fecha};
                }),"rechazadas.csv");}} style={Object.assign({},btnSec,{borderRadius:T.r8,display:"flex",alignItems:"center",gap:6})}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Exportar
                </button>
              )}
            </div>
            {rejects.length===0 ? <Empty msg="No hay rechazos registrados" sub="Las guías rechazadas aparecerán aquí cuando uses el botón Rechazar" /> : (
              <>
                {/* Toolbar filtros */}
                <div style={{ display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center" }}>
                  <select value={rFlt.src} style={selSt} onChange={function(e){setRFlt(function(p){return Object.assign({},p,{src:e.target.value});});}}>
                    <option value="todos">Todas las fuentes</option>
                    <option value="Comando">Comando</option>
                    <option value="Web Service">Web Service</option>
                  </select>
                  <select value={rFlt.f} style={selSt} onChange={function(e){setRFlt(function(p){return Object.assign({},p,{f:e.target.value});});}}>
                    <option value="todos">Todas las fechas</option>
                    {rejFechas.map(function(k){return <option key={k} value={k}>{dayKeyToLabel(k)}</option>;})}
                  </select>
                  <div style={{ position:"relative",flex:1,minWidth:200 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2"
                      style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",pointerEvents:"none" }}>
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input placeholder="Buscar guía, usuario, motivo…" value={rFlt.q}
                      style={Object.assign({},selSt,{width:"100%",boxSizing:"border-box",paddingLeft:32})}
                      onChange={function(e){setRFlt(function(p){return Object.assign({},p,{q:e.target.value});});}} />
                  </div>
                  <span style={{ fontSize:11,color:T.textMuted,whiteSpace:"nowrap" }}>{rejectsF.length} / {rejects.length}</span>
                </div>
                {rejectsF.length===0 ? <Empty msg="Sin resultados para este filtro" /> : (
                  <div style={{ borderRadius:T.r12,border:"1px solid "+T.borderFaint,overflow:"hidden" }}>
                    <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
                      <thead>
                        <tr style={{ background:T.bgPanel,borderBottom:"1px solid "+T.borderFaint }}>
                          {["Guía","Fuente","Estatus","Criticidad","Problemas","Rechazado por","Motivo","Fecha",""].map(function(h,i){
                            return <th key={i} style={thSt}>{h}</th>;
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {rejectsF.map(function(r,i){
                          var ropen=expRow==="rej-"+i;
                          return (
                            <Fragment key={"rej-"+i}>
                            <tr className="vge-row" style={{ borderBottom:"1px solid "+T.borderFaint+"66",
                              background:ropen?T.accentGlow:(i%2===0?T.bgSurface:T.bgPanel) }}>
                              <td style={{ padding:"10px 12px",fontFamily:"'SF Mono',monospace",fontSize:11,fontWeight:600,color:T.textPrimary }}>{r.guia}</td>
                              <td style={{ padding:"10px 12px",fontSize:11,color:T.textSec }}>{r.source}</td>
                              <td style={{ padding:"10px 12px" }}><SBadge s={r.original}/></td>
                              <td style={{ padding:"10px 12px" }}><CBadge v={r.criticidad}/></td>
                              <td style={{ padding:"10px 12px",fontSize:10,color:T.danger,maxWidth:160,lineHeight:1.5 }}>{r.problemas||"—"}</td>
                              <td style={{ padding:"10px 12px",fontWeight:600,fontSize:12,color:T.textPrimary }}>{r.rejectedBy}</td>
                              <td style={{ padding:"10px 12px",color:T.textSec,fontSize:11,maxWidth:160 }}>{r.motivo}</td>
                              <td style={{ padding:"10px 12px",fontSize:10,color:T.textMuted,whiteSpace:"nowrap" }}>{r.fecha}</td>
                              <td style={{ padding:"10px 12px" }}>
                                <button onClick={function(){setExpRow(ropen?null:"rej-"+i);}}
                                  style={{ padding:"4px 10px",background:ropen?T.accentBlue:"transparent",
                                    color:ropen?"white":T.textSec,border:"1px solid "+(ropen?T.accentBlue:T.borderLight),
                                    borderRadius:T.r6,fontSize:10,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap" }}>
                                  {ropen?"▾ Detalle":"▸ Detalle"}
                                </button>
                              </td>
                            </tr>
                            {ropen && (
                              <tr style={{ background:T.bgPanel }}>
                                <td colSpan={9} style={{ padding:"2px 12px 16px" }}>
                                  <GuiaDetalle row={(resByGuia[String(r.guia).trim()]||{}).row} />
                                </td>
                              </tr>
                            )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}
              </>
            )}
            <div style={{ marginTop:14,padding:14,background:T.dangerBg,borderRadius:T.r8,
              border:"1px solid "+T.dangerBd,fontSize:11,color:T.danger,display:"flex",gap:8,alignItems:"center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.danger} strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Los rechazos se registran en "Historial de Rechazadas" de tu Google Sheet.
            </div>
          </div>
        )}

        {tab==="estandar" && (
          <div className="vge-fade">
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20 }}>
              <div>
                <h2 style={{ fontSize:18,fontWeight:700,color:T.textPrimary,letterSpacing:"-0.02em",marginBottom:4 }}>Estandarizado</h2>
                <div style={{ fontSize:12,color:T.textMuted }}>Conectado a Google Sheet · Los cambios se guardan directamente</div>
              </div>
              <button onClick={refreshEst} disabled={loading} style={Object.assign({},btnSec,{borderRadius:T.r8,display:"flex",alignItems:"center",gap:6})}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                Sincronizar
              </button>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
              {[
                {label:"Orígenes",   set:estOrig,  sheet:"Orígenes",   setter:setEstOrig, color:T.accentBlue},
                {label:"Destinos",   set:estDest,  sheet:"Destinos",   setter:setEstDest, color:T.chartTeal},
                {label:"Contenidos", set:estCont,  sheet:"Contenidos", setter:setEstCont, color:T.chartPurple},
                {label:"Usuarios",   set:estUsers, sheet:"Usuarios",   setter:setEstUsers,color:T.warning}
              ].map(function(cat) {
                return (
                  <div key={cat.label} className="vge-card" style={{ background:T.bgSurface,borderRadius:T.r12,
                    padding:18,border:"1px solid "+T.borderFaint }}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                      <div style={{ fontWeight:600,fontSize:13,color:T.textPrimary }}>{cat.label}</div>
                      <span style={{ fontSize:10,fontWeight:600,color:cat.color,
                        background:cat.color+"15",padding:"2px 8px",borderRadius:20 }}>
                        {cat.set.size} registros
                      </span>
                    </div>
                    <div style={{ maxHeight:130,overflowY:"auto",display:"flex",flexWrap:"wrap",gap:4,marginBottom:12 }}>
                      {[...cat.set].sort().slice(0,60).map(function(v){
                        return <span key={v} style={{ padding:"2px 8px",background:cat.color+"12",
                          color:cat.color,borderRadius:20,fontSize:10,fontWeight:500,
                          border:"1px solid "+cat.color+"25" }}>{v}</span>;
                      })}
                      {cat.set.size>60 && <span style={{ fontSize:10,color:T.textMuted }}>+{cat.set.size-60} más</span>}
                    </div>
                    <AddKw placeholder={"Agregar a "+cat.label+"…"}
                      onAdd={async function(v) {
                        if(!v) return;
                        var vl=v.toLowerCase();
                        cat.setter(function(s){var n=new Set(s);n.add(vl);return n;});
                        try { await appendToEst(estId,cat.sheet,v); notify('"'+v+'" → '+cat.label); }
                        catch(e) { notify("Error al guardar en Sheet",false); }
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop:14,padding:14,background:T.successBg,borderRadius:T.r8,
              border:"1px solid "+T.successBd,fontSize:11,color:T.success,display:"flex",gap:8,alignItems:"center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.success} strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Al autorizar una guía con "Agregar al estandarizado", el valor se actualiza aquí y en el Sheet.
            </div>
          </div>
        )}

        {/* ═══ REGLAS ═══ */}
        {tab==="reglas" && (
          <div className="vge-fade">
            <h2 style={{ fontSize:18,fontWeight:700,color:T.textPrimary,letterSpacing:"-0.02em",marginBottom:4 }}>Reglas de clasificación</h2>
            <p style={{ fontSize:12,color:T.textMuted,marginBottom:24 }}>
              Las reglas se evalúan en orden — la primera coincidencia determina el resultado.
            </p>
            <RulesTable title="Tipo Origen (Guías Comando)" rules={orRules} onSave={saveOrRules} />
            <RulesTable title="Tipo Destino (Guías Comando)"
              subtitle="Regla de sistema siempre activa: Alias Origen contiene ALMACEN + Razón Social Destino contiene OXXO/CHEDRAUI/WALMART → Cadenas Comerciales."
              rules={dtRules} onSave={saveDtRules} />

            {/* Patrones WS */}
            <div style={{ marginBottom:28 }}>
              <div style={{ fontWeight:600,fontSize:14,color:T.textPrimary,marginBottom:12 }}>Patrones Web Service</div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
                {/* TR Keywords */}
                <div className="vge-card" style={{ background:T.bgSurface,borderRadius:T.r12,padding:16,border:"1px solid "+T.borderFaint }}>
                  <div style={{ fontWeight:600,fontSize:12,color:T.textPrimary,marginBottom:10 }}>TR Keywords (case-sensitive)</div>
                  <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:10 }}>
                    {wsConf.trKeywords.map(function(k,i){
                      return (
                        <span key={i} style={{ padding:"3px 10px",borderRadius:20,background:T.accentGlow,
                          color:T.accentBlueLt,fontSize:11,fontFamily:"monospace",fontWeight:600,
                          border:"1px solid "+T.borderBlue,display:"flex",alignItems:"center",gap:6 }}>
                          {k}
                          <button onClick={async function(){await saveWsConf(Object.assign({},wsConf,{trKeywords:wsConf.trKeywords.filter(function(_,j){return j!==i;})}));}}
                            style={{ background:"none",border:"none",cursor:"pointer",color:T.danger,fontSize:12,padding:0,lineHeight:1 }}>×</button>
                        </span>
                      );
                    })}
                  </div>
                  <AddKw placeholder="ej. TR" onAdd={async function(v){if(!v||wsConf.trKeywords.includes(v))return;await saveWsConf(Object.assign({},wsConf,{trKeywords:wsConf.trKeywords.concat([v])}));}} />
                </div>
                {/* Cambio catálogo */}
                <div className="vge-card" style={{ background:T.bgSurface,borderRadius:T.r12,padding:16,border:"1px solid "+T.borderFaint }}>
                  <div style={{ fontWeight:600,fontSize:12,color:T.textPrimary,marginBottom:10 }}>Cambio catálogo (case-insensitive)</div>
                  <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:10 }}>
                    {wsConf.camKeywords.map(function(k,i){
                      return (
                        <span key={i} style={{ padding:"3px 10px",borderRadius:20,background:T.purpleBg,
                          color:T.purple,fontSize:11,fontWeight:600,border:"1px solid "+T.purpleBd,
                          display:"flex",alignItems:"center",gap:6 }}>
                          {k}
                          <button onClick={async function(){await saveWsConf(Object.assign({},wsConf,{camKeywords:wsConf.camKeywords.filter(function(_,j){return j!==i;})}));}}
                            style={{ background:"none",border:"none",cursor:"pointer",color:T.danger,fontSize:12,padding:0,lineHeight:1 }}>×</button>
                        </span>
                      );
                    })}
                  </div>
                  <AddKw placeholder="ej. Cambio de catalogo" onAdd={async function(v){if(!v)return;await saveWsConf(Object.assign({},wsConf,{camKeywords:wsConf.camKeywords.concat([v])}));}} />
                </div>
                {/* Prefijos Ecommerce */}
                <div className="vge-card" style={{ background:T.bgSurface,borderRadius:T.r12,padding:16,border:"1px solid "+T.borderFaint }}>
                  <div style={{ fontWeight:600,fontSize:12,color:T.textPrimary,marginBottom:10 }}>Prefijos Ecommerce (col B + col D)</div>
                  <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11,marginBottom:10 }}>
                    <thead>
                      <tr style={{ borderBottom:"1px solid "+T.borderFaint }}>
                        {["Prefijo","Cuentas",""].map(function(h,i){return <th key={i} style={thSt}>{h}</th>;})}
                      </tr>
                    </thead>
                    <tbody>
                      {wsConf.ecPrefixes.map(function(ep,i){
                        return (
                          <tr key={i} style={{ borderBottom:"1px solid "+T.borderFaint+"66" }}>
                            <td style={Object.assign({},tdSt,{fontFamily:"monospace",fontWeight:700,color:T.chartTeal})}>{ep.prefix}</td>
                            <td style={Object.assign({},tdSt,{color:T.textSec})}>{ep.accounts}</td>
                            <td style={tdSt}>
                              <button onClick={async function(){await saveWsConf(Object.assign({},wsConf,{ecPrefixes:wsConf.ecPrefixes.filter(function(_,j){return j!==i;})}));}}
                                style={{ padding:"2px 8px",background:T.dangerBg,color:T.danger,border:"1px solid "+T.dangerBd,borderRadius:T.r6,fontSize:10,cursor:"pointer" }}>
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <AddEcPfx onAdd={async function(p,a){await saveWsConf(Object.assign({},wsConf,{ecPrefixes:wsConf.ecPrefixes.concat([{prefix:p,accounts:a}])}));}} />
                </div>
                {/* Cuentas Concentradora */}
                <div className="vge-card" style={{ background:T.bgSurface,borderRadius:T.r12,padding:16,border:"1px solid "+T.borderFaint }}>
                  <div style={{ fontWeight:600,fontSize:12,color:T.textPrimary,marginBottom:10 }}>Cuentas Concentradora (col D + ref vacía)</div>
                  <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:10 }}>
                    {wsConf.concentradoraAccounts.map(function(a,i){
                      return (
                        <span key={i} style={{ padding:"3px 10px",borderRadius:20,background:T.successBg,
                          color:T.success,fontSize:11,fontFamily:"monospace",fontWeight:600,
                          border:"1px solid "+T.successBd,display:"flex",alignItems:"center",gap:6 }}>
                          {a}
                          <button onClick={async function(){await saveWsConf(Object.assign({},wsConf,{concentradoraAccounts:wsConf.concentradoraAccounts.filter(function(_,j){return j!==i;})}));}}
                            style={{ background:"none",border:"none",cursor:"pointer",color:T.danger,fontSize:12,padding:0,lineHeight:1 }}>×</button>
                        </span>
                      );
                    })}
                  </div>
                  <AddKw placeholder="ej. 4003984" onAdd={async function(v){if(!v||wsConf.concentradoraAccounts.includes(v))return;await saveWsConf(Object.assign({},wsConf,{concentradoraAccounts:wsConf.concentradoraAccounts.concat([v])}));}} />
                </div>
              </div>
              <div style={{ marginTop:14,padding:14,background:T.accentGlow,borderRadius:T.r8,
                border:"1px solid "+T.borderBlue,fontSize:11,color:T.accentBlueLt,
                display:"flex",gap:8,alignItems:"center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.accentBlueLt} strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Los cambios en reglas y patrones aplican en la <strong>siguiente validación</strong>.
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Modal de autorización ── */}
      {modal && (
        <div style={{ position:"fixed",top:0,left:0,right:0,bottom:0,
          background:"rgba(7,11,20,0.8)",display:"flex",alignItems:"center",
          justifyContent:"center",zIndex:200,backdropFilter:"blur(6px)",
          WebkitBackdropFilter:"blur(6px)" }}>
          <div className="vge-fade" style={{ background:T.bgPanel,borderRadius:T.r16,padding:28,
            maxWidth:480,width:"94%",boxShadow:T.shadowLg,border:"1px solid "+T.borderLight }}>
            {/* Header modal */}
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20 }}>
              <div>
                <div style={{ fontWeight:700,fontSize:16,color:T.textPrimary,marginBottom:5 }}>Autorizar guía</div>
                <div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
                  <code style={{ fontFamily:"monospace",fontWeight:700,fontSize:13,color:T.accentBlueLt,
                    background:T.accentGlow,padding:"2px 8px",borderRadius:T.r6,
                    border:"1px solid "+T.borderBlue }}>{modal.guia}</code>
                  <span style={{ fontSize:11,color:T.textMuted }}>{modal.source}</span>
                  {modal.criticidad&&modal.criticidad!=="OK"&&<CBadge v={modal.criticidad}/>}
                </div>
              </div>
              <button onClick={function(){setModal(null);setMForm({name:"",reason:""});setEstOpts({});}}
                style={{ background:"none",border:"1px solid "+T.borderLight,borderRadius:T.r8,
                  cursor:"pointer",color:T.textMuted,padding:"5px 9px",fontSize:16,lineHeight:1 }}>×</button>
            </div>

            {/* Issues */}
            {modal.issues&&modal.issues.length>0 && (
              <div style={{ padding:"12px 14px",background:T.dangerBg,borderRadius:T.r8,
                marginBottom:16,border:"1px solid "+T.dangerBd }}>
                <div style={{ fontSize:10,fontWeight:700,color:T.danger,marginBottom:6,
                  textTransform:"uppercase",letterSpacing:"0.06em" }}>Problemas detectados</div>
                <ul style={{ margin:0,padding:"0 0 0 14px",fontSize:11,color:T.danger,lineHeight:1.7 }}>
                  {modal.issues.map(function(m,i){return <li key={i}>{m}</li>;})}
                </ul>
              </div>
            )}

            {/* Pendientes de estandarizar */}
            {modal.pendienteEst&&modal.pendienteEst.length>0 && (
              <div style={{ padding:"12px 14px",background:T.successBg,borderRadius:T.r8,
                marginBottom:16,border:"1px solid "+T.successBd }}>
                <div style={{ fontSize:10,fontWeight:700,color:T.success,marginBottom:8,
                  textTransform:"uppercase",letterSpacing:"0.06em" }}>Agregar al estandarizado</div>
                {modal.pendienteEst.map(function(p){
                  if(!p.value) return null;
                  return (
                    <label key={p.field} style={{ display:"flex",alignItems:"flex-start",gap:9,
                      fontSize:12,marginBottom:7,cursor:"pointer",color:T.textPrimary }}>
                      <input type="checkbox" checked={!!estOpts[p.field]}
                        onChange={function(e){setEstOpts(function(o){return Object.assign({},o,{[p.field]:e.target.checked});});}}
                        style={{ marginTop:2,accentColor:T.accentBlue }} />
                      <span>Agregar <strong style={{ color:T.textPrimary }}>"{p.value}"</strong>
                        <span style={{ color:T.textMuted }}> → hoja <strong style={{ color:T.accentBlueLt }}>{p.sheet}</strong></span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Campos del modal */}
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:11,fontWeight:700,display:"block",marginBottom:6,
                color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.06em" }}>Autorizado por *</label>
              {catalogos.nombres.length>0 ? (
                <select value={mForm.name} style={Object.assign({},selSt,{width:"100%",boxSizing:"border-box",fontSize:13,padding:"10px 12px"})}
                  onChange={function(e){setMForm(function(f){return Object.assign({},f,{name:e.target.value});});}}>
                  <option value="">Selecciona…</option>
                  {catalogos.nombres.map(function(n){return <option key={n} value={n}>{n}</option>;})}
                </select>
              ) : (
                <input value={mForm.name} placeholder="Nombre completo"
                  style={Object.assign({},selSt,{width:"100%",boxSizing:"border-box",fontSize:13,padding:"10px 12px"})}
                  onChange={function(e){setMForm(function(f){return Object.assign({},f,{name:e.target.value});});}} />
              )}
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:11,fontWeight:700,display:"block",marginBottom:6,
                color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.06em" }}>Motivo *</label>
              {catalogos.motivos.length>0 ? (
                <select value={mForm.reason} style={Object.assign({},selSt,{width:"100%",boxSizing:"border-box",fontSize:13,padding:"10px 12px"})}
                  onChange={function(e){setMForm(function(f){return Object.assign({},f,{reason:e.target.value});});}}>
                  <option value="">Selecciona motivo…</option>
                  {catalogos.motivos.map(function(m){return <option key={m} value={m}>{m}</option>;})}
                  <option value="Otros">Otros (escribir)</option>
                </select>
              ) : null}
              {(catalogos.motivos.length===0||mForm.reason==="Otros") && (
                <textarea value={mForm.reason==="Otros"?motManual:mForm.reason} rows={3}
                  placeholder="Justificación del movimiento…"
                  style={Object.assign({},selSt,{width:"100%",boxSizing:"border-box",fontSize:13,
                    padding:"10px 12px",resize:"vertical",marginTop:catalogos.motivos.length>0?8:0})}
                  onChange={function(e){
                    if(mForm.reason==="Otros") setMotManual(e.target.value);
                    else setMForm(function(f){return Object.assign({},f,{reason:e.target.value});});
                  }} />
              )}
            </div>

            {/* Acciones */}
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <button onClick={function(){setModal(null);setMForm({name:"",reason:""});setEstOpts({});}}
                style={Object.assign({},btnSec,{borderRadius:T.r8,padding:"9px 18px"})}>
                Cancelar
              </button>
              <button onClick={authorize}
                disabled={loading||!mForm.name||(!mForm.reason)||(mForm.reason==="Otros"&&!motManual)}
                className="vge-btn-primary"
                style={{ padding:"9px 20px",color:"white",border:"none",borderRadius:T.r8,fontSize:13,
                  fontWeight:700,cursor:"pointer",
                  background:(loading||!mForm.name||!mForm.reason||(mForm.reason==="Otros"&&!motManual))
                    ?"rgba(59,130,246,0.3)":T.accentBlue,
                  boxShadow:"0 2px 10px rgba(59,130,246,0.3)" }}>
                {loading ? "Guardando…" : "✓ Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
            {mmod && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,backdropFilter:"blur(6px)" }}>
          <div style={{ background:T.bgSurface,borderRadius:T.r12,padding:24,maxWidth:400,width:"100%",border:"1px solid "+T.borderFaint,maxHeight:"90vh",overflowY:"auto" }}>
            <h3 style={{ fontSize:15,fontWeight:700,color:T.textPrimary,marginBottom:3 }}>Rechazar Guía</h3>
            <div style={{ fontSize:11,color:T.textMuted,marginBottom:20 }}>{mmod.guia} · {mmod.source}</div>
            
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:11,fontWeight:700,display:"block",marginBottom:6,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.06em" }}>Código guía</label>
              <div style={{ padding:"8px 12px",background:T.bgPanel,borderRadius:T.r6,fontFamily:"'SF Mono',monospace",fontSize:12,fontWeight:600,color:T.accentBlueLt,border:"1px solid "+T.borderBlue }}>{mmod.guia}</div>
            </div>

            <div style={{ marginBottom:20,padding:14,background:T.dangerBg,borderRadius:T.r8,border:"1px solid "+T.dangerBd }}>
              <div style={{ fontSize:10,color:T.danger,fontWeight:600,marginBottom:8,textTransform:"uppercase" }}>Problemas identificados</div>
              <ul style={{ margin:0,paddingLeft:18,fontSize:10,color:T.danger,lineHeight:1.6 }}>
                {mmod.issues&&mmod.issues.length>0?mmod.issues.map(function(iss,i){return <li key={i}>{iss}</li>;}):
                  <li>Estatus: {mmod.status}</li>}
              </ul>
            </div>

            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:11,fontWeight:700,display:"block",marginBottom:6,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.06em" }}>Rechazado por *</label>
              {catalogos.nombres.length>0 ? (
                <select value={rForm.name} style={Object.assign({},selSt,{width:"100%",boxSizing:"border-box",fontSize:13,padding:"10px 12px"})}
                  onChange={function(e){setRForm(function(f){return Object.assign({},f,{name:e.target.value});});}}> 
                  <option value="">Selecciona tu nombre…</option>
                  {catalogos.nombres.map(function(n){return <option key={n} value={n}>{n}</option>;})}
                </select>
              ) : (
                <input value={rForm.name}
                  style={Object.assign({},selSt,{width:"100%",boxSizing:"border-box",fontSize:13,padding:"10px 12px"})}
                  placeholder="Tu nombre…"
                  onChange={function(e){setRForm(function(f){return Object.assign({},f,{name:e.target.value});});}} />
              )}
            </div>

            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:11,fontWeight:700,display:"block",marginBottom:6,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.06em" }}>Motivo del rechazo *</label>
              {motivosRech.length>0 ? (
                <select value={rForm.reason} style={Object.assign({},selSt,{width:"100%",boxSizing:"border-box",fontSize:13,padding:"10px 12px"})}
                  onChange={function(e){setRForm(function(f){return Object.assign({},f,{reason:e.target.value});});}}> 
                  <option value="">Selecciona motivo…</option>
                  {motivosRech.map(function(m){return <option key={m} value={m}>{m}</option>;})}
                  <option value="Otros">Otros (escribir)</option>
                </select>
              ) : null}
              {(motivosRech.length===0 || rForm.reason==="Otros") && (
                <textarea value={rForm.reason==="Otros"?motRechManual:rForm.reason} rows={3}
                  placeholder="Motivo del rechazo…"
                  style={Object.assign({},selSt,{width:"100%",boxSizing:"border-box",fontSize:13,padding:"10px 12px",resize:"vertical",marginTop:motivosRech.length>0?8:0})}
                  onChange={function(e){
                    if(rForm.reason==="Otros") setMotRechManual(e.target.value);
                    else setRForm(function(f){return Object.assign({},f,{reason:e.target.value});});
                  }} />
              )}
            </div>

            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <button onClick={function(){setMmod(null);setRForm({name:"",reason:""});setMotRechManual("");}}
                style={Object.assign({},btnSec,{borderRadius:T.r8,padding:"9px 18px"})}>
                Cancelar
              </button>
              <button onClick={reject}
                disabled={rLoading||!rForm.name||!rForm.reason||(rForm.reason==="Otros"&&!motRechManual)}
                style={{ padding:"9px 20px",color:"white",border:"none",borderRadius:T.r8,fontSize:13,fontWeight:700,cursor:"pointer",
                  background:(rLoading||!rForm.name||!rForm.reason||(rForm.reason==="Otros"&&!motRechManual))?"rgba(239,68,68,0.3)":T.danger,
                  boxShadow:"0 2px 10px rgba(239,68,68,0.3)" }}>
                {rLoading ? "Rechazando…" : "✕ Confirmar rechazo"}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
