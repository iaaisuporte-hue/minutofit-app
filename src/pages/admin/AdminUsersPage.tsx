import AdminPeopleList from "./AdminPeopleList";

export default function AdminUsersPage() {
  return (
    <AdminPeopleList
      role="user"
      title="Alunos"
      subtitle="Quem está dentro da plataforma — plano ativo, identidade e data de entrada. Use a busca para investigar um caso específico."
      detailBasePath="/app/admin/users"
    />
  );
}
