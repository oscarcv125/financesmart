# 🌟 Sofia Seed - Datos Ficticios para Demostración

Este script crea un usuario completo con todos los datos financieros del storytelling para demostrar todas las características del chatbot de FinanceSmart.

## 📋 Qué Se Crea

### Usuario: Sofia
- **Email**: `sofia.freelancer@gmail.com` (personalizable)
- **Edad**: 28 años
- **Profesión**: Freelancer

### Datos Financieros

#### 💰 Ingresos (Mes Actual)
- 2x $25,000 (quincenas)
- $3,500 (freelance front-end)
- **Total**: $53,500

#### 💳 Tarjetas
- Visa 4512 (Crédito)
- Santander Premium (Débito)

#### 📊 Gastos Mes Actual ($8,350 total - SOBRE PRESUPUESTO)
- Restaurantes: $3,100 (fue $2,400 mes pasado) ⚠️
- Transporte: $2,200 (fue $1,800 mes pasado) ⚠️
- Entretenimiento: $1,400 (fue $1,100 mes pasado) ⚠️
- Otros: $650

#### 📊 Gastos Mes Anterior ($7,200 total)
- Restaurantes: $2,400
- Transporte: $1,800
- Entretenimiento: $1,100
- Supermercado: $1,500

#### 🎯 Metas de Ahorro
1. **Viaje a Cancun** - $25,000 objetivo, $5,000 progreso (20%) ⏰ 9 meses
2. **Laptop Nueva** - $15,000 objetivo, $3,200 progreso (21%) ⏰ 6 meses
3. **Fondo de Emergencia** - $50,000 objetivo, $8,500 progreso (17%) ⏰ 12 meses

#### 📈 Presupuestos
- Restaurantes: $2,500 (¡EXCEDIDO! gasta $3,100)
- Transporte: $2,500
- Supermercado: $2,000
- Entretenimiento: $1,500

#### 📅 Suscripciones Recurrentes
- Netflix: $139/mes
- Spotify: $12/mes
- Gym Club: $99/mes
- Adobe Creative Cloud: $39/mes
- **Total**: $289/mes = $3,468/año

## 🚀 Cómo Usar

### Opción 1: Usar Email Existente (Recomendado)

1. **Registra el usuario en la app primero**
   ```bash
   # Abre la app y regístrate con el email deseado
   # Por ejemplo: sofia.freelancer@gmail.com
   ```

2. **Ejecuta el script**
   ```bash
   cd backend
   node scripts/seed-sofia.js sofia.freelancer@gmail.com
   ```

3. **Verifica los datos**
   - Abre la app
   - Inicia sesión con el mismo email
   - ¡Deberías ver todos los datos de Sofia!

### Opción 2: Email Por Defecto

```bash
cd backend
node scripts/seed-sofia.js
```

Esto usará `sofia.freelancer@gmail.com` por defecto.

## 📱 Qué Verás en la App

### FAB Badge (Health Score)
- Mostará aprox. 45/100 (Necesita atención) 🔴
- Razón: Gastos altos, poco progreso en metas

### Insights (💡 Badge)
Al abrir el chat, verás:
1. 🚨 **ALTO**: "Excediste presupuesto en Restaurantes"
   - Gastaste $3,100 de $2,500 (124%)
2. ⚠️ **MEDIO**: "Gasto elevado en Transporte"
   - +73% vs mes pasado ($320 más)
3. ⚠️ **MEDIO**: "Cargos recurrentes próximos"
   - $289 en suscripciones mensuales
4. 💭 **BAJO**: "Tendencia positiva YoY"
   - +8% ahorro año contra año

### Gráficos Disponibles

Cuando interactúes con el chatbot en Modo Coach:

1. **Pie Chart** - "¿En qué puedo ahorrar más?"
   - Top 5 categorías de gasto
   - Visualiza restaurantes, transporte, entretenimiento

2. **Comparison Chart** - "¿Cómo comparo con mes pasado?"
   - Lado a lado: Mes pasado vs Este mes
   - Muestra cambios porcentuales

3. **Goal Acceleration Simulator** - "¿Cuándo llego a $25K?"
   - Slider interactivo: $500-$5,000/mes
   - Muestra: 9 meses con $2,500/mes
   - Progreso de meta: 20% → 60%

4. **Compound Savings Simulator** - "¿Qué pasa si invierto?"
   - $3,000/mes × 10 años × 8% = $509,471
   - Gráfica de crecimiento exponencial

5. **Subscription Audit** - "¿Cuáles son mis recurrencias?"
   - Netflix $139
   - Spotify $12
   - Gym $99
   - Adobe $39
   - Total: $289/mes, $3,468/año

6. **Streak** - "¿He hecho progreso?"
   - Mostrará rachas de días bajo presupuesto
   - Récords de comportamiento positivo

### Action Chips
Aparecerán cuando sugieras aportes:
- 💰 Aportar a Viaje Cancun
- 💰 Aportar a Laptop
- Con selector de tarjeta si hay múltiples

## 🔧 Personalización

Puedes editar el archivo `seed-sofia.js` para cambiar:

```javascript
// Línea 90-100: Cambiar ingresos
movs.push({
  monto: 25000,  // Cambiar a otro monto
  descripcion: 'Quincena',
  fecha: ymd(new Date(thisYear, thisMonth, 1)),
});

// Línea 118-145: Cambiar gastos mes pasado
lastMonthExpenses.forEach(exp => {
  // Ajusta amounts y descriptions
});

// Línea 147-176: Cambiar gastos mes actual
thisMonthExpenses.forEach(exp => {
  // Ajusta amounts y descriptions
});

// Línea 179-191: Cambiar metas
const metasSeed = [
  {
    nombre_meta: 'Tu Meta',
    monto_objetivo: 10000,
    progreso: 3000,
    fecha_limite: ymd(new Date(...)),
  },
];
```

## 🗑️ Limpiar Datos (Empezar de Nuevo)

El script automáticamente limpia datos anteriores de Sofia. Si quieres hacerlo manualmente:

```bash
# En la base de datos Supabase, elimina:
DELETE FROM recurrencia WHERE id_usuario = 'sofia-user-id';
DELETE FROM presupuesto WHERE id_usuario = 'sofia-user-id';
DELETE FROM ahorro_meta WHERE id_usuario = 'sofia-user-id';
DELETE FROM movimiento_financiero WHERE id_usuario = 'sofia-user-id';
DELETE FROM tarjeta WHERE id_usuario = 'sofia-user-id';
```

## ✅ Checklist para la Demostración

Después de correr el seed:

- [ ] Abre la app con sofia.freelancer@gmail.com
- [ ] Verifica que el Health Score es ~45 (rojo)
- [ ] Abre el chat
- [ ] Acepta el disclaimer
- [ ] Mira los 4 insights en el modal
- [ ] Pregunta: "¿En qué puedo ahorrar más?"
  - ✅ Verás Pie Chart
  - ✅ Verás Action Chips para aportar
- [ ] Pregunta: "¿Cómo comparo con mes pasado?"
  - ✅ Verás Comparison Chart
- [ ] Pregunta: "¿Cuándo llego a $25K?"
  - ✅ Verás Goal Acceleration Simulator
  - ✅ Verás que 9 meses con $2,500/mes es lo ideal
- [ ] Pregunta: "¿Cuáles son mis suscripciones?"
  - ✅ Verás Subscription Audit con $3,468/año
- [ ] Pregunta: "¿He hecho progreso?"
  - ✅ Verás Streak (racha de días bajo presupuesto)
- [ ] Prueba hacer un aporte con Action Chip
  - ✅ Verás confirmación y actualización de meta

## 📞 Troubleshooting

### Error: "No user found with email..."
**Solución**: Debes crear la cuenta primero en la app. Abre FinanceSmart, regístrate con el email, luego corre el script.

### Error de conexión a Supabase
**Solución**: Verifica que:
- `.env` está configurado correctamente
- `SUPABASE_URL` y `SUPABASE_KEY` son válidos
- Tienes conexión a internet

### Los datos no aparecen en la app
**Solución**:
- Cierra y abre la app nuevamente
- Limpia el cache del navegador (Ctrl+Shift+Delete)
- Verifica en Supabase que los datos se insertaron correctamente

### Las gráficas no aparecen al chatear
**Solución**: El chatbot genera gráficas según el contexto. Intenta preguntas específicas:
- "¿En qué puedo ahorrar más?" → Pie Chart
- "¿Cómo comparo con mes pasado?" → Comparison Chart
- "¿Cuándo llego a mis metas?" → Simulator

---

## 📊 Datos de Referencia para el Storytelling

Todo coincide con el documento `FinanceSmart_Storytelling_ES.html`:

| Métrica | Mes Pasado | Este Mes | Cambio |
|---------|-----------|----------|--------|
| Restaurantes | $2,400 | $3,100 | ▲ 29% |
| Transporte | $1,800 | $2,200 | ▲ 22% |
| Entretenimiento | $1,100 | $1,400 | ▲ 27% |
| Supermercado | $1,500 | - | - |
| **Total** | **$7,200** | **$8,350** | **▲ 16%** |

Health Score: 45 → proyectado 72 en 3 meses (cuando se implementen cambios)

---

¡Listo! Ahora tienes un usuario completamente configurado con datos realistas para demostrar todas las características del chatbot de FinanceSmart. 🚀
