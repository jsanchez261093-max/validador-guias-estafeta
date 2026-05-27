import { useState, useEffect } from "react";
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

// ── UI constants ───────────────────────────────────────────
var SC = {
  valida:     { l:"Válida",     c:"#15803d", bg:"#f0fdf4", bc:"#86efac", ic:"✓" },
  sospechosa: { l:"Sospechosa", c:"#b45309", bg:"#fffbeb", bc:"#fcd34d", ic:"⚠" },
  anomalia:   { l:"Anomalía",   c:"#b91c1c", bg:"#fef2f2", bc:"#fca5a5", ic:"✕" },
  autorizada: { l:"Autorizada", c:"#5b21b6", bg:"#f5f3ff", bc:"#c4b5fd", ic:"●" }
};
var CC  = { "OK":"#15803d","Medio":"#b45309","Alto":"#b91c1c","Crítico":"#7f1d1d" };
var CBG = { "OK":"#f0fdf4","Medio":"#fffbeb","Alto":"#fef2f2","Crítico":"#fef2f2" };
var selSt = { padding:"7px 10px",borderRadius:7,border:"1px solid #e2e8f0",fontSize:12,background:"#ffffff",color:"#1e293b" };
var btnSec = { padding:"8px 14px",background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:7,fontSize:12,cursor:"pointer",color:"#1e293b" };
var thSt = { padding:"7px 9px",textAlign:"left",fontWeight:500,color:"#64748b",fontSize:10 };
var tdSt = { padding:"6px 9px",fontSize:11 };

// ── Pure helpers ───────────────────────────────────────────
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
async function fetchGuias(histId, date) {
  var ef  = ymdToEst(date);
  var url = APPS_SCRIPT_URL
    + "?action=fetchGuias"
    + "&histId=" + encodeURIComponent(histId)
    + "&fecha="  + encodeURIComponent(ef);
  var d = await jsonp(url);
  if (d.error) throw new Error(d.error);
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

// ── Sub-components ─────────────────────────────────────────
function Empty(props) {
  return (
    <div style={{ textAlign:"center", padding:"48px 20px", color:"#64748b" }}>
      <div style={{ fontSize:32, marginBottom:10 }}>📭</div>
      <div style={{ fontSize:14, marginBottom:props.cta?14:0 }}>{props.msg}</div>
      {props.cta && <button onClick={props.onCta} style={{ padding:"8px 16px",background:"#3b82f6",color:"white",border:"none",borderRadius:7,fontSize:13,cursor:"pointer" }}>{props.cta}</button>}
    </div>
  );
}
function SBadge(props) {
  var sc = SC[props.s] || SC.valida;
  return <span style={{ padding:"2px 5px",borderRadius:4,fontSize:9,fontWeight:500,background:sc.bg,color:sc.c,border:"1px solid "+sc.bc }}>{sc.ic} {sc.l}</span>;
}
function CBadge(props) {
  return <span style={{ padding:"2px 5px",borderRadius:3,fontSize:9,fontWeight:500,background:CBG[props.v]||"#f8fafc",color:CC[props.v]||"#334155" }}>{props.v||"—"}</span>;
}
function AddKw(props) {
  var st = useState(""); var v = st[0], setV = st[1];
  return (
    <div style={{ display:"flex", gap:7 }}>
      <input value={v} placeholder={props.placeholder||"Agregar…"} style={Object.assign({},selSt,{flex:1})} onChange={function(e){setV(e.target.value);}} />
      <button onClick={async function(){if(v){await props.onAdd(v);setV("");}}} disabled={!v}
        style={{ padding:"7px 12px",background:v?"#3b82f6":"#94a3b8",color:"white",border:"none",borderRadius:7,fontSize:12,cursor:v?"pointer":"not-allowed" }}>
        + Agregar
      </button>
    </div>
  );
}
function AddEcPfx(props) {
  var pSt=useState(""); var p=pSt[0],setP=pSt[1];
  var aSt=useState(""); var a=aSt[0],setA=aSt[1];
  return (
    <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
      <input value={p} placeholder="Prefijo" style={Object.assign({},selSt,{width:80})} onChange={function(e){setP(e.target.value);}} />
      <input value={a} placeholder="Cuentas: 5901359,5011124" style={Object.assign({},selSt,{flex:1,minWidth:140})} onChange={function(e){setA(e.target.value);}} />
      <button onClick={async function(){if(p&&a){await props.onAdd(p.trim(),a.trim());setP("");setA("");}}} disabled={!p||!a}
        style={{ padding:"7px 12px",background:p&&a?"#3b82f6":"#94a3b8",color:"white",border:"none",borderRadius:7,fontSize:12,cursor:p&&a?"pointer":"not-allowed" }}>
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
      <div style={{ fontWeight:500, fontSize:14, marginBottom:3 }}>{props.title}</div>
      {props.subtitle && (
        <div style={{ fontSize:11, color:"#64748b", marginBottom:10, padding:"8px 12px", background:"#fffbeb", borderRadius:7, border:"1px solid #fcd34d" }}>
          ⚠ {props.subtitle}
        </div>
      )}
      <div style={{ borderRadius:10, border:"1px solid #e2e8f0", overflow:"hidden", marginBottom:10 }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
          <thead>
            <tr style={{ background:"#f8fafc", borderBottom:"1px solid #e2e8f0" }}>
              <th style={thSt}>#</th><th style={thSt}>Campo</th><th style={thSt}>Op.</th>
              <th style={thSt}>Valor</th><th style={thSt}>Resultado</th><th style={thSt}>Estado</th><th style={thSt}></th>
            </tr>
          </thead>
          <tbody>
            {props.rules.map(function(r, i) {
              return (
                <tr key={r.id} style={{ borderBottom:"1px solid #e2e8f0", opacity:r.active?1:0.45 }}>
                  <td style={tdSt}>{i+1}</td>
                  <td style={Object.assign({},tdSt,{maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"})} title={r.field}>{r.field}</td>
                  <td style={tdSt}>{opLabel(r.op)}</td>
                  <td style={Object.assign({},tdSt,{fontFamily:"monospace",fontWeight:500})}>{r.val}</td>
                  <td style={tdSt}><span style={{ padding:"2px 7px",borderRadius:4,fontSize:9,background:"#eff6ff",color:"#1d4ed8" }}>{r.result}</span></td>
                  <td style={tdSt}>
                    <button onClick={function(){toggle(r.id);}} style={{ padding:"2px 8px",borderRadius:4,fontSize:10,cursor:"pointer",border:"none",background:r.active?"#dcfce7":"#f1f5f9",color:r.active?"#15803d":"#94a3b8" }}>
                      {r.active?"✓ Activa":"Pausada"}
                    </button>
                  </td>
                  <td style={tdSt}>
                    <button onClick={function(){remove(r.id);}} style={{ padding:"2px 8px",borderRadius:4,fontSize:10,cursor:"pointer",border:"none",background:"#fef2f2",color:"#b91c1c" }}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ padding:12,background:"#f8fafc",borderRadius:10,border:"1px solid #e2e8f0",display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end" }}>
        <div>
          <div style={{ fontSize:10,fontWeight:500,marginBottom:3,color:"#64748b" }}>Campo</div>
          <select value={nr.field} style={selSt} onChange={function(e){setNr(function(r){return Object.assign({},r,{field:e.target.value});});}}>
            {CMD_FIELD_DEFS.map(function(f){ return <option key={f.key} value={f.key}>{f.label}</option>; })}
          </select>
        </div>
        <div>
          <div style={{ fontSize:10,fontWeight:500,marginBottom:3,color:"#64748b" }}>Operador</div>
          <select value={nr.op} style={selSt} onChange={function(e){setNr(function(r){return Object.assign({},r,{op:e.target.value});});}}>
            {OPS.map(function(o){ return <option key={o.key} value={o.key}>{o.label}</option>; })}
          </select>
        </div>
        <div>
          <div style={{ fontSize:10,fontWeight:500,marginBottom:3,color:"#64748b" }}>Valor</div>
          <input value={nr.val} placeholder="ej. CEDISST" style={Object.assign({},selSt,{minWidth:120})} onChange={function(e){setNr(function(r){return Object.assign({},r,{val:e.target.value});});}} />
        </div>
        <div>
          <div style={{ fontSize:10,fontWeight:500,marginBottom:3,color:"#64748b" }}>Resultado</div>
          <input value={nr.result} placeholder="ej. Tienda" style={Object.assign({},selSt,{minWidth:150})} onChange={function(e){setNr(function(r){return Object.assign({},r,{result:e.target.value});});}} />
        </div>
        <button onClick={add} disabled={!nr.val||!nr.result}
          style={{ padding:"8px 16px",color:"white",border:"none",borderRadius:7,fontSize:12,cursor:nr.val&&nr.result?"pointer":"not-allowed",background:nr.val&&nr.result?"#3b82f6":"#94a3b8" }}>
          + Agregar regla
        </button>
      </div>
    </div>
  );
}

// ── Almacenamiento local (localStorage para deploy) ────────
var LS = {
  get: function(k) {
    try { var v = localStorage.getItem(k); return v ? { value: v } : null; } catch(e) { return null; }
  },
  set: function(k, v) {
    try { localStorage.setItem(k, v); return true; } catch(e) { return false; }
  }
};

// ── App ────────────────────────────────────────────────────
export default function App() {
  var tabSt  = useState("inicio"); var tab=tabSt[0],setTab=tabSt[1];
  var dateSt = useState(new Date().toISOString().split("T")[0]); var date=dateSt[0],setDate=dateSt[1];
  var hIdSt  = useState(DEF_HIST_ID);  var histId=hIdSt[0],setHistId=hIdSt[1];
  var eIdSt  = useState(DEF_EST_ID);   var estId=eIdSt[0],setEstId=eIdSt[1];
  var resSt  = useState([]); var results=resSt[0],setResults=resSt[1];
  var eOSt   = useState(new Set()); var estOrig=eOSt[0],setEstOrig=eOSt[1];
  var eDSt   = useState(new Set()); var estDest=eDSt[0],setEstDest=eDSt[1];
  var eCxSt  = useState(new Set()); var estCont=eCxSt[0],setEstCont=eCxSt[1];
  var eUSt   = useState(new Set()); var estUsers=eUSt[0],setEstUsers=eUSt[1];
  var authsSt= useState([]); var auths=authsSt[0],setAuths=authsSt[1];
  var histSt = useState([]); var hist=histSt[0],setHist=histSt[1];
  var fltSt  = useState({s:"todos",src:"todos",q:""}); var flt=fltSt[0],setFlt=fltSt[1];
  var modalSt= useState(null); var modal=modalSt[0],setModal=modalSt[1];
  var mfSt   = useState({name:"",reason:""}); var mForm=mfSt[0],setMForm=mfSt[1];
  var eoSt   = useState({}); var estOpts=eoSt[0],setEstOpts=eoSt[1];
  var loadSt = useState(false); var loading=loadSt[0],setLoading=loadSt[1];
  var lmSt   = useState(""); var loadMsg=lmSt[0],setLoadMsg=lmSt[1];
  var noteSt = useState(null); var note=noteSt[0],setNote=noteSt[1];
  var orSt   = useState(DEFAULT_ORIGEN_RULES); var orRules=orSt[0],setOrRules=orSt[1];
  var dtSt   = useState(DEFAULT_DESTINO_RULES); var dtRules=dtSt[0],setDtRules=dtSt[1];
  var wcSt   = useState(DEFAULT_WS_CONFIG); var wsConf=wcSt[0],setWsConf=wcSt[1];
  var showCfgSt = useState(false); var showCfg=showCfgSt[0],setShowCfg=showCfgSt[1];

  useEffect(function() {
    function load(k, fn) {
      var r = LS.get(k);
      if (r && r.value) { try { fn(JSON.parse(r.value)); } catch(e) {} }
    }
    load("auths",        function(v){setAuths(v);});
    load("hist",         function(v){setHist(v);});
    load("estOrig",      function(v){setEstOrig(new Set(v));});
    load("estDest",      function(v){setEstDest(new Set(v));});
    load("estCont",      function(v){setEstCont(new Set(v));});
    load("estUsers",     function(v){setEstUsers(new Set(v));});
    load("origenRules",  function(v){setOrRules(v);});
    load("destinoRules", function(v){setDtRules(v);});
    load("wsConf",       function(v){setWsConf(v);});
    load("histId",       function(v){setHistId(v);});
    load("estId",        function(v){setEstId(v);});
  }, []);

  function notify(msg, ok) {
    if (ok===undefined) ok=true;
    setNote({msg:msg,ok:ok});
    setTimeout(function(){setNote(null);}, 4000);
  }

  async function runValidation() {
    if (!date) return;
    setLoading(true);
    try {
      setLoadMsg("📡 Leyendo guías desde Google Sheets…");
      var sheetData = await fetchGuias(histId, date);
      var cd = sheetData.comando || [];
      var wd = sheetData.webService || [];

      setLoadMsg("📋 Cargando estandarizado…");
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

      setLoadMsg("⚙️ Validando " + (cd.length + wd.length) + " guías…");
      var cGuias   = cd.map(function(r){return gv(r,"No. de guía");});
      var cGuiaSet = new Set(cGuias);
      var authSet  = new Set(auths.map(function(a){return a.source+"|"+a.guia;}));
      var cmdRes   = cd.map(function(r){return validateCmd(r,cGuias,nO,nD,nU,nC,orRules,dtRules);});
      var wsRaw    = wd.map(function(r){return validateWS(r,cGuiaSet,wsConf);});
      var disc     = wsRaw.filter(function(r){return r===null;}).length;
      var wsRes    = wsRaw.filter(function(r){return r!==null;});
      var all = cmdRes.concat(wsRes).map(function(r){
        return authSet.has(r.source+"|"+r.guia)?Object.assign({},r,{status:"autorizada"}):r;
      });
      setResults(all);

      var b = {
        id:Date.now(), fecha:new Date().toLocaleString("es-MX"), periodo:fmtDate(date),
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
      notify(all.length+" guías · Cmd:"+cd.length+" WS:"+wsRes.length+(disc>0?" · "+disc+" descartadas":""));
    } catch(e) {
      notify("Error: "+(e.message||"Verifica la conexión con Apps Script"), false);
      console.error(e);
    }
    setLoadMsg(""); setLoading(false);
  }

  async function authorize() {
    if (!mForm.name||!mForm.reason||!modal) return;
    setLoading(true);
    var na = { guia:modal.guia, source:modal.source, original:modal.status, issues:modal.issues,
      tipoOrigen:modal.tipoOrigen, tipoDestino:modal.tipoDestino, criticidad:modal.criticidad,
      name:mForm.name, reason:mForm.reason, fecha:new Date().toLocaleString("es-MX") };
    var newA = [na].concat(auths);
    setAuths(newA);
    LS.set("auths", JSON.stringify(newA));

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
    setModal(null); setMForm({name:"",reason:""}); setEstOpts({});
    setLoading(false);
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

  async function saveOrRules(r)  { setOrRules(r);  LS.set("origenRules",  JSON.stringify(r)); notify("Reglas Tipo Origen guardadas"); }
  async function saveDtRules(r)  { setDtRules(r);  LS.set("destinoRules", JSON.stringify(r)); notify("Reglas Tipo Destino guardadas"); }
  async function saveWsConf(c)   { setWsConf(c);   LS.set("wsConf",       JSON.stringify(c)); notify("Patrones WS guardados"); }

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
  var stT=results.length, stV=results.filter(function(r){return r.status==="valida";}).length;
  var stS=results.filter(function(r){return r.status==="sospechosa";}).length;
  var stA=results.filter(function(r){return r.status==="anomalia";}).length;
  var stAu=results.filter(function(r){return r.status==="autorizada";}).length;
  var fltd = results.filter(function(r) {
    var q=flt.q.toLowerCase();
    return (flt.s==="todos"||r.status===flt.s)&&(flt.src==="todos"||r.source===flt.src)
      &&(!flt.q||(r.guia&&r.guia.includes(flt.q))||(r.usuario&&r.usuario.toLowerCase().includes(q))||(r.razonSocial&&r.razonSocial.toLowerCase().includes(q)));
  });
  var pieData=[{n:"Válidas",v:stV,f:"#22c55e"},{n:"Sospechosas",v:stS,f:"#f59e0b"},{n:"Anomalías",v:stA,f:"#ef4444"},{n:"Autorizadas",v:stAu,f:"#8b5cf6"}].filter(function(d){return d.v>0;});
  var toMap={};results.forEach(function(r){if(r.tipoOrigen&&r.tipoOrigen!=="—")toMap[r.tipoOrigen]=(toMap[r.tipoOrigen]||0)+1;});
  var toCounts=Object.entries(toMap).sort(function(a,b){return b[1]-a[1];}).slice(0,8).map(function(e){return{n:e[0],v:e[1]};});
  var barData=["Comando","Web Service"].map(function(src){return{name:src==="Comando"?"Comando":"Web Svc",Válidas:results.filter(function(r){return r.source===src&&r.status==="valida";}).length,Sospechosas:results.filter(function(r){return r.source===src&&r.status==="sospechosa";}).length,Anomalías:results.filter(function(r){return r.source===src&&r.status==="anomalia";}).length};});
  var critCards=["OK","Medio","Alto","Crítico"].map(function(c){return{l:c,n:results.filter(function(r){return r.criticidad===c;}).length};}).filter(function(x){return x.n>0;});
  var cmdDateMap={};
  results.filter(function(r){return r.source==="Comando";}).forEach(function(r){var d=parseFechaDay(r.fecha);if(d){if(!cmdDateMap[d])cmdDateMap[d]={total:0,validas:0,sospechosas:0,anomalias:0};cmdDateMap[d].total++;if(r.status==="valida")cmdDateMap[d].validas++;if(r.status==="sospechosa")cmdDateMap[d].sospechosas++;if(r.status==="anomalia")cmdDateMap[d].anomalias++;}});
  var cmdDaily=Object.entries(cmdDateMap).sort(function(a,b){return a[0].localeCompare(b[0]);}).map(function(e){return Object.assign({fecha:e[0]},e[1]);});
  var wsDateMap={};
  results.filter(function(r){return r.source==="Web Service";}).forEach(function(r){var d=parseFechaDay(r.fecha);if(d){if(!wsDateMap[d])wsDateMap[d]={total:0,validas:0,sospechosas:0,anomalias:0};wsDateMap[d].total++;if(r.status==="valida")wsDateMap[d].validas++;if(r.status==="sospechosa")wsDateMap[d].sospechosas++;if(r.status==="anomalia")wsDateMap[d].anomalias++;}});
  var wsDaily=Object.entries(wsDateMap).sort(function(a,b){return a[0].localeCompare(b[0]);}).map(function(e){return Object.assign({fecha:e[0]},e[1]);});
  var cmdTipoMap={};results.filter(function(r){return r.source==="Comando"&&r.tipoOrigen;}).forEach(function(r){cmdTipoMap[r.tipoOrigen]=(cmdTipoMap[r.tipoOrigen]||0)+1;});
  var cmdTipo=Object.entries(cmdTipoMap).sort(function(a,b){return b[1]-a[1];}).map(function(e){return{tipo:e[0],n:e[1]};});
  var wsTipoMap={};results.filter(function(r){return r.source==="Web Service"&&r.tipoOrigen&&r.tipoOrigen!=="—";}).forEach(function(r){wsTipoMap[r.tipoOrigen]=(wsTipoMap[r.tipoOrigen]||0)+1;});
  var wsTipo=Object.entries(wsTipoMap).sort(function(a,b){return b[1]-a[1];}).map(function(e){return{tipo:e[0],n:e[1]};});

  // ── Render ─────────────────────────────────────────────────
  return (
    <div style={{ fontFamily:"system-ui,sans-serif", background:"#f1f5f9", position:"relative", minHeight:600 }}>

      {/* Header */}
      <div style={{ background:"#0f172a", color:"white", padding:"10px 20px", display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:28, height:28, background:"#3b82f6", borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:11 }}>ES</div>
        <div>
          <div style={{ fontWeight:500, fontSize:14 }}>Validador de Guías Estafeta — MOBO</div>
          <div style={{ fontSize:10, opacity:0.4 }}>Conectado a Google Sheets via Apps Script</div>
        </div>
        {note && (
          <div style={{ marginLeft:"auto", padding:"5px 12px", borderRadius:6, fontSize:11, maxWidth:400, background:note.ok?"#15803d":"#b91c1c" }}>
            {note.msg}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ background:"#1e293b", padding:"0 16px", display:"flex", overflowX:"auto" }}>
        {[
          {id:"inicio",        l:"Inicio"},
          {id:"dashboard",     l:"Dashboard"},
          {id:"resultados",    l:"Resultados"},
          {id:"autorizaciones",l:"Autorizaciones"},
          {id:"historico",     l:"Histórico"},
          {id:"estandar",      l:"Estándar"},
          {id:"reglas",        l:"⚙ Reglas"}
        ].map(function(t) {
          var badge = t.id==="resultados"&&results.length?" ("+results.length+")"
            : t.id==="autorizaciones"&&auths.length?" ("+auths.length+")" : "";
          var active = tab === t.id;
          return (
            <button key={t.id} onClick={function(){setTab(t.id);}}
              style={{ padding:"10px 13px",fontSize:12,border:"none",cursor:"pointer",background:"transparent",whiteSpace:"nowrap",flexShrink:0,
                color:active?"white":"rgba(255,255,255,0.42)",
                borderBottom:"2px solid "+(active?"#3b82f6":"transparent") }}>
              {t.l}{badge}
            </button>
          );
        })}
      </div>

      <div style={{ padding:"18px 18px 40px", maxWidth:1200, margin:"0 auto" }}>

        {/* ═══ INICIO ═══ */}
        {tab === "inicio" && (
          <div style={{ maxWidth:520, margin:"0 auto", paddingTop:16 }}>
            <div style={{ textAlign:"center", marginBottom:28 }}>
              <div style={{ fontSize:42, marginBottom:8 }}>📊</div>
              <h2 style={{ fontSize:18, fontWeight:500, marginBottom:4 }}>Validación de Guías</h2>
              <div style={{ fontSize:13, color:"#64748b" }}>
                Selecciona la fecha para cargar y validar guías desde Google Sheets
              </div>
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:600, marginBottom:6 }}>Fecha de validación</label>
              <input type="date" value={date}
                max={new Date().toISOString().split("T")[0]}
                onChange={function(e){setDate(e.target.value);}}
                style={{ width:"100%", padding:"12px 14px", borderRadius:10,
                  border:"1px solid #e2e8f0", fontSize:16, boxSizing:"border-box",
                  background:"#ffffff", color:"#1e293b" }} />
            </div>
            <div style={{ padding:14, background:"#ffffff", borderRadius:10,
              border:"1px solid #e2e8f0", marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:600, color:"#64748b", marginBottom:8,
                textTransform:"uppercase", letterSpacing:"0.06em" }}>Fuentes conectadas</div>
              <div style={{ fontSize:12, display:"flex", gap:7, alignItems:"flex-start", marginBottom:6 }}>
                <span style={{ color:"#22c55e", flexShrink:0 }}>●</span>
                <span><strong>Histórico:</strong> Guías por Comando (col AF) · Guías por Web Service (col W)</span>
              </div>
              <div style={{ fontSize:12, display:"flex", gap:7, alignItems:"flex-start" }}>
                <span style={{ color:"#22c55e", flexShrink:0 }}>●</span>
                <span><strong>Estandarizado:</strong> Orígenes, Destinos, Contenidos, Usuarios</span>
              </div>
            </div>
            <button onClick={runValidation} disabled={loading||!date}
              style={{ width:"100%", padding:"14px", color:"white", border:"none", borderRadius:10,
                fontSize:15, fontWeight:500,
                background:loading||!date?"#94a3b8":"#3b82f6",
                cursor:loading||!date?"not-allowed":"pointer" }}>
              {loading
                ? "⏳ " + (loadMsg || "Cargando…")
                : "▶ Validar guías del " + (date ? fmtDate(date) : "—")}
            </button>
            <div style={{ marginTop:20 }}>
              <button onClick={function(){setShowCfg(!showCfg);}} style={Object.assign({},btnSec,{fontSize:11,width:"100%"})}>
                {showCfg?"▲ Ocultar":"▼ Configurar"} IDs de Google Sheets
              </button>
              {showCfg && (
                <div style={{ marginTop:10, padding:14, background:"#ffffff", borderRadius:10, border:"1px solid #e2e8f0" }}>
                  <div style={{ marginBottom:10 }}>
                    <label style={{ fontSize:12, fontWeight:500, display:"block", marginBottom:4 }}>ID Histórico Guías</label>
                    <input value={histId} onChange={function(e){setHistId(e.target.value);}}
                      style={Object.assign({},selSt,{width:"100%",boxSizing:"border-box",fontFamily:"monospace",fontSize:11})} />
                  </div>
                  <div style={{ marginBottom:10 }}>
                    <label style={{ fontSize:12, fontWeight:500, display:"block", marginBottom:4 }}>ID Estandarizado</label>
                    <input value={estId} onChange={function(e){setEstId(e.target.value);}}
                      style={Object.assign({},selSt,{width:"100%",boxSizing:"border-box",fontFamily:"monospace",fontSize:11})} />
                  </div>
                  <button onClick={function(){
                    LS.set("histId", histId);
                    LS.set("estId",  estId);
                    notify("IDs guardados"); setShowCfg(false);
                  }} style={{ padding:"8px 16px",background:"#3b82f6",color:"white",border:"none",borderRadius:7,fontSize:12,cursor:"pointer" }}>
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
          <div className="vge-fade" style={{ paddingBottom:40 }}>
            <h1 style={{ fontSize: 20, marginBottom: 30, color:T.textPrimary }}>Control Tower</h1>

            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 30 }}>
              {[
                { l: "Total", v: stT, c: T.accentBlue },
                { l: "Válidas", v: stV, c: T.chartGreen },
                { l: "Sospechosas", v: stS, c: T.chartAmber },
                { l: "Anomalías", v: stA, c: T.chartRed },
                { l: "Autorizadas", v: stAu, c: T.purple },
                { l: "Rechazadas", v: results.filter(r => r.status==="rechazada").length, c: "#ef4444" },
              ].map((card, i) => (
                <div key={i} style={{ background: T.bgSurface, padding: 16, borderRadius: T.r12, border: "1px solid "+T.borderFaint }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: card.c, lineHeight: 1 }}>{card.v}</div>
                  <div style={{ fontSize: 11, color: T.textSec, marginTop: 6 }}>{card.l}</div>
                </div>
              ))}
            </div>

            {/* Donut + Por Fuente */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 30 }}>
              <div style={{ background: T.bgSurface, padding: 20, borderRadius: T.r12, border: "1px solid "+T.borderFaint }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: T.textPrimary }}>Distribución de Estatus</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pieData.concat([{n:"Rechazadas",v:results.filter(r=>r.status==="rechazada").length,f:"#ef4444"}])} cx="50%" cy="50%" innerRadius={48} outerRadius={70} dataKey="v" nameKey="n" strokeWidth={0}>
                      {pieData.concat([{n:"Rechazadas",v:results.filter(r=>r.status==="rechazada").length,f:"#ef4444"}]).map((e, i) => <Cell key={i} fill={e.f} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: T.bgPanel, border: "1px solid "+T.borderFaint, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 16 }}>
                  {pieData.concat([{n:"Rechazadas",v:results.filter(r=>r.status==="rechazada").length,f:"#ef4444"}]).map(e => (
                    <div key={e.n} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: e.f }} />
                      <span style={{ color: T.textSec }}>{e.n}</span>
                      <span style={{ fontWeight: 700, color: T.textPrimary }}>{e.v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: T.bgSurface, padding: 20, borderRadius: T.r12, border: "1px solid "+T.borderFaint }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: T.textPrimary }}>Por Fuente</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={[{name:"Cmd",Válidas:results.filter(r=>r.source==="Comando"&&r.status==="valida").length,Sospechosas:results.filter(r=>r.source==="Comando"&&r.status==="sospechosa").length,Anomalías:results.filter(r=>r.source==="Comando"&&r.status==="anomalia").length,Rechazadas:results.filter(r=>r.source==="Comando"&&r.status==="rechazada").length}]} barGap={8}>
                    <XAxis dataKey="name" tick={{fontSize:10,fill:T.textMuted}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize:9,fill:T.textMuted}} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: T.bgPanel, border: "1px solid "+T.borderFaint, borderRadius: 8 }} />
                    <Bar dataKey="Válidas" fill={T.chartGreen} radius={[5,5,0,0]} />
                    <Bar dataKey="Sospechosas" fill={T.chartAmber} radius={[5,5,0,0]} />
                    <Bar dataKey="Anomalías" fill={T.chartRed} radius={[5,5,0,0]} />
                    <Bar dataKey="Rechazadas" fill="#ef4444" radius={[5,5,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tabla Resumen por Día */}
            <div style={{ background: T.bgSurface, padding: 20, borderRadius: T.r12, border: "1px solid "+T.borderFaint, marginBottom: 30 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: T.textPrimary }}>Resumen por Día (con Rechazadas)</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: T.bgPanel, borderBottom: "1px solid "+T.borderFaint }}>
                      {["FECHA","TOTAL","VÁLIDAS","SOSPECHOSAS","ANOMALÍAS","AUTORIZADAS","RECHAZADAS","% OK"].map(h=><th key={h} style={{padding:"10px 12px",textAlign:"left",fontWeight:700,fontSize:10,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {(function(){var byDay={};results.forEach(r=>{var d=parseFechaDay(r.fecha)||"—";if(!byDay[d])byDay[d]={total:0,validas:0,sospechosas:0,anomalias:0,autorizadas:0,rechazadas:0};byDay[d].total++;if(r.status==="valida")byDay[d].validas++;if(r.status==="sospechosa")byDay[d].sospechosas++;if(r.status==="anomalia")byDay[d].anomalias++;if(r.status==="autorizada")byDay[d].autorizadas++;if(r.status==="rechazada")byDay[d].rechazadas++;});return Object.keys(byDay).sort().reverse().map((d,i)=>{var row=byDay[d],okPercent=row.total>0?Math.round((row.validas+row.autorizadas)/row.total*100):0,okColor=okPercent>=90?T.chartGreen:okPercent>=70?T.chartAmber:T.chartRed;return <tr key={d} style={{borderBottom:"1px solid "+T.borderFaint+"66",background:i%2===0?"transparent":T.bgPanel}}><td style={{padding:"10px 12px",fontFamily:"monospace",fontSize:11,fontWeight:600,color:T.textPrimary}}>{d}</td><td style={{padding:"10px 12px",fontWeight:700}}>{row.total}</td><td style={{padding:"10px 12px",color:T.chartGreen,fontWeight:700}}>{row.validas}</td><td style={{padding:"10px 12px",color:T.chartAmber,fontWeight:700}}>{row.sospechosas}</td><td style={{padding:"10px 12px",color:T.chartRed,fontWeight:700}}>{row.anomalias}</td><td style={{padding:"10px 12px",color:T.purple,fontWeight:700}}>{row.autorizadas}</td><td style={{padding:"10px 12px",color:"#ef4444",fontWeight:700}}>{row.rechazadas}</td><td style={{padding:"10px 12px",color:okColor,fontWeight:700}}>{okPercent}%</td></tr>;});})()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}


        {tab==="resultados"&&(
          <div>
            <div style={{ display:"flex",gap:9,marginBottom:12,flexWrap:"wrap",alignItems:"center" }}>
              <h2 style={{ fontSize:16,fontWeight:500,marginRight:4 }}>Resultados</h2>
              <select value={flt.s} style={selSt} onChange={function(e){setFlt(function(p){return Object.assign({},p,{s:e.target.value});});}}>
                <option value="todos">Todos</option><option value="valida">Válidas</option><option value="sospechosa">Sospechosas</option><option value="anomalia">Anomalías</option><option value="autorizada">Autorizadas</option>
              </select>
              <select value={flt.src} style={selSt} onChange={function(e){setFlt(function(p){return Object.assign({},p,{src:e.target.value});});}}>
                <option value="todos">Todas las fuentes</option><option value="Comando">Comando</option><option value="Web Service">Web Service</option>
              </select>
              <input placeholder="Buscar…" value={flt.q} style={Object.assign({},selSt,{minWidth:160})} onChange={function(e){setFlt(function(p){return Object.assign({},p,{q:e.target.value});});}} />
              <span style={{ marginLeft:"auto",fontSize:11,color:"#64748b" }}>{fltd.length}/{results.length}</span>
              <button onClick={function(){expCsv(fltd,"guias_"+flt.s+".csv");}} style={btnSec}>↓ Exportar</button>
            </div>
            {fltd.length===0?<Empty msg="Sin resultados"/>:(
              <div style={{ borderRadius:11,border:"1px solid #e2e8f0",overflowX:"auto" }}>
                <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
                  <thead><tr style={{ background:"#f8fafc",borderBottom:"1px solid #e2e8f0" }}>
                    {["Guía","Referencia","Razón Social","Fuente","Estatus","Confirmación","Tipo Origen","Tipo Destino","Criticidad","Problemas",""].map(function(h,i){return <th key={i} style={{ padding:"8px 9px",textAlign:"left",fontWeight:500,color:"#64748b",fontSize:10,whiteSpace:"nowrap" }}>{h}</th>;})}
                  </tr></thead>
                  <tbody>
                    {fltd.slice(0,300).map(function(r,i){
                      var srcC=r.source==="Comando"?"#1d4ed8":"#5b21b6",srcBg=r.source==="Comando"?"#eff6ff":"#f5f3ff";
                      var rowBg=i%2===0?"transparent":"#f8fafc";
                      return (
                        <tr key={r.id} style={{ borderBottom:"1px solid #e2e8f0",background:rowBg }}>
                          <td style={{ padding:"6px 9px",fontFamily:"monospace",fontSize:10,fontWeight:500,whiteSpace:"nowrap" }}>{r.guia}</td>
                          <td style={{ padding:"6px 9px",fontSize:10,color:"#64748b",maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }} title={r.referencia}>{r.referencia||"—"}</td>
                          <td style={{ padding:"6px 9px",fontSize:10,color:"#64748b",maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }} title={r.razonSocial}>{r.razonSocial||"—"}</td>
                          <td style={{ padding:"6px 9px" }}><span style={{ padding:"2px 5px",borderRadius:3,fontSize:9,background:srcBg,color:srcC }}>{r.source}</span></td>
                          <td style={{ padding:"6px 9px" }}><SBadge s={r.status}/></td>
                          <td style={{ padding:"6px 9px" }}><span style={{ fontSize:10,fontWeight:500,color:r.confirmacion==="OK"?"#15803d":"#b91c1c" }}>{r.confirmacion==="OK"?"✓ OK":"✕ Revisar"}</span></td>
                          <td style={{ padding:"6px 9px",fontSize:10,color:"#64748b",whiteSpace:"nowrap" }}>{r.tipoOrigen||"—"}</td>
                          <td style={{ padding:"6px 9px",fontSize:10,color:"#64748b",whiteSpace:"nowrap" }}>{r.tipoDestino||"—"}</td>
                          <td style={{ padding:"6px 9px" }}><CBadge v={r.criticidad}/></td>
                          <td style={{ padding:"6px 9px",maxWidth:180 }}>
                            {r.issues&&r.issues.length>0?<ul style={{ margin:0,padding:"0 0 0 10px",color:"#b91c1c",fontSize:9 }}>{r.issues.map(function(m,j){return <li key={j}>{m}</li>;})}</ul>:<span style={{ color:"#15803d",fontSize:9 }}>Sin problemas</span>}
                          </td>
                          <td style={{ padding:"6px 9px" }}>
                            {(r.status==="sospechosa"||r.status==="anomalia")&&(
                              <button onClick={function(){setModal(r);setMForm({name:"",reason:""});setEstOpts({});}} style={{ padding:"3px 7px",background:"#3b82f6",color:"white",border:"none",borderRadius:4,fontSize:9,cursor:"pointer" }}>Autorizar</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {fltd.length>300&&<div style={{ padding:"8px 12px",fontSize:11,color:"#64748b",borderTop:"1px solid #e2e8f0" }}>Mostrando 300 de {fltd.length}. Exporta para ver todos.</div>}
              </div>
            )}
          </div>
        )}

        {/* ═══ AUTORIZACIONES ═══ */}
        {tab==="autorizaciones"&&(
          <div>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
              <h2 style={{ fontSize:16,fontWeight:500 }}>Historial de autorizaciones</h2>
              <div style={{ display:"flex",gap:9,alignItems:"center" }}>
                <span style={{ fontSize:11,color:"#64748b" }}>{auths.length} registros</span>
                {auths.length>0&&<button onClick={function(){expCsv(auths.map(function(a){return{"Guía":a.guia,"Fuente":a.source,"Estatus":a.original,"Tipo Origen":a.tipoOrigen,"Criticidad":a.criticidad,"Problemas":(a.issues||[]).join("; "),"Autorizado por":a.name,"Motivo":a.reason,"Fecha":a.fecha};}),"autorizaciones.csv");}} style={btnSec}>↓ Exportar</button>}
              </div>
            </div>
            {auths.length===0?<Empty msg="No hay autorizaciones registradas aún"/>:(
              <div style={{ borderRadius:11,border:"1px solid #e2e8f0",overflowX:"auto" }}>
                <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
                  <thead><tr style={{ background:"#f8fafc",borderBottom:"1px solid #e2e8f0" }}>
                    {["Guía","Fuente","Original","Criticidad","Problemas","Autorizado por","Motivo","Fecha"].map(function(h,i){return <th key={i} style={{ padding:"8px 9px",textAlign:"left",fontWeight:500,color:"#64748b",fontSize:10 }}>{h}</th>;})}
                  </tr></thead>
                  <tbody>
                    {auths.map(function(a,i){
                      var sc=SC[a.original]||SC.sospechosa;
                      return (
                        <tr key={i} style={{ borderBottom:"1px solid #e2e8f0" }}>
                          <td style={{ padding:"7px 9px",fontFamily:"monospace",fontSize:10,fontWeight:500 }}>{a.guia}</td>
                          <td style={{ padding:"7px 9px",fontSize:10 }}>{a.source}</td>
                          <td style={{ padding:"7px 9px" }}><span style={{ padding:"2px 5px",borderRadius:3,fontSize:9,background:sc.bg,color:sc.c }}>{sc.l}</span></td>
                          <td style={{ padding:"7px 9px" }}><CBadge v={a.criticidad}/></td>
                          <td style={{ padding:"7px 9px",fontSize:9,color:"#b91c1c",maxWidth:160 }}>{(a.issues||[]).join("; ")}</td>
                          <td style={{ padding:"7px 9px",fontWeight:500,fontSize:11 }}>{a.name}</td>
                          <td style={{ padding:"7px 9px",color:"#64748b",fontSize:10,maxWidth:160 }}>{a.reason}</td>
                          <td style={{ padding:"7px 9px",fontSize:9,color:"#94a3b8" }}>{a.fecha}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ marginTop:12,padding:12,background:"#f0fdf4",borderRadius:8,border:"1px solid #bbf7d0",fontSize:11,color:"#15803d" }}>
              💡 Las autorizaciones con "Agregar al estandarizado" actualizan automáticamente tu Google Sheet.
            </div>
          </div>
        )}

        {/* ═══ HISTÓRICO ═══ */}
        {tab==="historico"&&(
          <div>
            <h2 style={{ fontSize:16,fontWeight:500,marginBottom:4 }}>Histórico de validaciones</h2>
            <p style={{ fontSize:12,color:"#64748b",marginBottom:14 }}>Últimas {hist.length} ejecuciones guardadas localmente.</p>
            {hist.length===0?<Empty msg="Aún no hay validaciones"/>:(
              <div style={{ display:"grid",gap:8 }}>
                {hist.map(function(b,i){
                  return (
                    <div key={b.id} style={{ background:"#ffffff",borderRadius:10,padding:"11px 14px",border:"1px solid #e2e8f0",display:"flex",alignItems:"center",gap:13 }}>
                      <div style={{ width:28,height:28,background:"#eff6ff",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#1d4ed8",fontWeight:600,flexShrink:0 }}>{hist.length-i}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:500,fontSize:12 }}>{b.periodo}</div>
                        <div style={{ fontSize:10,color:"#64748b",marginTop:1 }}>{b.fecha} · Cmd:{b.cmd} WS:{b.ws}{b.discarded>0?" · "+b.discarded+" desc.":""}</div>
                      </div>
                      <div style={{ display:"flex",gap:12 }}>
                        {[{l:"Total",v:b.total,c:"#334155"},{l:"Válidas",v:b.validas,c:"#15803d"},{l:"Sosp.",v:b.sospechosas,c:"#b45309"},{l:"Anom.",v:b.anomalias,c:"#b91c1c"}].map(function(x){
                          return <div key={x.l} style={{ textAlign:"center" }}><div style={{ fontSize:17,fontWeight:600,color:x.c }}>{x.v}</div><div style={{ fontSize:9,color:x.c,opacity:0.7 }}>{x.l}</div></div>;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ ESTÁNDAR ═══ */}
        {tab==="estandar"&&(
          <div>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
              <div>
                <h2 style={{ fontSize:16,fontWeight:500,marginBottom:2 }}>Estandarizado</h2>
                <div style={{ fontSize:11,color:"#64748b" }}>Conectado a Google Sheet · Los cambios se guardan directamente en el Sheet</div>
              </div>
              <button onClick={refreshEst} disabled={loading} style={btnSec}>↻ Actualizar desde Sheets</button>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
              {[
                {label:"Orígenes",   set:estOrig,  sheet:"Orígenes",   setter:setEstOrig},
                {label:"Destinos",   set:estDest,  sheet:"Destinos",   setter:setEstDest},
                {label:"Contenidos", set:estCont,  sheet:"Contenidos", setter:setEstCont},
                {label:"Usuarios",   set:estUsers, sheet:"Usuarios",   setter:setEstUsers}
              ].map(function(cat) {
                return (
                  <div key={cat.label} style={{ background:"#ffffff",borderRadius:11,padding:15,border:"1px solid #e2e8f0" }}>
                    <div style={{ fontWeight:500,fontSize:12,marginBottom:4 }}>{cat.label}</div>
                    <div style={{ fontSize:11,color:"#64748b",marginBottom:10 }}>{cat.set.size} registros activos</div>
                    <div style={{ maxHeight:140,overflowY:"auto",display:"flex",flexWrap:"wrap",gap:4,marginBottom:10 }}>
                      {[...cat.set].sort().slice(0,60).map(function(v){return <span key={v} style={{ padding:"2px 6px",background:"#eff6ff",color:"#1d4ed8",borderRadius:4,fontSize:9 }}>{v}</span>;})}
                      {cat.set.size>60&&<span style={{ fontSize:9,color:"#94a3b8" }}>+{cat.set.size-60} más</span>}
                    </div>
                    <AddKw
                      placeholder={"Agregar a " + cat.label + "…"}
                      onAdd={async function(v) {
                        if (!v) return;
                        var vl = v.toLowerCase();
                        cat.setter(function(s){var n=new Set(s);n.add(vl);return n;});
                        try { await appendToEst(estId, cat.sheet, v); notify('"'+v+'" → '+cat.label); }
                        catch(e) { notify("Error al guardar en Sheet: "+e.message, false); }
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop:14,padding:12,background:"#f0fdf4",borderRadius:8,border:"1px solid #bbf7d0",fontSize:11,color:"#15803d" }}>
              💡 Al autorizar una guía con "Agregar al estandarizado" marcado, el valor se agrega aquí y en el Sheet automáticamente.
            </div>
          </div>
        )}

        {/* ═══ REGLAS ═══ */}
        {tab==="reglas"&&(
          <div>
            <h2 style={{ fontSize:16,fontWeight:500,marginBottom:3 }}>Reglas de clasificación</h2>
            <p style={{ fontSize:12,color:"#64748b",marginBottom:18 }}>
              Las reglas se evalúan en orden — la primera que coincida determina el resultado.
            </p>
            <RulesTable title="Tipo Origen (Guías Comando)" rules={orRules} onSave={saveOrRules} />
            <RulesTable
              title="Tipo Destino (Guías Comando)"
              subtitle="Regla de sistema siempre activa (no editable): Alias Origen contiene ALMACEN + Razón Social Destino contiene OXXO/CHEDRAUI/WALMART → Cadenas Comerciales."
              rules={dtRules} onSave={saveDtRules}
            />
            <div style={{ marginBottom:28 }}>
              <div style={{ fontWeight:500,fontSize:14,marginBottom:3 }}>Patrones Web Service</div>
              <p style={{ fontSize:12,color:"#64748b",marginBottom:14 }}>
                Col B (referencia) y D (número de cliente). Válida si cumple al menos uno.
              </p>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
                <div style={{ background:"#ffffff",borderRadius:11,padding:15,border:"1px solid #e2e8f0" }}>
                  <div style={{ fontWeight:500,fontSize:12,marginBottom:10 }}>TR Keywords (case-sensitive)</div>
                  <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:10 }}>
                    {wsConf.trKeywords.map(function(k,i){
                      return (
                        <span key={i} style={{ padding:"3px 8px",borderRadius:5,background:"#eff6ff",color:"#1d4ed8",fontSize:12,fontFamily:"monospace",display:"flex",alignItems:"center",gap:5 }}>
                          {k}
                          <button onClick={async function(){await saveWsConf(Object.assign({},wsConf,{trKeywords:wsConf.trKeywords.filter(function(_,j){return j!==i;})}));}} style={{ background:"none",border:"none",cursor:"pointer",color:"#b91c1c",fontSize:11,padding:0 }}>✕</button>
                        </span>
                      );
                    })}
                  </div>
                  <AddKw placeholder="ej. TR" onAdd={async function(v){if(!v||wsConf.trKeywords.includes(v))return;await saveWsConf(Object.assign({},wsConf,{trKeywords:wsConf.trKeywords.concat([v])}));}} />
                </div>
                <div style={{ background:"#ffffff",borderRadius:11,padding:15,border:"1px solid #e2e8f0" }}>
                  <div style={{ fontWeight:500,fontSize:12,marginBottom:10 }}>Cambio catálogo (case-insensitive)</div>
                  <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:10 }}>
                    {wsConf.camKeywords.map(function(k,i){
                      return (
                        <span key={i} style={{ padding:"3px 8px",borderRadius:5,background:"#fdf4ff",color:"#7e22ce",fontSize:12,display:"flex",alignItems:"center",gap:5 }}>
                          {k}
                          <button onClick={async function(){await saveWsConf(Object.assign({},wsConf,{camKeywords:wsConf.camKeywords.filter(function(_,j){return j!==i;})}));}} style={{ background:"none",border:"none",cursor:"pointer",color:"#b91c1c",fontSize:11,padding:0 }}>✕</button>
                        </span>
                      );
                    })}
                  </div>
                  <AddKw placeholder="ej. Cambio de catalogo" onAdd={async function(v){if(!v)return;await saveWsConf(Object.assign({},wsConf,{camKeywords:wsConf.camKeywords.concat([v])}));}} />
                </div>
                <div style={{ background:"#ffffff",borderRadius:11,padding:15,border:"1px solid #e2e8f0" }}>
                  <div style={{ fontWeight:500,fontSize:12,marginBottom:10 }}>Prefijos Ecommerce (col B + col D)</div>
                  <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11,marginBottom:10 }}>
                    <thead>
                      <tr style={{ borderBottom:"1px solid #e2e8f0" }}>
                        <th style={thSt}>Prefijo</th><th style={thSt}>Cuentas</th><th style={thSt}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {wsConf.ecPrefixes.map(function(ep,i){
                        return (
                          <tr key={i} style={{ borderBottom:"1px solid #e2e8f0" }}>
                            <td style={tdSt}><code style={{ fontWeight:600 }}>{ep.prefix}</code></td>
                            <td style={tdSt}>{ep.accounts}</td>
                            <td style={tdSt}>
                              <button onClick={async function(){await saveWsConf(Object.assign({},wsConf,{ecPrefixes:wsConf.ecPrefixes.filter(function(_,j){return j!==i;})}));}} style={{ padding:"2px 7px",background:"#fef2f2",color:"#b91c1c",border:"none",borderRadius:4,fontSize:10,cursor:"pointer" }}>Eliminar</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <AddEcPfx onAdd={async function(p,a){await saveWsConf(Object.assign({},wsConf,{ecPrefixes:wsConf.ecPrefixes.concat([{prefix:p,accounts:a}])}));}} />
                </div>
                <div style={{ background:"#ffffff",borderRadius:11,padding:15,border:"1px solid #e2e8f0" }}>
                  <div style={{ fontWeight:500,fontSize:12,marginBottom:10 }}>Cuentas Concentradora (col D + ref vacía)</div>
                  <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:10 }}>
                    {wsConf.concentradoraAccounts.map(function(a,i){
                      return (
                        <span key={i} style={{ padding:"3px 8px",borderRadius:5,background:"#f0fdf4",color:"#15803d",fontSize:12,fontFamily:"monospace",display:"flex",alignItems:"center",gap:5 }}>
                          {a}
                          <button onClick={async function(){await saveWsConf(Object.assign({},wsConf,{concentradoraAccounts:wsConf.concentradoraAccounts.filter(function(_,j){return j!==i;})}));}} style={{ background:"none",border:"none",cursor:"pointer",color:"#b91c1c",fontSize:11,padding:0 }}>✕</button>
                        </span>
                      );
                    })}
                  </div>
                  <AddKw placeholder="ej. 4003984" onAdd={async function(v){if(!v||wsConf.concentradoraAccounts.includes(v))return;await saveWsConf(Object.assign({},wsConf,{concentradoraAccounts:wsConf.concentradoraAccounts.concat([v])}));}} />
                </div>
              </div>
              <div style={{ marginTop:14,padding:12,background:"#eff6ff",borderRadius:8,border:"1px solid #bfdbfe",fontSize:11,color:"#1d4ed8" }}>
                💡 Los cambios en reglas y patrones aplican en la <strong>siguiente validación</strong>.
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Modal de autorización */}
      {modal && (
        <div style={{ position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100 }}>
          <div style={{ background:"#ffffff",borderRadius:13,padding:22,maxWidth:460,width:"92%",boxShadow:"0 12px 40px rgba(0,0,0,0.25)" }}>
            <div style={{ fontWeight:500,fontSize:15,marginBottom:4 }}>Autorizar guía</div>
            <div style={{ fontSize:12,color:"#64748b",marginBottom:12,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
              <code style={{ fontWeight:600 }}>{modal.guia}</code>
              <span>· {modal.source}</span>
              {modal.criticidad && modal.criticidad !== "OK" && <CBadge v={modal.criticidad} />}
            </div>
            {modal.issues && modal.issues.length > 0 && (
              <div style={{ padding:10,background:"#fef2f2",borderRadius:7,marginBottom:12,border:"1px solid #fca5a5" }}>
                <div style={{ fontSize:10,fontWeight:500,color:"#b91c1c",marginBottom:4 }}>Problemas detectados:</div>
                <ul style={{ margin:0,padding:"0 0 0 12px",fontSize:10,color:"#b91c1c" }}>
                  {modal.issues.map(function(m,i){ return <li key={i}>{m}</li>; })}
                </ul>
              </div>
            )}
            {modal.pendienteEst && modal.pendienteEst.length > 0 && (
              <div style={{ padding:10,background:"#f0fdf4",borderRadius:7,marginBottom:12,border:"1px solid #bbf7d0" }}>
                <div style={{ fontSize:10,fontWeight:600,color:"#15803d",marginBottom:7 }}>¿Agregar al estandarizado en Google Sheets?</div>
                {modal.pendienteEst.map(function(p) {
                  if (!p.value) return null;
                  return (
                    <label key={p.field} style={{ display:"flex",alignItems:"flex-start",gap:8,fontSize:11,marginBottom:5,cursor:"pointer" }}>
                      <input type="checkbox" checked={!!estOpts[p.field]}
                        onChange={function(e){ setEstOpts(function(o){ return Object.assign({},o,{[p.field]:e.target.checked}); }); }}
                        style={{ marginTop:2 }} />
                      <span>Agregar <strong>"{p.value}"</strong> → hoja <strong>{p.sheet}</strong></span>
                    </label>
                  );
                })}
              </div>
            )}
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:12,fontWeight:500,display:"block",marginBottom:3 }}>Autorizado por *</label>
              <input value={mForm.name} placeholder="Nombre completo"
                style={{ width:"100%",padding:"8px 10px",borderRadius:7,border:"1px solid #e2e8f0",fontSize:13,boxSizing:"border-box" }}
                onChange={function(e){ setMForm(function(f){ return Object.assign({},f,{name:e.target.value}); }); }} />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:12,fontWeight:500,display:"block",marginBottom:3 }}>Motivo *</label>
              <textarea value={mForm.reason} rows={3} placeholder="Justificación…"
                style={{ width:"100%",padding:"8px 10px",borderRadius:7,border:"1px solid #e2e8f0",fontSize:13,boxSizing:"border-box",resize:"vertical" }}
                onChange={function(e){ setMForm(function(f){ return Object.assign({},f,{reason:e.target.value}); }); }} />
            </div>
            <div style={{ display:"flex",gap:8,justifyContent:"flex-end" }}>
              <button style={btnSec}
                onClick={function(){ setModal(null); setMForm({name:"",reason:""}); setEstOpts({}); }}>
                Cancelar
              </button>
              <button onClick={authorize} disabled={loading||!mForm.name||!mForm.reason}
                style={{ padding:"8px 16px",color:"white",border:"none",borderRadius:7,fontSize:13,cursor:"pointer",background:loading||!mForm.name||!mForm.reason?"#94a3b8":"#3b82f6" }}>
                {loading ? "Guardando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
