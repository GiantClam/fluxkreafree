"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, X, FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface BaseUploadProps {
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  accept?: string;
  maxSize?: number;
  isUploading?: boolean;
  uploadProgress?: number;
  selectedFile?: File | null;
  className?: string;
}

export function BaseUpload({
  onFileSelect,
  onFileRemove,
  accept = "image/*",
  maxSize = 10 * 1024 * 1024, // 10MB
  isUploading = false,
  uploadProgress = 0,
  selectedFile,
  className,
}: BaseUploadProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    if (file.size > maxSize) {
      alert(`文件大小不能超过 ${maxSize / (1024 * 1024)} MB`);
      return;
    }
    
    onFileSelect(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  if (selectedFile) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileIcon className="h-5 w-5" />
              <span className="text-sm font-medium">{selectedFile.name}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onFileRemove}
              disabled={isUploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {isUploading && (
            <div className="mt-4 space-y-2">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-sm text-muted-foreground">
                上传中... {uploadProgress}%
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "border-2 border-dashed transition-colors",
        dragOver && "border-primary bg-primary/5",
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardContent className="p-6">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Upload className="h-10 w-10 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">拖拽文件到这里或点击上传</p>
            <p className="text-xs text-muted-foreground">
              支持 {accept} 格式，最大 {maxSize / (1024 * 1024)} MB
            </p>
          </div>
          <Button variant="outline" asChild>
            <label className="cursor-pointer">
              选择文件
              <input
                type="file"
                className="hidden"
                accept={accept}
                onChange={handleFileInput}
              />
            </label>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 