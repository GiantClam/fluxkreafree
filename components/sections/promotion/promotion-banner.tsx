"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PromotionBannerProps {
  title: string;
  description?: string;
  ctaText?: string;
  ctaLink?: string;
  dismissible?: boolean;
  className?: string;
  variant?: "default" | "success" | "warning" | "destructive";
}

export function PromotionBanner({
  title,
  description,
  ctaText,
  ctaLink,
  dismissible = true,
  className,
  variant = "default",
}: PromotionBannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const variantStyles = {
    default: "bg-primary text-primary-foreground",
    success: "bg-green-600 text-white",
    warning: "bg-yellow-600 text-white",
    destructive: "bg-red-600 text-white",
  };

  return (
    <div
      className={cn(
        "relative w-full px-4 py-3",
        variantStyles[variant],
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            <div>
              <h3 className="text-sm font-medium">{title}</h3>
              {description && (
                <p className="text-sm opacity-90">{description}</p>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {ctaText && ctaLink && (
            <Button
              variant="secondary"
              size="sm"
              asChild
              className="bg-white text-primary hover:bg-gray-100"
            >
              <a href={ctaLink}>{ctaText}</a>
            </Button>
          )}
          
          {dismissible && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(false)}
              className="h-auto p-1 text-current hover:bg-white/20"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
} 