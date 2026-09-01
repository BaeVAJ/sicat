-- =============================================
-- SICAT — Base de datos
-- PostgreSQL 
-- =============================================

-- ============================
-- TIPOS ENUM
-- ============================
CREATE TYPE tipo_pago_t      AS ENUM ('Contado', 'Credito', 'Transferencia', 'Cheque');
CREATE TYPE tipo_categoria_t AS ENUM ('equipo', 'insumo', 'accesorio');
CREATE TYPE estado_ticket_t  AS ENUM ('PENDIENTE', 'EN_PROCESO', 'SOLUCIONADO');
CREATE TYPE metodo_pago_t    AS ENUM ('PUE', 'PPD');
CREATE TYPE uso_cfdi_t       AS ENUM (
    'G01', 'G02', 'G03',
    'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08',
    'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10',
    'P01', 'CP01', 'CN01', 'S01'
);
CREATE TYPE estatus_asig_t   AS ENUM ('ACTIVO', 'DEVUELTO');
CREATE TYPE estatus_pedido_t AS ENUM ('PENDIENTE', 'ENTREGADO', 'CANCELADO');
CREATE TYPE rol_t            AS ENUM ('admin', 'gerente', 'usuario');

-- ============================
-- TABLAS
-- ============================

CREATE TABLE EMPRESA (
    id_empresa  SERIAL PRIMARY KEY,
    nombre      VARCHAR(120) NOT NULL,
    rfc         CHAR(13),
    direccion   VARCHAR(255),
    activa      BOOLEAN DEFAULT TRUE
);

CREATE TABLE DEPARTAMENTO (
    id_departamento SERIAL PRIMARY KEY,
    id_empresa      INT NOT NULL,
    nombre          VARCHAR(100) NOT NULL,
    CONSTRAINT fk_empresaDP FOREIGN KEY (id_empresa) 
        REFERENCES EMPRESA(id_empresa)
);

CREATE TABLE CATEGORIA (
    id_categoria SERIAL PRIMARY KEY,
    nombre       VARCHAR(80),
    descripcion  VARCHAR(255),
    tipo         tipo_categoria_t
);

CREATE TABLE PRODUCTO (
    id_producto  SERIAL PRIMARY KEY,
    id_categoria INT NOT NULL,
    nombre       VARCHAR(150) NOT NULL,
    marca        VARCHAR(80),
    modelo       VARCHAR(80),
    CONSTRAINT fk_categoriaP FOREIGN KEY (id_categoria) 
        REFERENCES CATEGORIA(id_categoria)
);

CREATE TABLE PROVEEDOR (
    id_proveedor SERIAL PRIMARY KEY,
    nombre       VARCHAR(120) NOT NULL,
    telefono     CHAR(10),
    email        VARCHAR(254) UNIQUE,
    tipo_pago    tipo_pago_t NOT NULL
);

CREATE TABLE USUARIOS (
    id_usuario      SERIAL PRIMARY KEY,
    id_departamento INT,
    nombre          VARCHAR(120) NOT NULL,
    correo          VARCHAR(254) UNIQUE NOT NULL,
    contrasena      VARCHAR(255) NOT NULL,
    rol             rol_t DEFAULT 'usuario',
    CONSTRAINT fk_departamentoU FOREIGN KEY (id_departamento) 
        REFERENCES DEPARTAMENTO(id_departamento)
);

CREATE TABLE COMPRA (
    id_compra    SERIAL PRIMARY KEY,
    id_proveedor INT,
    id_empresa   INT,
    fecha_compra DATE NOT NULL DEFAULT CURRENT_DATE,
    total        NUMERIC(10,2),
    CONSTRAINT fk_proveedorC FOREIGN KEY (id_proveedor) 
        REFERENCES PROVEEDOR(id_proveedor),
    CONSTRAINT fk_empresaC FOREIGN KEY (id_empresa)   
        REFERENCES EMPRESA(id_empresa)
);

CREATE TABLE DETALLE_COMPRA (
    id_compra       INT NOT NULL,
    id_producto     INT NOT NULL,
    cantidad        INT NOT NULL,
    precio_unitario NUMERIC(10,2) NOT NULL,
    PRIMARY KEY (id_compra, id_producto),
    CONSTRAINT fk_compraD FOREIGN KEY (id_compra)   
        REFERENCES COMPRA(id_compra),
    CONSTRAINT fk_productoD FOREIGN KEY (id_producto) 
        REFERENCES PRODUCTO(id_producto)
);

CREATE TABLE FACTURA (
    id_factura     SERIAL PRIMARY KEY,
    id_compra      INT,
    uuid_fiscal    UUID NOT NULL,
    rfc_emisor     CHAR(13),
    rfc_receptor   CHAR(13),
    fecha_emision  DATE,
    monto_subtotal NUMERIC(10,2),
    monto_iva      NUMERIC(10,2),
    metodo_pago    metodo_pago_t,
    uso_cfdi       uso_cfdi_t NOT NULL,
    archivo_url    TEXT,
    archivo_xml_url TEXT,
    CONSTRAINT fk_compraF FOREIGN KEY (id_compra) 
        REFERENCES COMPRA(id_compra)
);

CREATE TABLE INVENTARIO (
    id_inventario       SERIAL PRIMARY KEY,
    id_producto         INT,
    id_departamento     INT,
    cantidad_disponible INT DEFAULT 0,
    cantidad_minima     INT DEFAULT 1,
    CONSTRAINT fk_productoIN FOREIGN KEY (id_producto)     
        REFERENCES PRODUCTO(id_producto),
    CONSTRAINT fk_departamentoIN FOREIGN KEY (id_departamento) 
        REFERENCES DEPARTAMENTO(id_departamento)
);

CREATE TABLE ASIGNACION (
    id_asignacion    SERIAL PRIMARY KEY,
    id_inventario    INT,
    id_departamento  INT,
    fecha_asignacion DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_devolucion DATE,
    condicion        VARCHAR(40),
    estatus          estatus_asig_t DEFAULT 'ACTIVO',
    CONSTRAINT fk_inventarioAS FOREIGN KEY (id_inventario)   
        REFERENCES INVENTARIO(id_inventario),
    CONSTRAINT fk_departamentoAS FOREIGN KEY (id_departamento) 
        REFERENCES DEPARTAMENTO(id_departamento)
);

CREATE TABLE PEDIDO_MATERIAL (
    id_pedido       SERIAL PRIMARY KEY,
    id_departamento INT,
    id_producto     INT,
    stock_actual    INT NOT NULL,
    stock_deseado   INT NOT NULL,
    urgente         BOOLEAN DEFAULT FALSE,
    fecha_solicitud DATE DEFAULT CURRENT_DATE,
    estatus         estatus_pedido_t DEFAULT 'PENDIENTE',
    CONSTRAINT fk_departamentoPM FOREIGN KEY (id_departamento) 
        REFERENCES DEPARTAMENTO(id_departamento),
    CONSTRAINT fk_productoPM FOREIGN KEY (id_producto)     
        REFERENCES PRODUCTO(id_producto)
);

CREATE TABLE TICKETS (
    id_ticket       SERIAL PRIMARY KEY,
    id_departamento INT,
    fecha_creacion  DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_solucion  DATE,
    descripcion     TEXT,
    estado          estado_ticket_t DEFAULT 'PENDIENTE',
    CONSTRAINT fk_departamentoT FOREIGN KEY (id_departamento) 
        REFERENCES DEPARTAMENTO(id_departamento)
);