import { useEffect, useState } from "react";

function getMatches(maxWidth: number) {
  if (typeof window === "undefined") return false;
  return window.innerWidth <= maxWidth;
}

export function useIsMobile(maxWidth = 768) {
  const [isMobile, setIsMobile] = useState(() => getMatches(maxWidth));

  useEffect(() => {
    function handleResize() {
      setIsMobile(getMatches(maxWidth));
    }

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [maxWidth]);

  return isMobile;
}
