// Phusion Passenger on shared cPanel hosting commonly loads its startup file
// through CommonJS, while the Uniform Kings backend is an ES module.
// This small bridge lets Passenger boot the existing application safely.
import("./src/server.js").catch((error) => {
  console.error("Uniform Kings API failed to start:", error);
  process.exitCode = 1;
});
