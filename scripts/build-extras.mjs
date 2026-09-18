import { build } from "vite";

const common = {
  configFile: false,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    target: "chrome89"
  }
};

await build({
  ...common,
  build: {
    ...common.build,
    rollupOptions: {
      input: "content/content-script.js",
      output: {
        format: "iife",
        name: "TrapScanContent",
        inlineDynamicImports: true,
        entryFileNames: "content/content-script.js"
      }
    }
  }
});

await build({
  ...common,
  build: {
    ...common.build,
    rollupOptions: {
      input: "background/service-worker.js",
      output: {
        format: "iife",
        name: "TrapScanWorker",
        inlineDynamicImports: true,
        entryFileNames: "background/service-worker.js"
      }
    }
  }
});
