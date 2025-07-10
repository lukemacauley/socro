import { ArrowDown, ArrowDownIcon, ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { useCallback } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export type AIConversationProps = ComponentProps<typeof StickToBottom>;

export const AIConversation = ({
  className,
  ...props
}: AIConversationProps) => (
  <StickToBottom
    className={cn("relative flex-1 overflow-y-auto", className)}
    initial="instant"
    resize="instant"
    role="log"
    {...props}
  />
);

export type AIConversationContentProps = ComponentProps<
  typeof StickToBottom.Content
>;

export const AIConversationContent = ({
  className,
  ...props
}: AIConversationContentProps) => (
  <StickToBottom.Content
    className={cn("px-4 pt-4 pb-12", className)}
    {...props}
  />
);

export const AIConversationScrollButton = () => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom({ animation: "instant" });
  }, [scrollToBottom]);

  return (
    !isAtBottom && (
      <Button
        className="absolute bottom-8 left-[50%] translate-x-[-50%] text-xs rounded-full"
        onClick={handleScrollToBottom}
        size="sm"
        type="button"
        variant="secondary"
      >
        Scroll to bottom <ChevronDown className="size-4" />
      </Button>
    )
  );
};
