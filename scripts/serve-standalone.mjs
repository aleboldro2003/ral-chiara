import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "standalone", "ral-chiara.html");
createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-length": statSync(file).size });
  createReadStream(file).pipe(res);
}).listen(4173, () => console.log("standalone su http://localhost:4173"));
