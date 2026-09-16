# Plane, versión Piensaenweb

Bifurcación de [makeplane/plane](https://github.com/makeplane/plane) v1.4.2, bajo **AGPL-3.0**
como el original. Las mejoras de aquí son públicas, que es lo que esa licencia pide.

## Por qué existe

Plane tiene la mejor interfaz de gestión de tareas que hemos probado, y le falta exactamente una
cosa para nuestro caso: **registro de tiempo en la edición libre**. Sin tiempo no hay margen por
cliente, y el margen por cliente es el motivo de todo el proyecto.

## Qué cambia respecto al original

| Cambio | Dónde | Por qué |
|---|---|---|
| **Cronómetro en la fila de la lista** | `apps/web/core/components/piensaenweb/cronometro.tsx` | En el triaje diario se arranca sin abrir la tarea. Es la diferencia entre registrar el tiempo y tener que acordarse |

El tiempo **no se guarda aquí**: vive en nuestro orquestador, en su propia base de datos.

Tres motivos, y ninguno es la licencia:

1. Funciona con cualquier edición de Plane, y seguiría funcionando si mañana el gestor fuera otro.
2. Es el único dato que **no se puede reconstruir**: una tarea perdida se vuelve a escribir, una
   hora trabajada no se recuerda en marzo.
3. Mantiene esta bifurcación **mínima**, que es lo que permite seguir trayendo las versiones de
   arriba sin pelearse con cada una.

## Regla de la bifurcación

**Cuanto menos toquemos, mejor.** Cada fichero modificado es un conflicto futuro cada vez que
Plane publique — y publican cada dos semanas. Lo que se pueda resolver fuera, se resuelve fuera.

## Variables propias

| Variable | Para qué |
|---|---|
| `VITE_PIENSA_API` | Dónde vive el orquestador. Sin ella, el cronómetro no cuenta. Es `VITE_*` porque la web de Plane es React Router + Vite, no Next |

## Mantenerse al día con el original

```bash
git fetch upstream
git rebase upstream/v1.5.0   # o la versión que toque
```
