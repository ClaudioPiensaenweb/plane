"use client";

import { FC, useCallback, useEffect, useRef, useState } from "react";
import { Play, Square } from "lucide-react";
// plane imports
import { cn } from "@plane/utils";

/**
 * Cronómetro de Piensaenweb.
 *
 * Plane no trae registro de tiempo en la edición libre, y el nuestro no puede
 * depender de una licencia: es el único dato que no se puede reconstruir.
 * Por eso el tiempo vive en nuestro orquestador y esto solo lo enseña.
 *
 * Va en la fila de la lista, no dentro de la tarea: en el triaje diario se
 * arranca sin abrir nada. Es la diferencia entre registrar el tiempo y tener
 * que acordarse de registrarlo.
 */

const API = process.env.NEXT_PUBLIC_PIENSA_API ?? "";

type Props = {
  referencia: string; // SOP-12
  tareaId?: string;
  personaId?: string;
  compacto?: boolean;
};

const reloj = (segundos: number) => {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = Math.floor(segundos % 60);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
};

export const Cronometro: FC<Props> = (props) => {
  const { referencia, tareaId, personaId, compacto } = props;
  const [contando, setContando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [total, setTotal] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const tic = useRef<ReturnType<typeof setInterval> | null>(null);

  const leerEstado = useCallback(async () => {
    if (!personaId || !API) return;
    try {
      const r = await fetch(
        `${API}/api/tiempo/estado?ref=${encodeURIComponent(referencia)}&persona=${personaId}`
      );
      if (!r.ok) return;
      const d = await r.json();
      setContando(d.contando);
      setSegundos(d.segundos ?? 0);
      setTotal(d.total ?? 0);
    } catch {
      // Si el orquestador no responde, el cronómetro se queda quieto. Nunca
      // inventamos un estado: un contador que miente es peor que uno parado.
    }
  }, [referencia, personaId]);

  useEffect(() => {
    leerEstado();
  }, [leerEstado]);

  // El reloj corre en el navegador. Preguntar al servidor cada segundo sería
  // castigarlo para enseñar exactamente lo mismo.
  useEffect(() => {
    if (tic.current) clearInterval(tic.current);
    if (contando) tic.current = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => {
      if (tic.current) clearInterval(tic.current);
    };
  }, [contando]);

  const alternar = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!personaId || !API || ocupado) return;
    setOcupado(true);
    // Optimista: la interfaz responde ya y se corrige si el servidor dice otra cosa.
    setContando((c) => !c);
    setSegundos(0);
    try {
      const r = await fetch(`${API}/api/tiempo/alternar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: referencia, persona: personaId, tarea: tareaId }),
      });
      const d = await r.json();
      setContando(!!d.contando);
      setSegundos(d.contando ? (d.segundos ?? 0) : 0);
      setTotal(d.total ?? total);
    } catch {
      leerEstado();
    } finally {
      setOcupado(false);
    }
  };

  const etiqueta = contando ? reloj(segundos) : total > 0 ? reloj(total) : compacto ? "" : "00:00:00";

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={!personaId}
      title={
        contando
          ? "Parar el cronómetro"
          : total > 0
            ? `Lleva ${Math.round(total / 60)} min. Pulsa para seguir contando`
            : "Empezar a contar"
      }
      className={cn(
        "flex h-6 shrink-0 items-center gap-1.5 rounded px-1.5 transition-colors",
        contando ? "bg-danger-subtle" : "hover:bg-layer-transparent-hover",
        ocupado && "opacity-60"
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded-full",
          contando ? "bg-danger-primary text-white" : "text-tertiary"
        )}
      >
        {contando ? <Square className="h-2 w-2 fill-current" /> : <Play className="h-2.5 w-2.5 fill-current" />}
      </span>
      {etiqueta && (
        <span
          className={cn(
            "text-11 tabular-nums",
            contando ? "font-medium text-danger-primary" : "text-tertiary"
          )}
        >
          {etiqueta}
        </span>
      )}
    </button>
  );
};
