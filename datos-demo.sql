USE estetica;

DROP TABLE IF EXISTS #prof;
DROP TABLE IF EXISTS #espec;
DROP TABLE IF EXISTS #cli;

CREATE TABLE #prof (nombre NVARCHAR(100), apellido NVARCHAR(100), desde NVARCHAR(5), hasta NVARCHAR(5), dias NVARCHAR(20));
CREATE TABLE #espec (nombre NVARCHAR(100), apellido NVARCHAR(100), prefijo NVARCHAR(100));
CREATE TABLE #cli (nombre NVARCHAR(100), apellido NVARCHAR(100), telefono NVARCHAR(30), email NVARCHAR(190));

-- dias: 0=domingo, 1=lunes ... 6=sabado
INSERT INTO #prof VALUES
(N'Lucía',     N'Gómez',   '09:00', '18:00', '2,3,4,5,6'),
(N'Martín',    N'Sosa',    '10:00', '19:00', '2,3,4,5,6'),
(N'Camila',    N'Ruiz',    '10:00', '19:00', '1,2,3,4,5'),
(N'Valentina', N'Díaz',    '09:00', '17:00', '1,2,3,4,5'),
(N'Sofía',     N'Herrera', '10:00', '20:00', '1,3,5,6');

INSERT INTO #espec VALUES
(N'Lucía', N'Gómez', N'Peluquería'), (N'Lucía', N'Gómez', N'Peinados'), (N'Lucía', N'Gómez', N'Maquillaje'),
(N'Martín', N'Sosa', N'Barbería'),
(N'Camila', N'Ruiz', N'Manicura'), (N'Camila', N'Ruiz', N'Uñas'),
(N'Valentina', N'Díaz', N'Pestañas'), (N'Valentina', N'Díaz', N'Cejas'), (N'Valentina', N'Díaz', N'Limpieza'),
(N'Sofía', N'Herrera', N'Spa'), (N'Sofía', N'Herrera', N'Masajes');

INSERT INTO #cli VALUES
(N'María',   N'López',     '3811000001', NULL),
(N'Julieta', N'Fernández', '3811000002', 'julieta@example.com'),
(N'Carlos',  N'Navarro',   '3811000003', NULL),
(N'Paula',   N'Vega',      '3811000004', NULL);

INSERT INTO Profesional (nombre, apellido, activo, creadoEn, actualizadoEn)
SELECT p.nombre, p.apellido, 1, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM #prof p
WHERE NOT EXISTS (SELECT 1 FROM Profesional x WHERE x.nombre = p.nombre AND x.apellido = p.apellido);

INSERT INTO ProfesionalServicio (profesionalId, servicioId)
SELECT DISTINCT pr.id, s.id
FROM #espec e
JOIN Profesional pr ON pr.nombre = e.nombre AND pr.apellido = e.apellido
JOIN Categoria c ON c.nombre LIKE e.prefijo + N'%'
JOIN Servicio s ON s.categoriaId = c.id
WHERE NOT EXISTS (SELECT 1 FROM ProfesionalServicio ps WHERE ps.profesionalId = pr.id AND ps.servicioId = s.id);

INSERT INTO Horario (profesionalId, diaSemana, horaInicio, horaFin)
SELECT pr.id, CAST(d.value AS INT), p.desde, p.hasta
FROM #prof p
JOIN Profesional pr ON pr.nombre = p.nombre AND pr.apellido = p.apellido
CROSS APPLY STRING_SPLIT(p.dias, ',') d
WHERE NOT EXISTS (SELECT 1 FROM Horario h WHERE h.profesionalId = pr.id);

INSERT INTO Cliente (nombre, apellido, telefono, email, activo, creadoEn, actualizadoEn)
SELECT c.nombre, c.apellido, c.telefono, c.email, 1, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM #cli c
WHERE NOT EXISTS (SELECT 1 FROM Cliente x WHERE x.telefono = c.telefono);

DROP TABLE #prof;
DROP TABLE #espec;
DROP TABLE #cli;

SELECT pr.id, pr.nombre, pr.apellido,
  (SELECT COUNT(*) FROM ProfesionalServicio ps WHERE ps.profesionalId = pr.id) AS servicios,
  (SELECT COUNT(*) FROM Horario h WHERE h.profesionalId = pr.id) AS franjas_horarias
FROM Profesional pr ORDER BY pr.id;