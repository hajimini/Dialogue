import { listPromptVersions } from "@/lib/ai/prompt-versions";
import PromptVersionsClient from "./PromptVersionsClient";

export default async function AdminPromptsPage() {
  const versions = await listPromptVersions();
  return <PromptVersionsClient initialVersions={versions} />;
}
