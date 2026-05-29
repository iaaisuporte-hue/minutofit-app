import { useState } from 'react';
import { ConfirmModal } from '../../team/ConfirmModal';
import { grantSportConsent } from '../services/sportApi';

interface Props {
  personalId: number;
  onAccept: () => void;
  onDecline: () => void;
}

export function SportConsentPromptModal({ personalId, onAccept, onDecline }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await grantSportConsent(personalId);
      onAccept();
    } catch {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-card)', padding: 'var(--space-6)', width: '100%', maxWidth: 440 }}>
        <ConfirmModal
          title="Compartilhar dados esportivos com seu personal?"
          description="Seu personal poderá ver sua prontidão para treino, fadiga acumulada e recovery gap. Você pode revogar a qualquer momento em Configurações > Privacidade."
          confirmLabel="Aceitar"
          cancelLabel="Agora não"
          loading={loading}
          onConfirm={handleConfirm}
          onCancel={onDecline}
        />
      </div>
    </div>
  );
}
