export const LOCATION_ACK_KEY = "corefit:tracker:locationDisclosureAck";

export function hasLocationAck(): boolean {
  try {
    return localStorage.getItem(LOCATION_ACK_KEY) === "1";
  } catch {
    return false;
  }
}

export function setLocationAck() {
  try {
    localStorage.setItem(LOCATION_ACK_KEY, "1");
  } catch {
    /* modo privado — o aviso reaparece na próxima sessão, o que é aceitável */
  }
}
