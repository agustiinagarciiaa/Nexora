BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Usuario] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nombre] NVARCHAR(100) NOT NULL,
    [email] NVARCHAR(190) NOT NULL,
    [passwordHash] NVARCHAR(100) NOT NULL,
    [rol] NVARCHAR(20) NOT NULL CONSTRAINT [Usuario_rol_df] DEFAULT 'RECEPCION',
    [activo] BIT NOT NULL CONSTRAINT [Usuario_activo_df] DEFAULT 1,
    [creadoEn] DATETIME2 NOT NULL CONSTRAINT [Usuario_creadoEn_df] DEFAULT CURRENT_TIMESTAMP,
    [actualizadoEn] DATETIME2 NOT NULL,
    CONSTRAINT [Usuario_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Usuario_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[Categoria] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nombre] NVARCHAR(100) NOT NULL,
    [descripcion] NVARCHAR(500),
    [orden] INT NOT NULL CONSTRAINT [Categoria_orden_df] DEFAULT 0,
    [activa] BIT NOT NULL CONSTRAINT [Categoria_activa_df] DEFAULT 1,
    [creadoEn] DATETIME2 NOT NULL CONSTRAINT [Categoria_creadoEn_df] DEFAULT CURRENT_TIMESTAMP,
    [actualizadoEn] DATETIME2 NOT NULL,
    CONSTRAINT [Categoria_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Categoria_nombre_key] UNIQUE NONCLUSTERED ([nombre])
);

-- CreateTable
CREATE TABLE [dbo].[Servicio] (
    [id] INT NOT NULL IDENTITY(1,1),
    [categoriaId] INT NOT NULL,
    [nombre] NVARCHAR(150) NOT NULL,
    [descripcion] NVARCHAR(500),
    [duracionMin] INT NOT NULL,
    [precio] DECIMAL(12,2) NOT NULL,
    [activo] BIT NOT NULL CONSTRAINT [Servicio_activo_df] DEFAULT 1,
    [creadoEn] DATETIME2 NOT NULL CONSTRAINT [Servicio_creadoEn_df] DEFAULT CURRENT_TIMESTAMP,
    [actualizadoEn] DATETIME2 NOT NULL,
    CONSTRAINT [Servicio_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Servicio_categoriaId_nombre_key] UNIQUE NONCLUSTERED ([categoriaId],[nombre])
);

-- CreateTable
CREATE TABLE [dbo].[Profesional] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nombre] NVARCHAR(100) NOT NULL,
    [apellido] NVARCHAR(100) NOT NULL,
    [email] NVARCHAR(190),
    [telefono] NVARCHAR(30),
    [notas] NVARCHAR(500),
    [activo] BIT NOT NULL CONSTRAINT [Profesional_activo_df] DEFAULT 1,
    [creadoEn] DATETIME2 NOT NULL CONSTRAINT [Profesional_creadoEn_df] DEFAULT CURRENT_TIMESTAMP,
    [actualizadoEn] DATETIME2 NOT NULL,
    CONSTRAINT [Profesional_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ProfesionalServicio] (
    [profesionalId] INT NOT NULL,
    [servicioId] INT NOT NULL,
    [precioEspecial] DECIMAL(12,2),
    [duracionEspecialMin] INT,
    CONSTRAINT [ProfesionalServicio_pkey] PRIMARY KEY CLUSTERED ([profesionalId],[servicioId])
);

-- CreateTable
CREATE TABLE [dbo].[Horario] (
    [id] INT NOT NULL IDENTITY(1,1),
    [profesionalId] INT NOT NULL,
    [diaSemana] INT NOT NULL,
    [horaInicio] NVARCHAR(5) NOT NULL,
    [horaFin] NVARCHAR(5) NOT NULL,
    CONSTRAINT [Horario_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Cliente] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nombre] NVARCHAR(100) NOT NULL,
    [apellido] NVARCHAR(100) NOT NULL,
    [telefono] NVARCHAR(30) NOT NULL,
    [email] NVARCHAR(190),
    [documento] NVARCHAR(20),
    [fechaNacimiento] DATE,
    [notas] NVARCHAR(500),
    [activo] BIT NOT NULL CONSTRAINT [Cliente_activo_df] DEFAULT 1,
    [creadoEn] DATETIME2 NOT NULL CONSTRAINT [Cliente_creadoEn_df] DEFAULT CURRENT_TIMESTAMP,
    [actualizadoEn] DATETIME2 NOT NULL,
    CONSTRAINT [Cliente_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Turno] (
    [id] INT NOT NULL IDENTITY(1,1),
    [clienteId] INT NOT NULL,
    [profesionalId] INT NOT NULL,
    [servicioId] INT NOT NULL,
    [inicio] DATETIME2 NOT NULL,
    [fin] DATETIME2 NOT NULL,
    [duracionMin] INT NOT NULL,
    [precio] DECIMAL(12,2) NOT NULL,
    [estado] NVARCHAR(20) NOT NULL CONSTRAINT [Turno_estado_df] DEFAULT 'PENDIENTE',
    [notas] NVARCHAR(500),
    [creadoEn] DATETIME2 NOT NULL CONSTRAINT [Turno_creadoEn_df] DEFAULT CURRENT_TIMESTAMP,
    [actualizadoEn] DATETIME2 NOT NULL,
    CONSTRAINT [Turno_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Pago] (
    [id] INT NOT NULL IDENTITY(1,1),
    [turnoId] INT NOT NULL,
    [monto] DECIMAL(12,2) NOT NULL,
    [metodo] NVARCHAR(20) NOT NULL,
    [estado] NVARCHAR(20) NOT NULL CONSTRAINT [Pago_estado_df] DEFAULT 'REGISTRADO',
    [referencia] NVARCHAR(100),
    [motivoAnulacion] NVARCHAR(300),
    [fecha] DATETIME2 NOT NULL CONSTRAINT [Pago_fecha_df] DEFAULT CURRENT_TIMESTAMP,
    [creadoEn] DATETIME2 NOT NULL CONSTRAINT [Pago_creadoEn_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Pago_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Servicio_categoriaId_idx] ON [dbo].[Servicio]([categoriaId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ProfesionalServicio_servicioId_idx] ON [dbo].[ProfesionalServicio]([servicioId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Horario_profesionalId_diaSemana_idx] ON [dbo].[Horario]([profesionalId], [diaSemana]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Cliente_apellido_nombre_idx] ON [dbo].[Cliente]([apellido], [nombre]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Cliente_telefono_idx] ON [dbo].[Cliente]([telefono]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Turno_profesionalId_inicio_idx] ON [dbo].[Turno]([profesionalId], [inicio]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Turno_clienteId_idx] ON [dbo].[Turno]([clienteId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Turno_servicioId_idx] ON [dbo].[Turno]([servicioId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Pago_turnoId_idx] ON [dbo].[Pago]([turnoId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Pago_fecha_idx] ON [dbo].[Pago]([fecha]);

-- AddForeignKey
ALTER TABLE [dbo].[Servicio] ADD CONSTRAINT [Servicio_categoriaId_fkey] FOREIGN KEY ([categoriaId]) REFERENCES [dbo].[Categoria]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ProfesionalServicio] ADD CONSTRAINT [ProfesionalServicio_profesionalId_fkey] FOREIGN KEY ([profesionalId]) REFERENCES [dbo].[Profesional]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ProfesionalServicio] ADD CONSTRAINT [ProfesionalServicio_servicioId_fkey] FOREIGN KEY ([servicioId]) REFERENCES [dbo].[Servicio]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Horario] ADD CONSTRAINT [Horario_profesionalId_fkey] FOREIGN KEY ([profesionalId]) REFERENCES [dbo].[Profesional]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Turno] ADD CONSTRAINT [Turno_clienteId_fkey] FOREIGN KEY ([clienteId]) REFERENCES [dbo].[Cliente]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Turno] ADD CONSTRAINT [Turno_profesionalId_fkey] FOREIGN KEY ([profesionalId]) REFERENCES [dbo].[Profesional]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Turno] ADD CONSTRAINT [Turno_servicioId_fkey] FOREIGN KEY ([servicioId]) REFERENCES [dbo].[Servicio]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Pago] ADD CONSTRAINT [Pago_turnoId_fkey] FOREIGN KEY ([turnoId]) REFERENCES [dbo].[Turno]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
