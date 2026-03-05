import { Link } from "react-router-dom";

export default function AdminUsersPage() {
  const users = [
    { id: "1", name: "João Silva", plan: "basic" },
    { id: "2", name: "Maria Souza", plan: "black" },
  ];

  return (
    <div>
      <h2>Alunos (Admin)</h2>
      <p>Placeholder: lista completa de alunos, busca, filtro por plano, status, etc.</p>

      <ul>
        {users.map((u) => (
          <li key={u.id}>
            <Link to={`/app/admin/users/${u.id}`}>{u.name}</Link> — plano: {u.plan}
          </li>
        ))}
      </ul>
    </div>
  );
}