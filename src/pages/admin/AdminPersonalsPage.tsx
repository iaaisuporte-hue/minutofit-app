import { Link } from "react-router-dom";

export default function AdminPersonalsPage() {
  const personals = [
    { id: "p1", name: "Personal A" },
    { id: "p2", name: "Personal B" },
  ];

  return (
    <div>
      <h2>Personais (Admin)</h2>
      <p>Placeholder: lista completa, cadastro, ativação, permissões, etc.</p>

      <ul>
        {personals.map((p) => (
          <li key={p.id}>
            <Link to={`/app/admin/personals/${p.id}`}>{p.name}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}