// Passenger on shared cPanel hosting expects the startup file to create a
// listening HTTP server synchronously. The application itself remains ESM.
const http = require("node:http");

let handler = (_request, response) => {
  response.writeHead(503, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ error: "API is starting" }));
};

process.env.UNIFORM_KINGS_PASSENGER = "1";

const server = http.createServer((request, response) => handler(request, response));
server.listen(Number(process.env.PORT || 3001), () => {
  console.log("Uniform Kings API ready for Passenger");
});

import("./src/server.js")
  .then(({ default: app }) => {
    handler = app;
  })
  .catch((error) => {
    console.error("Uniform Kings API failed to start:", error);
  });
