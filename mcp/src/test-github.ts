import { listLearningDirectory } from "./github.js";

const files = await listLearningDirectory();

console.log(
  files
    .filter((item) => item.type === "file")
    .slice(0, 10)
);
