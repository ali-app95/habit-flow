const corsHeaders = {
  "Access-Control-Allow-Origin": "https://ali-app95.github.io",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};
let cachedAccessToken = null;
let cachedAccessTokenExpiry = 0;
function responseJson(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } });
}
function base64url(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function pemToArrayBuffer(pem) {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
  const binary = atob(base64), bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
async function googleAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessTokenExpiry > now + 60) return cachedAccessToken;
  const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const unsigned = `${base64url(JSON.stringify({alg:"RS256",typ:"JWT"}))}.${base64url(JSON.stringify({
    iss: sa.client_email, scope:"https://www.googleapis.com/auth/firebase.messaging",
    aud:"https://oauth2.googleapis.com/token", iat:now, exp:now+3600
  }))}`;
  const key = await crypto.subtle.importKey("pkcs8", pemToArrayBuffer(sa.private_key), {name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"}, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const form = new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:`${unsigned}.${base64url(new Uint8Array(signature))}`});
  const r = await fetch("https://oauth2.googleapis.com/token", {method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:form});
  const data = await r.json();
  if (!r.ok || !data.access_token) throw new Error("Google OAuth token error: " + JSON.stringify(data));
  cachedAccessToken = data.access_token; cachedAccessTokenExpiry = now + (data.expires_in || 3600);
  return cachedAccessToken;
}
async function stableUidFromToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function ensureSchema(env) {
  try { await env.DB.prepare("SELECT habits_json,last_sent_key FROM subscriptions LIMIT 1").first(); }
  catch {
    try { await env.DB.prepare("ALTER TABLE subscriptions ADD COLUMN habits_json TEXT NOT NULL DEFAULT '[]'").run(); } catch {}
    try { await env.DB.prepare("ALTER TABLE subscriptions ADD COLUMN last_sent_key TEXT").run(); } catch {}
  }
}
function isScheduled(h,dateString) {
  const d=new Date(dateString+"T12:00:00Z"),day=(d.getUTCDay()+6)%7,f=h.frequency||"daily";
  return f==="daily" || (f==="weekdays"&&day<5) || (f==="weekends"&&day>=5) || (f==="custom"&&(h.weekdays||[]).includes(day));
}
function validTimeZone(tz) {
  try { new Intl.DateTimeFormat("en-US", {timeZone:tz}).format(new Date()); return true; } catch { return false; }
}
async function subscribe(request, env) {
  let body;
  try { body = await request.json(); } catch { return responseJson({error:"Invalid JSON"},400); }
  const {token,enabled,time,timezone,habits=[]} = body || {};
  if (typeof token !== "string" || token.length < 20 || token.length > 8192) return responseJson({error:"Invalid FCM token"},400);
  if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return responseJson({error:"Invalid time"},400);
  if (typeof timezone !== "string" || !validTimeZone(timezone)) return responseJson({error:"Invalid timezone"},400);
  if (!Array.isArray(habits) || JSON.stringify(habits).length > 120000) return responseJson({error:"Invalid habits payload"},400);
  await ensureSchema(env);
  const uid = await stableUidFromToken(token);
  await env.DB.prepare(`INSERT INTO subscriptions (uid,token,enabled,time,timezone,last_sent_date,last_sent_key,habits_json,updated_at)
    VALUES (?,?,?,?,?,NULL,NULL,?,CURRENT_TIMESTAMP)
    ON CONFLICT(uid) DO UPDATE SET token=excluded.token,enabled=excluded.enabled,time=excluded.time,timezone=excluded.timezone,habits_json=excluded.habits_json,updated_at=CURRENT_TIMESTAMP`)
    .bind(uid,token,enabled?1:0,time,timezone,JSON.stringify(habits)).run();
  return responseJson({ok:true});
}
function localParts(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);
  const p = Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};
}
async function sendPush(env, accessToken, row, habit) {
  const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON), projectId = sa.project_id || env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("Missing Firebase project_id");
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,{
    method:"POST",headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"},
    body:JSON.stringify({message:{token:row.token,data:{title:"Habit Flow 🔥",body:`Пора: ${habit.name}`,url:"https://ali-app95.github.io/habit-flow/"},webpush:{headers:{Urgency:"high"},fcmOptions:{link:"https://ali-app95.github.io/habit-flow/"}}}})
  });
  const result = await r.json().catch(()=>({}));
  if (!r.ok) {
    const msg = JSON.stringify(result);
    if (r.status===404 || msg.includes("UNREGISTERED") || msg.includes("registration-token-not-registered")) {
      await env.DB.prepare("UPDATE subscriptions SET enabled=0,updated_at=CURRENT_TIMESTAMP WHERE uid=?").bind(row.uid).run();
    }
    throw new Error(`FCM send failed (${r.status}): ${msg}`);
  }
}
async function runScheduled(env) {
  const now = new Date();
  await ensureSchema(env);
  const {results=[]} = await env.DB.prepare("SELECT uid,token,timezone,last_sent_key,habits_json FROM subscriptions WHERE enabled=1").all();
  for (const row of results) {
    try {
      const local = localParts(now,row.timezone);
      let habits=[];try{habits=JSON.parse(row.habits_json||"[]")}catch{}
      const due=habits.filter(h=>h.reminder===local.time && isScheduled(h,local.date) && !(h.done&&h.done[local.date]));
      for(const habit of due){
        const sendKey=local.date+"|"+habit.id+"|"+habit.reminder;
        if(row.last_sent_key===sendKey) continue;
        const accessToken=await googleAccessToken(env);
        await sendPush(env,accessToken,row,habit);
        await env.DB.prepare("UPDATE subscriptions SET last_sent_date=?,last_sent_key=?,updated_at=CURRENT_TIMESTAMP WHERE uid=?").bind(local.date,sendKey,row.uid).run();
        row.last_sent_key=sendKey;
      }
    } catch (e) { console.error("Push failed for uid",row.uid,e && e.message ? e.message : e); }
  }
}
export default {
  async fetch(request,env) {
    if (request.method==="OPTIONS") return new Response(null,{status:204,headers:corsHeaders});
    const url = new URL(request.url);
    if (request.method==="GET" && url.pathname==="/") return responseJson({ok:true,service:"Habit Flow push worker"});
    if (request.method==="POST" && url.pathname==="/subscribe") {
      try { return await subscribe(request,env); } catch(e) { console.error(e); return responseJson({error:"Worker error"},500); }
    }
    return responseJson({error:"Not found"},404);
  },
  async scheduled(_event,env,ctx) { ctx.waitUntil(runScheduled(env)); }
};
