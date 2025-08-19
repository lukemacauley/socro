import { MeshGradient } from "@paper-design/shaders-react";
import { api } from "convex/_generated/api";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export default function EmailSignup() {
  const [email, setEmail] = useState("");
  const [responseMessage, setResponseMessage] = useState("");
  const submitDemoRequest = useMutation(api.demoRequests.submitDemoRequest);

  const handleDemoSubmit = async () => {
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    try {
      const result = await submitDemoRequest({ email });
      setResponseMessage(result.message);
      if (result.success) {
        setEmail("");
      }
    } catch (error) {
      toast.error(
        "Invalid email address. Please try again with a valid email."
      );
    }
  };

  if (responseMessage) {
    setTimeout(() => {
      setResponseMessage("");
    }, 5000);
  }

  return (
    <div className="relative">
      <MeshGradient
        colors={["#535146", "#83827d", "#28261b"]}
        distortion={1}
        swirl={0.8}
        speed={0.1}
        style={{ width: "100%", height: "500px" }}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="max-w-3xl w-full">
          <h3 className="text-xl md:text-3xl text-center text-pretty text-white">
            Let’s connect you with a Socro expert.
            <br />
            See the full power of Socro in 30 minutes.
          </h3>
          <div className="flex flex-col md:flex-row items-center gap-2 mt-10">
            <Input
              className="!bg-primary-foreground h-12 sm:h-16 text-xl sm:!text-2xl"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && email) {
                  handleDemoSubmit();
                }
              }}
            />
            <Button
              size="lg"
              className="h-12 sm:h-16 w-full sm:w-auto text-xl sm:text-2xl"
              variant="secondary"
              onClick={handleDemoSubmit}
            >
              Book a demo
            </Button>
          </div>
          {responseMessage && (
            <div className="mt-2 text-left text-primary-foreground">
              {responseMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
