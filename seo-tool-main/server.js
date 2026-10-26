import("tsx/esm/api").then(({ register }) => { register(); return import("./server.ts"); });
