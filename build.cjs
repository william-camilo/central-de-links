// Publica somente os arquivos do navegador; fontes do backend e testes ficam fora do site.
const fs = require('node:fs');
const path = require('node:path');
const output = path.join(__dirname, 'dist');
fs.mkdirSync(output, { recursive: true });
for (const name of ['index.html', 'layout.css']) {
  fs.copyFileSync(path.join(__dirname, name), path.join(output, name));
}
