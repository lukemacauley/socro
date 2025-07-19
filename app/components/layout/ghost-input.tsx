import { useRef, useState } from "react";
import { Input, type InputProps } from "../ui/input";
import { toast } from "sonner";
import { cn } from "~/lib/utils";

type GhostInputProps = Omit<InputProps, "value" | "onChange" | "onBlur"> & {
  value: string;
  onSave?: (value: string) => void | Promise<void>;
  onCancel?: () => void;
  emptyMessage?: string;
};

export default function GhostInput({
  className,
  value,
  onSave,
  onCancel,
  emptyMessage = "Value cannot be empty",
  variant = "ghost",
  ...props
}: GhostInputProps) {
  const [editValue, setEditValue] = useState(value);
  const [isReadOnly, setIsReadOnly] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    if (editValue === "") {
      toast.error(emptyMessage);
      setIsReadOnly(true);
      setEditValue(value);
      onCancel?.();
      return;
    }

    if (editValue !== value) {
      await onSave?.(editValue);
      setIsReadOnly(true);
      inputRef.current?.blur();
      return;
    }

    setIsReadOnly(true);
    inputRef.current?.blur();
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsReadOnly(true);
    onCancel?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <Input
      ref={inputRef}
      value={isReadOnly ? value : editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={handleKeyDown}
      readOnly={isReadOnly}
      variant="ghost"
      onDoubleClick={() => {
        setIsReadOnly(false);
        setEditValue(value);
      }}
      className={cn(
        // isReadOnly
        //   ? "min-w-0"
        //   : "w-96 selection:bg-muted selection:text-foreground",
        className
      )}
      {...props}
    />
  );
}
