// Cambios del editor sobre la configuración de un piso ({ ambientes, lugares, pasos }), sin tocar la original.
// Los usa el panel de administración (App.jsx) y se prueban en tests/eliminar.test.js.

// cambia campos de un ambiente; un campo en undefined se quita (así «Restaurar» o «Según la categoría» no dejan
// la marca vacía en lo que se manda a OM3)
export function cambiarAmbiente(cp, id, patch) {
  const v = { ...(cp.ambientes?.[id] || {}), ...patch }
  for (const k of Object.keys(v)) if (v[k] === undefined) delete v[k]
  return { ...cp, ambientes: { ...cp.ambientes, [id]: v } }
}

// eliminar un ambiente: el cuarto es del plano y no se puede borrar; queda marcado (sin nombre, sin letrero, no es
// destino) y conserva sus datos para poder restaurarlo
export const eliminarAmbiente = (cp, id) => cambiarAmbiente(cp, id, { eliminado: true })
export const restaurarAmbiente = (cp, id) => cambiarAmbiente(cp, id, { eliminado: undefined })
export const estaEliminado = (cp, id) => cp?.ambientes?.[id]?.eliminado === true

// eliminar un lugar nuevo: sale de la lista (en OM3, la fila pasa a ESTADO_ID 4 al guardar)
export const eliminarLugar = (cp, id) => ({ ...cp, lugares: (cp.lugares || []).filter((x) => x.id !== id) })
