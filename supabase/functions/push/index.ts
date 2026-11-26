// プッシュ通知を送る。データベースから呼ばれる（合い言葉 x-push-key が要る）
//  POST {to_id, title, body, url?}   … その人の端末すべてに送る（url は押したときに開く画面）
//  POST {job: 'remind'}         … 明日の部内イベントに参加登録した人に前日のお知らせ
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
webpush.setVapidDetails('https://f-lab-ynu.github.io/SLOPE/', Deno.env.get('VAPID_PUBLIC')!, Deno.env.get('VAPID_PRIVATE')!);

async function sendTo(uid: string, title: string, body: string, url = './') {
  const { data: subs } = await sb.from('push_subs').select('id,endpoint,p256dh,auth').eq('user_id', uid);
  let sent = 0; const errs: string[] = [];
  for (const s of subs || []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title, body, url }), { TTL: 86400 });
      sent++;
    } catch (e: any) {
      errs.push(String((e && e.statusCode) || '') + ' ' + String((e && (e.body || e.message)) || e).slice(0, 200));
      if (e && (e.statusCode === 404 || e.statusCode === 410)) await sb.from('push_subs').delete().eq('id', s.id); // もう使われていない端末
    }
  }
  if (errs.length) console.error('push failed', errs);
  return sent;
}

Deno.serve(async (req) => {
  if (req.headers.get('x-push-key') !== Deno.env.get('PUSH_KEY')) return new Response('forbidden', { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (b.job === 'remind') {
    const t = new Date(Date.now() + 9 * 3600e3 + 86400e3).toISOString().slice(0, 10); // 日本時間の明日
    const { data: cals } = await sb.from('items').select('id,data').eq('kind', 'cal').eq('state', 'ok');
    let n = 0;
    for (const c of (cals || []).filter((x: any) => x.data && x.data.state === 'pub' && x.data.date === t)) {
      const { data: js } = await sb.from('reactions').select('user_id').eq('kind', 'join').eq('item_id', c.id);
      for (const j of js || []) n += await sendTo(j.user_id, '明日：' + c.data.title, [c.data.time, c.data.place].filter(Boolean).join(' · ') || '参加登録しているイベントです');
    }
    return Response.json({ sent: n });
  }
  if (!b.to_id) return new Response('bad request', { status: 400 });
  return Response.json({ sent: await sendTo(b.to_id, b.title || 'SLOPE', b.body || '', typeof b.url === 'string' && /^\.\/[\w.?=:&%-]*$/.test(b.url) ? b.url : './') }); // 押したときに開く画面（同じサイトの中だけ）
});
