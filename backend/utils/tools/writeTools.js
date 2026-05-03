const { z } = require('zod');
const proposalStore = require('../agent/proposalStore');
const { isoDate } = require('./schemas');

// Per-request schemas. Note: id_meta etc. are validated against the live ctx
// enums, so the model can't propose actions on fabricated IDs.
function buildWriteSchemas(ctx) {
  const idMeta = z.number().int().refine(id => ctx.metasById.has(id), { message: 'META_NO_ENCONTRADA' });
  const idCategoria = z.number().int().refine(id => ctx.categoriaIds.has(id), { message: 'CATEGORIA_NO_VALIDA' });
  const idPresupuesto = z.number().int().refine(id => ctx.presupuestosById.has(id), { message: 'PRESUPUESTO_NO_VALIDO' });
  const idRecurrencia = z.number().int().refine(id => ctx.recurrenciasById.has(id), { message: 'RECURRENCIA_NO_VALIDA' });

  // Reasonable money cap to bound blast radius if the model hallucinates a value.
  const monto = z.number().positive().max(200000);

  return {
    proponer_aporte_meta: z.object({
      id_meta: idMeta,
      monto,
      // id_tarjeta is optional at proposal time — UI can ask user which tarjeta.
      id_tarjeta: z.number().int().refine(id => ctx.tarjetaIds.has(id), { message: 'TARJETA_NO_VALIDA' }).optional(),
    }),

    proponer_crear_presupuesto: z.object({
      id_categoria: idCategoria,
      monto,
    }),

    proponer_modificar_presupuesto: z.object({
      id_presupuesto: idPresupuesto,
      monto_nuevo: monto,
    }),

    proponer_toggle_recurrencia: z.object({
      id_recurrencia: idRecurrencia,
      activo: z.boolean(),
    }),

    proponer_crear_meta: z.object({
      nombre: z.string().min(3).max(60),
      monto_objetivo: monto,
      // Reuse the same calendar+range refine as read tools so 2025-13-01 or
      // 1900-01-01 can't slip through into a Postgres `date` insert.
      fecha_limite: isoDate().optional(),
    }),
  };
}

const WRITE_DESCRIPTIONS_ES = {
  proponer_aporte_meta: 'Propone aportar un monto a una meta de ahorro EXISTENTE. ANTES de llamar, SIEMPRE llama obtener_metas_ahorro para conseguir el id_meta exacto — NUNCA inventes el ID. La acción NO se ejecuta hasta que el usuario confirme en la UI.',
  proponer_crear_presupuesto: 'Propone crear un presupuesto mensual para una categoría. ANTES de llamar, llama obtener_presupuestos para verificar que la categoría no tenga ya un presupuesto. Requiere confirmación.',
  proponer_modificar_presupuesto: 'Propone cambiar el monto de un presupuesto existente. ANTES de llamar, llama obtener_presupuestos para conseguir el id_presupuesto exacto. Requiere confirmación.',
  proponer_toggle_recurrencia: 'Propone activar o desactivar un cargo recurrente. ANTES de llamar, llama obtener_recurrencias para conseguir el id_recurrencia exacto. Requiere confirmación.',
  proponer_crear_meta: 'Propone crear una NUEVA meta de ahorro (no para metas existentes). Requiere confirmación.',
};

function summarizeAction(name, params, ctx) {
  switch (name) {
    case 'proponer_aporte_meta': {
      const meta = ctx.metasById.get(params.id_meta);
      return `Aportar $${params.monto.toFixed(2)} a tu meta "${meta?.nombre_meta || params.id_meta}".`;
    }
    case 'proponer_crear_presupuesto': {
      const cat = ctx.categoriaNombres.get(params.id_categoria);
      return `Crear un presupuesto mensual de $${params.monto.toFixed(2)} para "${cat || params.id_categoria}".`;
    }
    case 'proponer_modificar_presupuesto': {
      const p = ctx.presupuestosById.get(params.id_presupuesto);
      const catName = p?.categoria?.nombre || ctx.categoriaNombres.get(p?.id_categoria) || 'una categoría';
      return `Cambiar el presupuesto de "${catName}" a $${params.monto_nuevo.toFixed(2)}.`;
    }
    case 'proponer_toggle_recurrencia': {
      const r = ctx.recurrenciasById.get(params.id_recurrencia);
      const verb = params.activo ? 'Reactivar' : 'Desactivar';
      return `${verb} el cargo recurrente "${r?.descripcion || params.id_recurrencia}".`;
    }
    case 'proponer_crear_meta': {
      const fecha = params.fecha_limite ? ` con fecha límite ${params.fecha_limite}` : '';
      return `Crear meta "${params.nombre}" por $${params.monto_objetivo.toFixed(2)}${fecha}.`;
    }
    default:
      return `Acción: ${name}`;
  }
}

function neededExtras(name, params) {
  // Tells the UI which fields it must collect from the user before confirming.
  const needs = [];
  if (name === 'proponer_aporte_meta' && params.id_tarjeta == null) needs.push('id_tarjeta');
  return needs;
}

function buildWriteTools(ctx, { send } = {}) {
  return {
    async proponer_aporte_meta(args) {
      return _emit('proponer_aporte_meta', args, ctx, send);
    },
    async proponer_crear_presupuesto(args) {
      return _emit('proponer_crear_presupuesto', args, ctx, send);
    },
    async proponer_modificar_presupuesto(args) {
      return _emit('proponer_modificar_presupuesto', args, ctx, send);
    },
    async proponer_toggle_recurrencia(args) {
      return _emit('proponer_toggle_recurrencia', args, ctx, send);
    },
    async proponer_crear_meta(args) {
      return _emit('proponer_crear_meta', args, ctx, send);
    },
  };
}

function _emit(actionName, params, ctx, send) {
  const summary_es = summarizeAction(actionName, params, ctx);
  const needs = neededExtras(actionName, params);
  const created = proposalStore.create({
    id_usuario: ctx.id_usuario,
    action: actionName,
    params,
    summary_es,
    needs,
  });
  if (!created.ok) {
    return { status: 'proposal_rejected', error: created.error, mensaje: created.mensaje };
  }
  const payload = {
    proposal_id: created.proposal_id,
    action: actionName,
    params,
    summary_es,
    needs,
    expires_at: new Date(created.expires_at).toISOString(),
  };
  send?.('action_proposal', payload);
  return { status: 'proposal_emitted', proposal_id: created.proposal_id, summary_es, needs };
}

module.exports = { buildWriteSchemas, buildWriteTools, WRITE_DESCRIPTIONS_ES, summarizeAction };
