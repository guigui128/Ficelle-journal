import { useState, useEffect, useMemo } from "react";

const CATEGORIES = [
  { id: "client", label: "Actions clients", color: "#2D6A4F", bg: "#D8F3DC" },
  { id: "ficelle", label: "Ficelle Conseil", color: "#1D3557", bg: "#A8DADC" },
  { id: "reflexion", label: "Réflexions perso", color: "#7B2D8B", bg: "#E9D8F4" },
];

const getCat = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];

const formatDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

const formatShort = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};

// ---- Storage helpers ----
const STORAGE_KEY = "ficelle-entries";
const SHARED = false;

async function loadEntries() {
  try {
    const res = await window.storage.get(STORAGE_KEY, SHARED);
    return res ? JSON.parse(res.value) : [];
  } catch {
    return [];
  }
}

async function saveEntries(entries) {
  try {
    await window.storage.set(STORAGE_KEY, JSON.stringify(entries), SHARED);
  } catch (e) {
    console.error("Storage error", e);
  }
}

// ---- Sub-components ----

function Badge({ catId }) {
  const cat = getCat(catId);
  return (
    <span style={{
      background: cat.bg,
      color: cat.color,
      fontSize: "0.7rem",
      fontWeight: 700,
      letterSpacing: "0.06em",
      padding: "2px 9px",
      borderRadius: "20px",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}>
      {cat.label}
    </span>
  );
}

function EntryCard({ entry, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div style={{
      borderLeft: `4px solid ${getCat(entry.category).color}`,
      background: "#fff",
      borderRadius: "0 10px 10px 0",
      padding: "14px 18px",
      marginBottom: "10px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      position: "relative",
      transition: "box-shadow 0.2s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Badge catId={entry.category} />
          {entry.client && (
            <span style={{ fontSize: "0.72rem", color: "#555", fontStyle: "italic" }}>
              — {entry.client}
            </span>
          )}
        </div>
        <span style={{ fontSize: "0.72rem", color: "#999", whiteSpace: "nowrap" }}>
          {formatDate(entry.date)}
        </span>
      </div>
      <p style={{ margin: "10px 0 6px", fontSize: "0.93rem", color: "#222", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
        {entry.text}
      </p>
      {entry.tags && entry.tags.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          {entry.tags.map(t => (
            <span key={t} style={{ fontSize: "0.7rem", background: "#F0F0F0", color: "#666", padding: "2px 8px", borderRadius: 12 }}>#{t}</span>
          ))}
        </div>
      )}
      <button
        onClick={() => confirm ? onDelete(entry.id) : setConfirm(true)}
        onBlur={() => setConfirm(false)}
        style={{
          position: "absolute", bottom: 10, right: 14,
          background: "none", border: "none", cursor: "pointer",
          fontSize: "0.72rem", color: confirm ? "#c0392b" : "#ccc",
          transition: "color 0.2s",
        }}
      >
        {confirm ? "Confirmer ?" : "✕"}
      </button>
    </div>
  );
}

function useSpeechRecognition(onResult) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useState(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSupported(true);
      const rec = new SpeechRecognition();
      rec.lang = "fr-FR";
      rec.continuous = false;
      rec.interimResults = false;
      rec.onresult = (e) => {
        const transcript = Array.from(e.results).map(r => r[0].transcript).join(" ");
        onResult(transcript);
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      recRef[0] = rec;
    }
  }, []);

  const toggle = () => {
    const rec = recRef[0];
    if (!rec) return;
    if (listening) { rec.stop(); setListening(false); }
    else { rec.start(); setListening(true); }
  };

  return { listening, supported, toggle };
}

function MicButton({ onTranscript, small }) {
  const { listening, supported, toggle } = useSpeechRecognition((t) => onTranscript(t));
  if (!supported) return null;

  return (
    <button
      onClick={toggle}
      title={listening ? "Arrêter l'écoute" : "Dicter (vocal)"}
      style={{
        width: small ? 38 : 48, height: small ? 38 : 48,
        borderRadius: "50%",
        border: `2px solid ${listening ? "#c0392b" : "#1D3557"}`,
        background: listening ? "#c0392b" : "#fff",
        color: listening ? "#fff" : "#1D3557",
        cursor: "pointer",
        fontSize: small ? "1.1rem" : "1.3rem",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        boxShadow: listening ? "0 0 0 4px rgba(192,57,43,0.2)" : "0 2px 8px rgba(0,0,0,0.1)",
        transition: "all 0.2s",
        animation: listening ? "pulse 1s infinite" : "none",
      }}
    >
      {listening ? "⏹" : "🎙️"}
    </button>
  );
}

function AddForm({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [category, setCategory] = useState("client");
  const [client, setClient] = useState("");
  const [tagInput, setTagInput] = useState("");

  const handleSubmit = () => {
    if (!text.trim()) return;
    const tags = tagInput.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
    onAdd({ text: text.trim(), category, client: client.trim(), tags, date: new Date().toISOString(), id: Date.now().toString() });
    setText(""); setClient(""); setTagInput(""); setOpen(false);
  };

  const appendTranscript = (t) => setText(prev => prev ? prev + " " + t : t);

  if (!open) return (
    <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
      <button onClick={() => setOpen(true)} style={{
        flex: 1, padding: "13px", background: "#1D3557", color: "#fff",
        border: "none", borderRadius: 10, fontSize: "0.95rem", cursor: "pointer",
        fontFamily: "inherit", fontWeight: 600, letterSpacing: "0.03em",
        boxShadow: "0 4px 14px rgba(29,53,87,0.25)",
      }}>
        + Nouvelle entrée
      </button>
      <MicButton onTranscript={(t) => { setText(t); setOpen(true); }} />
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(192,57,43,0.2); }
          50% { box-shadow: 0 0 0 8px rgba(192,57,43,0.1); }
        }
      `}</style>
      <div style={{
        background: "#fff", borderRadius: 12, padding: "20px", marginBottom: 20,
        boxShadow: "0 4px 20px rgba(0,0,0,0.1)", border: "2px solid #1D3557",
      }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setCategory(cat.id)} style={{
              padding: "5px 14px", borderRadius: 20, border: `2px solid ${cat.color}`,
              background: category === cat.id ? cat.color : "transparent",
              color: category === cat.id ? "#fff" : cat.color,
              fontWeight: 700, fontSize: "0.78rem", cursor: "pointer",
              fontFamily: "inherit", transition: "all 0.15s",
            }}>
              {cat.label}
            </button>
          ))}
        </div>
        {category === "client" && (
          <input
            placeholder="Nom du client / projet (optionnel)"
            value={client}
            onChange={e => setClient(e.target.value)}
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: "0.88rem", marginBottom: 10, fontFamily: "inherit", boxSizing: "border-box" }}
          />
        )}

        {/* Zone texte + micro côte à côte */}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <textarea
            placeholder="Décris tes actions, réflexions, avancées... ou dicte avec le micro 🎙️"
            value={text}
            onChange={e => setText(e.target.value)}
            rows={4}
            style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: "0.9rem", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
          />
          <MicButton onTranscript={appendTranscript} small />
        </div>

        <input
          placeholder="Tags séparés par virgule (ex: prospection, rdv, stratégie)"
          value={tagInput}
          onChange={e => setTagInput(e.target.value)}
          style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: "0.85rem", marginTop: 8, fontFamily: "inherit", boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={handleSubmit} style={{
            flex: 1, padding: "10px", background: "#2D6A4F", color: "#fff",
            border: "none", borderRadius: 8, fontSize: "0.92rem", fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            Enregistrer
          </button>
          <button onClick={() => setOpen(false)} style={{
            padding: "10px 18px", background: "#f5f5f5", color: "#666",
            border: "none", borderRadius: 8, fontSize: "0.88rem", cursor: "pointer", fontFamily: "inherit",
          }}>
            Annuler
          </button>
        </div>
      </div>
    </>
  );
}

function Dashboard({ entries }) {
  const byCat = CATEGORIES.map(cat => ({
    ...cat,
    count: entries.filter(e => e.category === cat.id).length,
  }));

  // Activité des 4 dernières semaines
  const weeks = [];
  const now = new Date();
  for (let i = 3; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (i + 1) * 7);
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() - i * 7);
    const label = `S-${i === 0 ? "Cette sem." : i}`;
    const count = entries.filter(e => {
      const d = new Date(e.date);
      return d >= weekStart && d < weekEnd;
    }).length;
    weeks.push({ label, count });
  }

  const maxWeek = Math.max(...weeks.map(w => w.count), 1);

  // Clients actifs
  const clients = {};
  entries.filter(e => e.category === "client" && e.client).forEach(e => {
    clients[e.client] = (clients[e.client] || 0) + 1;
  });
  const topClients = Object.entries(clients).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Tags fréquents
  const tags = {};
  entries.forEach(e => (e.tags || []).forEach(t => { tags[t] = (tags[t] || 0) + 1; }));
  const topTags = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
        {byCat.map(cat => (
          <div key={cat.id} style={{
            background: cat.bg, borderRadius: 12, padding: "14px 12px", textAlign: "center",
            border: `2px solid ${cat.color}20`,
          }}>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: cat.color, lineHeight: 1 }}>{cat.count}</div>
            <div style={{ fontSize: "0.72rem", color: cat.color, fontWeight: 600, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{cat.label}</div>
          </div>
        ))}
      </div>

      {/* Activité hebdo */}
      <div style={{ background: "#fff", borderRadius: 12, padding: "16px", marginBottom: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Activité hebdomadaire</div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 60 }}>
          {weeks.map(w => (
            <div key={w.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: "100%", background: "#1D3557",
                height: `${(w.count / maxWeek) * 48 + 4}px`,
                borderRadius: "4px 4px 0 0", minHeight: 4,
                opacity: w.count === 0 ? 0.15 : 1,
                transition: "height 0.4s",
              }} />
              <span style={{ fontSize: "0.65rem", color: "#aaa", whiteSpace: "nowrap" }}>{w.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Clients actifs */}
      {topClients.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 12, padding: "16px", marginBottom: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Clients actifs</div>
          {topClients.map(([name, count]) => (
            <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: "0.88rem", color: "#333" }}>{name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ height: 6, width: `${(count / topClients[0][1]) * 80}px`, background: "#2D6A4F", borderRadius: 3 }} />
                <span style={{ fontSize: "0.75rem", color: "#2D6A4F", fontWeight: 700 }}>{count}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tags */}
      {topTags.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 12, padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Sujets fréquents</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {topTags.map(([tag, count]) => (
              <span key={tag} style={{
                background: "#F0F4FF", color: "#1D3557", padding: "4px 12px",
                borderRadius: 20, fontSize: "0.8rem", fontWeight: 600,
              }}>
                #{tag} <span style={{ opacity: 0.6, fontWeight: 400 }}>×{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Drive Mode ----
function DriveMode({ onAdd }) {
  const [phase, setPhase] = useState("idle"); // idle | listening | preview | saved
  const [category, setCategory] = useState(null);
  const [transcript, setTranscript] = useState("");
  const recRef = useState(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const rec = new SR();
      rec.lang = "fr-FR";
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        const t = Array.from(e.results).map(r => r[0].transcript).join(" ");
        setTranscript(t);
      };
      rec.onend = () => {
        setPhase(prev => prev === "listening" ? "preview" : prev);
      };
      recRef[0] = rec;
    }
  }, []);

  const startListening = (cat) => {
    setTranscript("");
    setCategory(cat);
    recRef[0]?.start();
    setPhase("listening");
  };

  const stopListening = () => {
    recRef[0]?.stop();
    setPhase("preview");
  };

  const handleSave = async () => {
    if (!transcript.trim()) return;
    await onAdd({
      text: transcript.trim(),
      category: category || "client",
      client: "",
      tags: [],
      date: new Date().toISOString(),
      id: Date.now().toString(),
    });
    setPhase("saved");
    setTimeout(() => { setPhase("idle"); setCategory(null); setTranscript(""); }, 2500);
  };

  const reset = () => {
    recRef[0]?.stop();
    setPhase("idle"); setCategory(null); setTranscript("");
  };

  const catColor = category ? getCat(category).color : "#1D3557";

  return (
    <div style={{
      minHeight: "70vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: "20px 16px", gap: 24,
    }}>
      <style>{`
        @keyframes ripple { 0% { transform:scale(1);opacity:0.6; } 100% { transform:scale(2.2);opacity:0; } }
        @keyframes fadeIn { from { opacity:0;transform:translateY(10px); } to { opacity:1;transform:translateY(0); } }
      `}</style>

      {phase === "saved" && (
        <div style={{ textAlign:"center", animation:"fadeIn 0.3s ease" }}>
          <div style={{ fontSize:"4rem" }}>✅</div>
          <div style={{ fontSize:"1.3rem", fontWeight:700, color:"#2D6A4F", marginTop:12, fontFamily:"sans-serif" }}>Enregistré !</div>
        </div>
      )}

      {phase === "idle" && (
        <div style={{ width:"100%", maxWidth:360, animation:"fadeIn 0.3s ease" }}>
          <div style={{ textAlign:"center", marginBottom:28 }}>
            <div style={{ fontSize:"2.5rem" }}>🚗</div>
            <div style={{ fontSize:"1.1rem", fontWeight:700, color:"#1D3557", marginTop:8, fontFamily:"sans-serif" }}>Mode conduite</div>
            <div style={{ fontSize:"0.85rem", color:"#888", marginTop:4, fontFamily:"sans-serif" }}>Choisis la catégorie puis dicte</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => startListening(cat.id)} style={{
                padding:"22px 20px", borderRadius:16, border:`3px solid ${cat.color}`,
                background:cat.bg, color:cat.color,
                fontSize:"1.1rem", fontWeight:800, cursor:"pointer",
                fontFamily:"sans-serif", boxShadow:"0 4px 14px rgba(0,0,0,0.08)",
              }}>
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === "listening" && (
        <div style={{ textAlign:"center", animation:"fadeIn 0.3s ease" }}>
          <div style={{ position:"relative", width:180, height:180, margin:"0 auto" }}>
            {[1,2,3].map(i => (
              <div key={i} style={{
                position:"absolute", inset:0, borderRadius:"50%",
                border:`3px solid ${catColor}`,
                animation:`ripple 1.8s ease-out ${i*0.4}s infinite`,
              }} />
            ))}
            <button onClick={stopListening} style={{
              position:"absolute", inset:0, borderRadius:"50%",
              background:catColor, border:"none", cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:"3.5rem",
            }}>⏹</button>
          </div>
          <div style={{ marginTop:24, fontSize:"1rem", fontWeight:700, color:catColor, fontFamily:"sans-serif" }}>
            {getCat(category).label}
          </div>
          <div style={{ fontSize:"0.85rem", color:"#888", marginTop:6, fontFamily:"sans-serif" }}>
            Parle… appuie ⏹ pour terminer
          </div>
          {transcript && (
            <div style={{
              marginTop:16, padding:"12px 16px", background:"#fff", borderRadius:12,
              fontSize:"0.9rem", color:"#333", lineHeight:1.6, maxWidth:320,
              textAlign:"left", boxShadow:"0 2px 8px rgba(0,0,0,0.08)", fontStyle:"italic",
            }}>
              {transcript}
            </div>
          )}
          <button onClick={reset} style={{ marginTop:20, background:"none", border:"none", color:"#aaa", fontSize:"0.82rem", cursor:"pointer", fontFamily:"sans-serif" }}>
            Annuler
          </button>
        </div>
      )}

      {phase === "preview" && (
        <div style={{ width:"100%", maxWidth:360, animation:"fadeIn 0.3s ease" }}>
          <div style={{ textAlign:"center", marginBottom:16 }}><Badge catId={category} /></div>
          <div style={{
            background:"#fff", borderRadius:14, padding:"16px 18px",
            fontSize:"0.95rem", color:"#222", lineHeight:1.7,
            boxShadow:"0 4px 16px rgba(0,0,0,0.08)", marginBottom:20, minHeight:80,
          }}>
            {transcript || <span style={{ color:"#bbb" }}>Rien enregistré…</span>}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <button onClick={handleSave} style={{
              padding:"18px", background:"#2D6A4F", color:"#fff",
              border:"none", borderRadius:14, fontSize:"1.1rem", fontWeight:800,
              cursor:"pointer", fontFamily:"sans-serif",
              boxShadow:"0 4px 14px rgba(45,106,79,0.35)",
            }}>✅ Enregistrer</button>
            <button onClick={() => startListening(category)} style={{
              padding:"14px", background:"#fff", color:"#1D3557",
              border:"2px solid #1D3557", borderRadius:14, fontSize:"0.95rem", fontWeight:700,
              cursor:"pointer", fontFamily:"sans-serif",
            }}>🎙️ Recommencer</button>
            <button onClick={reset} style={{
              padding:"12px", background:"none", color:"#aaa",
              border:"none", fontSize:"0.85rem", cursor:"pointer", fontFamily:"sans-serif",
            }}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Main App ----
export default function App() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("journal"); // journal | dashboard | drive
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadEntries().then(data => { setEntries(data); setLoading(false); });
  }, []);

  const handleAdd = async (entry) => {
    const next = [entry, ...entries];
    setEntries(next);
    await saveEntries(next);
  };

  const handleDelete = async (id) => {
    const next = entries.filter(e => e.id !== id);
    setEntries(next);
    await saveEntries(next);
  };

  const filtered = useMemo(() => {
    return entries
      .filter(e => filterCat === "all" || e.category === filterCat)
      .filter(e => {
        if (!search) return true;
        const s = search.toLowerCase();
        return e.text.toLowerCase().includes(s)
          || (e.client || "").toLowerCase().includes(s)
          || (e.tags || []).some(t => t.includes(s));
      });
  }, [entries, filterCat, search]);

  // Group by date for journal
  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(e => {
      const day = e.date.slice(0, 10);
      if (!groups[day]) groups[day] = [];
      groups[day].push(e);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <div style={{
      fontFamily: "'Georgia', 'Palatino', serif",
      background: "#F4F1EC",
      minHeight: "100vh",
      paddingBottom: 40,
    }}>
      {/* Header */}
      <div style={{
        background: "#1D3557",
        padding: "22px 20px 18px",
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: "#A8DADC", fontSize: "0.72rem", letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: "sans-serif" }}>
                Guillaume · Ficelle Conseil
              </div>
              <h1 style={{ color: "#fff", margin: "2px 0 0", fontSize: "1.3rem", fontWeight: 700, letterSpacing: "-0.01em" }}>
                Journal professionnel
              </h1>
            </div>
            <div style={{ color: "#A8DADC", fontSize: "0.8rem", fontFamily: "sans-serif", textAlign: "right" }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#fff", lineHeight: 1 }}>{entries.length}</div>
              entrée{entries.length !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
            {[["journal", "📋 Journal"], ["dashboard", "📊 Stats"], ["drive", "🚗 Conduite"]].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                padding: "7px 12px", borderRadius: 20, border: "none",
                background: tab === id ? "#A8DADC" : "rgba(255,255,255,0.1)",
                color: tab === id ? "#1D3557" : "#A8DADC",
                fontWeight: 700, fontSize: "0.78rem", cursor: "pointer",
                fontFamily: "sans-serif", transition: "all 0.2s",
              }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px 0" }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "#aaa", padding: "40px 0", fontFamily: "sans-serif" }}>Chargement...</div>
        ) : tab === "dashboard" ? (
          <Dashboard entries={entries} />
        ) : tab === "drive" ? (
          <DriveMode onAdd={handleAdd} />
        ) : (
          <>
            <AddForm onAdd={handleAdd} />

            {/* Filtres */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              <button onClick={() => setFilterCat("all")} style={{
                padding: "5px 14px", borderRadius: 20,
                border: "2px solid #1D3557",
                background: filterCat === "all" ? "#1D3557" : "transparent",
                color: filterCat === "all" ? "#fff" : "#1D3557",
                fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", fontFamily: "sans-serif",
              }}>
                Tout
              </button>
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setFilterCat(cat.id)} style={{
                  padding: "5px 14px", borderRadius: 20,
                  border: `2px solid ${cat.color}`,
                  background: filterCat === cat.id ? cat.color : "transparent",
                  color: filterCat === cat.id ? "#fff" : cat.color,
                  fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", fontFamily: "sans-serif",
                }}>
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Recherche */}
            <input
              placeholder="🔍 Rechercher..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 8, border: "2px solid #ddd",
                fontSize: "0.9rem", fontFamily: "sans-serif", marginBottom: 16, boxSizing: "border-box",
                background: "#fff",
              }}
            />

            {/* Entrées groupées par date */}
            {grouped.length === 0 ? (
              <div style={{ textAlign: "center", color: "#aaa", padding: "40px 0", fontFamily: "sans-serif" }}>
                {entries.length === 0
                  ? "Aucune entrée pour l'instant. Ajoute ta première note !"
                  : "Aucun résultat pour ces filtres."}
              </div>
            ) : (
              grouped.map(([day, dayEntries]) => (
                <div key={day} style={{ marginBottom: 20 }}>
                  <div style={{
                    fontSize: "0.75rem", fontWeight: 700, color: "#888",
                    textTransform: "uppercase", letterSpacing: "0.1em",
                    marginBottom: 8, fontFamily: "sans-serif",
                    borderBottom: "1px solid #ddd", paddingBottom: 5,
                  }}>
                    {formatDate(day)}
                  </div>
                  {dayEntries.map(e => (
                    <EntryCard key={e.id} entry={e} onDelete={handleDelete} />
                  ))}
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
