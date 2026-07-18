# TallerPro — Contenido para Landing Page (Uso exclusivo para generación de copy/UI con IA)

> Este archivo describe el sistema con una mirada comercial B2C. No forma parte del contexto de desarrollo.

---

## Propuesta de valor principal

**TallerPro** es el sistema de gestión todo-en-uno para talleres mecánicos que quieren dejar de perder dinero por desorden, olvidar presupuestos o no saber qué está pasando en el taller en tiempo real. Diseñado para dueños, recepcionistas y mecánicos que no tienen tiempo para complicaciones.

**Tagline sugerido:** *"Tu taller bajo control, desde el primer turno hasta la boleta."*

---

## Problema que resuelve (Pain points del cliente)

- Pierde rastro de en qué estado está cada auto
- No sabe cuánto ganó con cada tipo de servicio
- Los presupuestos se hacen a mano y se pierden
- Los clientes llaman a preguntar si su auto ya está listo
- El inventario de repuestos se descuadra constantemente
- No puede delegar porque todo está en la cabeza del dueño
- Las citas se anotan en papel y se superponen
- No hay registro formal de la condición del auto al ingresar

---

## Módulos y funcionalidades (descripción comercial)

### 1. Panel de control (Dashboard)
Una vista rápida de todo lo que importa: cuántas órdenes están activas, cuántos clientes hay en el sistema y cuántos vehículos registrados. Ideal para empezar el día sabiendo exactamente dónde está parado el negocio.

### 2. Órdenes de trabajo
El corazón del sistema. Cada auto que entra al taller genera una orden de trabajo digital con todo el historial: qué trabajo se solicitó, qué mecánico lo tiene, cuánto va a costar y en qué estado está. El ciclo completo es:

- **Presupuestada** → se genera un presupuesto PDF numerado y se envía al cliente
- **Aprobada** → el cliente da el visto bueno y la orden pasa a pendiente
- **En progreso** → el mecánico está trabajando
- **Completada** → trabajo terminado, se genera la boleta PDF
- **Entregada** → el auto salió del taller
- **Rechazada** → el cliente rechazó el presupuesto (queda registro)

Nunca más una orden "perdida" ni un cliente que no sabe en qué estado está su auto.

### 3. Presupuestos y boletas en PDF
Con un clic se genera un PDF profesional con el logo del taller, datos del cliente, vehículo, lista de servicios, repuestos utilizados, IVA opcional, forma de pago y pie de página personalizado. Numeración correlativa automática. El presupuesto tiene vigencia configurable. La boleta incluye espacio para firma del cliente.

Ideal para talleres que quieren verse profesionales sin contratar a un contador para hacer los documentos.

### 4. Agenda de citas
Calendario de turnos integrado con la disponibilidad real del taller. Define los horarios de atención, la cantidad de boxes disponibles y la duración de cada turno. El sistema evita la superposición de citas automáticamente. Una cita aprobada puede convertirse en una orden de trabajo con un solo clic, sin volver a ingresar datos.

### 5. Checklist de recepción de vehículo
Antes de tocar el auto, el recepcionista registra digitalmente el estado de la carrocería, neumáticos, interior, niveles de fluidos, accesorios y documentos del vehículo. Cada ítem puede marcarse como OK, con observación o no aplica. Al terminar, se imprime un **acta de recepción** con el logo del taller y las firmas del cliente y el recepcionista. Esto protege al taller de reclamos por daños preexistentes.

### 6. Clientes
Ficha completa de cada cliente con nombre, RUT, teléfono, email y todos sus vehículos asociados. Historial de órdenes por cliente disponible con un clic. Búsqueda rápida por nombre, RUT o patente.

### 7. Vehículos
Registro de cada auto con patente, marca, modelo, año, color y cliente propietario. Historial de todas las órdenes de ese vehículo. Útil para talleres que quieren fidelizar al cliente recordándole los próximos servicios.

### 8. Catálogo de servicios
Define los servicios que ofrece el taller (cambio de aceite, revisión de frenos, alineación, etc.) con descripción y precio base. Cuando se crea una orden, los servicios se seleccionan del catálogo y el costo total se calcula automáticamente. Se pueden activar o desactivar servicios sin borrarlos.

### 9. Inventario de repuestos
Control de stock en tiempo real. Cada repuesto tiene código, nombre, unidad de medida, stock actual y stock mínimo. Cuando el stock baja del mínimo, el sistema lo indica visualmente. Registro de todos los movimientos: entradas, salidas y ajustes. Los repuestos usados en cada orden quedan vinculados automáticamente con su precio de venta.

### 10. Equipo de mecánicos
Gestión del equipo de trabajo con nombre, especialidad, teléfono y estado activo/inactivo. Cada orden puede asignarse a un mecánico específico. Los reportes muestran el rendimiento individual.

### 11. Reportes de rentabilidad (solo administrador)
Tres reportes clave para decisiones de negocio:

- **Rentabilidad por servicio:** qué servicios generan más ingresos, cuáles tienen mejor margen y cuáles son los más frecuentes. Incluye barra visual de margen para comparar rápidamente.
- **Ingresos mensuales:** gráfico de barras con los últimos 12 meses de ingresos. Permite ver tendencias y meses pico.
- **Rendimiento por mecánico:** número de órdenes completadas, ingreso generado, tiempo promedio de trabajo y el servicio más frecuente de cada uno.

Todo exportable a Excel con un clic (4 hojas: resumen, servicios, ingresos mensuales y mecánicos).

### 12. Perfil del taller
Nombre, RUT, dirección, teléfono, email, sitio web, logo y texto de pie de página. Estos datos aparecen automáticamente en todos los documentos impresos: presupuestos, boletas PDF y actas de checklist. Se configura una sola vez.

---

## Para quién es TallerPro

| Perfil | Qué gana |
|--------|----------|
| **Dueño del taller** | Control total del negocio, reportes de rentabilidad, visión clara de qué servicios y mecánicos son más rentables |
| **Recepcionista** | Gestión de citas, creación de órdenes, checklist de recepción, presupuestos en PDF sin conocimientos técnicos |
| **Mecánico** | Ve las órdenes asignadas, registra el trabajo realizado, usa el checklist digital |

---

## Diferenciadores clave

- **Sin papeles:** todo el flujo del taller, digital y trazable
- **Documentos profesionales:** presupuestos y boletas con PDF numerados y con el logo de tu taller
- **Protección legal:** acta de recepción imprimible con estado del vehículo al ingreso
- **Reportes reales:** no solo "cuánto vendiste" sino qué servicio deja más margen
- **Multi-rol:** admin, mecánico y recepcionista con acceso diferenciado
- **Multi-taller:** si tienes más de una sucursal, cada una tiene sus datos completamente aislados
- **En la nube:** accede desde cualquier dispositivo con navegador, sin instalar nada
- **Sin límite de registros:** clientes, vehículos y órdenes ilimitados

---

## Flujo típico de un día en el taller con TallerPro

1. El cliente llama → se agenda una **cita** en el horario disponible
2. El auto llega → se hace el **checklist de recepción** y se imprime el acta
3. Se crea la **orden de trabajo** desde la cita con un clic
4. Se genera el **presupuesto PDF** y se envía al cliente
5. El cliente aprueba → la orden pasa a **en progreso** y se asigna al mecánico
6. El mecánico registra los **servicios** y **repuestos** usados
7. Al terminar, se genera la **boleta PDF** con el total calculado
8. El cliente retira el auto → orden marcada como **entregada**
9. El dueño revisa los **reportes** y sabe qué día fue más rentable

---

## Preguntas frecuentes (para sección FAQ de la landing)

**¿Necesito instalar algo?**
No. TallerPro funciona en el navegador desde cualquier dispositivo: computador, tablet o celular.

**¿Qué pasa con mis datos si cancelo?**
Tus datos son tuyos. Puedes exportarlos en Excel en cualquier momento.

**¿Cuántos usuarios puedo agregar?**
Sin límite. Puedes crear perfiles para todos tus mecánicos y recepcionistas.

**¿Puedo personalizar los documentos con el logo de mi taller?**
Sí. El logo y los datos del taller aparecen en todos los presupuestos, boletas y actas de recepción.

**¿Funciona para más de un local?**
Sí. El sistema soporta múltiples talleres con datos completamente aislados entre sí.

**¿Necesito saber de computadores?**
No. Está diseñado para personas que saben de mecánica, no de tecnología.

---

## Calls to action sugeridos

- "Empieza gratis hoy — sin tarjeta de crédito"
- "Prueba TallerPro 30 días gratis"
- "Ver demo en vivo"
- "¿Tienes dudas? Habla con un asesor"

---

## Tono de comunicación recomendado

- Directo y confiable, no técnico
- Hablar de ahorro de tiempo y dinero, no de "módulos" ni "APIs"
- Usar ejemplos concretos del día a día del taller
- Evitar jerga de software (SaaS, full-stack, multi-tenant, etc.)
- Lenguaje chileno/latinoamericano cuando corresponda (patente, boleta, RUT)
