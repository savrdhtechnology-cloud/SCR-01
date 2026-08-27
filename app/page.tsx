"use client";
import {useEffect,useState} from "react";

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
 useEffect(()=>{
   const saved=window.localStorage.getItem("savrdh-current-screen") as Screen|null;
   const valid:Screen[]=["welcome","signup","details","home","report","raise","raise-details","success","requests","issue"];
   if(saved&&valid.includes(saved))setScreen(saved);
   setReady(true);
 },[]);
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
   {leadOpen&&<div className="lead-overlay" role="dialog" aria-modal="true" aria-label="Start credit resolution">
    <form className="lead-sheet" onSubmit={async e=>{
      e.preventDefault();setSaving(true);setLeadError("");
      try{
        const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL||"https://qngjmepksxavimwnhtqt.supabase.co";
        const supabaseKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||"sb_publishable_rma90Xm4Hy4nT0CEXTlqHQ_6oKKWeds";
        const response=await fetch(`${supabaseUrl}/rest/v1/scr01_leads`,{
          method:"POST",
          headers:{"Content-Type":"application/json","apikey":supabaseKey,"Prefer":"return=minimal"},
          body:JSON.stringify({...lead,consent:true,source:new URLSearchParams(location.search).get("source")||"scr01_app",utm_source:new URLSearchParams(location.search).get("utm_source"),utm_campaign:new URLSearchParams(location.search).get("utm_campaign")})
        });
        if(!response.ok)throw new Error("Unable to save enquiry");
        localStorage.setItem("scr01-lead-mobile",lead.mobile);setLeadOpen(false);go("signup");
      }catch{setLeadError("Please check your details and try again.");}
      finally{setSaving(false);}
    }}>
      <button type="button" className="sheet-close" onClick={()=>setLeadOpen(false)}>×</button>
      <small>SAVRDH CREDIT RESOLUTION</small><h2>Start your credit journey</h2><p>Our credit expert will contact you regarding your report and resolution request.</p>
      <input required minLength={2} placeholder="Full name" value={lead.full_name} onChange={e=>setLead({...lead,full_name:e.target.value})}/>
      <input required pattern="[0-9+ -]{10,18}" placeholder="Mobile number" value={lead.mobile} onChange={e=>setLead({...lead,mobile:e.target.value})}/>
      <input type="email" placeholder="Email address (optional)" value={lead.email} onChange={e=>setLead({...lead,email:e.target.value})}/>
      <input placeholder="City (optional)" value={lead.city} onChange={e=>setLead({...lead,city:e.target.value})}/>
      <label><input required type="checkbox"/> I consent to be contacted by Savrdh Financial Services.</label>
      {leadError&&<b className="lead-error">{leadError}</b>}
      <button className="lead-submit" disabled={saving}>{saving?"Saving…":"Continue securely →"}</button>
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
