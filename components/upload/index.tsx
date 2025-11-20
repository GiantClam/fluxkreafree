"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { FileIcon } from "lucide-react";
import { nanoid } from "nanoid";
import { Accept } from "react-dropzone";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { cn, getMime } from "@/lib/utils";

import { BaseUpload } from "./base-upload";
import { RemoveAction } from "./remove-action";

let md5Worker: any;

export function formatSize(size: number) {
  const units = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  let i = 0;
  while (size >= 1024) {
    size /= 1024;
    i++;
  }
  return size.toFixed(2) + " " + units[i];
}

// Helper function to convert React Dropzone Accept type to string
function convertAcceptToString(accept?: Accept): string {
  if (!accept) return "image/*";
  
  if (typeof accept === "string") {
    return accept;
  }
  
  if (Array.isArray(accept)) {
    return accept[0] || "image/*";
  }
  
  // If it's an object, get the first key
  const keys = Object.keys(accept);
  return keys[0] || "image/*";
}

interface UploadValue {
  id?: string;
  url: string;
  completedUrl: string;
  key?: string;
  originFile?: File;
  md5?: string;
  fileType?: string;
}

interface FormUploadProps {
  accept?: Accept;
  maxSize?: number;
  maxFiles?: number;
  defaultImg?: string;
  value?: UploadValue[];
  className?: string;
  previewClassName?: string;
  disabled?: boolean;
  placeholder?: string | React.ReactNode;
  onChange?: (values: UploadValue[]) => void;
}

export const useGetLicenseSts = (config?: {
  onSuccess: (result: any) => void;
}) => {
  const { userId } = useAuth();

  return useMutation({
    mutationFn: async (values: any = {}) => {
      // 使用绝对路径，避免国际化路由前缀问题
      const apiUrl = `/api/s3/sts`;
      return fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
        credentials: 'include',
      }).then(async (res) => {
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`API error: ${res.status} ${errorText}`);
        }
        return res.json();
      });
    },
    onSuccess: async (result) => {
      config?.onSuccess(result);
    },
  });
};

const FormUpload = (props: FormUploadProps) => {
  const {
    value = [],
    placeholder = "Please drag and drop files to upload",
    onChange,
    className,
    previewClassName,
    disabled,
    accept,
    maxSize,
    maxFiles,
    defaultImg,
  } = props;
  const t = useTranslations("Upload");
  const getLicenseSts = useGetLicenseSts();
  const [uploadLoading, setUploadLoading] = useState(false);
  
  const handleFileChange = async (files: File[]) => {
    if (files.length) {
      try {
        setUploadLoading(true);
        
        // 检查文件数量限制（最多50张）
        const MAX_FILES = 50;
        const currentFileCount = value?.length || 0;
        const totalFileCount = currentFileCount + files.length;
        
        if (totalFileCount > MAX_FILES) {
          const allowedCount = MAX_FILES - currentFileCount;
          if (allowedCount <= 0) {
            toast.error(t("maxFilesExceeded", { max: MAX_FILES }));
            setUploadLoading(false);
            return;
          }
          // 只处理允许的文件数量
          files = files.slice(0, allowedCount);
          toast.warning(t("filesLimited", { count: allowedCount, max: MAX_FILES }));
        }
        
        // 支持批量上传：处理所有文件
        const uploadPromises = files.map(async (file) => {
          // 检查文件大小限制（如果设置了 maxSize）
          if (maxSize && file.size > maxSize) {
            throw new Error(`文件 ${file.name} 大小超过限制 ${maxSize / (1024 * 1024)} MB`);
          }

          const key = `${nanoid(12)}.${getMime(file.name) || "_"}`;

          const res = await getLicenseSts.mutateAsync({
            key,
            fileType: file.type,
          });
          if (res.error || !res?.data.putUrl || !res?.data.url) {
            throw new Error(res.error || "Failed to get upload information. Please try again later.");
          }

          let uploadResult: { url: string; key: string; completedUrl: string };
          
          try {
            // 尝试直接上传到 R2（预签名 URL）
            const uploadResponse = await fetch(res.data.putUrl, {
              body: file,
              method: "PUT",
              headers: {
                "Content-Type": file.type,
              },
            });

            if (!uploadResponse.ok) {
              throw new Error(`Upload failed: ${uploadResponse.status}`);
            }

            uploadResult = {
              url: res.data.url,
              key: res.data.key,
              completedUrl: res.data.completedUrl,
            };
          } catch (error: any) {
            // 如果直接上传失败（可能是 CORS 问题），立即使用服务器端代理上传
            // CORS 错误通常意味着预检请求失败，文件不会实际上传成功
            const isCorsError = error?.message?.includes('CORS') || 
                               error?.message?.includes('cors') ||
                               error?.message?.includes('Access-Control-Allow-Origin') ||
                               (error?.name === 'TypeError' && error?.message?.includes('Failed to fetch'));
            
            if (isCorsError) {
              console.log("CORS error detected, using server-side proxy upload");
            } else {
              console.warn("Direct upload failed, falling back to server-side upload:", error);
            }
            
            // 统一使用服务器端代理上传作为回退方案
            const formData = new FormData();
            formData.append("file", file);
            formData.append("key", key);

            const proxyResponse = await fetch("/api/s3/upload", {
              method: "POST",
              body: formData,
              credentials: "include",
            });

            if (!proxyResponse.ok) {
              const errorText = await proxyResponse.text();
              throw new Error(`Server-side upload failed: ${errorText}`);
            }

            const proxyResult = await proxyResponse.json();
            if (proxyResult.error) {
              throw new Error(proxyResult.error);
            }

            uploadResult = {
              url: proxyResult.data.url,
              key: proxyResult.data.key,
              completedUrl: proxyResult.data.completedUrl,
            };
          }

          return {
            url: uploadResult.url,
            key: uploadResult.key,
            completedUrl: uploadResult.completedUrl,
            id: nanoid(12),
            originFile: file,
          };
        });

        // 等待所有文件上传完成
        const newValues = await Promise.all(uploadPromises);
        
        // 更新值，支持批量添加
        onChange?.([...value, ...newValues]);
        
        if (newValues.length > 1) {
          toast.success(t("uploadSuccess", { count: newValues.length }));
        }
      } catch (error: any) {
        console.log("error->", error);
        toast.error(error?.message || error + "" || t("uploadFailed"));
      } finally {
        setUploadLoading(false);
      }
    }
  };

  return (
    <>
      {value?.length && Array.isArray(value) ? (
        <div className="w-full">
          {/* 多图网格布局：5列，多行 */}
          <div className="grid grid-cols-5 gap-2">
            {value.map((item) => {
              const type = item?.fileType || item?.originFile?.type;
              return (
                <div
                  className={cn(
                    "dark:!bg-navy-700 group relative flex h-[120px] w-full items-center justify-center rounded-xl border-gray-200 bg-gray-100 transition duration-300 dark:!border-none overflow-hidden",
                    previewClassName,
                    {
                      disabled,
                    },
                  )}
                  key={item.id}
                >
                  {!disabled && (
                    <RemoveAction
                      onClick={() => {
                        onChange?.(value.filter((_item) => _item.id !== item.id));
                      }}
                    />
                  )}
                  {type?.includes("image") ? (
                    <img src={item.url} className="aspect-auto h-full w-full object-cover" />
                  ) : type?.includes("video") ? (
                    <video src={item.url} className="aspect-auto h-full w-full object-cover" />
                  ) : (
                    <div className="dark:!bg-navy-700 flex aspect-auto flex-col items-center justify-center border-gray-200 bg-gray-100 dark:!border-none h-full w-full">
                      <FileIcon fontSize={24} />
                      <p className="max-w-[80%] truncate text-xs">{item.url}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {defaultImg && (
            <div
              className={cn(
                "pointer-events-none absolute z-10 h-full w-full",
                className,
              )}
            >
              <img src={defaultImg} className="h-full w-full" />
            </div>
          )}
          <BaseUpload
            className={className}
            onFileSelect={(files) => handleFileChange(files)}
            onFileRemove={() => {}}
            accept={convertAcceptToString(accept)}
            maxSize={maxSize}
            maxFiles={maxFiles}
            isUploading={uploadLoading}
            multiple={maxFiles !== 1}
          />
        </>
      )}
    </>
  );
};

export default FormUpload; 