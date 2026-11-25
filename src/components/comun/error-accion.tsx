import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ErrorDeAccion } from "./use-accion";

/** Muestra el error de una acción con su lista de detalles. */
export function ErrorAccion({ error }: { error: ErrorDeAccion | null }) {
  if (!error) return null;
  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertTitle>{error.error}</AlertTitle>
      {error.detalles?.length ? (
        <AlertDescription>
          <ul className="list-disc space-y-0.5 pl-4">
            {error.detalles.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </AlertDescription>
      ) : null}
    </Alert>
  );
}
