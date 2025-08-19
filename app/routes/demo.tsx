import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { toast } from "sonner";
import { MeshGradient } from "@paper-design/shaders-react";

export default function DemoRequest() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email");

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: email || "",
    company: "",
  });

  const updateDemoRequest = useMutation(api.demoRequests.updateDemoRequest);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName || !formData.lastName || !formData.company) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await updateDemoRequest({
        ...formData,
      });
      toast.success("Thank you! We'll be in touch soon.");
      navigate("/demo-success");
    } catch (error) {
      toast.error("Failed to submit details. Please try again.");
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen relative">
      <MeshGradient
        colors={["#dad9d4", "#535146", "#c96442", "#ede9de"]}
        distortion={0.5}
        swirl={0.3}
        speed={0.1}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: -1,
        }}
      />

      <div className="max-w-2xl mx-auto px-4 py-20">
        <div className="bg-white/95 p-8 md:p-12 shadow-xl">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Book a demo</h1>
            <p className="text-lg text-muted-foreground">
              Request a demo to see how Socro fits into your daily needs. Fill
              out the form and our team will get back to you shortly.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Input
                  value={formData.firstName}
                  onChange={(e) => handleChange("firstName", e.target.value)}
                  placeholder="First Name"
                  required
                />
              </div>
              <div>
                <Input
                  value={formData.lastName}
                  onChange={(e) => handleChange("lastName", e.target.value)}
                  placeholder="Last Name"
                  required
                />
              </div>
            </div>

            <div>
              <Input
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="Work Email"
                required
              />
            </div>
            <div>
              <Input
                value={formData.company}
                onChange={(e) => handleChange("company", e.target.value)}
                placeholder="Company Website"
                required
              />
            </div>

            <Button type="submit" size="lg" className="w-full">
              Request Demo
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
