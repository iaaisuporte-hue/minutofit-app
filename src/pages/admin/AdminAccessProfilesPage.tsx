import { useMemo, useState } from "react";
import {
  ACCESS_PROFILE_META,
  ACCESS_PROFILE_ORDER,
  APP_PERMISSION_META,
  APP_PERMISSION_ORDER,
  getProfilePermissions,
  type AccessProfile,
  type AppPermission,
} from "../../auth/accessControl";

const COLORS = {
  border: "rgba(124,255,107,.16)",
  borderStrong: "rgba(29,185,84,.34)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.72)",
  panel: "linear-gradient(180deg, rgba(22,25,22,.92), rgba(15,18,16,.96))",
  panelDeep: "linear-gradient(135deg, rgba(15,61,46,.94), rgba(15,24,20,.98))",
  panelSoft: "rgba(255,255,255,.04)",
  primarySoft: "rgba(29,185,84,.18)",
  lime: "#7CFF6B",
};

export default function AdminAccessProfilesPage() {
  const [selectedProfile, setSelectedProfile] = useState<AccessProfile>("admin_owner");
  const [draftPermissions, setDraftPermissions] = useState<Record<AccessProfile, AppPermission[]>>(() => {
    const initial = {} as Record<AccessProfile, AppPermission[]>;
    ACCESS_PROFILE_ORDER.forEach((profile) => {
      initial[profile] = [...getProfilePermissions(profile)];
    });
    return initial;
  });

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, AppPermission[]>();
    APP_PERMISSION_ORDER.forEach((permission) => {
      const group = APP_PERMISSION_META[permission].group;
      const current = groups.get(group) ?? [];
      current.push(permission);
      groups.set(group, current);
    });
    return Array.from(groups.entries());
  }, []);

  function togglePermission(profile: AccessProfile, permission: AppPermission) {
    setDraftPermissions((prev) => {
      const current = prev[profile] ?? [];
      const has = current.includes(permission);
      return {
        ...prev,
        [profile]: has ? current.filter((item) => item !== permission) : [...current, permission],
      };
    });
  }

  function resetProfile(profile: AccessProfile) {
    setDraftPermissions((prev) => ({
      ...prev,
      [profile]: [...getProfilePermissions(profile)],
    }));
  }

  return (
    <div style={{ display: "grid", gap: 16, color: COLORS.text }}>
      <div
        style={{
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: 20,
          background: COLORS.panelDeep,
          boxShadow: "0 18px 44px rgba(0,0,0,.45)",
          padding: 18,
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 1000 }}>Gerência dos perfis</div>
        <div style={{ color: COLORS.muted, lineHeight: 1.6, maxWidth: 860 }}>
          Esta tela deixa pronta a matriz de perfis e permissões. Você pode usar esse painel para decidir depois quem terá acesso a cada página, ação ou bloco do admin.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: 14, alignItems: "start" }}>
        <div
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 20,
            background: COLORS.panel,
            boxShadow: "0 18px 44px rgba(0,0,0,.45)",
            padding: 16,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 1000 }}>Perfis disponíveis</div>
          {ACCESS_PROFILE_ORDER.map((profile) => {
            const meta = ACCESS_PROFILE_META[profile];
            const active = selectedProfile === profile;
            return (
              <button
                key={profile}
                type="button"
                onClick={() => setSelectedProfile(profile)}
                style={{
                  textAlign: "left",
                  padding: 14,
                  borderRadius: 16,
                  border: active ? `1px solid ${COLORS.borderStrong}` : `1px solid ${COLORS.border}`,
                  background: active ? COLORS.primarySoft : COLORS.panelSoft,
                  color: COLORS.text,
                  cursor: "pointer",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: 1000 }}>{meta.label}</div>
                <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>{meta.description}</div>
              </button>
            );
          })}
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: 20,
              background: COLORS.panel,
              boxShadow: "0 18px 44px rgba(0,0,0,.45)",
              padding: 18,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 22, fontWeight: 1000 }}>{ACCESS_PROFILE_META[selectedProfile].label}</div>
                <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>{ACCESS_PROFILE_META[selectedProfile].description}</div>
              </div>
              <button
                type="button"
                onClick={() => resetProfile(selectedProfile)}
                style={{
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.panelSoft,
                  color: COLORS.text,
                  fontWeight: 1000,
                  cursor: "pointer",
                }}
              >
                Restaurar perfil base
              </button>
            </div>
          </div>

          {groupedPermissions.map(([group, permissions]) => (
            <div
              key={group}
              style={{
                border: `1px solid ${COLORS.border}`,
                borderRadius: 20,
                background: COLORS.panel,
                boxShadow: "0 18px 44px rgba(0,0,0,.45)",
                padding: 18,
                display: "grid",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 1000 }}>{group}</div>
              <div style={{ display: "grid", gap: 10 }}>
                {permissions.map((permission) => {
                  const checked = draftPermissions[selectedProfile]?.includes(permission);
                  return (
                    <label
                      key={permission}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "22px minmax(0, 1fr)",
                        gap: 12,
                        alignItems: "start",
                        borderRadius: 16,
                        border: `1px solid ${checked ? COLORS.borderStrong : COLORS.border}`,
                        background: checked ? COLORS.primarySoft : COLORS.panelSoft,
                        padding: 14,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!checked}
                        onChange={() => togglePermission(selectedProfile, permission)}
                        style={{ marginTop: 2 }}
                      />
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontWeight: 1000 }}>{APP_PERMISSION_META[permission].label}</div>
                        <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
                          {APP_PERMISSION_META[permission].description}
                        </div>
                        <div style={{ color: COLORS.lime, fontSize: 12, fontWeight: 900 }}>{permission}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          <div
            style={{
              borderRadius: 18,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.panel,
              boxShadow: "0 18px 44px rgba(0,0,0,.45)",
              padding: 16,
              color: COLORS.muted,
              lineHeight: 1.6,
            }}
          >
            Esta tela ainda trabalha com rascunho local no frontend. O próximo passo será salvar essas decisões no backend e associar cada usuário a um `accessProfile` ou a uma lista explícita de permissões.
          </div>
        </div>
      </div>
    </div>
  );
}
