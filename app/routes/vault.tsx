import { api } from "convex/_generated/api";
import { useAction } from "convex/react";
import { Button } from "~/components/ui/button";

export default function Page() {
  const handleCreateWorkflow = useAction(api.workflows.createWorkflow);
  return (
    <div className="p-20">
      <div className="">Vault</div>
      <Button onClick={() => handleCreateWorkflow({ content: "Test content" })}>
        Create workflow
      </Button>
    </div>
  );
}
