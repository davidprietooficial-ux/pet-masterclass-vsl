<?php

/**
 * PLANTILLA de la config de la analítica de retención.
 *
 * Este archivo de ejemplo sí va al repo; el real NO. Para desplegar:
 *
 *   1. Copiarlo como `config-retencion.php`.
 *   2. Rellenar los datos de la base que se creó en Hostinger.
 *   3. Subirlo al HOME de la cuenta de hosting, un nivel ARRIBA de
 *      public_html — no dentro del sitio. Así no es alcanzable por URL ni
 *      aunque el servidor deje de interpretar PHP.
 *
 *        (home de la cuenta)
 *        ├── config-retencion.php   ← acá
 *        └── public_html/
 *            ├── api/retencion.php
 *            └── index.html
 *
 *   4. Permisos 600 (solo el dueño lee).
 *
 * `retencion.php` lo busca en esa ruta y, si no está, un nivel arriba del
 * docroot. Nunca dentro del sitio publicado.
 */

declare(strict_types=1);

return [
    'host'    => 'localhost',
    'base'    => 'uXXXXXXX_pet_vsl',
    'usuario' => 'uXXXXXXX_pet',
    'clave'   => 'PONER-LA-CLAVE-REAL',

    // Cadena larga y aleatoria, propia de esta instalación. Se usa para
    // hashear la IP en el limitador de peticiones, de modo que ni siquiera en
    // la base quede una IP reversible. Generar con:
    //   php -r "echo bin2hex(random_bytes(32));"
    'salt'    => 'CAMBIAR-POR-UNA-CADENA-ALEATORIA-LARGA',

    // Usuario y contraseña del panel /panel-retencion/.
    // Generar el hash con: php -r "echo password_hash('tu-clave', PASSWORD_DEFAULT);"
    'panel_usuario' => 'admin',
    'panel_hash'    => '$2y$10$PONER-EL-HASH-REAL-AQUI',
];
