import { useAuth } from "../../auth/AuthContext";
import AdminPeopleList from "./AdminPeopleList";

export default function AdminNutrisPage() {
  const auth = useAuth();
  const canCreate = auth.hasPermission("admin.professionals.create");

  return (
    <AdminPeopleList
      role="nutri"
      title="Nutricionistas"
      subtitle="Profissionais de nutrição — disponibilidade, carteira ativa e foco clínico."
      detailBasePath="/app/admin/nutris"
      showCreate={canCreate}
      createPath="/app/admin/nutris/new"
      createLabel="Cadastrar nutri"
    />
  );
}
