// Entry point untuk hosting Node.js Hostinger (hPanel "Setup Node.js App"),
// yang menjalankan aplikasi lewat Phusion Passenger -- Passenger butuh satu
// file startup yang membuka HTTP server sendiri (bukan lewat CLI `next
// start`), jadi wrapper ini yang didaftarkan sebagai "Application startup
// file" di hPanel. Pastikan `npm run build` sudah dijalankan lebih dulu
// (folder .next harus ada) -- lihat docs/deploy-hostinger.md.
const { createServer } = require("http");
const next = require("next");

const port = process.env.PORT || 3000;
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    handle(req, res);
  }).listen(port, () => {
    console.log(`Program Pelatihan Atlet siap di port ${port}`);
  });
});
