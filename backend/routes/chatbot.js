const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver');


const aitools={
  obtener_resumen_financiero: async ({id_usuario, fecha_inicio, fecha_fin})=>{
    let query = supabase.from('movimiento_financiero').select('tipo, monto').eq('id_usuario', id_usuario);

      if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
      if (fecha_fin) query = query.lte('fecha', fecha_fin);
      const { data, error } = await query;
      if (error) return {error: error.message};

      const ingresos=data.filter(m=>m.tipo.toLowerCase()==='ingreso').reduce((acc,m)=>acc+Number(m.monto),0);
      const gastos=data.filter(m=>m.tipo.toLowerCase()==='gasto').reduce((acc,m)=>acc+Math.abs(Number(m.monto)),0);

      return {ingresos:ingresos.toFixed(2), gastos:gastos.toFixed(2), saldo:(ingresos-gastos).toFixed(2), total_movimientos:data.length};
  },

  obtener_gastos_por_categoria: async({id_usuario, fecha_inicio, fecha_fin})=>{
    let query = supabase.from('movimiento_financiero').select('monto, categoria(nombre)').eq('id_usuario', id_usuario).eq('tipo', 'gasto');

    if (fecha_inicio) query=query.gte('fecha', fecha_inicio);
    if (fecha_fin) query=query.lte('fecha', fecha_fin);

    const { data, error } = await query;
    console.log('Gastos raw:', data, 'Error:', error);
    if (error) return {error: error.message};

    const gastosPorCategoria = {};
    data.forEach(m => {
      const cat = m.categoria?.nombre || 'Otros';
      gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + Math.abs(Number(m.monto));
    });
    return Object.entries(gastosPorCategoria).sort(([, a], [, b]) => b - a).map(([categoria, total]) => ({ categoria, total: total.toFixed(2) }));
  },

  obtener_movimientos: async({id_usuario, fecha_inicio, fecha_fin, tipo, nombre_categoria, limite=15})=>{
    if (limite>50) limite=50;
    let query=supabase.from('movimiento_financiero').select('monto, fecha, tipo, descripcion, categoria(nombre), tarjeta(nombre, tipo)').eq('id_usuario', id_usuario)
    .order('fecha', { ascending: false });

    if (fecha_inicio) query=query.gte('fecha', fecha_inicio);
    if (fecha_fin) query=query.lte('fecha', fecha_fin);
    if (tipo) query=query.ilike('tipo', tipo);

    const{data,error}=await query;
    if (error) return {error: error.message};

    if (nombre_categoria){
      return data.filter(m => m.categoria?.nombre?.toLowerCase().includes(nombre_categoria.toLowerCase()))
      .slice(0, limite);
    } 
    return data;
  },

  obtener_metas_ahorro:async({id_usuario})=>{
    const { data, error } = await supabase.from('ahorro_meta').select('nombre_meta,monto_objetivo, progreso, fecha_limite').eq('id_usuario', id_usuario);
    if (error) return {error: error.message};
   
    return data.map(m => ({
      nombre:m.nombre_meta,
      monto_objetivo: m.monto_objetivo,
      progreso: m.progreso,
      porcentaje: m.monto_objetivo > 0 ? ((m.progreso / m.monto_objetivo) * 100).toFixed(2) + '%' : '0%',
      fecha_limite: m.fecha_limite,
      faltante: (m.monto_objetivo - m.progreso).toFixed(2)
    }));
  },

  obtener_inversiones:async({id_usuario})=>{
    const{data,error}=await supabase.from('usuario_inversion').select('monto, fecha_inicio,fecha_fin_estimada,tipo_inversion, inversion(nombre, nivel_riesgo, rendimiento_estimado, plazo)')
    .eq('id_usuario', id_usuario);

    if (error) return {error: error.message};

    return data.map(i=>({
      nombre: i.inversion?.nombre,
      tipo: i.tipo_inversion,
      monto: i.monto,
      nivel_riesgo: i.inversion?.nivel_riesgo,
      rendimiento_estimado: i.inversion?.rendimiento_estimado+'%',
      fecha_inicio: i.fecha_inicio,
      fecha_fin_estimada: i.fecha_fin_estimada
    }));
      
  },

  obtener_tarjetas: async({id_usuario})=>{
    const {data,error} = await supabase.from('tarjeta').select('nombre, tipo').eq('id_usuario',id_usuario);

    if(error) return {error: error.message};
    return data;
  }
};

const toolDefs = {
  function_declarations: [
    {
      name: 'obtener_resumen_financiero',
      description: 'Obtiene el total de ingresos, gastos y saldo del usuario. Puede filtrarse por rango de fechas.',
      parameters: {
        type: 'OBJECT',
        properties: {
          fecha_inicio: { type: 'STRING', description: 'Fecha inicio en formato YYYY-MM-DD. Opcional.' },
          fecha_fin:    { type: 'STRING', description: 'Fecha fin en formato YYYY-MM-DD. Opcional.' },
        },
      },
    },
    {
      name: 'obtener_gastos_por_categoria',
      description: 'Retorna cuánto ha gastado el usuario agrupado por categoría. Útil para saber en qué gasta más. Puede filtrarse por fechas.',
      parameters: {
        type: 'OBJECT',
        properties: {
          fecha_inicio: { type: 'STRING', description: 'Fecha inicio en formato YYYY-MM-DD. Opcional.' },
          fecha_fin:    { type: 'STRING', description: 'Fecha fin en formato YYYY-MM-DD. Opcional.' },
        },
      },
    },
    {
      name: 'obtener_movimientos',
      description: 'Lista movimientos individuales del usuario. Usar para preguntas específicas como "¿cuánto gasté en Uber?" o "muéstrame mis últimos ingresos".',
      parameters: {
        type: 'OBJECT',
        properties: {
          fecha_inicio:      { type: 'STRING', description: 'Fecha inicio YYYY-MM-DD. Opcional.' },
          fecha_fin:         { type: 'STRING', description: 'Fecha fin YYYY-MM-DD. Opcional.' },
          tipo:              { type: 'STRING', description: 'Filtrar por "Gasto" o "Ingreso". Opcional.' },
          nombre_categoria:  { type: 'STRING', description: 'Nombre parcial de categoría a filtrar. Ej: "transporte", "comida". Opcional.' },
          limite:            { type: 'INTEGER', description: 'Cuántos movimientos traer. Máximo 50. Default 15.' },
        },
      },
    },
    {
      name: 'obtener_metas_ahorro',
      description: 'Retorna las metas de ahorro del usuario con su progreso actual, monto objetivo y fecha límite.',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'obtener_inversiones',
      description: 'Retorna las inversiones activas del usuario con monto, rendimiento estimado y tipo.',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'obtener_tarjetas',
      description: 'Retorna las tarjetas o cuentas registradas del usuario.',
      parameters: { type: 'OBJECT', properties: {} },
    },
  ],
};

async function ejecutarTool(nombre, args, id_usuario){
  const fn = aitools[nombre];
  if(!fn) return {error: 'Función no encontrada'};
  return await fn({...args, id_usuario});
}

//SYSTEM PROMPT

function systemPrompt(mode, nombre){
  const hoy = new Date().toISOString().split('T')[0];
  const basePrompt= ` Eres Fortia AI, un asesor financiero personal para ${nombre}. 
  Responde SIEMPRE en español. 
  La fecha de hoy es ${hoy}.
  Tienes herramientas para consultar los datos financieros del usuario.
  Úsalas antes de responder preguntas sobre sus finanzas.
  NUNCA inventes cifras o datos. Si necesitas datos, pidelos usando las herramientas disponibles.
  Cuando des recomendaciones, básate en los datos reales del usuario y en principios financieros sólidos. No des consejos no solicitados.
  `;

  if(mode==='analyst'){
    return basePrompt+ '\nTono: objetivo, preciso y profesional. No des consejos no solicitados.';
}else{
  return basePrompt+ '\nTono: motivador, amigable y cercano. Sugiere metas, señala áreas de mejora, recomienda acciones concretas.';
}
}
router.post('/', async (req, res) => {
  const{message, history =[], mode='coach'}=req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0)
    return res.status(400).json({ error: 'Mensaje requerido' });
  if (message.length > 1000)
    return res.status(400).json({ error: 'Mensaje demasiado largo (máx 1000 caracteres)' });
  if (!Array.isArray(history) || history.length > 50)
    return res.status(400).json({ error: 'Historial inválido' });

  try{
    const {id_usuario, nombre, apellido} =req.usuario;
    const nombreCompleto=`${nombre} ${apellido}`;
    const F_systemPrompt = systemPrompt(mode, nombreCompleto);

    const contenido = [...history, {role:'user', parts:[{text:message}]}];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent=(tipo, data) => {
      res.write(`data: ${JSON.stringify({tipo, ...data})}\n\n`);
    }

    let respuestaFinal=null;
    let iteraciones=0;
    const maxIteraciones=5;

    while(!respuestaFinal && iteraciones<maxIteraciones){
      iteraciones++;
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            system_instruction: {parts:[{text:F_systemPrompt}]},
            contents: contenido,
            tools: [toolDefs],
          }),
        }
      );
      //if(!geminiRes.ok) throw new Error('Error Gemini: '+geminiRes.status);
      if(!geminiRes.ok) {
  const errorBody = await geminiRes.json();
  console.error('Gemini error detalle:', JSON.stringify(errorBody, null, 2));
  throw new Error('Error Gemini: '+geminiRes.status);
}
      const geminiData = await geminiRes.json();
      const candidate = geminiData?.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      const toolCalls = parts.filter(p=>p.functionCall);
      if (toolCalls.length>0){
        contenido.push({role:'model', parts});

        const toolResults=await Promise.all(
          toolCalls.map(async (part)=>{
            const {name,args}=part.functionCall;

            const mensajes={obtener_resumen_financiero:'Calculando tu resumen financiero...',
            obtener_gastos_por_categoria:'Analizando tus gastos por categoría...',
            obtener_movimientos:'Revisando tus movimientos...',
            obtener_metas_ahorro:'Consultando tus metas de ahorro...',
            obtener_inversiones:'Verificando tus inversiones...',
            obtener_tarjetas:'Revisando tus tarjetas...'
            }
            sendEvent('estado', {texto: mensajes[name] || 'Consultando datos...'});
            const resultado=await ejecutarTool(name, args || {}, id_usuario);
            return{ functionResponse:{name, response:{results:resultado}}}
        
          })
        );
        contenido.push({role:'user', parts:toolResults});
      }else{respuestaFinal=parts.find(p=>p.text)?.text || 'Sin respuesta.';}
        }
        sendEvent('respuesta', {texto: respuestaFinal || 'No pude procesar tu solicitud.'});
        res.end();
        
      }catch(error){
        console.error('Error en chatbot:', error.message);
        res.write(`data: ${JSON.stringify({tipo:'error', error: 'Error al procesar la consulta'})}\n\n`);
        res.end();
      }
    }
  )
    module.exports = router;














/*
async function fetchUserFinancialData(id_usuario) {
  const { data: movimientos } = await supabase
    .from('movimiento_financiero')
    .select('monto, fecha, tipo, descripcion, categoria(nombre)')
    .eq('id_usuario', id_usuario)
    .order('fecha', { ascending: false })
    .limit(20);

  const lista = movimientos || [];

  const ingresos = lista
    .filter(m => m.tipo?.toLowerCase() === 'ingreso')
    .reduce((acc, m) => acc + Number(m.monto), 0);

  const gastos = lista
    .filter(m => m.tipo?.toLowerCase() === 'gasto')
    .reduce((acc, m) => acc + Math.abs(Number(m.monto)), 0);

  const catAgrupadas = {};
  lista
    .filter(m => m.tipo?.toLowerCase() === 'gasto')
    .forEach(m => {
      const cat = m.categoria?.nombre || 'Otros';
      catAgrupadas[cat] = (catAgrupadas[cat] || 0) + Math.abs(Number(m.monto));
    });

  const topCategorias = Object.entries(catAgrupadas)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([nombre, monto]) => `- ${nombre}: $${monto.toFixed(2)}`)
    .join('\n');

  const movRecientes = lista.slice(0, 10).map(m =>
    `| ${m.fecha?.split('T')[0]} | ${m.descripcion || '-'} | ${m.tipo} | $${Math.abs(Number(m.monto)).toFixed(2)} |`
  ).join('\n');

  return { saldo: ingresos - gastos, ingresos, gastos, topCategorias, movRecientes };
}

function buildSystemPrompt(mode, nombre, data) {
  const datosFinancieros = `
=== ESTADO FINANCIERO ACTUAL ===
- Saldo disponible: $${data.saldo.toFixed(2)} MXN
- Ingresos registrados: $${data.ingresos.toFixed(2)} MXN
- Gastos registrados: $${data.gastos.toFixed(2)} MXN

=== MOVIMIENTOS RECIENTES ===
| Fecha | Descripción | Tipo | Monto |
|-------|-------------|------|-------|
${data.movRecientes}

=== TOP CATEGORÍAS DE GASTO ===
${data.topCategorias || 'Sin gastos registrados'}
`;

  if (mode === 'analyst') {
    return `Eres FinanceSmart AI en modo ANALISTA FINANCIERO para el usuario ${nombre}.
Responde SIEMPRE en español, de forma objetiva, precisa y profesional.
No des consejos no solicitados. Mantén un tono neutro. No inventes datos fuera del contexto.
${datosFinancieros}`;
  }

  return `Eres FinanceSmart AI en modo COACH FINANCIERO para el usuario ${nombre}.
Responde SIEMPRE en español, de forma motivadora y cercana.
Propón metas concretas, sugiere cómo reducir gastos, recomienda inversiones según su perfil.
No inventes datos fuera del contexto.
${datosFinancieros}`;
}

router.post('/', async (req, res) => {
  const { message, history = [], mode = 'coach' } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Mensaje requerido' });
  }
  if (message.length > 1000) {
    return res.status(400).json({ error: 'Mensaje demasiado largo (máx 1000 caracteres)' });
  }
  if (!Array.isArray(history) || history.length > 50) {
    return res.status(400).json({ error: 'Historial inválido' });
  }

  try {
    const nombre = `${req.usuario.nombre} ${req.usuario.apellido}`;
    const financialData = await fetchUserFinancialData(req.usuario.id_usuario);
    const systemPrompt = buildSystemPrompt(mode, nombre, financialData);

    const newHistory = [...history, { role: 'user', parts: [{ text: message }] }];

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: newHistory,
        }),
      }
    );

    if (!geminiRes.ok) {
      throw new Error(`Gemini error: ${geminiRes.status}`);
    }

    const geminiData = await geminiRes.json();
    const reply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta.';

    res.json({ reply });
  } catch (error) {
    console.error('Error en chatbot:', error.message);
    res.status(500).json({ error: 'Error al procesar la consulta' });
  }
});

module.exports = router;
*/