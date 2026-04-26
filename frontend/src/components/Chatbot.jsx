import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import ReactMarkdown from "react-markdown";
import "../styles/chatbot.css";

const QUICK_CHIPS = [
  "¿Cuál es mi saldo?",
  "¿Cuánto gasté este mes?",
  "¿Qué inversión me conviene?",
  "¿En qué gasto más?",
];

const buildMsgBienvenida = (nombre) => ({
  role: "bot",
  text: `¡Hola, ${nombre.split(" ")[0]}! 👋 Soy tu asistente FinanceSmart. Puedo ayudarte con tu saldo, movimientos, gastos e inversiones. ¿En qué te puedo ayudar?`,
});

export default function Chatbot() {
  const { session } = useAuth();
  const [nombreUsuario, setNombreUsuario] = useState(null);
  
  // Definimos la URL del backend desde las variables de entorno de Vite
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "";

  useEffect(() => {
    if (!session) return;
    // Usamos la variable backendUrl aquí
    fetch(`${backendUrl}/api/me`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.nombre) setNombreUsuario(`${data.nombre} ${data.apellido}`);
      })
      .catch(() => setNombreUsuario("Usuario"));
  }, [session, backendUrl]);

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
  const [estado, setEstado]         = useState("");
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0, posX: 0, posY: 0 });
  const bottomRef = useRef(null);
  const windowRef = useRef(null);

  const messages = nombreUsuario
    ? [buildMsgBienvenida(nombreUsuario), ...extraMessages]
    : extraMessages;

  const setMessages = (updater) => {
    setExtraMessages((prev) => {
      const current =
        typeof updater === "function"
          ? updater([buildMsgBienvenida(nombreUsuario || "Usuario"), ...prev])
          : updater;
      return current.slice(1);
    });
  };

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
  };

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    setLoading(true);
    setEstado("Analizando tu pregunta...");

    try {
      // Usamos la variable backendUrl aquí también
      const res = await fetch(`${backendUrl}/api/chatbot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: msg, history, mode }),
      });

      const reader=res.body.getReader();
      const decoder=new TextDecoder();
      
      while(true){
        const {done,value}=await reader.read();
        if(done)break;
        const texto=decoder.decode(value);
        const lineas=texto.split("\n").filter(l=>l.trim().startsWith("data:"));
        
        for (const linea of lineas){
          const evento=JSON.parse(linea.replace('data:',''));
          if (evento.tipo==='estado'){
            setEstado(evento.texto);
          }
          else if(evento.tipo==='respuesta'){
            const respuesta=evento.texto;
            setHistory((prev) => [
              ...prev,
              { role: "user", parts: [{ text: msg }] },
              { role: "model", parts: [{ text: evento.texto }] },
            ]);
            setMessages((prev) => [...prev, { role: "bot", text: evento.texto }]);
          }else if(evento.tipo==='error'){
            throw new Error(evento.error);
          }
      }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "Error de conexión. Intenta de nuevo." },
      ]);
    } finally {
      setLoading(false);
      setEstado("");
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
              <p>Modo {mode === "coach" ? "Coach" : "Analista"} · En línea</p>
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
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                ) : (
                  msg.text
                )}
              </div>
            ))}
            {loading && (
              <div className="dot-anim">
                <span /><span /><span />
                {estado && <p className="chat-estado">{estado}</p>}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {messages.length <= 1 && (
            <div className="quick-chips">
              {QUICK_CHIPS.map((chip, i) => (
                <button key={i} className="chip" onClick={() => sendMessage(chip)}>
                  {chip}
                </button>
              ))}
            </div>
          )}

          <div className="chat-input-row">
            <input
              className="chat-input"
              placeholder="Escribe tu pregunta..."
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
      </button>
    </>
  );
}