BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[Usuario] ADD [clienteId] INT,
[profesionalId] INT;

-- CreateIndex
CREATE NONCLUSTERED INDEX [Usuario_clienteId_idx] ON [dbo].[Usuario]([clienteId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Usuario_profesionalId_idx] ON [dbo].[Usuario]([profesionalId]);

-- AddForeignKey
ALTER TABLE [dbo].[Usuario] ADD CONSTRAINT [Usuario_clienteId_fkey] FOREIGN KEY ([clienteId]) REFERENCES [dbo].[Cliente]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Usuario] ADD CONSTRAINT [Usuario_profesionalId_fkey] FOREIGN KEY ([profesionalId]) REFERENCES [dbo].[Profesional]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
