import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Inversiones from "./pages/Inversiones";
import AnalisisFinanciero from "./pages/AnalisisFinanciero";
import Tarjetas from "./pages/Tarjetas";
import MetasAhorro from "./pages/MetasAhorro";
import Register from "./pages/Register";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/inversiones" element={<Inversiones />} />
            <Route path="/analisis" element={<AnalisisFinanciero />} />
            <Route path="/tarjetas" element={<Tarjetas />} />
            <Route path="/metas" element={<MetasAhorro />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;