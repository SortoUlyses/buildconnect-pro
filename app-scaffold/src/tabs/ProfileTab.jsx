import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";
import { uploadContractorPhoto } from "../lib/storage.js";

export function ProfileTab({ profile, setProfile, auth }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);
  const [previewing, setPreviewing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef();
  const set = k => v => setDraft(d => ({ ...d, [k]: v }));

  const save_ = () => { setProfile(draft); setEditing(false); };

  const handlePhotoUpload = async e => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setUploadingPhoto(true);
    const { url, error } = await uploadContractorPhoto(file, auth.id, "profile");
    setUploadingPhoto(false);
    if (error) { console.error("Failed to upload profile photo:", error); alert("Couldn't upload that photo. Please try again."); return; }
    set("photo")(url);
  };

  const initials = (profile.name || "??").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  // — Client preview modal --
  const renderClientPreview = () => (
    <div onClick={()=>setPreviewing(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth:560, maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ background:"#0C447C", padding:"24px 24px 0", borderRadius:"14px 14px 0 0", position:"relative" }}>
          <div style={{ position:"absolute", top:-20, right:-20, width:140, height:140, borderRadius:"50%", background:"rgba(255,255,255,0.05)", pointerEvents:"none" }} />
          <div style={{ fontSize:11, fontWeight:700, color:"#B5D4F4", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Consumer view — this is what clients see</div>
          <div style={{ display:"flex", gap:16, alignItems:"flex-end" }}>
            <div style={{ width:64, height:64, borderRadius:12, background:"#F8F7F4", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:800, color:"#0C447C", border:"2px solid #fff", flexShrink:0, overflow:"hidden" }}>
              {profile.photo ? <img src={profile.photo} alt="Profile" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : initials}
            </div>
            <div style={{ flex:1, paddingBottom:20 }}>
              <div style={{ fontSize:18, fontWeight:800, color:"#fff" }}>{profile.name || "Your Name"}</div>
              <div style={{ fontSize:13, color:"#B5D4F4" }}>{profile.company || "Company Name"} · {profile.city || "City"}, {profile.state || "ST"}</div>
              <div style={{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap" }}>
                {(profile.trades||[]).map(t=><Badge key={t} text={t} color={TRADES[t]?.color||"#444"} bg={TRADES[t]?.bg||"#eee"} />)}
                {profile.licensed && <Badge text="Licensed" color="#0F6E56" bg="#E1F5EE" />}
                {profile.insured && <Badge text="Insured" color="#185FA5" bg="#E6F1FB" />}
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding:"20px 24px" }}>
          <div style={{ fontSize:13, color:"#2C2C2A", lineHeight:1.7, marginBottom:16 }}>{profile.bio || "No bio added yet."}</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
            {[["Phone", profile.phone], ["Email", profile.email], ["Website", profile.website], ["Years in Business", profile.years ? `${profile.years} years` : null]].map(([k,v]) => v ? (
              <div key={k}>
                <div style={{ fontSize:11, fontWeight:700, color:"#2C2C2A", textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:2 }}>{k}</div>
                <div style={{ fontSize:13, color:"#2C2C2A" }}>{v}</div>
              </div>
            ) : null)}
          </div>
          {profile.serviceArea && (
            <div style={{ background:"#F8F7F4", borderRadius:8, padding:"10px 14px", fontSize:13, color:"#2C2C2A" }}>
              <span style={{ fontWeight:700, color:"#2C2C2A" }}>Service Area: </span>{profile.serviceArea}
            </div>
          )}
          <div style={{ marginTop:16, textAlign:"right" }}>
            <Btn onClick={()=>setPreviewing(false)} variant="ghost" small>Close Preview</Btn>
          </div>
        </div>
      </div>
    </div>
  );

  // — View mode --
  if (!editing) return (
    <div>
      {previewing && renderClientPreview()}

      {/* Profile header */}
      <div style={{ background:"#fff", border:"1.5px solid #D3D1C7", borderRadius:14, padding:"24px 28px", marginBottom:16, display:"flex", gap:20, alignItems:"center" }}>
        <div style={{ width:88, height:88, borderRadius:16, background:"#E6F1FB", display:"flex", alignItems:"center", justifyContent:"center", fontSize:30, fontWeight:800, color:"#0C447C", flexShrink:0, overflow:"hidden", border:"3px solid #E8E6DF", position:"relative" }}>
          {profile.photo ? <img src={profile.photo} alt="Profile" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : initials}
          {!profile.photo && (
            <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"rgba(12,68,124,0.7)", fontSize:9, fontWeight:700, color:"#fff", textAlign:"center", padding:"3px 0", letterSpacing:"0.04em" }}>ADD PHOTO</div>
          )}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:20, fontWeight:800, color:"#2C2C2A", marginBottom:2 }}>{profile.name || "Your Name"}</div>
          <div style={{ fontSize:14, color:"#2C2C2A", marginBottom:8 }}>{profile.company || "Company Name"}{profile.city ? ` · ${profile.city}, ${profile.state}` : ""}</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {(profile.trades||[]).map(t=><Badge key={t} text={t} color={TRADES[t]?.color||"#444"} bg={TRADES[t]?.bg||"#eee"} />)}
            {profile.licensed && <Badge text="Licensed" color="#0F6E56" bg="#E1F5EE" />}
            {profile.insured && <Badge text="Insured" color="#185FA5" bg="#E6F1FB" />}
            {profile.backgroundCheck && <Badge text="Background Checked" color="#534AB7" bg="#EEEDFE" />}
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, flexShrink:0 }}>
          <Btn onClick={() => { setDraft(profile); setEditing(true); }} variant="primary" small>Edit Profile</Btn>
          <Btn onClick={() => setPreviewing(true)} variant="ghost" small>Preview as Client</Btn>
        </div>
      </div>

      {/* Detail cards */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
        <Card style={{ margin:0 }}>
          <SectionTitle>About</SectionTitle>
          <p style={{ fontSize:14, color:"#2C2C2A", lineHeight:1.75, margin:0 }}>{profile.bio || "No bio added yet."}</p>
        </Card>
        <Card style={{ margin:0 }}>
          <SectionTitle>Contact</SectionTitle>
          {[["Phone", profile.phone], ["Email", profile.email], ["Website", profile.website]].map(([k,v]) => (
            <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:8, gap:12 }}>
              <span style={{ color:"#2C2C2A", flexShrink:0 }}>{k}</span>
              <span style={{ color:"#2C2C2A", fontWeight:600, textAlign:"right", wordBreak:"break-all" }}>{v || "—"}</span>
            </div>
          ))}
        </Card>
        <Card style={{ margin:0 }}>
          <SectionTitle>Credentials</SectionTitle>
          {[["License Number", profile.licenseNum], ["Insurance", profile.insurance], ["Years in Business", profile.years ? `${profile.years} years` : null]].map(([k,v]) => (
            <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:8, gap:12 }}>
              <span style={{ color:"#2C2C2A", flexShrink:0 }}>{k}</span>
              <span style={{ color:"#2C2C2A", fontWeight:600, textAlign:"right" }}>{v || "—"}</span>
            </div>
          ))}
        </Card>
        <Card style={{ margin:0 }}>
          <SectionTitle>Service Area</SectionTitle>
          <p style={{ fontSize:14, color:"#2C2C2A", margin:0, lineHeight:1.7 }}>{profile.serviceArea || "No service area listed."}</p>
        </Card>
      </div>
    </div>
  );

  // — Edit mode --
  return (
    <div>
      {/* Section: Photo & Identity */}
      <Card>
        <SectionTitle>Photo & Identity</SectionTitle>

        {/* Photo upload — prominent, required */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12, padding:"20px", background:"#F8F7F4", borderRadius:12, border:`2px dashed ${draft.photo?"#0F6E56":"#D3D1C7"}`, marginBottom:20, cursor:"pointer" }}
          onClick={() => photoInputRef.current?.click()}>
          <div style={{ width:88, height:88, borderRadius:16, background:draft.photo?"#fff":"#E6F1FB", border:`3px solid ${draft.photo?"#0F6E56":"#D3D1C7"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, fontWeight:900, color:"#0C447C", overflow:"hidden", flexShrink:0, boxShadow:"0 4px 14px rgba(0,0,0,0.1)" }}>
            {draft.photo
              ? <img src={draft.photo} alt="Profile preview" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              : <span style={{ fontSize:36 }}>photo</span>
            }
          </div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:14, fontWeight:700, color:draft.photo?"#0F6E56":"#0C447C", marginBottom:3 }}>
              {uploadingPhoto ? "Uploading..." : draft.photo ? "✓ Photo uploaded" : "Upload Your Photo or Logo"}
            </div>
            <div style={{ fontSize:12, color:"#888780", lineHeight:1.5 }}>
              {draft.photo
                ? "Click to change · Your photo appears on your public profile and in search results"
                : "Required · A photo of yourself or your company logo · JPG, PNG or GIF · Recommended 400x400px or larger"}
            </div>
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display:"none" }} />
          <div style={{ display:"flex", gap:10 }}>
            <Btn onClick={e=>{ e.stopPropagation(); photoInputRef.current?.click(); }} variant={draft.photo?"ghost":"primary"} small disabled={uploadingPhoto}>
              {draft.photo ? "Change Photo" : "Choose File"}
            </Btn>
            {draft.photo && <Btn onClick={e=>{ e.stopPropagation(); set("photo")(""); }} variant="danger" small>Remove</Btn>}
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
          <Field label="Full Name" value={draft.name} onChange={set("name")} placeholder="John Smith" required />
          <Field label="Company Name" value={draft.company} onChange={set("company")} placeholder="Smith Construction LLC" required />
          <Field label="City" value={draft.city} onChange={set("city")} placeholder="San Diego" />
          <Field label="State" value={draft.state} onChange={set("state")} placeholder="CA" />
        </div>
        <div style={{ marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:5 }}>
            <label style={{ fontSize:12, fontWeight:700, color:"#444441", letterSpacing:"0.04em", textTransform:"uppercase" }}>Bio / About</label>
            <span style={{ fontSize:11, color:(draft.bio||"").length > 300 ? "#A32D2D" : "#888780" }}>{(draft.bio||"").length} / 300</span>
          </div>
          <textarea value={draft.bio||""} onChange={e=>set("bio")(e.target.value)} rows={4} placeholder="Tell homeowners about your experience, specialties, and approach to quality work..."
            style={{ width:"100%", boxSizing:"border-box", padding:"9px 12px", borderRadius:8, border:`1.5px solid ${(draft.bio||"").length > 300 ? "#A32D2D" : "#D3D1C7"}`, fontSize:14, fontFamily:"inherit", resize:"vertical", outline:"none", lineHeight:1.6 }} />
          {(draft.bio||"").length > 300 && <div style={{ fontSize:11, color:"#A32D2D", marginTop:4 }}>Keep your bio under 300 characters for best display on your public profile.</div>}
        </div>
      </Card>

      {/* Section: Contact */}
      <Card>
        <SectionTitle>Contact Information</SectionTitle>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
          <Field label="Phone" type="tel" value={draft.phone} onChange={set("phone")} placeholder="(555) 000-0000" />
          <Field label="Email" type="email" value={draft.email} onChange={set("email")} placeholder="john@smithconstruction.com" />
          <Field label="Website" value={draft.website} onChange={set("website")} placeholder="https://smithconstruction.com" />
        </div>
      </Card>

      {/* Section: Credentials */}
      <Card>
        <SectionTitle>Credentials</SectionTitle>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
          <Field label="License Number" value={draft.licenseNum} onChange={set("licenseNum")} placeholder="CA-123456" />
          <Field label="Years in Business" type="number" value={draft.years} onChange={set("years")} placeholder="10" />
          <Field label="Insurance Provider" value={draft.insurance} onChange={set("insurance")} placeholder="State Farm · $2M liability" style={{ gridColumn:"1 / -1" }} />
        </div>
        <div style={{ display:"flex", gap:8, marginTop:8 }}>
          {[["licensed", "Licensed"], ["insured", "Insured"], ["backgroundCheck", "Background Checked"]].map(([k, label]) => (
            <button key={k} type="button" onClick={() => set(k)(!draft[k])}
              style={{ padding:"8px 16px", borderRadius:8, border: draft[k] ? "2px solid #0F6E56" : "1.5px solid #D3D1C7", background: draft[k] ? "#E1F5EE" : "#fff", color: draft[k] ? "#0F6E56" : "#5F5E5A", fontSize:13, fontWeight:600, cursor:"pointer" }}>
              {draft[k] ? "✓ " : ""}{label}
            </button>
          ))}
        </div>
      </Card>

      {/* Section: Trade Specialties */}
      <Card>
        <SectionTitle>Trade Specialties</SectionTitle>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {Object.entries(TRADES).map(([k, t]) => {
            const sel = (draft.trades || []).includes(k);
            return (
              <button key={k} type="button" onClick={() => set("trades")(sel ? (draft.trades||[]).filter(x=>x!==k) : [...(draft.trades||[]), k])}
                style={{ padding:"6px 14px", borderRadius:20, border: sel ? `2px solid ${t.color}` : "1.5px solid #D3D1C7", background: sel ? t.bg : "#fff", color: sel ? t.color : "#5F5E5A", fontSize:13, fontWeight: sel ? 600 : 400, cursor:"pointer" }}>
                {k}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Section: Service Area */}
      <Card>
        <SectionTitle>Service Area</SectionTitle>
        <Field label="Coverage Area" value={draft.serviceArea} onChange={set("serviceArea")} placeholder="San Diego County, Riverside County — within 50 miles of 92101" />
      </Card>

      <div style={{ display:"flex", gap:10 }}>
        <Btn onClick={save_} variant="success">Save Profile</Btn>
        <Btn onClick={() => setEditing(false)} variant="ghost">Cancel</Btn>
      </div>
    </div>
  );
}

