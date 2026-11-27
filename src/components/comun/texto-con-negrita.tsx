import { Fragment } from "react";

/**
 * Texto con **negrita** y saltos de línea, sin interpretar HTML. Lo usan el
 * asistente virtual y el recorrido guiado.
 */
export function TextoConNegrita({ texto }: { texto: string }) {
  return (
    <>
      {texto.split("\n").map((linea, i) => (
        <Fragment key={i}>
          {i > 0 ? <br /> : null}
          {linea.split(/(\*\*[^*]+\*\*)/g).map((parte, j) =>
            parte.startsWith("**") && parte.endsWith("**") ? (
              <strong key={j} className="font-semibold text-foreground">
                {parte.slice(2, -2)}
              </strong>
            ) : (
              <Fragment key={j}>{parte}</Fragment>
            ),
          )}
        </Fragment>
      ))}
    </>
  );
}
