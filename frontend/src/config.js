// Determina la URL del backend automáticamente basada en el origin
// En desarrollo: http://localhost:5173 -> http://localhost:10000 (Render backend)
// En producción: https://financesmart1.vercel.app -> https://financesmart1.onrender.com (Render backend)
export const BACKEND_URL = (() => {
  if (typeof window === 'undefined') return '/api';
  
  const origin = window.location.origin;
  
  // Si está en Vercel (vercel.app), usar el backend en Render
  if (origin.includes('vercel.app')) {
    return 'https://financesmart1.onrender.com';
  }
  
  // Si está en localhost, usar el backend local en Render (desarrollo)
  if (origin.includes('localhost')) {
    return 'http://localhost:10000';
  }
  
  // En otros casos, asumir que están en el mismo host
  return origin;
})();