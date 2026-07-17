import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { uploadContractorPhoto, deleteContractorPhoto } from "../lib/storage.js";
import { contractorPhotoFromDb } from "../lib/mappers.js";

// — Photo Gallery Tab ---------------------------------------------------------
export function PhotosTab({ photos, setPhotos, auth }) {
  const beforeFileRef = useRef();
  const afterFileRef = useRef();
  const [lightbox, setLightbox] = useState(null);
  const [addingCaption, setAddingCaption] = useState(null);

  const handleFiles = async (e, category) => {
    const files = Array.from(e.target.files);
    e.target.value = "";
    for (const file of files) {
      const { path, url, error: uploadErr } = await uploadContractorPhoto(file, auth.id, "portfolio");
      if (uploadErr) { console.error("Failed to upload photo:", uploadErr); continue; }
      const nextPosition = photos.filter(p => p.category === category).length;
      const { data, error } = await supabase.from("contractor_photos").insert({
        contractor_id: auth.id, url, storage_path: path, category, caption: "", position: nextPosition,
      }).select().single();
      if (error) { console.error("Failed to save photo record:", error); continue; }
      setPhotos(prev => [contractorPhotoFromDb(data), ...prev]);
    }
  };

  const deletePhoto = async id => {
    const photo = photos.find(p => p.id === id);
    if (photo?.storagePath) await deleteContractorPhoto(photo.storagePath);
    const { error } = await supabase.from("contractor_photos").delete().eq("id", id);
    if (error) { console.error("Failed to delete photo:", error); return; }
    setPhotos(prev => prev.filter(p => p.id !== id));
    if (lightbox?.id === id) setLightbox(null);
  };

  const updateCaption = async (id, caption) => {
    const { error } = await supabase.from("contractor_photos").update({ caption }).eq("id", id);
    if (error) { console.error("Failed to update caption:", error); return; }
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, caption } : p));
    setAddingCaption(null);
  };

  // Move a photo up or down within its category — swaps `position` with its neighbor.
  // Must operate on position-sorted order, not raw array order (new uploads are
  // prepended to `photos` but get the highest position, i.e. sorted last).
  const movePhoto = async (id, direction) => {
    const category = photos.find(p => p.id === id)?.category;
    const catPhotos = photos.filter(p => p.category === category).sort((a,b) => a.position - b.position);
    const idx = catPhotos.findIndex(p => p.id === id);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= catPhotos.length) return;
    const a = catPhotos[idx], b = catPhotos[newIdx];
    const [{ error: err1 }, { error: err2 }] = await Promise.all([
      supabase.from("contractor_photos").update({ position: b.position }).eq("id", a.id),
      supabase.from("contractor_photos").update({ position: a.position }).eq("id", b.id),
    ]);
    if (err1 || err2) { console.error("Failed to reorder photos:", err1 || err2); return; }
    setPhotos(prev => prev.map(p => p.id === a.id ? { ...p, position: b.position } : p.id === b.id ? { ...p, position: a.position } : p));
  };

  const beforePhotos = photos.filter(p => p.category === "Before").sort((a,b) => a.position - b.position);
  const afterPhotos = photos.filter(p => p.category === "After").sort((a,b) => a.position - b.position);

  const renderGrid = (list, emptyLabel) => list.length === 0 ? (
    <div style={{ textAlign: "center", padding: "30px 16px", border: "2px dashed #D3D1C7", borderRadius: 10, color: "#888780", fontSize: 13 }}>
      {emptyLabel}
    </div>
  ) : (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
      {list.map((photo, idx) => (
        <div key={photo.id} style={{ borderRadius: 10, overflow: "hidden", border: "1.5px solid #D3D1C7", background: "#fff", position: "relative" }}>
          <div style={{ position: "relative", paddingBottom: "75%", overflow: "hidden", cursor: "pointer" }} onClick={() => setLightbox(photo)}>
            <img src={photo.src} alt={photo.caption || "Project photo"} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            {/* Position indicators */}
            <div style={{ position: "absolute", top: 4, left: 4, display: "flex", flexDirection: "column", gap: 2 }}>
              {idx > 0 && (
                <button onClick={e => { e.stopPropagation(); movePhoto(photo.id, -1); }}
                  style={{ width: 22, height: 22, borderRadius: 4, border: "none", background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                  ^
                </button>
              )}
              {idx < list.length - 1 && (
                <button onClick={e => { e.stopPropagation(); movePhoto(photo.id, 1); }}
                  style={{ width: 22, height: 22, borderRadius: 4, border: "none", background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                  v
                </button>
              )}
            </div>
          </div>
          <div style={{ padding: "8px 10px" }}>
            <div style={{ fontSize: 11, color: "#888780", marginBottom: 4 }}>
              {timeAgo(photo.uploadedAt)}
            </div>
            {addingCaption === photo.id ? (
              <CaptionEditor photo={photo} onSave={updateCaption} onCancel={() => setAddingCaption(null)} />
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#5F5E5A", flex: 1 }}>{photo.caption || <span style={{ color: "#B4B2A9", fontStyle: "italic" }}>Add caption...</span>}</span>
                <button onClick={() => setAddingCaption(photo.id)} style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", color: "#888780", padding: "0 2px" }}></button>
                <button onClick={() => deletePhoto(photo.id)} style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", color: "#A32D2D", padding: "0 2px" }}></button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 13, color: "#888780", marginBottom: 16 }}>
        {photos.length} photo{photos.length!==1?"s":""} total · upload directly into the correct column below
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {/* Before column */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, paddingBottom: 8, borderBottom: "2px solid #FAEEDA" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#854F0B", textTransform: "uppercase", letterSpacing: "0.06em" }}> Before</span>
            <span style={{ fontSize: 11, background: "#FAEEDA", color: "#854F0B", borderRadius: 20, padding: "2px 9px", fontWeight: 700 }}>{beforePhotos.length}</span>
          </div>
          <input ref={beforeFileRef} type="file" accept="image/*" multiple onChange={e=>handleFiles(e,"Before")} style={{ display: "none" }} />
          <Btn onClick={() => beforeFileRef.current?.click()} variant="ghost" style={{ width: "100%", marginBottom: 10, borderColor:"#854F0B", color:"#854F0B" }}>photo Upload to Before</Btn>
          {renderGrid(beforePhotos, "No \"before\" photos yet.")}
        </div>

        {/* After column */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, paddingBottom: 8, borderBottom: "2px solid #E1F5EE" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#0F6E56", textTransform: "uppercase", letterSpacing: "0.06em" }}>* After</span>
            <span style={{ fontSize: 11, background: "#E1F5EE", color: "#0F6E56", borderRadius: 20, padding: "2px 9px", fontWeight: 700 }}>{afterPhotos.length}</span>
          </div>
          <input ref={afterFileRef} type="file" accept="image/*" multiple onChange={e=>handleFiles(e,"After")} style={{ display: "none" }} />
          <Btn onClick={() => afterFileRef.current?.click()} variant="ghost" style={{ width: "100%", marginBottom: 10, borderColor:"#0F6E56", color:"#0F6E56" }}>photo Upload to After</Btn>
          {renderGrid(afterPhotos, "No \"after\" photos yet.")}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 800, width: "100%", background: "#fff", borderRadius: 12, overflow: "hidden" }}>
            <img src={lightbox.src} alt={lightbox.caption} style={{ width: "100%", maxHeight: 560, objectFit: "contain", display: "block", background: "#111" }} />
            <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, color: "#5F5E5A" }}>{lightbox.caption || "No caption"}</span>
              <button onClick={() => setLightbox(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CaptionEditor({ photo, onSave, onCancel }) {
  const [val, setVal] = useState(photo.caption);
  return (
    <div onClick={e => e.stopPropagation()}>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") onSave(photo.id, val); if (e.key === "Escape") onCancel(); }}
        autoFocus
        placeholder="Add caption..."
        style={{ width: "100%", boxSizing: "border-box", fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1.5px solid #378ADD", outline: "none", fontFamily: "inherit", marginBottom: 6 }} />
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => onSave(photo.id, val)} style={{ flex: 1, background: "#0F6E56", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, padding: "5px 8px", cursor: "pointer" }}>✓ Save</button>
        <button onClick={onCancel} style={{ flex: 1, background: "#fff", border: "1.5px solid #D3D1C7", borderRadius: 6, fontSize: 12, fontWeight: 700, padding: "5px 8px", cursor: "pointer", color:"#2C2C2A" }}>x Cancel</button>
      </div>
    </div>
  );
}

