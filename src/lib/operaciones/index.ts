export { ErrorNegocio, type Ctx } from "./contexto";
export {
  crearDenuncia,
  crearReingreso,
  editarDenuncia,
  siniestrosAbiertos,
  type DenunciaCreada,
  type SiniestroAbierto,
} from "./denuncias";
export { adjuntarDocumento, desistir, pasarAMedica, verificarRelacionLaboral, type ResultadoPase } from "./recepcion";
export {
  agregarDiagnostico,
  definirBaja,
  evaluarDiagnostico,
  pasarALegal,
  programarCitacion,
  reencuadrarComoEP,
  registrarAsistencia,
} from "./medica";
export { cerrarDictamen, decidirDiagnostico, motivoPermitido, solicitarProrroga } from "./legal";
export { darAlta, registrarIntercurrencia, registrarPresentacion, registrarPresentacionCM } from "./seguimiento";
export {
  describirOmitido,
  generarLoteIntercambio,
  pendientesDeIntercambio,
  vistaPreviaIntercambio,
  type RegistroOmitido,
  type VistaIntercambio,
} from "./intercambio";
