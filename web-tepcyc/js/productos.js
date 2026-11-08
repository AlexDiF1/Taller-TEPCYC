/*
  CATÁLOGO DE LA TIENDA: aquí se editan productos, fotos y precios.

  Cada producto lleva:
    id:        palabra única, sin espacios
    nombre:    lo que ve el cliente
    categoria: 'nuevas', 'usadas' o 'controles'
    precio:    número en pesos, sin puntos (450000)
    foto:      ruta de la foto, por ejemplo 'img/productos/ps4-slim.jpg'; '' si aún no hay

  ATENCIÓN: los productos de abajo son de ejemplo. Cuando pongas los reales,
  cambia ejemplo a false para que desaparezca el aviso de la tienda.
*/
window.TIENDA = {
  ejemplo: true,
  productos: [
    { id: 'ejemplo-switch-nueva', nombre: 'Nintendo Switch', categoria: 'nuevas', precio: 1000000, foto: '' },
    { id: 'ejemplo-xbox-nueva', nombre: 'Xbox Series S', categoria: 'nuevas', precio: 1500000, foto: '' },
    { id: 'ejemplo-ps4-usada', nombre: 'PS4', categoria: 'usadas', precio: 500000, foto: '' },
    { id: 'ejemplo-360-usada', nombre: 'Xbox 360', categoria: 'usadas', precio: 300000, foto: '' },
    { id: 'ejemplo-switch-usada', nombre: 'Nintendo Switch', categoria: 'usadas', precio: 700000, foto: '' },
    { id: 'ejemplo-control-ps4', nombre: 'Control PS4', categoria: 'controles', precio: 100000, foto: '' },
    { id: 'ejemplo-control-xbox', nombre: 'Control Xbox', categoria: 'controles', precio: 200000, foto: '' },
    { id: 'ejemplo-control-pro', nombre: 'Control Pro Switch', categoria: 'controles', precio: 200000, foto: '' }
  ]
};
