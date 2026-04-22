import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ReactMarkdown from "react-markdown";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import "../styles/chatbot.css";

const CHART_PALETTE = ["#cc0000", "#2196f3", "#4caf50", "#ff9800", "#9c27b0", "#00bcd4", "#ff5722", "#795548"];

function fmtMXN(v) {
  return `$${Number(v).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function InlineChart({ chart }) {
  if (!chart) return null;
  const { type, title, data } = chart;

  if (type === "pie") {
    return (
      <div className="inline-chart">
        <p className="chart-title">{title}</p>
        <ResponsiveContainer width="100%" height={210}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={74} paddingAngle={2}>
              {data.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => fmtMXN(v)} />
            <Legend iconSize={9} wrapperStyle={{ fontSize: "10px" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === "bar") {
    const hasSecond = data.some(d => d.value2 !== undefined);
    return (
      <div className="inline-chart">
        <p className="chart-title">{title}</p>
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 28, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 9 }} width={42}
              tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`} />
            <Tooltip formatter={(v) => fmtMXN(v)} />
            {hasSecond && <Legend iconSize={9} wrapperStyle={{ fontSize: "10px" }} />}
            <Bar dataKey="value" name="Este mes" fill="#cc0000" radius={[3, 3, 0, 0]} />
            {hasSecond && <Bar dataKey="value2" name="Mes anterior" fill="#bbb" radius={[3, 3, 0, 0]} />}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
}

function ActionChips({ actions, tarjetas, onAportar, onNav }) {
  const [picking, setPicking] = useState(null);
  const [selectedTarjeta, setSelectedTarjeta] = useState("");
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    if (tarjetas.length > 0) setSelectedTarjeta(String(tarjetas[0].id));
  }, [tarjetas]);

  async function handleChip(action) {
    if (action.type === "nav") {
      onNav(action.path);
      return;
    }
    if (action.type === "aportar") {
      if (tarjetas.length === 1) {
        setExecuting(true);
        await onAportar(action, tarjetas[0].id);
        setExecuting(false);
      } else {
        setPicking(action);
      }
    }
  }

  async function confirmAportar() {
    if (!selectedTarjeta || !picking) return;
    setExecuting(true);
    await onAportar(picking, Number(selectedTarjeta));
    setExecuting(false);
    setPicking(null);
  }

  if (executing) return <div className="action-chips"><span className="action-executing">Procesando...</span></div>;

  if (picking) {
    return (
      <div className="action-chips tarjeta-picker">
        <span className="picker-label">¿Con qué tarjeta?</span>
        <select
          className="picker-select"
          value={selectedTarjeta}
          onChange={(e) => setSelectedTarjeta(e.target.value)}
        >
          {tarjetas.map((t) => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>
        <div className="picker-btns">
          <button className="picker-confirm" onClick={confirmAportar}>Confirmar</button>
          <button className="picker-cancel" onClick={() => setPicking(null)}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="action-chips">
      {actions.map((action, i) => (
        <button key={i} className="action-chip" onClick={() => handleChip(action)}>
          {action.type === "aportar" ? "💰 " : "→ "}{action.label}
        </button>
      ))}
    </div>
  );
}

const SCORE_COLORS = {
  green:  '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  red:    '#ef4444',
};

const COACH_CHIPS = [
  "¿En qué puedo ahorrar más?",
  "¿Cómo avanzo en mis metas?",
  "Dame un reto para esta semana",
  "¿Qué inversión me conviene?",
];

const ANALYST_CHIPS = [
  "¿Cómo comparo con el mes pasado?",
  "¿Qué presupuesto estoy excediendo?",
  "¿Cuáles son mis gastos recurrentes?",
  "¿Cuál es mi saldo actual?",
];

const buildMsgBienvenida = (nombre, mode) => ({
  role: "bot",
  text: mode === "analyst"
    ? `Hola, ${nombre.split(" ")[0]}. Soy tu Analista Financiero. Analizando tu situación actual...`
    : `¡Hola, ${nombre.split(" ")[0]}! 👋 Soy tu Coach Financiero. Estoy aquí para ayudarte a alcanzar tus metas y mejorar tus hábitos financieros. ¿Por dónde empezamos?`,
});

export default function Chatbot() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [nombreUsuario, setNombreUsuario] = useState(null);
  const [userTarjetas, setUserTarjetas] = useState([]);
  const [healthScore, setHealthScore] = useState(null);

  useEffect(() => {
    if (!session) return;
    fetch("/api/me", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.nombre) setNombreUsuario(`${data.nombre} ${data.apellido}`);
      })
      .catch(() => setNombreUsuario("Usuario"));
  }, [session]);

  const fetchHealthScore = useCallback(() => {
    if (!session) return;
    fetch("/api/health", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => { if (data.score !== undefined) setHealthScore(data); })
      .catch(() => {});
  }, [session]);

  useEffect(() => { fetchHealthScore(); }, [fetchHealthScore]);

  // Refresh score when chat closes (contributions or other actions may have changed data)
  useEffect(() => {
    if (!open) fetchHealthScore();
  }, [open, fetchHealthScore]);

  const [open, setOpen]               = useState(false);
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [fullscreen, setFullscreen]   = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [accepted, setAccepted]       = useState(() => localStorage.getItem("chat_disclaimer") === "true");
  const [mode, setMode]               = useState(() => localStorage.getItem("chat_mode") || "coach");
  const [extraMessages, setExtraMessages] = useState(() => { localStorage.removeItem("chat_messages"); return []; });
  const [history, setHistory]         = useState(() => { localStorage.removeItem("chat_history"); return []; });
  const [pos, setPos]                 = useState({ x: null, y: null });
  const [size, setSize]               = useState({ w: 370, h: 520 });
  const [dragging, setDragging]       = useState(false);
  const [resizing, setResizing]       = useState(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0, posX: 0, posY: 0 });
  const bottomRef = useRef(null);
  const windowRef = useRef(null);
  const analysisTriggered = useRef(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "es-MX";

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(transcript);
          // Optional: automatically send after a small delay
          // setTimeout(() => sendMessage(transcript), 500);
        }
      };
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Tu navegador no soporta reconocimiento de voz.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const messages = nombreUsuario
    ? [buildMsgBienvenida(nombreUsuario, mode), ...extraMessages]
    : extraMessages;

  const setMessages = (updater) => {
    setExtraMessages((prev) => {
      const current =
        typeof updater === "function"
          ? updater([buildMsgBienvenida(nombreUsuario || "Usuario", mode), ...prev])
          : updater;
      return current.slice(1);
    });
  };

  // Analyst auto-analysis: fires once when the chat opens with an empty history
  useEffect(() => {
    if (!open || mode !== "analyst" || !accepted || !session || extraMessages.length > 0) return;
    if (analysisTriggered.current) return;
    analysisTriggered.current = true;

    setLoading(true);
    fetch("/api/chatbot", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        message: "Proporciona un análisis financiero objetivo y breve de mi situación actual.",
        history: [],
        mode: "analyst",
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.reply) return;
        setHistory([
          { role: "user", parts: [{ text: "Proporciona un análisis financiero objetivo y breve de mi situación actual." }] },
          { role: "model", parts: [{ text: data.reply }] },
        ]);
        setExtraMessages([{ role: "bot", text: data.reply, chart: data.chart }]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, accepted, session]);

  useEffect(() => {
    localStorage.setItem("chat_messages", JSON.stringify(extraMessages));
  }, [extraMessages]);

  useEffect(() => {
    localStorage.setItem("chat_history", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleMouseDown = useCallback((e) => {
    if (fullscreen) return;
    if (e.target.closest(".chat-icon-btn")) return;
    const rect = windowRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDragging(true);
  }, [fullscreen]);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e) => {
      const x = Math.max(0, Math.min(window.innerWidth - 370, e.clientX - dragOffset.current.x));
      const y = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.current.y));
      setPos({ x, y });
    };
    const handleUp = () => setDragging(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging]);

  const handleResizeDown = useCallback((corner, e) => {
    if (fullscreen) return;
    e.stopPropagation();
    const rect = windowRef.current.getBoundingClientRect();
    resizeStart.current = { x: e.clientX, y: e.clientY, w: rect.width, h: rect.height, posX: rect.left, posY: rect.top };
    setResizing(corner);
  }, [fullscreen]);

  useEffect(() => {
    if (!resizing) return;
    const handleMove = (e) => {
      const s = resizeStart.current;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      let newW = s.w, newH = s.h, newX = s.posX, newY = s.posY;
      if (resizing === "br") { newW = s.w + dx; newH = s.h + dy; }
      else if (resizing === "bl") { newW = s.w - dx; newH = s.h + dy; newX = s.posX + dx; }
      else if (resizing === "tr") { newW = s.w + dx; newH = s.h - dy; newY = s.posY + dy; }
      else if (resizing === "tl") { newW = s.w - dx; newH = s.h - dy; newX = s.posX + dx; newY = s.posY + dy; }
      newW = Math.max(300, Math.min(window.innerWidth - 20, newW));
      newH = Math.max(350, Math.min(window.innerHeight - 20, newH));
      setSize({ w: newW, h: newH });
      setPos({ x: Math.max(0, newX), y: Math.max(0, newY) });
    };
    const handleUp = () => setResizing(null);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [resizing]);

  const handleAccept = () => {
    localStorage.setItem("chat_disclaimer", "true");
    setAccepted(true);
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    localStorage.setItem("chat_mode", newMode);
    setHistory([]);
    setExtraMessages([]);
    localStorage.removeItem("chat_history");
    setShowSettings(false);
    analysisTriggered.current = false;
  };

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: msg, history, mode }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error del servidor");

      const { reply, chart, actions = [], tarjetas = [] } = data;
      if (tarjetas.length > 0) setUserTarjetas(tarjetas);
      setHistory((prev) => [
        ...prev,
        { role: "user", parts: [{ text: msg }] },
        { role: "model", parts: [{ text: reply }] },
      ]);
      setMessages((prev) => [...prev, { role: "bot", text: reply, chart, actions }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "Error de conexión. Intenta de nuevo." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAportarAction = async (action, tarjetaId) => {
    // Clear actions from the last bot message so chips disappear
    setExtraMessages((prev) => {
      const updated = [...prev];
      const last = updated.length - 1;
      if (last >= 0) updated[last] = { ...updated[last], actions: [] };
      return updated;
    });

    try {
      const res = await fetch(`/api/metas/${action.id_meta}/aportar`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ monto: action.monto, id_tarjeta: tarjetaId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al aportar");
      const successText = `✅ Aporte de **$${Number(action.monto).toFixed(2)}** a **${action.nombre_meta}** realizado. Nuevo progreso: $${Number(data.nuevoProgreso).toFixed(2)}.`;
      setExtraMessages((prev) => [...prev, { role: "bot", text: successText }]);
    } catch (err) {
      setExtraMessages((prev) => [
        ...prev,
        { role: "bot", text: `Error al realizar el aporte: ${err.message}` },
      ]);
    }
  };

  return (
    <>
      {open && (
        <div
          ref={windowRef}
          className={`chat-window${fullscreen ? " fullscreen" : ""}${dragging || resizing ? " dragging" : ""}`}
          style={
            fullscreen
              ? {}
              : pos.x === null
              ? { bottom: 96, right: 28, width: size.w, height: size.h, maxHeight: size.h }
              : { left: pos.x, top: pos.y, bottom: "auto", right: "auto", width: size.w, height: size.h, maxHeight: size.h }
          }
        >
          {!fullscreen && (
            <>
              <div className="resize-handle-tl" onMouseDown={(e) => handleResizeDown("tl", e)} />
              <div className="resize-handle-tr" onMouseDown={(e) => handleResizeDown("tr", e)} />
              <div className="resize-handle-bl" onMouseDown={(e) => handleResizeDown("bl", e)} />
              <div className="resize-handle-br" onMouseDown={(e) => handleResizeDown("br", e)} />
            </>
          )}
          <div className="chat-header" onMouseDown={handleMouseDown}>
            <div>
              <h3>🤖 Fortia AI</h3>
              <p>
                Modo {mode === "coach" ? "Coach" : "Analista"} · En línea
                {healthScore !== null && (
                  <span
                    className="header-score"
                    style={{ color: SCORE_COLORS[healthScore.color] }}
                  >
                    {" "}· {healthScore.score}/100 {healthScore.grade}
                  </span>
                )}
              </p>
            </div>
            <div className="chat-header-actions">
              <button className="chat-icon-btn" onClick={() => setShowSettings((s) => !s)} title="Configuración">⚙</button>
              <button className="chat-icon-btn" onClick={() => setFullscreen((f) => !f)} title={fullscreen ? "Restaurar" : "Pantalla completa"}>
                {fullscreen ? "⊡" : "⛶"}
              </button>
              <button className="chat-icon-btn" onClick={() => { setOpen(false); setFullscreen(false); setShowSettings(false); setPos({ x: null, y: null }); setSize({ w: 370, h: 520 }); }}>✕</button>
            </div>
          </div>

          {showSettings && (
            <div className="settings-panel">
              <div className="settings-title">
                Modo del asistente
                <button className="settings-close" onClick={() => setShowSettings(false)}>✕</button>
              </div>
              <div className={`mode-option ${mode === "coach" ? "selected" : ""}`} onClick={() => handleModeChange("coach")}>
                <div className="mode-option-header">
                  <div className="mode-dot" />
                  <span className="mode-name">🎯 Coach Financiero</span>
                </div>
                <span className="mode-desc">Te propone metas, te da consejos para ahorrar, te sugiere inversiones y te motiva a mejorar tus hábitos financieros.</span>
              </div>
              <div className={`mode-option ${mode === "analyst" ? "selected" : ""}`} onClick={() => handleModeChange("analyst")}>
                <div className="mode-option-header">
                  <div className="mode-dot" />
                  <span className="mode-name">📊 Analista Financiero</span>
                </div>
                <span className="mode-desc">Solo te presenta tus datos de forma objetiva y precisa. No da opiniones ni consejos a menos que se los pidas directamente.</span>
              </div>
            </div>
          )}

          {!accepted && (
            <div className="disclaimer-overlay">
              <div className="disclaimer-card">
                <div className="disclaimer-icon">🔒</div>
                <div className="disclaimer-title">Uso de tus datos financieros</div>
                <div className="disclaimer-text">
                  Para ofrecerte una experiencia personalizada, Fortia AI utiliza información de tu cuenta.
                </div>
                <ul className="disclaimer-bullets">
                  <li>Tus datos se procesan en tiempo real y no se almacenan en servidores externos</li>
                  <li>La conversación es privada y no se comparte con terceros</li>
                  <li>Puedes eliminar el historial en cualquier momento</li>
                  <li>Fortia AI no realiza operaciones bancarias, solo informa y aconseja</li>
                </ul>
                <button className="disclaimer-accept" onClick={handleAccept}>Entendido, continuar</button>
                <span className="disclaimer-link">Consultar aviso de privacidad</span>
              </div>
            </div>
          )}

          <div className="chat-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`msg ${msg.role}`}>
                {msg.role === "bot" ? (
                  <>
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                    <InlineChart chart={msg.chart} />
                    {msg.actions && msg.actions.length > 0 && i === messages.length - 1 && (
                      <ActionChips
                        actions={msg.actions}
                        tarjetas={userTarjetas}
                        onAportar={handleAportarAction}
                        onNav={(path) => { navigate(path); setOpen(false); }}
                      />
                    )}
                  </>
                ) : (
                  msg.text
                )}
              </div>
            ))}
            {loading && (
              <div className="dot-anim">
                <span /><span /><span />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {messages.length <= 1 && !loading && (
            <div className="quick-chips">
              {(mode === "analyst" ? ANALYST_CHIPS : COACH_CHIPS).map((chip, i) => (
                <button key={i} className="chip" onClick={() => sendMessage(chip)}>
                  {chip}
                </button>
              ))}
            </div>
          )}

          <div className="chat-input-row">
            <button 
              className={`chat-voice-btn ${isListening ? "listening" : ""}`}
              onClick={toggleListening}
              title={isListening ? "Escuchando..." : "Dictar mensaje"}
            >
              {isListening ? "🛑" : "🎤"}
            </button>
            <input
              className="chat-input"
              placeholder={isListening ? "Escuchando..." : "Escribe tu pregunta..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              disabled={loading}
            />
            <button
              className="chat-send"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
            >
              ➤
            </button>
          </div>
        </div>
      )}

      <button className="fab" onClick={() => setOpen((o) => !o)}>
        {open ? "✕" : "🤖"}
        {!open && healthScore !== null && (
          <span
            className="fab-score-badge"
            style={{ background: SCORE_COLORS[healthScore.color] }}
          >
            {healthScore.score}
          </span>
        )}
      </button>
    </>
  );
}
