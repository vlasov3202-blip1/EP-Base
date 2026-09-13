export function parseCsv(text=''){const rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'&&q&&n==='"'){cell+='"';i++;continue}if(c==='"'){q=!q;continue}if(c===','&&!q){row.push(cell);cell='';continue}if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&n==='\n')i++;row.push(cell);cell='';if(row.some(x=>x!==''))rows.push(row);row=[];continue}cell+=c}row.push(cell);if(row.some(x=>x!==''))rows.push(row);if(!rows.length)return[];const headers=rows[0].map(x=>String(x).trim());return rows.slice(1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])))}

export function parseXmlItems(text=''){const out=[];const blocks=[...String(text).matchAll(/<(item|offer|product)\b[^>]*>([\s\S]*?)<\/\1>/gi)];for(const b of blocks){const body=b[2],obj={};for(const m of body.matchAll(/<([a-zA-Z0-9_:-]+)\b[^>]*>([\s\S]*?)<\/\1>/g))obj[m[1]]=decodeXml(strip(m[2]));out.push(obj)}return out}

export function parseYmlFeed(text=''){return parseXmlItems(text)}

export function parseApiFeed(payload){if(Array.isArray(payload))return structuredClone(payload);if(Array.isArray(payload?.items))return structuredClone(payload.items);if(Array.isArray(payload?.offers))return structuredClone(payload.offers);return[]}

export async function parseXlsx(buffer){let XLSX;try{XLSX=await import('xlsx')}catch{throw Object.assign(new Error('XLSX parser dependency is not installed'),{code:'XLSX_PARSER_UNAVAILABLE'})}const wb=XLSX.read(buffer,{type:'buffer'});const ws=wb.Sheets[wb.SheetNames[0]];return XLSX.utils.sheet_to_json(ws,{defval:''})}

function strip(v){return String(v).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]+>/g,'').trim()}
function decodeXml(v){return String(v).replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&apos;',"'")}
