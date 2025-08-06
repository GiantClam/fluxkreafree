"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      className={className}
      onClick={handleCopy}
    >
      {copied ? "Copied!" : "Copy Prompt"}
    </Button>
  );
} 