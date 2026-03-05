import { useParams } from "react-router-dom";

export default function AdminPersonalDetailsPage() {
  const { personalId } = useParams();

  return (
    <div>
      <h2>Detalhes do personal (Admin)</h2>
      <p>ID: {personalId}</p>
      <p>Placeholder: alunos vinculados, treinos criados, uploads, permissões ADM, etc.</p>
    </div>
  );
}