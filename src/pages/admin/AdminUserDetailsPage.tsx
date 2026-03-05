import { useParams } from "react-router-dom";

export default function AdminUserDetailsPage() {
  const { userId } = useParams();

  return (
    <div>
      <h2>Detalhes do aluno (Admin)</h2>
      <p>ID: {userId}</p>
      <p>Placeholder: ver treinos, plano, pagamentos, histórico, etc.</p>
      <p><b>Segurança:</b> senha nunca aparece aqui (nem existe no front).</p>
    </div>
  );
}