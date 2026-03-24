import { useState, useRef, useEffect, useCallback } from "react";

const GEMINI_API_KEY = "AIzaSyAg1MnGuuu2Syzw4jfDVJQAY4xdx0UCoR0";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const DATOS_FINANCIEROS = `
=== PERFIL DEL USUARIO ===
Nombre: Diego García
Banco: Banorte

=== DASHBOARD - ESTADO ACTUAL (Febrero 2026) ===
- Saldo disponible: $1,240.68 MXN
- Gastado este mes: $3,760.00 MXN
- Comparado al mes anterior: 22% más de gasto ↗
- Días restantes del mes: 18

=== MOVIMIENTOS DE FEBRERO 2026 ===
| Fecha  | Descripción    | Tipo    | Monto      |
|--------|----------------|---------|------------|
| 26/02  | Uber Eats      | Gasto   | $199.00    |
| 26/02  | OXXO Tec       | Gasto   | $56.00     |
| 26/02  | Spotify        | Gasto   | $199.00    |
| 19/02  | Retiro         | Gasto   | $500.00    |
| 15/02  | Transferencia  | Ingreso | $600.00    |
| 10/02  | Netflix        | Gasto   | $149.00    |
| 05/02  | Nómina         | Ingreso | $5,000.00  |

Total ingresos febrero: $5,600.00
Total gastos febrero: $3,760.00

=== ANÁLISIS FINANCIERO MENSUAL ===
- Enero: $3,200 en gastos
- Febrero: $5,800 en gastos
- Marzo: $4,500 en gastos

Distribución de gastos:
- Inversión: 35%
- Snacks/Cafés (ej. Andatti): 25%
- Ocio: 40%

Alerta activa: El consumo en snacks y cafés (como Andatti) se está desviando del presupuesto habitual.

=== OPORTUNIDADES DE INVERSIÓN DISPONIBLES ===
1. Fondo de Inversión  — ROI: 6.20%  — Plazo: 90 días  — Riesgo: Bajo
2. Mercado Global      — ROI: 12.20% — Plazo: 90 días  — Riesgo: Alto
3. Pagaré              — ROI: 16.20% — Plazo: 190 días — Riesgo: Bajo
4. CETES 28 días       — ROI: 11.30% — Plazo: 28 días  — Riesgo: Bajo
5. Fibra Inmobiliaria  — ROI: 9.50%  — Plazo: 365 días — Riesgo: Medio
`;

const PROMPT_COACH = `
Eres FinanceSmart AI en modo COACH FINANCIERO para el usuario Diego García en Banorte.
Responde SIEMPRE en español, de forma motivadora, cercana y con iniciativa.
Tu objetivo es ayudar a Diego a mejorar sus finanzas activamente.

TU ROL COMO COACH:
- Propón metas de ahorro concretas basadas en sus datos.
- Si gasta mucho en una categoría, sugiérele cómo reducirlo con pasos específicos.
- Recomienda inversiones según su perfil y saldo disponible.
- Celebra sus logros financieros y motívalo cuando veas que va bien.
- Dale tips prácticos y accionables, no solo información.
- Si pregunta algo general, aprovecha para darle un consejo útil relacionado.
- Puedes calcular proyecciones si te lo piden.
- No inventes datos que no estén en el contexto.

${DATOS_FINANCIEROS}
`;

const PROMPT_ANALYST = `
Eres FinanceSmart AI en modo ANALISTA FINANCIERO para el usuario Diego García en Banorte.
Responde SIEMPRE en español, de forma objetiva, precisa y profesional.
Tu objetivo es informar a Diego sobre el estado de sus finanzas sin emitir juicios.

TU ROL COMO ANALISTA:
- Presenta los datos tal cual son, sin sugerir cambios a menos que te lo pidan.
- Responde con cifras exactas y porcentajes cuando sea relevante.
- Si te piden un resumen, sé directo y estructurado.
- No des consejos no solicitados ni motivaciones.
- Mantén un tono neutro y profesional.
- Puedes calcular proyecciones si te lo piden.
- No inventes datos que no estén en el contexto.

${DATOS_FINANCIEROS}
`;

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

  .fab {
    position: fixed; bottom: 28px; right: 28px;
    width: 56px; height: 56px; border-radius: 50%;
    background: #cc0000; border: none;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 20px rgba(204,0,0,0.4);
    cursor: pointer; font-size: 24px; z-index: 1000;
    transition: transform 0.15s;
  }
  .fab:hover { transform: scale(1.08); }

  .chat-window {
    position: fixed;
    width: 370px; max-height: min(600px, calc(100vh - 120px));
    background: #fff; border-radius: 18px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.16);
    display: flex; flex-direction: column;
    z-index: 1000; overflow: hidden;
    font-family: 'DM Sans', sans-serif;
    animation: slideUp 0.2s ease;
  }
  .chat-window.dragging { transition: none; }
  .chat-window:not(.dragging) { transition: all 0.25s ease; }
  .chat-window.fullscreen {
    bottom: 0; right: 0;
    width: 100vw; height: 100vh; max-height: 100vh;
    border-radius: 0;
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .chat-header {
    background: linear-gradient(135deg, #cc0000, #990000);
    padding: 16px 18px;
    display: flex; align-items: center; justify-content: space-between;
    cursor: grab; user-select: none;
  }
  .chat-header:active { cursor: grabbing; }
  .chat-header h3 { color: #fff; font-size: 15px; font-weight: 700; margin: 0; }
  .chat-header p  { color: rgba(255,255,255,0.7); font-size: 11px; margin: 3px 0 0; }
  .chat-header-actions { display: flex; align-items: center; gap: 4px; }
  .chat-icon-btn {
    color: rgba(255,255,255,0.8); cursor: pointer;
    font-size: 15px; padding: 4px 7px; border-radius: 4px;
    background: none; border: none; line-height: 1;
  }
  .chat-icon-btn:hover { background: rgba(255,255,255,0.15); }

  .chat-messages {
    flex: 1; overflow-y: auto; padding: 14px;
    display: flex; flex-direction: column; gap: 10px;
    background: #f9f9f9;
  }
  .chat-window.fullscreen .chat-messages { padding: 24px 32px; }
  .chat-messages::-webkit-scrollbar { width: 4px; }
  .chat-messages::-webkit-scrollbar-thumb { background: #ddd; border-radius: 4px; }

  .msg {
    max-width: 88%; padding: 10px 14px; border-radius: 14px;
    font-size: 13px; line-height: 1.55; word-break: break-word;
    white-space: pre-wrap;
  }
  .chat-window.fullscreen .msg { max-width: 640px; font-size: 15px; }
  .msg.bot {
    background: #fff; color: #333; border: 1px solid #ebebeb;
    align-self: flex-start; border-radius: 4px 14px 14px 14px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
  .msg.user {
    background: #cc0000; color: #fff;
    align-self: flex-end; border-radius: 14px 4px 14px 14px;
  }

  .dot-anim {
    display: flex; gap: 4px; align-items: center;
    background: #fff; border: 1px solid #ebebeb;
    padding: 12px 16px; border-radius: 4px 14px 14px 14px;
    align-self: flex-start;
  }
  .dot-anim span {
    display: inline-block; width: 7px; height: 7px;
    background: #cc0000; border-radius: 50%;
    animation: bounce 1.2s infinite;
  }
  .dot-anim span:nth-child(2) { animation-delay: 0.2s; }
  .dot-anim span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes bounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
    30% { transform: translateY(-6px); opacity: 1; }
  }

  .chat-input-row {
    display: flex; gap: 8px; padding: 12px 14px;
    border-top: 1px solid #eee; background: #fff;
    align-items: center;
  }
  .chat-window.fullscreen .chat-input-row { padding: 16px 32px; }
  .chat-input {
    flex: 1; border: 1.5px solid #e0e0e0; border-radius: 20px;
    padding: 9px 14px; font-size: 13px;
    font-family: 'DM Sans', sans-serif; outline: none;
    transition: border 0.15s; color: #333;
  }
  .chat-window.fullscreen .chat-input { font-size: 15px; padding: 12px 18px; }
  .chat-input:focus { border-color: #cc0000; }
  .chat-input::placeholder { color: #bbb; }

  .chat-send {
    width: 36px; height: 36px; border-radius: 50%;
    background: #cc0000; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 15px; flex-shrink: 0;
    transition: background 0.15s;
  }
  .chat-window.fullscreen .chat-send { width: 44px; height: 44px; font-size: 18px; }
  .chat-send:hover { background: #aa0000; }
  .chat-send:disabled { background: #e0e0e0; cursor: not-allowed; }

  .quick-chips {
    display: flex; flex-wrap: wrap; gap: 6px;
    padding: 0 14px 10px;
    background: #f9f9f9;
  }
  .chip {
    border: 1px solid #e0e0e0; background: #fff;
    border-radius: 20px; padding: 5px 12px;
    font-size: 11px; color: #555; cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: all 0.15s; white-space: nowrap;
  }
  .chip:hover { background: #cc0000; color: #fff; border-color: #cc0000; }

  .disclaimer-overlay {
    position: absolute; inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center;
    z-index: 10; padding: 20px;
  }
  .disclaimer-card {
    background: #fff; border-radius: 16px;
    padding: 22px 20px; width: 100%;
    display: flex; flex-direction: column; gap: 12px;
    animation: slideUp 0.25s ease;
  }
  .disclaimer-icon {
    width: 40px; height: 40px; border-radius: 50%;
    background: #fff5f5; display: flex; align-items: center;
    justify-content: center; font-size: 18px; margin: 0 auto;
  }
  .disclaimer-title {
    font-size: 14px; font-weight: 700; color: #111;
    text-align: center;
  }
  .disclaimer-text {
    font-size: 11px; color: #666; line-height: 1.5;
    text-align: center;
  }
  .disclaimer-bullets {
    font-size: 11px; color: #555; line-height: 1.5;
    padding: 0; margin: 0; list-style: none;
    display: flex; flex-direction: column; gap: 4px;
  }
  .disclaimer-bullets li {
    display: flex; align-items: flex-start; gap: 8px;
  }
  .disclaimer-bullets li::before {
    content: ""; display: inline-block;
    width: 6px; height: 6px; border-radius: 50%;
    background: #cc0000; flex-shrink: 0; margin-top: 5px;
  }
  .disclaimer-accept {
    width: 100%; background: #cc0000; color: #fff;
    border: none; border-radius: 10px; padding: 11px;
    font-size: 13px; font-weight: 700; cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: background 0.15s;
  }
  .disclaimer-accept:hover { background: #aa0000; }
  .disclaimer-link {
    font-size: 11px; color: #999; text-align: center;
    text-decoration: underline; cursor: pointer;
  }

  .settings-panel {
    padding: 16px 18px;
    background: #fff;
    border-bottom: 1px solid #f0f0f0;
    display: flex; flex-direction: column; gap: 12px;
    animation: slideUp 0.15s ease;
  }
  .settings-title {
    font-size: 13px; font-weight: 700; color: #333;
    display: flex; align-items: center; justify-content: space-between;
  }
  .settings-close {
    background: none; border: none; cursor: pointer;
    font-size: 14px; color: #999; padding: 2px 6px;
    border-radius: 4px;
  }
  .settings-close:hover { background: #f0f0f0; color: #333; }
  .mode-option {
    border: 1.5px solid #e8e8e8; border-radius: 12px;
    padding: 14px 16px; cursor: pointer;
    transition: all 0.15s; display: flex; flex-direction: column; gap: 4px;
  }
  .mode-option:hover { border-color: #ccc; }
  .mode-option.selected { border-color: #cc0000; background: #fff8f8; }
  .mode-option-header {
    display: flex; align-items: center; gap: 8px;
  }
  .mode-dot {
    width: 10px; height: 10px; border-radius: 50%;
    border: 2px solid #ccc;
  }
  .mode-option.selected .mode-dot {
    border-color: #cc0000; background: #cc0000;
  }
  .mode-name { font-size: 13px; font-weight: 700; color: #222; }
  .mode-desc { font-size: 11px; color: #888; line-height: 1.5; padding-left: 18px; }

  .resize-handle-tl {
    position: absolute; top: 0; left: 0;
    width: 18px; height: 18px; cursor: nwse-resize; z-index: 5;
  }
  .resize-handle-tr {
    position: absolute; top: 0; right: 0;
    width: 18px; height: 18px; cursor: nesw-resize; z-index: 5;
  }
  .resize-handle-bl {
    position: absolute; bottom: 0; left: 0;
    width: 18px; height: 18px; cursor: nesw-resize; z-index: 5;
  }
  .resize-handle-br {
    position: absolute; bottom: 0; right: 0;
    width: 18px; height: 18px; cursor: nwse-resize; z-index: 5;
  }
`;

const QUICK_CHIPS = [
  "¿Cuál es mi saldo?",
  "¿Cuánto gasté este mes?",
  "¿Qué inversión me conviene?",
  "¿En qué gasto más?",
];

const MSG_BIENVENIDA = { role: "bot", text: "¡Hola, Diego! 👋 Soy tu asistente FinanceSmart. Puedo ayudarte con tu saldo, movimientos, gastos e inversiones. ¿En qué te puedo ayudar?" };

function cargarDesdeStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

export default function Chatbot() {
  const [open, setOpen]               = useState(false);
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [fullscreen, setFullscreen]   = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [accepted, setAccepted]       = useState(() => localStorage.getItem("chat_disclaimer") === "true");
  const [mode, setMode]               = useState(() => localStorage.getItem("chat_mode") || "coach");
  const [messages, setMessages]       = useState(() => cargarDesdeStorage("chat_messages", [MSG_BIENVENIDA]));
  const [history, setHistory]         = useState(() => cargarDesdeStorage("chat_history", []));
  const [pos, setPos]                 = useState({ x: null, y: null });
  const [size, setSize]               = useState({ w: 370, h: 520 });
  const [dragging, setDragging]       = useState(false);
  const [resizing, setResizing]       = useState(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0, posX: 0, posY: 0 });
  const bottomRef = useRef(null);
  const windowRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("chat_messages", JSON.stringify(messages));
  }, [messages]);

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

      if (resizing === "br") {
        newW = s.w + dx;
        newH = s.h + dy;
      } else if (resizing === "bl") {
        newW = s.w - dx;
        newH = s.h + dy;
        newX = s.posX + dx;
      } else if (resizing === "tr") {
        newW = s.w + dx;
        newH = s.h - dy;
        newY = s.posY + dy;
      } else if (resizing === "tl") {
        newW = s.w - dx;
        newH = s.h - dy;
        newX = s.posX + dx;
        newY = s.posY + dy;
      }

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
    setMessages([MSG_BIENVENIDA]);
    localStorage.removeItem("chat_history");
    setShowSettings(false);
  };

  const getSystemPrompt = () => mode === "coach" ? PROMPT_COACH : PROMPT_ANALYST;

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    setLoading(true);

    const newHistory = [...history, { role: "user", parts: [{ text: msg }] }];

    try {
      const res = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: getSystemPrompt() }] },
          contents: newHistory,
        }),
      });

      const data = await res.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sin respuesta.";

      setHistory([...newHistory, { role: "model", parts: [{ text: reply }] }]);
      setMessages((prev) => [...prev, { role: "bot", text: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "bot", text: "Error de conexión. Intenta de nuevo." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{styles}</style>

      {open && (
        <div
          ref={windowRef}
          className={`chat-window${fullscreen ? " fullscreen" : ""}${dragging || resizing ? " dragging" : ""}`}
          style={fullscreen
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
              <button
                className="chat-icon-btn"
                onClick={() => setShowSettings((s) => !s)}
                title="Configuración"
              >
                ⚙
              </button>
              <button
                className="chat-icon-btn"
                onClick={() => setFullscreen((f) => !f)}
                title={fullscreen ? "Restaurar" : "Pantalla completa"}
              >
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
              <div
                className={`mode-option ${mode === "coach" ? "selected" : ""}`}
                onClick={() => handleModeChange("coach")}
              >
                <div className="mode-option-header">
                  <div className="mode-dot" />
                  <span className="mode-name">🎯 Coach Financiero</span>
                </div>
                <span className="mode-desc">Te propone metas, te da consejos para ahorrar, te sugiere inversiones y te motiva a mejorar tus hábitos financieros.</span>
              </div>
              <div
                className={`mode-option ${mode === "analyst" ? "selected" : ""}`}
                onClick={() => handleModeChange("analyst")}
              >
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
              <div key={i} className={`msg ${msg.role}`} dangerouslySetInnerHTML={{
                __html: msg.text
                  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                  .replace(/\n/g, "<br>")
              }} />
            ))}
            {loading && (
              <div className="dot-anim">
                <span /><span /><span />
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
