import React from "react";
import { useAuth } from "../auth/AuthContext";

export default function NutriApp() {
  const auth = useAuth();

  return (
    <div style={{ padding: 16 }}>
      <h1>Área do Nutricionista</h1>
      <p>Pacientes • Planos alimentares • Avaliações</p>
      <button onClick={auth.logout}>Sair</button>
    </div>
  );
}