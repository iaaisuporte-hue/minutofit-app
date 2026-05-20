import StudentTechnicalNotes, { type TechnicalNoteHighlight } from "../StudentTechnicalNotes";

type Props = {
  studentId: string;
  highlights: TechnicalNoteHighlight[];
  onSaved: () => void;
};

export function CockpitTabTechnical({ studentId, highlights, onSaved }: Props) {
  return (
    <StudentTechnicalNotes
      studentId={studentId}
      highlights={highlights}
      onSaved={onSaved}
    />
  );
}
