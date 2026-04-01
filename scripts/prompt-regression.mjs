import fs from "node:fs";
import path from "node:path";

const inputPath = path.join(process.cwd(), "docs", "TEST_CASES.md");

if (!fs.existsSync(inputPath)) {
  console.error("Missing docs/TEST_CASES.md");
  process.exit(1);
}

const lines = fs.readFileSync(inputPath, "utf8").split(/\r?\n/);
const cases = [];

for (const line of lines) {
  if (!line.startsWith("|")) {
    continue;
  }

  const cells = line
    .split("|")
    .slice(1, -1)
    .map((item) => item.trim());

  if (cells.length < 4) {
    continue;
  }

  const [id, category, message, expected, setup = ""] = cells;

  if (!id || id === "用例编号" || id.startsWith("---")) {
    continue;
  }

  cases.push({
    id,
    category,
    message,
    expected,
    setup,
  });
}

console.log(JSON.stringify(cases, null, 2));
