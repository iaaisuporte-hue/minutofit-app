import { useNavigate, useParams } from "react-router-dom";
import StudentProfileModal from "./StudentProfileModal";

export default function StudentProfilePage() {
  const { studentId } = useParams();
  const navigate = useNavigate();

  if (!studentId) {
    return null;
  }

  return (
    <div className="pp-page">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => navigate("/app/personal/students")}>
          Voltar
        </button>
        <span className="pp-kicker">Perfil do aluno</span>
      </div>
      <StudentProfileModal
        studentId={studentId}
        studentName="Aluno"
        variant="inline"
        onClose={() => navigate(-1)}
      />
    </div>
  );
}
