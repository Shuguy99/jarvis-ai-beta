"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { playSound } from "@/lib/sounds";

interface CalculatorWidgetProps {
  onClose?: () => void;
}

const MAX_DISPLAY = 18;

const buttons = [
  { label: "C", action: "clear" },
  { label: "±", action: "negate" },
  { label: "%", action: "percent" },
  { label: "÷", action: "op", value: "/" },
  { label: "7", action: "digit", value: "7" },
  { label: "8", action: "digit", value: "8" },
  { label: "9", action: "digit", value: "9" },
  { label: "×", action: "op", value: "*" },
  { label: "4", action: "digit", value: "4" },
  { label: "5", action: "digit", value: "5" },
  { label: "6", action: "digit", value: "6" },
  { label: "−", action: "op", value: "-" },
  { label: "1", action: "digit", value: "1" },
  { label: "2", action: "digit", value: "2" },
  { label: "3", action: "digit", value: "3" },
  { label: "+", action: "op", value: "+" },
  { label: "⌫", action: "backspace" },
  { label: "0", action: "digit", value: "0" },
  { label: ".", action: "decimal" },
  { label: "=", action: "equals" },
];

function truncate(str: string, max: number) {
  return str.length > max ? "…" + str.slice(str.length - max + 1) : str;
}

export function CalculatorWidget({ onClose }: CalculatorWidgetProps) {
  const [expression, setExpression] = useState("");
  const [current, setCurrent] = useState("0");
  const [prevExpr, setPrevExpr] = useState("");
  const [justEvaluated, setJustEvaluated] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleButton = useCallback(
    (action: string, value?: string) => {
      playSound("click");

      switch (action) {
        case "digit": {
          if (justEvaluated) {
            setCurrent(value!);
            setExpression("");
            setJustEvaluated(false);
          } else if (current === "0") {
            setCurrent(value!);
          } else if (current.replace(/[^0-9]/g, "").length < 15) {
            setCurrent((c) => c + value);
          }
          break;
        }
        case "decimal": {
          if (justEvaluated) {
            setCurrent("0.");
            setExpression("");
            setJustEvaluated(false);
          } else if (!current.includes(".")) {
            setCurrent((c) => (c === "" || c === "0" ? "0." : c + "."));
          }
          break;
        }
        case "op": {
          setExpression((e) =>
            justEvaluated
              ? current + " " + value
              : e === ""
              ? current + " " + value
              : e + " " + current + " " + value
          );
          setCurrent("0");
          setJustEvaluated(false);
          break;
        }
        case "equals": {
          const fullExpr = expression === "" ? current : expression + " " + current;
          try {
            const sanitized = fullExpr.replace(/[^0-9+\-*/.() ]/g, "");
            const result = Function('"use strict"; return (' + sanitized + ")")();
            if (typeof result === "number" && isFinite(result)) {
              const formatted =
                Number.isInteger(result) ? String(result) : parseFloat(result.toPrecision(12)).toString();
              setPrevExpr(fullExpr + " = " + formatted);
              setCurrent(formatted);
              setExpression("");
              setJustEvaluated(true);
            }
          } catch {
            setCurrent("Error");
            setExpression("");
            setJustEvaluated(true);
          }
          break;
        }
        case "clear":
          setExpression("");
          setCurrent("0");
          setPrevExpr("");
          setJustEvaluated(false);
          break;
        case "negate":
          if (current !== "0" && current !== "Error") {
            setCurrent((c) => (c.startsWith("-") ? c.slice(1) : "-" + c));
          }
          break;
        case "percent":
          setCurrent((c) => {
            const n = parseFloat(c);
            return isNaN(n) ? c : String(n / 100);
          });
          break;
        case "backspace":
          if (!justEvaluated) {
            setCurrent((c) => (c.length <= 1 || (c.length === 2 && c.startsWith("-")) ? "0" : c.slice(0, -1)));
          }
          break;
      }
    },
    [current, expression, justEvaluated]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!containerRef.current?.contains(document.activeElement)) return;
      const key = e.key;
      if (key >= "0" && key <= "9") handleButton("digit", key);
      else if (key === ".") handleButton("decimal");
      else if (key === "+") handleButton("op", "+");
      else if (key === "-") handleButton("op", "-");
      else if (key === "*") handleButton("op", "*");
      else if (key === "/") { e.preventDefault(); handleButton("op", "/"); }
      else if (key === "Enter" || key === "=") handleButton("equals");
      else if (key === "Backspace") handleButton("backspace");
      else if (key === "Escape" || key === "c" || key === "C") handleButton("clear");
      else if (key === "%") handleButton("percent");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleButton]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="relative rounded-xl border jarvis-border-cyan bg-card/95 backdrop-blur-xl p-4 w-72 outline-none"
    >
      {onClose && (
        <button
          onClick={() => { playSound("click"); onClose(); }}
          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded border jarvis-border-cyan/50 bg-muted/20 text-foreground/60 hover:text-primary transition text-xs"
          aria-label="Закрыть"
        >
          ✕
        </button>
      )}

      <div className="rounded-lg border jarvis-border-cyan bg-muted/30 p-3 font-mono text-right mb-3 min-h-[4.5rem] flex flex-col justify-end">
        {prevExpr && (
          <div className="text-[10px] text-foreground/40 mb-1 truncate">{prevExpr}</div>
        )}
        {expression && (
          <div className="text-xs text-foreground/50 mb-1 truncate">{expression}</div>
        )}
        <div className="text-xl text-foreground leading-tight break-all">
          {truncate(current, MAX_DISPLAY)}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {buttons.map((btn) => {
          const isOp = btn.action === "op";
          const isEquals = btn.action === "equals";
          return (
            <button
              key={btn.label}
              onClick={() => handleButton(btn.action, btn.value)}
              className={
                "rounded-lg border jarvis-border-cyan/50 bg-muted/20 font-mono text-sm text-foreground/90 transition hover:bg-primary/15 hover:text-primary hover:jarvis-box-glow active:scale-95 h-12" +
                (isOp ? " bg-primary/10 text-primary" : "") +
                (isEquals ? " bg-primary/20 text-primary font-bold" : "")
              }
            >
              {btn.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}