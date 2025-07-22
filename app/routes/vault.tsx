import { api } from "convex/_generated/api";
import { useAction } from "convex/react";
import type { Workflow } from "convex/workflows";
import { useState } from "react";
import { Button } from "~/components/ui/button";

export default function Page() {
  const createWorkflow = useAction(api.workflows.createWorkflow);
  const [result, setResult] = useState<Workflow | null>(null);

  const handleCreateWorkflow = async (args: { content: string }) => {
    try {
      const result = await createWorkflow(args);
      setResult(result);
      console.log("Workflow created successfully:", result);
    } catch (error) {
      console.error("Error creating workflow:", error);
    }
  };

  return (
    <div className="p-20">
      <div className="">Vault</div>
      <Button onClick={() => handleCreateWorkflow({ content: "Test content" })}>
        Create workflow
      </Button>
      {result && (
        <pre className="mt-4 p-4 bg-gray-100 rounded">
          <code>{JSON.stringify(result, null, 2)}</code>
        </pre>
      )}
    </div>
  );
}
