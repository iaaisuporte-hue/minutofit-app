import AdminPeopleList from "./AdminPeopleList";

export default function AdminUsersPage() {
  return (
    <AdminPeopleList
      role="user"
      title="Alunos"
      subtitle="Base de alunos cadastrados — plano ativo, perfil e data de entrada. Busque por nome ou e-mail."
      detailBasePath="/app/admin/users"
    />
  );
}
