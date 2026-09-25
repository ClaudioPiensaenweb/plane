"use client";

import { useCallback, useEffect, useState } from "react";
import { observer } from "mobx-react";
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
// plane imports
import { cn } from "@plane/utils";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useUser } from "@/hooks/store/user";

/**
 * Fichajes de la tarea, uno a uno.
 *
 * El cronómetro de la fila dice cuánto lleva; esto dice de dónde sale, y deja
 * arreglarlo: corregir los minutos o la nota, añadir lo que se olvidó cronometrar
 * y anular lo que no toca. Anular no borra: el fichaje deja de sumar, se queda
 * tachado y se puede restaurar. Todo cambio pide motivo y acaba comentado en la
 * tarea, porque esto se factura y un número que cambia sin explicación no se
 * puede defender delante de un cliente.
 *
 * El tiempo vive en el orquestador, como el del cronómetro.
 */

const API = import.meta.env.VITE_PIENSA_API ?? "";

type Fichaje = {
  id: number;
  persona: string;
  inicio: number;
  fin: number | null;
  segundos: number | null;
  origen: string;
  nota: string | null;
  revisar: number;
  anulado: number;
};

type Props = { projectId: string; issueId: string; disabled?: boolean };

/** "90", "1:30", "1h30", "1h 30m", "2h" -> minutos. */
const aMinutos = (texto: string): number | null => {
  const t = texto.trim().toLowerCase().replace(",", ".");
  if (!t) return null;
  let m = t.match(/^(\d+):(\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = t.match(/^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m?(?:in)?)?$/);
  if (m && (m[1] || m[2])) return Math.round(Number(m[1] || 0) * 60 + Number(m[2] || 0));
  return null;
};

const duracion = (minutos: number) =>
  minutos >= 60 ? `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, "0")} min` : `${minutos} min`;

const fecha = (ts: number) =>
  new Date(ts * 1000).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const enviar = async (ruta: string, cuerpo: object) => {
  const r = await fetch(`${API}/api/tiempo/${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.detail || `el servidor respondió ${r.status}`);
  return d;
};

const campo =
  "h-7 rounded border border-subtle bg-surface-1 px-2 text-13 text-primary placeholder:text-placeholder focus:outline-none focus:border-accent-strong";
const boton = "h-7 rounded px-2.5 text-13 font-medium disabled:opacity-50";

type Edicion = {
  id: number | "nuevo";
  modo: "editar" | "anular" | "restaurar" | "nuevo";
  nota?: string;
  dia?: string;
};

/** El timestamp del fichaje como "2026-09-24", en hora local. */
const aDia = (ts: number) => {
  const d = new Date(ts * 1000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const FichajesDeLaTarea = observer(function FichajesDeLaTarea(props: Props) {
  const { projectId, issueId, disabled } = props;
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { getProjectIdentifierById } = useProject();
  const { getUserDetails } = useMember();
  const { data: usuarioActual } = useUser();

  const issue = getIssueById(issueId);
  const identificador = getProjectIdentifierById(projectId);
  const referencia = identificador && issue?.sequence_id ? `${identificador}-${issue.sequence_id}` : undefined;

  const [fichajes, setFichajes] = useState<Fichaje[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [minutos, setMinutos] = useState("");
  const [nota, setNota] = useState("");
  const [dia, setDia] = useState("");
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    if (!referencia || !API) return;
    try {
      const r = await fetch(`${API}/api/tiempo/detalle?ref=${encodeURIComponent(referencia)}`);
      if (!r.ok) throw new Error(`el servidor respondió ${r.status}`);
      const d = await r.json();
      setFichajes(d.fichajes ?? []);
    } catch (e) {
      // Sin datos no se enseña un cero: un "0 min" que miente es peor que un aviso.
      setError(`No he podido leer los fichajes: ${(e as Error).message}`);
    }
  }, [referencia]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!API || !referencia) return null;

  const nombre = (id: string) => {
    const u = getUserDetails(id);
    return u ? (u.first_name ? `${u.first_name} ${u.last_name ?? ""}`.trim() : u.display_name) : "otra persona";
  };

  const abrir = (e: Edicion, f?: Fichaje) => {
    const suDia = f ? aDia(f.fin ?? f.inicio) : aDia(Math.floor(Date.now() / 1000));
    setEdicion({ ...e, nota: f?.nota ?? "", dia: suDia });
    setError(null);
    setMotivo("");
    setMinutos(f && f.segundos != null ? String(Math.round(f.segundos / 60)) : "");
    setNota(f?.nota ?? "");
    setDia(suDia);
  };

  const cerrar = () => {
    setEdicion(null);
    setMinutos("");
    setNota("");
    setDia("");
    setMotivo("");
  };

  const guardar = async () => {
    if (!edicion || !usuarioActual?.id) return;
    const quien = usuarioActual.id;
    setOcupado(true);
    setError(null);
    try {
      if (edicion.modo === "nuevo") {
        const m = aMinutos(minutos);
        if (!m || m <= 0) throw new Error("escribe el tiempo: 45, 1:30 o 1h 30");
        await enviar("manual", {
          ref: referencia,
          persona: quien,
          minutos: m,
          nota: nota || null,
          tarea: issueId,
          cuando: dia || undefined,
        });
      } else if (edicion.modo === "editar") {
        const m = aMinutos(minutos);
        if (m == null) throw new Error("escribe el tiempo: 45, 1:30 o 1h 30");
        // La nota solo viaja si cambia: si no, contaria como un cambio que nadie hizo.
        await enviar("corregir", {
          id: edicion.id,
          persona: quien,
          minutos: m,
          nota: nota !== edicion.nota ? nota : undefined,
          // Igual que la nota: el día solo viaja si cambia.
          cuando: dia && dia !== edicion.dia ? dia : undefined,
          motivo,
        });
      } else {
        await enviar("anular", { id: edicion.id, persona: quien, motivo, restaurar: edicion.modo === "restaurar" });
      }
      cerrar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      // Se vuelve a leer siempre: lo que se enseña es lo que quedó, no lo que se pidió.
      await cargar();
      setOcupado(false);
    }
  };

  const validos = (fichajes ?? []).filter((f) => f.fin && !f.anulado);
  const totalMin = Math.round(validos.reduce((s, f) => s + (f.segundos ?? 0), 0) / 60);
  // Se ofrece el motivo, no se exige: pedirlo siempre convertía una corrección
  // de medio minuto en una negociación, y la gente acababa dejando el tiempo
  // mal antes que pelearse con el formulario. Lo que hace fiable esto es el
  // rastro de quién cambió qué, que se guarda igual; si no hay motivo, en la
  // tarea queda escrito «sin motivo indicado», que ya es incómodo de leer.
  const pideMotivo = edicion && edicion.modo !== "nuevo";

  const formulario = (
    <div className="flex flex-wrap items-center gap-2 rounded border border-subtle bg-layer-1 p-2">
      {(edicion?.modo === "nuevo" || edicion?.modo === "editar") && (
        <>
          <input
            className={cn(campo, "w-24")}
            placeholder="1h 30"
            value={minutos}
            onChange={(e) => setMinutos(e.target.value)}
            autoFocus
          />
          {/* El día en que se trabajó. Sin esto, lo del viernes apuntado el lunes
              caía en el lunes y descuadraba el cierre de mes. */}
          <input
            type="date"
            className={cn(campo, "w-36")}
            max={new Date().toISOString().slice(0, 10)}
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            title="El día en que se hizo el trabajo"
          />
          <input
            className={cn(campo, "min-w-[10rem] flex-1")}
            placeholder="Nota (opcional)"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
        </>
      )}
      {pideMotivo && (
        <input
          className={cn(campo, "min-w-[12rem] flex-1")}
          placeholder={
            edicion?.modo === "anular"
              ? "Motivo (opcional): p. ej. se quedó corriendo toda la noche"
              : edicion?.modo === "restaurar"
                ? "Motivo (opcional) para volver a contarlo"
                : "Motivo (opcional): p. ej. cronómetro olvidado al comer"
          }
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          autoFocus={edicion?.modo !== "editar"}
        />
      )}
      <button
        type="button"
        className={cn(boton, edicion?.modo === "anular" ? "bg-danger-primary text-white" : "bg-accent-primary text-white")}
        disabled={ocupado}
        onClick={guardar}
      >
        {edicion?.modo === "anular" ? "Anular" : edicion?.modo === "restaurar" ? "Restaurar" : "Guardar"}
      </button>
      <button type="button" className={cn(boton, "text-secondary hover:bg-layer-transparent-hover")} onClick={cerrar}>
        Cancelar
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-h5-medium text-primary">
          Tiempo <span className="text-13 font-normal text-tertiary">· {duracion(totalMin)}</span>
        </div>
        {!disabled && !edicion && (
          <button
            type="button"
            className="flex items-center gap-1 rounded px-2 py-1 text-13 text-secondary hover:bg-layer-transparent-hover"
            onClick={() => abrir({ id: "nuevo", modo: "nuevo" })}
          >
            <Plus className="h-3.5 w-3.5" /> Añadir tiempo
          </button>
        )}
      </div>

      {edicion?.modo === "nuevo" && formulario}
      {error && <div className="text-13 text-danger-primary">{error}</div>}

      {fichajes && fichajes.length === 0 && (
        <div className="text-13 text-tertiary">Todavía no hay tiempo apuntado en esta tarea.</div>
      )}

      {fichajes && fichajes.length > 0 && (
        <div className="rounded border border-subtle">
          {fichajes.map((f) => {
            const min = Math.round((f.segundos ?? 0) / 60);
            const enMarcha = !f.fin;
            const editando = edicion && edicion.id === f.id;
            return (
              <div key={f.id} className="border-b border-subtle px-3 py-2 last:border-b-0">
                <div className={cn("flex items-center gap-3 text-13", f.anulado && "text-tertiary line-through")}>
                  <span className="w-28 shrink-0 tabular-nums text-secondary">{fecha(f.inicio)}</span>
                  <span className="w-32 shrink-0 truncate text-primary">{nombre(f.persona)}</span>
                  <span className="w-20 shrink-0 tabular-nums font-medium">
                    {enMarcha ? <span className="text-danger-primary">en marcha</span> : duracion(min)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-tertiary" title={f.nota ?? ""}>
                    {f.origen === "manual" ? "a mano" : "cronómetro"}
                    {f.revisar ? " · por revisar" : ""}
                    {f.nota ? ` · ${f.nota}` : ""}
                  </span>
                  {!disabled && !enMarcha && !edicion && (
                    <span className="flex shrink-0 items-center gap-1 no-underline">
                      {f.anulado ? (
                        <button
                          type="button"
                          title="Volver a contarlo"
                          className="rounded p-1 text-tertiary hover:bg-layer-transparent-hover hover:text-primary"
                          onClick={() => abrir({ id: f.id, modo: "restaurar" })}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            title="Corregir"
                            className="rounded p-1 text-tertiary hover:bg-layer-transparent-hover hover:text-primary"
                            onClick={() => abrir({ id: f.id, modo: "editar" }, f)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Anular: deja de contar, pero no se borra"
                            className="rounded p-1 text-tertiary hover:bg-layer-transparent-hover hover:text-danger-primary"
                            onClick={() => abrir({ id: f.id, modo: "anular" })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </span>
                  )}
                </div>
                {editando && <div className="mt-2">{formulario}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
