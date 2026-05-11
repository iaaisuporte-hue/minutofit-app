import { useAuth } from "../../auth/AuthContext";
import AdminPeopleList from "./AdminPeopleList";

export default function AdminPersonalsPage() {
  const auth = useAuth();
  const canCreate = auth.hasPermission("admin.professionals.create");

  return (
    <AdminPeopleList
      role="personal"
      title="Personals"
      subtitle="Profissionais de educação física — capacidade operacional, carteira ativa e data de cadastro."
      detailBasePath="/app/admin/personals"
      showCreate={canCreate}
      createPath="/app/admin/personals/new"
      createLabel="Cadastrar personal"
    />
  );
}
