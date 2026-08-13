/**
 * Config del formulario de acceso a la clase.
 *
 * Rellenarlo es requisito para ver el video (pedido del cliente). Quien ya
 * se registró entra directo la próxima vez: volver a pedir los datos a
 * quien ya los dio molesta y no aporta ningún lead nuevo.
 */

/**
 * La URL /exec del Apps Script implementado (FORM VSL PET - AGO 2026).
 *
 * Si algún día se cambia el código del script, hay que hacer
 * Implementar → Gestionar implementaciones → editar → Nueva versión.
 * Crear una implementación NUEVA genera otra URL y habría que cambiarla
 * aquí; editando la existente, esta sigue valiendo.
 */
export const ENDPOINT_FORMULARIO =
  'https://script.google.com/macros/s/AKfycbxvVabzW17iPjMFuA8j-QOkYxdRXccKCJkrAE050caLri-l8dA9WK7wCdrYBOWYWD_X/exec';

/**
 * No es un secreto de verdad: viaja en el HTML, a la vista de cualquiera.
 * Lo que hace es frenar a un bot que le pegue directo al endpoint sin
 * haber cargado nunca la página. Tiene que coincidir con TOKEN_SECRETO
 * del Apps Script.
 */
export const TOKEN_FORMULARIO = 'PETVSL2026-kaisen-9RtZ4mQ7';

/**
 * Los cuatro motivos de entrada. No son decoración: cada uno corresponde a
 * un público con un anuncio distinto —marca personal, negocio, salida
 * laboral, subir de nivel— y es lo que permite segmentar las campañas
 * después cruzándolo con las UTM.
 */
export const MOTIVOS = [
  'Quiero editar los videos de mi marca personal',
  'Quiero editar para mi negocio y vender más',
  'Quiero trabajar como editor y conseguir clientes',
  'Ya edito y quiero subir de nivel',
] as const;

/** Prefijos más frecuentes del público de la marca, LATAM y España. */
export const PREFIJOS = [
  { pais: 'Colombia', codigo: '+57' },
  { pais: 'México', codigo: '+52' },
  { pais: 'Argentina', codigo: '+54' },
  { pais: 'Chile', codigo: '+56' },
  { pais: 'Perú', codigo: '+51' },
  { pais: 'Ecuador', codigo: '+593' },
  { pais: 'España', codigo: '+34' },
  { pais: 'Estados Unidos', codigo: '+1' },
  { pais: 'Venezuela', codigo: '+58' },
  { pais: 'Bolivia', codigo: '+591' },
  { pais: 'Uruguay', codigo: '+598' },
  { pais: 'Paraguay', codigo: '+595' },
  { pais: 'Costa Rica', codigo: '+506' },
  { pais: 'Panamá', codigo: '+507' },
  { pais: 'Guatemala', codigo: '+502' },
  { pais: 'República Dominicana', codigo: '+1809' },
] as const;
