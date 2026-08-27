"use client";
import {useEffect,useState} from "react";

type WebSession={access_token:string;user:{id:string;email?:string;user_metadata?:{full_name?:string;mobile?:string}}};
function Portal({session,data,onSignOut}:{session:WebSession;data:PortalData|null;onSignOut:()=>void}){
 const profile=data?.profile;const report=data?.report;const requests=data?.requests||[];
 return <main className="portal-page"><header className="portal-header"><div><small>SAVRDH CREDIT RESOLUTION</small><h1>Customer Portal</h1></div><button className="portal-signout" onClick={onSignOut}>Sign out</button></header><section className="portal-content"><div className="portal-welcome"><div><span>Welcome back</span><h2>{String(profile?.full_name||session.user.user_metadata?.full_name||session.user.email||"Customer")}</h2><p>Website aur mobile app mein aapka data synced hai.</p></div><b className="sync-badge">● CRM Sync: Live</b></div><div className="portal-grid"><article className="portal-card score-card"><span>CIBIL SCORE</span><strong>{report?.score?String(report.score):"—"}</strong><p>{report?"Latest verified report":"Report CRM review ke baad yahan dikhegi"}</p></article><article className="portal-card"><span>ACTIVE REQUESTS</span><strong>{requests.filter(item=>!['resolved','rejected'].includes(String(item.status))).length}</strong><p>Resolution requests</p></article><article className="portal-card request-list"><h3>My Requests</h3>{requests.length?requests.map(item=><div className="portal-request" key={String(item.id)}><div><b>{String(item.issue_type||"Credit issue")}</b><small>{String(item.request_number||"")}</small></div><span>{String(item.status||"submitted").replaceAll("_"," ")}</span></div>):<p className="portal-muted">Abhi koi request nahi hai.</p>}</article></div></section></main>;
}

type PortalData={profile:Record<string,unknown>|null;report:Record<string,unknown>|null;requests:Array<Record<string,unknown>>};
type Screen="welcome"|"signup"|"details"|"home"|"report"|"raise"|"raise-details"|"success"|"requests"|"issue";
const ASSET_BASE="https://savrdh-credit-resolution.savrdhfinancialservi.chatgpt.site/mockups";
const src:Record<Screen,string>={
 welcome:`${ASSET_BASE}/welcome.png`,signup:`${ASSET_BASE}/signup.png`,details:`${ASSET_BASE}/details.png`,
 home:`${ASSET_BASE}/home.png`,report:`${ASSET_BASE}/report.png`,raise:`${ASSET_BASE}/raise.png`,
 "raise-details":`${ASSET_BASE}/raise-details.png`,success:`${ASSET_BASE}/success.png`,
 requests:`${ASSET_BASE}/requests.png`,issue:`${ASSET_BASE}/issue.png`
};
const ratio:Record<Screen,string>={welcome:"1024 / 1536",signup:"233 / 580",details:"248 / 580",home:"240 / 580",report:"284 / 580",raise:"235 / 433","raise-details":"238 / 433",success:"252 / 433",requests:"243 / 433",issue:"284 / 433"};

export default function App(){
 const [screen,setScreen]=useState<Screen>("welcome");
 const [ready,setReady]=useState(false);
 const [leadOpen,setLeadOpen]=useState(false);
 const [saving,setSaving]=useState(false);
 const [leadError,setLeadError]=useState("");
 const [lead,setLead]=useState({full_name:"",mobile:"",email:"",city:""});
 const [authMode,setAuthMode]=useState<"signup"|"login">("signup");
 const [session,setSession]=useState<WebSession|null>(null);
 const [portal,setPortal]=useState<PortalData|null>(null);
 useEffect(()=>{
   const saved=window.localStorage.getItem("savrdh-current-screen") as Screen|null;
   const valid:Screen[]=["welcome","signup","details","home","report","raise","raise-details","success","requests","issue"];
   if(saved&&valid.includes(saved))setScreen(saved);
   const stored=window.localStorage.getItem("savrdh-web-session");
   if(stored){try{setSession(JSON.parse(stored) as WebSession);}catch{window.localStorage.removeItem("savrdh-web-session");}}
   setReady(true);
 },[]);
 async function loadPortal(current:WebSession){
   const base=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
   if(!base||!key)return;
   const headers={apikey:key,Authorization:`Bearer ${current.access_token}`};
   const get=async(path:string)=>{const response=await fetch(`${base}/rest/v1/${path}`,{headers});return response.ok?response.json():null;};
   const [profile,report,requests]=await Promise.all([
     get(`scr01_profiles?user_id=eq.${current.user.id}&select=*&limit=1`),
     get(`scr01_credit_reports?user_id=eq.${current.user.id}&select=*&order=created_at.desc&limit=1`),
     get(`scr01_requests?user_id=eq.${current.user.id}&select=*&order=created_at.desc`)
   ]);
   setPortal({profile:profile?.[0]||null,report:report?.[0]||null,requests:requests||[]});
 }
 useEffect(()=>{if(session)loadPortal(session);},[session]);
 async function authenticate(event:React.FormEvent<HTMLFormElement>){
   event.preventDefault();setSaving(true);setLeadError("");
   try{
     const base=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
     if(!base||!key)throw new Error("Supabase environment variables are missing.");
     const password=(document.getElementById("auth-password") as HTMLInputElement).value;
     if(authMode==="signup"){
       const leadResponse=await fetch(`${base}/rest/v1/scr01_leads`,{method:"POST",headers:{"Content-Type":"application/json",apikey:key,Prefer:"return=minimal"},body:JSON.stringify({...lead,consent:true,source:"scr01_web"})});
       if(!leadResponse.ok)throw new Error("Unable to save enquiry");
     }
     const endpoint=authMode==="signup"?"signup":"token?grant_type=password";
     const body=authMode==="signup"?{email:lead.email,password,data:{full_name:lead.full_name,mobile:lead.mobile}}:{email:lead.email,password};
     const response=await fetch(`${base}/auth/v1/${endpoint}`,{method:"POST",headers:{"Content-Type":"application/json",apikey:key},body:JSON.stringify(body)});
     const result=await response.json();
    if(authMode==="signup"&&response.ok&&result.user&&!result.access_token){setAuthMode("login");setLeadError("Account created. Email verify karke sign in karein.");return;}
     if(!response.ok||!result.access_token)throw new Error(result.error_description||result.msg||"Unable to authenticate");
     const next={access_token:result.access_token,user:result.user};setSession(next);window.localStorage.setItem("savrdh-web-session",JSON.stringify(next));setLeadOpen(false);
   }catch(error){setLeadError(error instanceof Error?error.message:"Please try again.");}finally{setSaving(false);}
 }
 function signOut(){setSession(null);setPortal(null);window.localStorage.removeItem("savrdh-web-session");}
 const go=(next:Screen)=>{
   setScreen(next);
   window.localStorage.setItem("savrdh-current-screen",next);
   if(next==="success"){
     window.localStorage.setItem("savrdh-request-status","In Progress");
     window.localStorage.setItem("savrdh-request-id","SRVDH25050421");
   }
   window.scrollTo({top:0,behavior:"smooth"});
 };
 if(!ready)return <main className="prototype"><div className="loading-ring">S</div></main>;
 if(session)return <Portal session={session} data={portal} onSignOut={signOut}/>;
 return <main className={`prototype ${screen==="welcome"?"welcome-frame":""}`}>
   <div className="device" style={{aspectRatio:ratio[screen]}} key={screen}>
    <img className="mockup" src={src[screen]} alt={`Savrdh Credit Resolution — ${screen} screen`} draggable={false}/>
    {screen==="welcome"&&<><Hot label="Login or signup" box="welcome-login" onClick={()=>setLeadOpen(true)}/><Hot label="Explore as guest" box="welcome-guest" onClick={()=>go("home")}/></>}
    {screen==="signup"&&<><Hot label="Back" box="top-back" onClick={()=>go("welcome")}/><Hot label="Continue" box="signup-next" onClick={()=>go("details")}/></>}
    {screen==="details"&&<><Hot label="Back" box="top-back" onClick={()=>go("signup")}/><Hot label="Fetch my CIBIL report" box="details-next" onClick={()=>go("home")}/></>}
    {screen==="home"&&<><Hot label="Credit report" box="home-report-card" onClick={()=>go("report")}/><Hot label="Score issues" box="home-issues" onClick={()=>go("issue")}/><Bottom go={go}/></>}
    {screen==="report"&&<><Hot label="Back" box="top-back" onClick={()=>go("home")}/><Hot label="Credit factor issue" box="report-issue" onClick={()=>go("issue")}/><Bottom go={go}/></>}
    {screen==="raise"&&<><Hot label="Back" box="top-back" onClick={()=>go("home")}/><Hot label="Continue request" box="raise-next" onClick={()=>go("raise-details")}/></>}
    {screen==="raise-details"&&<><Hot label="Back" box="top-back" onClick={()=>go("raise")}/><Hot label="Submit request" box="raise-next" onClick={()=>go("success")}/></>}
    {screen==="success"&&<Hot label="View my requests" box="success-next" onClick={()=>go("requests")}/>}
    {screen==="requests"&&<><Hot label="Back" box="top-back" onClick={()=>go("home")}/><Hot label="New request" box="requests-new" onClick={()=>go("raise")}/><Hot label="Open request details" box="request-card" onClick={()=>go("issue")}/><Bottom go={go}/></>}
    {screen==="issue"&&<><Hot label="Back" box="top-back" onClick={()=>go("requests")}/><Hot label="Raise request" box="issue-next" onClick={()=>go("raise")}/><Bottom go={go}/></>}
   </div>
   {leadOpen&&<div className="lead-overlay" role="dialog" aria-modal="true" aria-label="Savrdh customer account">
    <form className="lead-sheet" onSubmit={authenticate}>
      <button type="button" className="sheet-close" onClick={()=>setLeadOpen(false)}>×</button>
      <small>SAVRDH CREDIT RESOLUTION</small><h2>{authMode==="signup"?"Create your customer account":"Welcome back"}</h2><p>Same secure account website aur mobile app dono mein use hoga.</p>
      {authMode==="signup"&&<><input required minLength={2} placeholder="Full name" value={lead.full_name} onChange={e=>setLead({...lead,full_name:e.target.value})}/><input required pattern="[0-9+ -]{10,18}" placeholder="Mobile number" value={lead.mobile} onChange={e=>setLead({...lead,mobile:e.target.value})}/></>}
      <input required type="email" placeholder="Email address" value={lead.email} onChange={e=>setLead({...lead,email:e.target.value})}/>
      <input required minLength={8} id="auth-password" type="password" placeholder="Password (minimum 8 characters)"/>
      {authMode==="signup"&&<label><input required type="checkbox"/> I consent to be contacted by Savrdh Financial Services.</label>}
      {leadError&&<b className="lead-error">{leadError}</b>}
      <button className="lead-submit" disabled={saving}>{saving?"Please wait…":authMode==="signup"?"Create account securely →":"Sign in securely →"}</button>
      <button type="button" className="auth-switch" onClick={()=>{setAuthMode(authMode==="signup"?"login":"signup");setLeadError("")}}>{authMode==="signup"?"Already have an account? Sign in":"New customer? Create an account"}</button>
      <footer>🔒 Bank-grade encrypted • Your data stays confidential</footer>
    </form>
   </div>}
   <a className="apk-download" href="/downloads">
     <span>Android App</span><strong>Download Android App ↓</strong>
   </a>
   <p className="hint">Tap the highlighted app controls to explore the complete flow.</p>
 </main>
}

function Hot({label,box,onClick}:{label:string,box:string,onClick:()=>void}){return <button className={`hot ${box}`} onClick={onClick} aria-label={label}/>}
function Bottom({go}:{go:(s:Screen)=>void}){return <div className="bottom-hots"><Hot label="Home" box="nav-home" onClick={()=>go("home")}/><Hot label="Report" box="nav-report" onClick={()=>go("report")}/><Hot label="Create request" box="nav-plus" onClick={()=>go("raise")}/><Hot label="My requests" box="nav-offers" onClick={()=>go("requests")}/><Hot label="Profile" box="nav-profile" onClick={()=>go("requests")}/></div>}
