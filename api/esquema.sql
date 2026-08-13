-- Esquema de la analítica de retención del VSL.
--
-- Correr una sola vez desde phpMyAdmin en Hostinger (Hosting → Bases de datos
-- → phpMyAdmin → pestaña SQL), con la base ya creada.
--
-- Nota de privacidad: ninguna de estas tablas guarda IP, user-agent ni dato
-- personal. `retencion_limite` guarda un hash con salt de la IP, que solo sirve
-- para contar peticiones dentro de una ventana y no permite reidentificar.

CREATE TABLE IF NOT EXISTS retencion_video (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sid           VARCHAR(36)     NOT NULL,
  evento        ENUM('inicio','progreso','pitch','clic_cta','fin') NOT NULL,
  hito_pct      TINYINT UNSIGNED NOT NULL,
  segundo       INT UNSIGNED    NOT NULL,
  utm_source    VARCHAR(64)     NOT NULL DEFAULT '',
  utm_campaign  VARCHAR(64)     NOT NULL DEFAULT '',
  creado_en     DATETIME        NOT NULL,
  PRIMARY KEY (id),

  -- Idempotencia. El navegador puede reenviar un beacon; con esta clave, el
  -- INSERT IGNORE del endpoint descarta el duplicado en vez de contar el
  -- mismo hito dos veces y deformar la curva.
  UNIQUE KEY sesion_hito (sid, evento, hito_pct),

  KEY idx_creado (creado_en),
  KEY idx_campana (utm_campaign),
  KEY idx_evento_hito (evento, hito_pct)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS retencion_limite (
  ip_hash  CHAR(64)        NOT NULL,
  ventana  INT UNSIGNED    NOT NULL,
  golpes   INT UNSIGNED    NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, ventana)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Limpieza de las ventanas viejas del limitador. Se puede dejar como cron en
-- Hostinger (Avanzado → Trabajos cron), una vez al día:
--   DELETE FROM retencion_limite WHERE ventana < UNIX_TIMESTAMP() / 300 - 288;
