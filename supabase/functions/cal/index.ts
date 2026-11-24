// SLOPE のカレンダー（iCalendar）。?t=合い言葉 で自分の予定一式、?e=イベントID でそのイベント1件
import { createClient } from 'jsr:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const esc = (s: unknown) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const d8 = (iso: string) => iso.replace(/-/g, '');
const next = (iso: string) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
function fold(line: string) { // 75バイトごとに折り返す（RFC 5545）
  const enc = new TextEncoder(); if (enc.encode(line).length <= 75) return line;
  const out: string[] = []; let cur = '';
  for (const ch of line) { if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ''; } cur += ch; }
  out.push(cur); return out.join('\r\n ');
}
type Ev = { uid: string; title: string; date: string; to?: string; time?: string; place?: string; memo?: string; link?: string };
function vevent(e: Ev) {
  const L = ['BEGIN:VEVENT', 'UID:' + e.uid + '@slope', 'DTSTAMP:' + stamp(), 'SUMMARY:' + esc(e.title)];
  const tm = /^(\d{1,2}):(\d{2})/.exec(e.time || '');
  if (tm && !(e.to && e.to !== e.date)) {
    const hh = tm[1].padStart(2, '0'), mm = tm[2], eh = String(Math.min(23, +hh + 1)).padStart(2, '0');
    L.push('DTSTART;TZID=Asia/Tokyo:' + d8(e.date) + 'T' + hh + mm + '00', 'DTEND;TZID=Asia/Tokyo:' + d8(e.date) + 'T' + eh + mm + '00');
  } else {
    L.push('DTSTART;VALUE=DATE:' + d8(e.date), 'DTEND;VALUE=DATE:' + d8(next(e.to && ISO.test(e.to) && e.to > e.date ? e.to : e.date)));
  }
  if (e.place) L.push('LOCATION:' + esc(e.place));
  const desc = [e.memo, e.link].filter(Boolean).join('\n'); if (desc) L.push('DESCRIPTION:' + esc(desc));
  if (e.link && /^https?:/.test(e.link)) L.push('URL:' + e.link);
  L.push('END:VEVENT'); return L.map(fold).join('\r\n');
}
const TZ = ['BEGIN:VTIMEZONE', 'TZID:Asia/Tokyo', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'TZNAME:JST', 'END:STANDARD', 'END:VTIMEZONE'].join('\r\n');
function cal(evs: Ev[], name: string) {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SLOPE//JA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', fold('X-WR-CALNAME:' + esc(name)), 'X-WR-TIMEZONE:Asia/Tokyo', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H', TZ]
    .concat(evs.map(vevent)).concat(['END:VCALENDAR']).join('\r\n') + '\r\n';
}
const HDR = { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' };

Deno.serve(async (req) => {
  const u = new URL(req.url), t = u.searchParams.get('t'), one = u.searchParams.get('e');
  // 公開しているイベント（告知で公開し、日付が入っているもの）
  const { data: items } = await sb.from('items').select('id,data,state').eq('kind', 'cal').eq('state', 'ok');
  const pub = (items || []).filter((x: any) => { const d = x.data || {}; return d.state === 'pub' && d.inNotice !== false && ISO.test(d.date || '') && d.title; })
    .map((x: any) => ({ uid: x.id, title: x.data.title, date: x.data.date, to: x.data.to, time: x.data.time, place: x.data.place, memo: x.data.memo, link: x.data.link } as Ev));
  if (one) {
    const e = pub.find((x) => x.uid === one); if (!e) return new Response('not found', { status: 404 });
    return new Response(cal([e], 'SLOPE'), { headers: { ...HDR, 'Content-Disposition': 'inline; filename="event.ics"' } });
  }
  if (!t) return new Response('not found', { status: 404 });
  const { data: tk } = await sb.from('cal_tokens').select('user_id').eq('token', t).maybeSingle();
  if (!tk) return new Response('not found', { status: 404 });
  const uid = tk.user_id as string, evs: Ev[] = pub.slice();
  // 担当している業務の期限（終わっていない、いちばん下の業務）
  const { data: nodes } = await sb.from('nodes').select('id,parent_id,title,who,team,end_date,done');
  const hasKids = new Set((nodes || []).map((n: any) => n.parent_id).filter(Boolean));
  (nodes || []).forEach((n: any) => {
    if (n.done || hasKids.has(n.id) || !ISO.test(n.end_date || '')) return;
    if (n.who !== uid && !(n.team || []).includes(uid)) return;
    evs.push({ uid: 'k-' + n.id, title: '期限：' + n.title, date: n.end_date });
  });
  return new Response(cal(evs, 'SLOPE'), { headers: HDR });
});
