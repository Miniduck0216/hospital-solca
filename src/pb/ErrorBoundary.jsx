import { Component } from 'react'

// si el 3D falla, la página vuelve a la vista 2D (onError). Si lo que no se pudo bajar es un trozo de la página
// (tras una publicación, el archivo viejo ya no existe), se recarga una sola vez: la marca en sessionStorage evita el bucle
const CLAVE_RECARGA = 'solca-recarga-trozo'
const DE_CARGA = /Failed to fetch dynamically imported module|Importing a module script failed/

export class ErrorBoundary extends Component {
  state = { fallo: false }
  static getDerivedStateFromError() { return { fallo: true } }
  componentDidCatch(error) {
    if (DE_CARGA.test(error?.message || '')) {
      try {
        if (!sessionStorage.getItem(CLAVE_RECARGA)) { sessionStorage.setItem(CLAVE_RECARGA, '1'); location.reload(); return }
      } catch { /* sin almacenamiento: no se recarga */ }
    }
    this.props.onError?.(error)
  }
  render() { return this.state.fallo ? null : this.props.children }
}
