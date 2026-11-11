const http = require('http');

const PORT = process.env.PORT || 4000;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.url === '/api/health' || req.url === '/') {
    res.writeHead(200);
    res.end(
      JSON.stringify({
        ok: true,
        status: 'UP',
        service: 'decr27000-backend',
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ ok: false, error: 'Ruta no encontrada' }));
});

server.listen(PORT, () => {
  console.log(`Servidor decr27000-backend activo en el puerto ${PORT}`);
});
