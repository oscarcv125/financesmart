const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver');
const { ollama } = require('../utils/ollama'); // Importa la conexión al Xeon

const aitools = {
    obtener_resumen_financiero: async ({ id_usuario, fecha_inicio, fecha_fin }) => {
        let query = supabase.from('movimiento_financiero').select('tipo, monto').eq('id_usuario', id_usuario);
        if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
        if (fecha_fin) query = query.lte('fecha', fecha_fin);
        const { data, error } = await query;
        if (error) return { error: error.message };

        const ingresos = data.filter(m => m.tipo.toLowerCase() === 'ingreso').reduce((acc, m) => acc + Number(m.monto), 0);
        const gastos = data.filter(m => m.tipo.toLowerCase() === 'gasto').reduce((acc, m) => acc + Math.abs(Number(m.monto)), 0);

        return { ingresos: ingresos.toFixed(2), gastos: gastos.toFixed(2), saldo: (ingresos - gastos).toFixed(2), total_movimientos: data.length };
    },

    obtener_gastos_por_categoria: async ({ id_usuario, fecha_inicio, fecha_fin }) => {
        let query = supabase.from('movimiento_financiero').select('monto, categoria(nombre)').eq('id_usuario', id_usuario).eq('tipo', 'gasto');
        if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
        if (fecha_fin) query = query.lte('fecha', fecha_fin);

        const { data, error } = await query;
        if (error) return { error: error.message };

        const gastosPorCategoria = {};
        data.forEach(m => {
            const cat = m.categoria?.nombre || 'Otros';
            gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + Math.abs(Number(m.monto));
        });
        return Object.entries(gastosPorCategoria).sort(([, a], [, b]) => b - a).map(([categoria, total]) => ({ categoria, total: total.toFixed(2) }));
    },

    obtener_movimientos: async ({ id_usuario, fecha_inicio, fecha_fin, tipo, nombre_categoria, limite = 15 }) => {
        if (limite > 50) limite = 50;
        let query = supabase.from('movimiento_financiero').select('monto, fecha, tipo, descripcion, categoria(nombre), tarjeta(nombre, tipo)').eq('id_usuario', id_usuario).order('fecha', { ascending: false });

        if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
        if (fecha_fin) query = query.lte('fecha', fecha_fin);
        if (tipo) query = query.ilike('tipo', tipo);

        const { data, error } = await query;
        if (error) return { error: error.message };

        if (nombre_categoria) {
            return data.filter(m => m.categoria?.nombre?.toLowerCase().includes(nombre_categoria.toLowerCase())).slice(0, limite);
        }
        return data;
    },

    obtener_metas_ahorro: async ({ id_usuario }) => {
        const { data, error } = await supabase.from('ahorro_meta').select('nombre_meta, monto_objetivo, progreso, fecha_limite').eq('id_usuario', id_usuario);
        if (error) return { error: error.message };
        return data.map(m => ({
            nombre: m.nombre_meta,
            monto_objetivo: m.monto_objetivo,
            progreso: m.progreso,
            porcentaje: m.monto_objetivo > 0 ? ((m.progreso / m.monto_objetivo) * 100).toFixed(2) + '%' : '0%',
            fecha_limite: m.fecha_limite,
            faltante: (m.monto_objetivo - m.progreso).toFixed(2)
        }));
    },

    obtener_inversiones: async ({ id_usuario }) => {
        const { data, error } = await supabase.from('usuario_inversion').select('monto, fecha_inicio, fecha_fin_estimada, tipo_inversion, inversion(nombre, nivel_riesgo, rendimiento_estimado, plazo)').eq('id_usuario', id_usuario);
        if (error) return { error: error.message };
        return data.map(i => ({
            nombre: i.inversion?.nombre,
            tipo: i.tipo_inversion,
            monto: i.monto,
            nivel_riesgo: i.inversion?.nivel_riesgo,
            rendimiento_estimado: i.inversion?.rendimiento_estimado + '%',
            fecha_inicio: i.fecha_inicio,
            fecha_fin_estimada: i.fecha_fin_estimada
        }));
    },

    obtener_tarjetas: async ({ id_usuario }) => {
        const { data, error } = await supabase.from('tarjeta').select('nombre, tipo').eq('id_usuario', id_usuario);
        if (error) return { error: error.message };
        return data;
    }
};

// Definición de herramientas para que la IA sepa qué puede llamar
const tools = [
    {
        type: 'function',
        function: {
            name: 'obtener_resumen_financiero',
            description: 'Obtiene ingresos, gastos y saldo total.',
            parameters: {
                type: 'object',
                properties: {
                    fecha_inicio: { type: 'string' },
                    fecha_fin: { type: 'string' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'obtener_gastos_por_categoria',
            description: 'Agrupa gastos por categoría.',
            parameters: {
                type: 'object',
                properties: {
                    fecha_inicio: { type: 'string' },
                    fecha_fin: { type: 'string' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'obtener_movimientos',
            description: 'Lista movimientos detallados.',
            parameters: {
                type: 'object',
                properties: {
                    tipo: { type: 'string', enum: ['Gasto', 'Ingreso'] },
                    limite: { type: 'number' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'obtener_metas_ahorro',
            description: 'Ver metas de ahorro.',
            parameters: { type: 'object', properties: {} }
        }
    }
];

async function ejecutarTool(nombre, args, id_usuario) {
    const fn = aitools[nombre];
    return fn ? await fn({ ...args, id_usuario }) : { error: 'No encontrada' };
}

function getSystemPrompt(mode, nombre) {
    const hoy = new Date().toISOString().split('T')[0];
    const base = `Eres Fortia AI para ${nombre}. Hoy es ${hoy}. Responde en español. Usa tus herramientas para datos reales. No inventes.`;
    return mode === 'analyst' ? `${base} Tono: Objetivo.` : `${base} Tono: Motivador.`;
}

router.post('/', async (req, res) => {
    const { message, history = [], mode = 'coach' } = req.body;
    const { id_usuario, nombre, apellido } = req.usuario;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    const sendEvent = (tipo, data) => res.write(`data: ${JSON.stringify({ tipo, ...data })}\n\n`);

    try {
        let mensajes = [
            { role: 'system', content: getSystemPrompt(mode, `${nombre} ${apellido}`) },
            ...history.map(h => ({ 
                role: h.role === 'model' ? 'assistant' : h.role, 
                content: h.parts[0].text 
            })),
            { role: 'user', content: message }
        ];

        // Usamos DeepSeek-R1 en tu Xeon para razonar las herramientas
        const response = await ollama.chat({
            model: 'llama3.1:8b',//'deepseek-r1:8b',
            messages: mensajes,
            tools: tools,
        });

        if (response.message.tool_calls) {
            for (const tool of response.message.tool_calls) {
                const msgsEstado = {
                    obtener_resumen_financiero: 'Calculando resumen...',
                    obtener_gastos_por_categoria: 'Analizando categorías...',
                    obtener_movimientos: 'Buscando movimientos...',
                    obtener_metas_ahorro:'Consultando tus metas de ahorro...',
                    obtener_inversiones:'Verificando tus inversiones...',
                    obtener_tarjetas:'Revisando tus tarjetas...'
                };
                sendEvent('estado', { texto: msgsEstado[tool.function.name] || 'Consultando...' });

                const resultado = await ejecutarTool(tool.function.name, tool.function.arguments, id_usuario);
                mensajes.push(response.message);
                mensajes.push({
                    role: 'tool',
                    content: JSON.stringify(resultado),
                });
            }

            // Segunda llamada con los datos obtenidos
            const finalRes = await ollama.chat({
                model: 'llama3.1:8b',//'deepseek-r1:8b',
                messages: mensajes
            });
            sendEvent('respuesta', { texto: finalRes.message.content });
        } else {
            sendEvent('respuesta', { texto: response.message.content });
        }

    } catch (error) {
        console.error('Error Xeon:', error);
        sendEvent('error', { error: 'Error de conexión con el servidor de IA' });
    } finally {
        res.end();
    }
});

module.exports = router;