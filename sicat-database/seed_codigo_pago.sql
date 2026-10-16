-- ═══════════════════════════════════════════════════════════
-- Seed: CODIGO_PAGO  (Formas de pago SAT - c_FormaPago, CFDI 4.0)
-- Idempotente: se puede ejecutar varias veces sin duplicar.
-- Usado por el backend para validar la "forma de pago" de los
-- complementos de pago (REP) de facturas PPD.
-- ═══════════════════════════════════════════════════════════

INSERT INTO CODIGO_PAGO (codigo_pago, descripcion) VALUES
    ('01', 'Efectivo'),
    ('02', 'Cheque nominativo'),
    ('03', 'Transferencia electrónica de fondos'),
    ('04', 'Tarjeta de crédito'),
    ('05', 'Monedero electrónico'),
    ('06', 'Dinero electrónico'),
    ('08', 'Vales de despensa'),
    ('12', 'Dación en pago'),
    ('13', 'Pago por subrogación'),
    ('14', 'Pago por consignación'),
    ('15', 'Condonación'),
    ('17', 'Compensación'),
    ('23', 'Novación'),
    ('24', 'Confusión'),
    ('25', 'Remisión de deuda'),
    ('26', 'Prescripción o caducidad'),
    ('27', 'A satisfacción del acreedor'),
    ('28', 'Tarjeta de débito'),
    ('29', 'Tarjeta de servicios'),
    ('30', 'Aplicación de anticipos'),
    ('31', 'Intermediario pagos'),
    ('99', 'Por definir')
ON CONFLICT (codigo_pago)
DO UPDATE SET descripcion = EXCLUDED.descripcion;
