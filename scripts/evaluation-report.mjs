import fs from "node:fs";
import path from "node:path";

const storePath = path.join(process.cwd(), ".data", "app-store.json");

if (!fs.existsSync(storePath)) {
  console.error("No app store found at .data/app-store.json");
  process.exit(1);
}

const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
const logs = Array.isArray(store.evaluationLogs) ? store.evaluationLogs : [];
const promptVersions = Array.isArray(store.promptVersions) ? store.promptVersions : [];

const scoreFields = [
  ["role_adherence", "角色一致"],
  ["naturalness", "自然度"],
  ["emotional_accuracy", "情绪准确"],
  ["memory_accuracy", "记忆衔接"],
  ["anti_ai_score", "去 AI 味"],
  ["length_appropriate", "长度合适"],
];

function average(field, input) {
  const values = input
    .map((item) => item[field])
    .filter((value) => typeof value === "number");

  if (values.length === 0) {
    return "-";
  }

  const sum = values.reduce((total, value) => total + value, 0);
  return (sum / values.length).toFixed(2);
}

function countBy(items, getter) {
  return items.reduce((map, item) => {
    const key = getter(item);
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map());
}

console.log("# Evaluation Report");
console.log("");
console.log(`- Total logs: ${logs.length}`);
console.log(`- Positive feedback: ${logs.filter((item) => item.feedback_type === "up").length}`);
console.log(`- Negative feedback: ${logs.filter((item) => item.feedback_type === "down").length}`);
console.log("");
console.log("## Metric Averages");
console.log("");
console.log("| Metric | Average | Samples |");
console.log("| --- | ---: | ---: |");

for (const [field, label] of scoreFields) {
  const samples = logs.filter((item) => typeof item[field] === "number").length;
  console.log(`| ${label} | ${average(field, logs)} | ${samples} |`);
}

console.log("");
console.log("## Prompt Versions");
console.log("");
console.log("| Prompt | Logs |");
console.log("| --- | ---: |");

for (const version of promptVersions) {
  const total = logs.filter((item) => item.prompt_version === version.id).length;
  console.log(`| ${version.label} | ${total} |`);
}

console.log("");
console.log("## Sources");
console.log("");
console.log("| Source | Count |");
console.log("| --- | ---: |");

for (const [source, count] of countBy(logs, (item) => item.source ?? "unknown")) {
  console.log(`| ${source} | ${count} |`);
}

console.log("");
console.log("## Negative Reasons");
console.log("");
console.log("| Reason | Count |");
console.log("| --- | ---: |");

for (const [reason, count] of countBy(
  logs.filter((item) => item.feedback_reason),
  (item) => item.feedback_reason,
)) {
  console.log(`| ${reason} | ${count} |`);
}
