import { useState, useEffect } from "react";

export function useMobileSidebar() {
  const [isMobile, setIsMobile] = useState(false);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  useEffect(() => {
    function check() {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setLeftOpen(false);
        setRightOpen(false);
      }
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const toggleLeft = () => {
    setLeftOpen(prev => !prev);
    setRightOpen(false);
  };

  const toggleRight = () => {
    setRightOpen(prev => !prev);
    setLeftOpen(false);
  };

  const closeAll = () => {
    setLeftOpen(false);
    setRightOpen(false);
  };

  return { isMobile, leftOpen, rightOpen, toggleLeft, toggleRight, closeAll };
}