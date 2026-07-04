export const getErrorMessage = (error: unknown, fallback = "Ocurrio un error inesperado.") =>
  error instanceof Error ? error.message : fallback;
