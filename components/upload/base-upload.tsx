"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, X, FileIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface BaseUploadProps {
  onFileSelect: (files: File[]) => void;
  onFileRemove: () => void;
  accept?: string;
  maxSize?: number;
  maxFiles?: number;
  isUploading?: boolean;
  uploadProgress?: number;
  selectedFile?: File | null;
  className?: string;
  multiple?: boolean;
}

export function BaseUpload({
  onFileSelect,
  onFileRemove,
  accept = "image/*",
  maxSize = 10 * 1024 * 1024, // 10MB
  maxFiles,
  isUploading = false,
  uploadProgress = 0,
  selectedFile,
  className,
  multiple = false,
}: BaseUploadProps) {
  const t = useTranslations("Upload");
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
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files);
    }
  };

  const handleFileSelect = (files: File | File[]) => {
    const fileArray = Array.isArray(files) ? files : [files];
    
    // 检查文件数量限制
    if (maxFiles && fileArray.length > maxFiles) {
      const sizeInMB = maxSize / (1024 * 1024);
      alert(t("maxFilesExceeded", { max: maxFiles, size: sizeInMB }));
      // 只选择允许的文件数量
      const filesToSelect = fileArray.slice(0, maxFiles);
      onFileSelect(filesToSelect);
      return;
    }
    
    // 检查文件大小
    const oversizedFiles = fileArray.filter(file => file.size > maxSize);
    if (oversizedFiles.length > 0) {
      const sizeInMB = maxSize / (1024 * 1024);
      const fileNames = oversizedFiles.map(f => f.name).join('\n');
      alert(t("fileSizeExceeded", { size: sizeInMB, files: fileNames }));
      return;
    }
    
    // 如果 multiple 为 false，只选择第一个文件
    const filesToSelect = multiple ? fileArray : fileArray.slice(0, 1);
    onFileSelect(filesToSelect);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      handleFileSelect(fileArray);
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
                {t("uploading")} {uploadProgress}%
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
            <p className="text-sm font-medium">
              {multiple ? t("dragMultiple") : t("dragSingle")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("fileSizeLimit", { accept, size: maxSize / (1024 * 1024) })}{multiple ? t("multipleAllowed") : ""}
            </p>
          </div>
          <Button variant="outline" asChild>
            <label className="cursor-pointer">
              {t("selectFile")}
              <input
                type="file"
                className="hidden"
                accept={accept}
                onChange={handleFileInput}
                multiple={multiple}
              />
            </label>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 