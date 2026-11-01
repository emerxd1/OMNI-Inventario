# OMNI-Inventario Pro

Una aplicación web ligera y moderna para la gestión de inventario, diseñada para escanear códigos de barras, registrar productos y exportar datos a Excel, todo desde el navegador y sin necesidad de un servidor o base de datos externa.

## Características Principales

*   **Escaneo Inteligente:** Compatible con cámaras de dispositivos móviles (vía "html5-qrcode") y lectores de códigos de barras físicos (USB/Bluetooth).
*   **Gestión de Inventario:** CRUD completo (Crear, Leer, Actualizar, Borrar) para productos.
*   **Persistencia de Datos:** Utiliza "localStorage" para guardar tus registros directamente en el navegador; no se pierden al cerrar la pestaña.
*   **Exportación a Excel:** Genera archivos ".xlsx"  listos para usar con un solo clic (vía "SheetJS").
*   **Interfaz Moderna:** Diseño responsive construido con **Tailwind CSS**, optimizado para escritorio y dispositivos móviles.
*   **Cálculos Automáticos:** Visualización de ganancia en tiempo real al ingresar precios.

## Tecnologías Utilizadas

*   **HTML5 / JavaScript:** Lógica principal de la aplicación.
*   **Tailwind CSS:** Framework de estilos para un diseño moderno y responsive.
*   **html5-qrcode:** Librería para el escaneo de códigos a través de la cámara.
*   **SheetJS (xlsx):** Librería para la generación de archivos Excel.

## Instrucciones de Uso

1.  **Abrir la aplicación:** Simplemente abre el archivo "index.html" en cualquier navegador web moderno.
2.  **Registrar productos:**
    *   **Escanear:** Haz clic en "📷 Cámara" o utiliza un lector físico enfocado en el campo de búsqueda.
    *   **Manual:** Ingresa el código manualmente en el campo de texto y presiona "Enter".
3.  **Gestionar datos:**
    *   Al escanear un código nuevo, se abrirá un formulario para completar los datos del producto.
    *   Si el producto ya existe, se abrirá para editar stock, precios o estado.
4.  **Exportar:** Haz clic en "Excel" para descargar tu inventario actual.
5.  **Limpiar** Usa el enlace "Vaciar inventario" (con precaución) para resetear los datos.
