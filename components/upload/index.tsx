"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { FileIcon } from "lucide-react";
import { nanoid } from "nanoid";
import { Accept } from "react-dropzone";
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
      return fetch(`/api/s3/sts`, {
        method: "POST",
        body: JSON.stringify(values),
        credentials: 'include',
      }).then((res) => res.json());
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
  const getLicenseSts = useGetLicenseSts();
  const [uploadLoading, setUploadLoading] = useState(false);
  
  const handleFileChange = async (files: File[]) => {
    if (files.length) {
      try {
        setUploadLoading(true);
        const file: File = files[0];
        const key = `${nanoid(12)}.${getMime(file.name) || "_"}`;

        const res = await getLicenseSts.mutateAsync({
          key,
          fileType: file.type,
        });
        if (res.error || !res?.data.putUrl || !res?.data.url) {
          toast.error(res.error || "Failed to get upload information. Please try again later.");
          return;
        }
        const formData = new FormData();
        formData.append("file", file);
        await Promise.all([
          fetch(res.data.putUrl, {
            body: file,
            method: "PUT",
            headers: {
              "Content-Type": file.type,
            },
          }),
        ]);

        const newValue = {
          url: res?.data?.url,
          key: res?.data?.key,
          completedUrl: res?.data?.completedUrl,
          id: nanoid(12),
          originFile: file,
        };
        onChange?.([...value, newValue]);
      } catch (error) {
        console.log("error->", error);
        toast.error(error + "" || "Upload failed! Please try again later.");
      } finally {
        setUploadLoading(false);
      }
    }
  };

  return (
    <>
      {value?.length && Array.isArray(value) ? (
        <div
          className={cn(
            "dark:!bg-navy-700 relative flex h-[225px] w-full items-center justify-center rounded-xl border-gray-200 bg-gray-100 transition duration-300 dark:!border-none",
            previewClassName,
            {
              disabled,
            },
          )}
        >
          {value.map((item) => {
            const type = item?.fileType || item?.originFile?.type;
            return (
              <div
                className="group relative h-full w-full overflow-hidden flex justify-center"
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
                  <img src={item.url} className="aspect-auto h-full object-cover" />
                ) : type?.includes("video") ? (
                  <video src={item.url} className="aspect-auto" />
                ) : (
                  <div className="dark:!bg-navy-700 flex aspect-auto flex-col items-center justify-center border-gray-200 bg-gray-100 dark:!border-none">
                    <FileIcon fontSize={24} />
                    <p className="max-w-[50%] truncate">{item.url}</p>
                  </div>
                )}
              </div>
            );
          })}
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
            onFileSelect={(file) => handleFileChange([file])}
            onFileRemove={() => {}}
            accept={convertAcceptToString(accept)}
            maxSize={maxSize}
            isUploading={uploadLoading}
          />
        </>
      )}
    </>
  );
};

export default FormUpload; 