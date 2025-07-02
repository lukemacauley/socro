import { api } from "convex/_generated/api";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

export function TestMessageCreator() {
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const createTestConversation = useMutation(
    api.conversations.createTestConversation
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !content.trim() || !senderEmail.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsCreating(true);
    try {
      await createTestConversation({
        subject: subject.trim(),
        content: content.trim(),
        senderName: senderName.trim() || undefined,
        senderEmail: senderEmail.trim(),
      });

      // Reset form
      setSubject("");
      setContent("");
      setSenderName("");
      setSenderEmail("");

      toast.success("Test conversation created!");
    } catch (error) {
      toast.error("Failed to create test conversation");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-semibold mb-4">
          Create Test Email Conversation
        </h2>
        <p className="text-gray-600 mb-6">
          Since you don't have any conversations yet, you can create a test
          email to see how the AI assistant works.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="senderEmail"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Sender Email *
            </label>
            <input
              id="senderEmail"
              type="email"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="sender@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label
              htmlFor="senderName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Sender Name
            </label>
            <input
              id="senderName"
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="John Doe"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="subject"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Subject *
            </label>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Meeting request for next week"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label
              htmlFor="content"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email Content *
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Hi there, I'd like to schedule a meeting with you next week to discuss the project. Are you available on Tuesday or Wednesday afternoon? Please let me know what works best for you."
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isCreating}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? "Creating..." : "Create Test Conversation"}
          </button>
        </form>
      </div>
    </div>
  );
}
