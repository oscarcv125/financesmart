const { z } = require('zod');

const STRIP_KEYS = new Set([
  '$schema',
  'additionalProperties',
  'patternProperties',
  'propertyNames', // from z.record() — Gemini's OpenAPI subset rejects it
  'definitions',
  '$defs',
  'default',
  'exclusiveMinimum',
  'exclusiveMaximum',
]);

// Gemini's OpenAPI subset uses `enum: [...]` instead of JSON Schema's `const: x`,
// and `oneOf`/`anyOf` aren't supported on the response schema (we have to flatten
// discriminated unions). Helpers below handle both.

function flattenOneOf(node) {
  // If we encounter a oneOf/anyOf of object schemas that share a discriminator,
  // collapse to a single object whose discriminator is an enum and whose other
  // properties are unioned (additive). This loses some strictness but Gemini
  // can't enforce discriminated unions at the schema level anyway.
  if (!node || typeof node !== 'object') return node;
  const variants = node.oneOf || node.anyOf;
  if (!Array.isArray(variants) || variants.length === 0) return node;
  const allObjects = variants.every(v => v && v.type === 'object' && v.properties);
  if (!allObjects) return node;

  const merged = { type: 'object', properties: {}, required: [] };
  const requiredCount = {};
  for (const v of variants) {
    for (const [k, vv] of Object.entries(v.properties)) {
      if (!merged.properties[k]) {
        merged.properties[k] = vv;
      } else {
        // Merge enums if both sides are enums on the same key (typical discriminator).
        const a = merged.properties[k];
        if (a.enum && vv.enum) {
          merged.properties[k] = { ...a, enum: Array.from(new Set([...a.enum, ...vv.enum])) };
        }
      }
    }
    for (const r of (v.required || [])) requiredCount[r] = (requiredCount[r] || 0) + 1;
  }
  // Only mark as required the keys that ALL variants required.
  merged.required = Object.entries(requiredCount).filter(([, n]) => n === variants.length).map(([k]) => k);
  if (merged.required.length === 0) delete merged.required;
  return merged;
}

function strip(node) {
  if (Array.isArray(node)) return node.map(strip);
  if (node && typeof node === 'object') {
    // Convert { const: x } → { enum: [x] } so Gemini accepts it.
    if (Object.prototype.hasOwnProperty.call(node, 'const')) {
      const { const: c, ...rest } = node;
      return strip({ ...rest, enum: [c] });
    }
    // Flatten oneOf/anyOf of object variants.
    if (node.oneOf || node.anyOf) {
      return strip(flattenOneOf(node));
    }
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (STRIP_KEYS.has(k)) continue;
      if (k === '$ref') continue;
      out[k] = strip(v);
    }
    return out;
  }
  return node;
}

function inlineRefs(node, defs) {
  if (Array.isArray(node)) return node.map(n => inlineRefs(n, defs));
  if (node && typeof node === 'object') {
    if (node.$ref && typeof node.$ref === 'string') {
      const refName = node.$ref.split('/').pop();
      if (defs && defs[refName]) {
        return inlineRefs(defs[refName], defs);
      }
    }
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = inlineRefs(v, defs);
    }
    return out;
  }
  return node;
}

function zodToGeminiSchema(zodSchema) {
  const json = z.toJSONSchema(zodSchema, { target: 'draft-7' });
  const defs = json.$defs || json.definitions;
  const inlined = inlineRefs(json, defs);
  return strip(inlined);
}

module.exports = { zodToGeminiSchema };
