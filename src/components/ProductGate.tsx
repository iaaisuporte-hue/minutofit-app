import { type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";

interface Props {
  productKey: string;
  /** Renderizado quando o usuário não tem o produto. Padrão: null. */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Renderiza `children` apenas se o usuário possuir o produto ativo.
 * Admin (MetaCore) sempre passa.
 *
 * Uso:
 *   <ProductGate productKey="personal">
 *     <PersonalDashboard />
 *   </ProductGate>
 */
export function ProductGate({ productKey, fallback = null, children }: Props) {
  const { hasProduct } = useAuth();
  return hasProduct(productKey) ? <>{children}</> : <>{fallback}</>;
}
