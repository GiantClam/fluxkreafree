"use client";

import React, { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import copy from "copy-to-clipboard";
import { debounce } from "lodash-es";
import { Copy, ArrowDownToLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { toast } from "sonner";

import BlurFade from "@/components/magicui/blur-fade";
import { AspectRatioSelector } from "@/components/playground/aspect-selector";
import { ModelSelector } from "@/components/playground/model-selector";
import { Model, models, types } from "@/components/playground/models";
import { PrivateSwitch } from "@/components/playground/private-switch";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Locale } from "@/config";
import { Credits, loras, model, ModelName, Ratio } from "@/config/constants";
import {
  ChargeProductSelectDto,
  FluxSelectDto,
  UserCreditSelectDto,
} from "@/db/type";
import { cn, createRatio } from "@/lib/utils";

import { DownloadAction } from "../history/download-action";
import { PricingCardDialog } from "../pricing-cards";
import { EmptyPlaceholder } from "../shared/empty-placeholder";
import { Icons } from "../shared/icons";
import Upload from "../upload";
import ComfortingMessages from "./comforting";
import Loading from "./loading";
import JSZip from "jszip";

const aspectRatios = [Ratio.r1, Ratio.r2, Ratio.r3, Ratio.r4, Ratio.r5];

const useCreateTaskMutation = (config?: {
  onSuccess: (result: any) => void;
}) => {
  return useMutation({
    mutationFn: async (values: any) => {
      const res = await fetch("/api/generate", {
        body: JSON.stringify(values),
        method: "POST",
        credentials: 'include', // 使用 cookie 认证而不是 Bearer token
      });

      if (!res.ok && res.status >= 500) {
        throw new Error("Network response error");
      }

      return res.json();
    },
    onSuccess: async (result) => {
      config?.onSuccess(result);
    },
  });
};

export enum FluxTaskStatus {
  Processing = "processing",
  Succeeded = "succeeded",
  Failed = "failed",
  Canceled = "canceled",
}

export default function Playground({
  locale,
  chargeProduct,
}: {
  locale: string;
  chargeProduct?: ChargeProductSelectDto[];
}) {
  const [isPublic, setIsPublic] = React.useState(true);
  const [selectedModel, setSelectedModel] = React.useState<Model>(models[0]);
  const [ratio, setRatio] = React.useState<Ratio>(Ratio.r1);
  const [inputPrompt, setInputPrompt] = React.useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fluxId, setFluxId] = useState("");
  const [fluxData, setFluxData] = useState<FluxSelectDto>();
  // 批量任务的结果（用于 clothing try-on 多图展示）
  const [batchTaskIds, setBatchTaskIds] = useState<string[]>([]);
  const [batchTaskData, setBatchTaskData] = useState<FluxSelectDto[]>([]);
  const useCreateTask = useCreateTaskMutation();
  const [uploadInputImage, setUploadInputImage] = useState<any[]>([]);
  // clothing-tryon 模型专用的上传状态
  const [uploadUserPhoto, setUploadUserPhoto] = useState<any[]>([]);
  const [uploadTopClothes, setUploadTopClothes] = useState<any[]>([]);
  const [uploadBottomClothes, setUploadBottomClothes] = useState<any[]>([]);
  const t = useTranslations("Playground");
  const tBatch = useTranslations("Batch");
  const queryClient = useQueryClient();
  const [pricingCardOpen, setPricingCardOpen] = useState(false);
  const [lora, setLora] = React.useState<string>(loras.wukong);
  
  // 判断是否为 clothing-tryon 模型
  const isClothingTryon = selectedModel.id === model.clothingTryon;
  
  // 当切换模型时，清空 clothing-tryon 专用的上传状态和批量任务数据
  useEffect(() => {
    if (!isClothingTryon) {
      setUploadUserPhoto([]);
      setUploadTopClothes([]);
      setUploadBottomClothes([]);
      setBatchTaskIds([]);
      setBatchTaskData([]);
    }
  }, [isClothingTryon]);

  const queryTask = useQuery({
    queryKey: ["queryFluxTask", fluxId],
    enabled: !!fluxId,
    refetchInterval: (query) => {
      if (query.state.data?.data?.taskStatus === FluxTaskStatus.Processing) {
        return 2000;
      }
      return false;
    },
    queryFn: async () => {
      const res = await fetch("/api/task", {
        body: JSON.stringify({
          fluxId,
        }),
        method: "POST",
        credentials: 'include', // 使用 cookie 认证而不是 Bearer token
      });

      if (!res.ok) {
        throw new Error("Network response error");
      }

      return res.json();
    },
  });

  useEffect(() => {
    const key = "GENERATOR_PROMPT";
    const _prompt = window.sessionStorage.getItem(key);
    if (_prompt) {
      setInputPrompt(_prompt);
      window.sessionStorage.removeItem(key);
    }
  }, []);

  useEffect(() => {
    const onBeforeunload = () => {
      if (inputPrompt) {
        window.sessionStorage.setItem("GENERATOR_PROMPT", inputPrompt);
      }
    };
    window.addEventListener("beforeunload", onBeforeunload);
  }, [inputPrompt]);

  useEffect(() => {
    if (!queryTask.data?.data?.id) {
      return;
    }
    setFluxData(queryTask?.data?.data);
  }, [queryTask.data]);

  // 查询批量任务的结果
  const batchTaskQueries = useQuery({
    queryKey: ["queryBatchFluxTasks", batchTaskIds],
    enabled: isClothingTryon && batchTaskIds.length > 1,
    refetchInterval: (query) => {
      // 如果还有任务在处理中，继续轮询
      const allData = query.state.data as FluxSelectDto[] | undefined;
      if (allData?.some(task => task.taskStatus === FluxTaskStatus.Processing)) {
        return 2000;
      }
      return false;
    },
    queryFn: async () => {
      const results = await Promise.all(
        batchTaskIds.map(async (id) => {
          const res = await fetch("/api/task", {
            body: JSON.stringify({ fluxId: id }),
            method: "POST",
            credentials: 'include',
          });
          if (!res.ok) {
            throw new Error("Network response error");
          }
          const data = await res.json();
          return data.data;
        })
      );
      return results;
    },
  });

  useEffect(() => {
    if (batchTaskQueries.data && batchTaskQueries.data.length > 0) {
      setBatchTaskData(batchTaskQueries.data);
    }
  }, [batchTaskQueries.data]);

  const handleSubmit = async () => {
    // 对于 clothing-tryon 模型，验证用户照片
    if (isClothingTryon) {
      if (!uploadUserPhoto || uploadUserPhoto.length === 0) {
        return toast.error("Please upload a full-body photo");
      }
      // 至少需要上传一件衣服（上衣或下衣）
      if ((!uploadTopClothes || uploadTopClothes.length === 0) && 
          (!uploadBottomClothes || uploadBottomClothes.length === 0)) {
        return toast.error("Please upload at least one clothing item (top or bottom)");
      }
    } else {
      // 对于其他模型，验证 prompt
      if (!inputPrompt) {
        return toast.error("Please enter a prompt");
      }
    }
    
    const queryData = queryClient.getQueryData([
      "queryUserPoints",
    ]) as UserCreditSelectDto;
    
    // 检查积分是否足够支付所选模型的费用
    const needCredit = Credits[selectedModel.id] || 0;
    const currentCredit = queryData?.credit ?? 0;
    
    // 如果积分不足，显示错误并打开套餐选择框
    if (currentCredit < needCredit) {
      t("error.insufficientCredits") &&
        toast.error(t("error.insufficientCredits"));
      setPricingCardOpen(true);
      return;
    }
    setLoading(true);

    try {
      if (isClothingTryon) {
        // clothing-tryon 模型的请求参数
        const userPhotoUrl = uploadUserPhoto?.[0]?.completedUrl;
        const topClothesUrls = uploadTopClothes?.map(item => item.completedUrl) || [];
        const bottomClothesUrls = uploadBottomClothes?.map(item => item.completedUrl) || [];
        
        // 计算需要创建的任务数量
        const totalClothesCount = topClothesUrls.length + bottomClothesUrls.length;
        
        // 检查是否有批量上传的衣服
        if (totalClothesCount > 1) {
          // 批量创建任务
          const res = await fetch("/api/generate/batch", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              model: selectedModel.id,
              userPhotoUrl,
              topClothesUrls,
              bottomClothesUrls,
              isPrivate: isPublic ? 0 : 1,
              locale,
            }),
          });
          
          const result = await res.json();
          
          if (!result.error) {
            toast.success(tBatch("tasksCreated", { count: result.data?.length || 0 }));
            // 存储所有任务ID（用于多图展示）
            if (result.data && result.data.length > 0) {
              const taskIds = result.data.map((item: { id: string }) => item.id);
              setBatchTaskIds(taskIds);
              // 设置第一个任务的 ID 用于兼容单图展示逻辑
              setFluxId(taskIds[0]);
            }
            queryClient.invalidateQueries({ queryKey: ["queryUserPoints"] });
            queryClient.invalidateQueries({ queryKey: ["queryFluxTask"] });
          } else {
            let error = result.error;
            // 如果用户不存在（需要重新登录），引导用户登录
            if (result.code === 1000401 || result.error?.includes("sign in") || result.error?.includes("User not found")) {
              toast.error(t("error.pleaseSignIn") || "Please sign in to continue");
              // 触发登录流程
              signIn("google", {
                callbackUrl: window.location.href,
                redirect: true,
              });
              return;
            }
            // 如果积分不足，打开套餐选择框
            if (result.code === 1000402) {
              setPricingCardOpen(true);
              error = t("error.insufficientCredits") ?? result.error;
            }
            toast.error(error);
          }
        } else {
          // 单个任务（保持原有逻辑）
          const topClothesUrl = topClothesUrls[0];
          const bottomClothesUrl = bottomClothesUrls[0];
          
          const res = await useCreateTask.mutateAsync({
            model: selectedModel.id,
            userPhotoUrl,
            topClothesUrl,
            bottomClothesUrl,
            isPrivate: isPublic ? 0 : 1,
            locale,
          });
          console.log("res--->", res);
          if (!res.error) {
            setFluxId(res.id);
            queryClient.invalidateQueries({ queryKey: ["queryUserPoints"] });
          } else {
            let error = res.error;
            // 如果用户不存在（需要重新登录），引导用户登录
            if (res.code === 1000401 || res.error?.includes("sign in") || res.error?.includes("User not found")) {
              toast.error(t("error.pleaseSignIn") || "Please sign in to continue");
              // 触发登录流程
              signIn("google", {
                callbackUrl: window.location.href,
                redirect: true,
              });
              return;
            }
            // 如果积分不足，打开套餐选择框
            if (res.code === 1000402) {
              setPricingCardOpen(true);
              error = t("error.insufficientCredits") ?? res.error;
            }
            toast.error(error);
          }
        }
      } else {
        // 其他模型的请求参数
        const inputImageUrl = uploadInputImage
          ? uploadInputImage?.[0]?.completedUrl
          : undefined;
        const loraName = selectedModel.id === model.general ? lora : undefined;
        const res = await useCreateTask.mutateAsync({
          model: selectedModel.id,
          inputPrompt,
          aspectRatio: ratio,
          inputImageUrl,
          isPrivate: isPublic ? 0 : 1,
          loraName,
          locale,
        });
        console.log("res--->", res);
        if (!res.error) {
          setFluxId(res.id);
          queryClient.invalidateQueries({ queryKey: ["queryUserPoints"] });
        } else {
          let error = res.error;
          // 如果用户不存在（需要重新登录），引导用户登录
          if (res.code === 1000401 || res.error?.includes("sign in") || res.error?.includes("User not found")) {
            toast.error(t("error.pleaseSignIn") || "Please sign in to continue");
            // 触发登录流程
            signIn("google", {
              callbackUrl: window.location.href,
              redirect: true,
            });
            return;
          }
          // 如果积分不足，打开套餐选择框
          if (res.code === 1000402) {
            setPricingCardOpen(true);
            error = t("error.insufficientCredits") ?? res.error;
          }
          toast.error(error);
        }
      }
    } catch (error: any) {
      console.log("error", error);
      // 检查是否是 401 错误或用户需要登录
      if (error?.message?.includes("401") || 
          error?.message?.includes("Not authenticated") ||
          error?.message?.includes("sign in") ||
          error?.message?.includes("User not found")) {
        toast.error(t("error.pleaseSignIn") || "Please sign in to continue");
        // 触发登录流程
        signIn("google", {
          callbackUrl: window.location.href,
          redirect: true,
        });
        return;
      }
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };
  const debounceHandleSubmit = debounce(handleSubmit, 800);

  const generateLoading = useMemo(() => {
    return (
      queryTask.isPending ||
      queryTask.isLoading ||
      fluxData?.taskStatus === FluxTaskStatus.Processing
    );
  }, [fluxData, queryTask]);

  const copyPrompt = (prompt: string) => {
    copy(prompt);
    toast.success(t("action.copySuccess"));
  };

  return (
    <div className="overflow-hidden rounded-[0.5rem] border bg-background shadow">
      <div className="container h-full p-6">
        <div className="grid h-full items-stretch gap-6 md:grid-cols-[1fr_240px]">
          <div className="flex-col space-y-4 sm:flex md:order-2">
            <ModelSelector
              selectedModel={selectedModel}
              onChange={(model) => setSelectedModel(model)}
              types={types}
              lora={lora}
              onLoraChange={setLora}
              models={models}
            />
            {!isClothingTryon && (
              <AspectRatioSelector
                aspectRatios={aspectRatios}
                ratio={ratio}
                onChange={setRatio}
              />
            )}
            {selectedModel.id === model.dev && !isClothingTryon && (
              <div className="flx flex-col gap-4">
                <HoverCard openDelay={200}>
                  <HoverCardTrigger asChild>
                    <Label htmlFor="model">{t("form.inputImage")}</Label>
                  </HoverCardTrigger>
                  <HoverCardContent
                    align="start"
                    className="w-[260px] text-sm"
                    side="left"
                  >
                    {t("form.inputImageTooltip")}
                  </HoverCardContent>
                </HoverCard>
                <Upload
                  maxFiles={1}
                  maxSize={2 * 1024 * 1024}
                  placeholder={t("form.inputImagePlaceholder")}
                  value={uploadInputImage}
                  onChange={setUploadInputImage}
                  previewClassName="h-[120px]"
                  accept={{
                    "image/*": [],
                  }}
                />
              </div>
            )}

            {/* <TemperatureSelector defaultValue={[0.56]} /> */}
            {/* <MaxLengthSelector defaultValue={[256]} /> */}
          </div>
          <div className="md:order-1">
            <div className="flex flex-col space-y-4">
              <div className="grid h-full gap-6 lg:grid-cols-2">
                <div className="flex flex-col space-y-4">
                  {!isClothingTryon && (
                    <div className="flex flex-1 flex-col space-y-2">
                      <Label htmlFor="input">{t("form.input")}</Label>
                      <Textarea
                        id="input"
                        placeholder={t("form.placeholder")}
                        className="flex-1 lg:min-h-[320px]"
                        value={inputPrompt}
                        onChange={(e) => setInputPrompt(e.target.value)}
                      />
                    </div>
                  )}
                  {isClothingTryon && (
                    <div className="flex flex-1 flex-col space-y-2">
                      <Label htmlFor="input">{t("form.input") || "Input"}</Label>
                      <div className="flex-1 flex flex-col gap-4 rounded-md border p-4 lg:min-h-[320px]">
                        {/* 用户照片上传（必选） */}
                        <div className="flex flex-col gap-2">
                          <HoverCard openDelay={200}>
                            <HoverCardTrigger asChild>
                              <Label htmlFor="userPhoto">
                                {t("form.userPhoto") || "Full-Body Photo"} <span className="text-red-500">*</span>
                              </Label>
                            </HoverCardTrigger>
                            <HoverCardContent
                              align="start"
                              className="w-[260px] text-sm"
                              side="left"
                            >
                              {t("form.userPhotoTooltip") || "Upload a full-body photo of yourself"}
                            </HoverCardContent>
                          </HoverCard>
                          <Upload
                            maxFiles={1}
                            maxSize={20 * 1024 * 1024}
                            placeholder={t("form.userPhotoPlaceholder") || "Upload full-body photo"}
                            value={uploadUserPhoto}
                            onChange={setUploadUserPhoto}
                            previewClassName="h-[120px]"
                            accept={{
                              "image/*": [],
                            }}
                          />
                        </div>
                        {/* 上衣上传（可选） */}
                        <div className="flex flex-col gap-2">
                          <HoverCard openDelay={200}>
                            <HoverCardTrigger asChild>
                              <Label htmlFor="topClothes">
                                {t("form.topClothes") || "Top Clothes"} <span className="text-gray-500">(Optional)</span>
                              </Label>
                            </HoverCardTrigger>
                            <HoverCardContent
                              align="start"
                              className="w-[260px] text-sm"
                              side="left"
                            >
                              {t("form.topClothesTooltip") || "Upload a photo of the top clothing item"}
                            </HoverCardContent>
                          </HoverCard>
                          <Upload
                            maxFiles={50}
                            maxSize={20 * 1024 * 1024}
                            placeholder={t("form.topClothesPlaceholder")}
                            value={uploadTopClothes}
                            onChange={setUploadTopClothes}
                            previewClassName="h-[120px]"
                            accept={{
                              "image/*": [],
                            }}
                          />
                        </div>
                        {/* 下衣上传（可选） */}
                        <div className="flex flex-col gap-2">
                          <HoverCard openDelay={200}>
                            <HoverCardTrigger asChild>
                              <Label htmlFor="bottomClothes">
                                {t("form.bottomClothes") || "Bottom Clothes"} <span className="text-gray-500">(Optional)</span>
                              </Label>
                            </HoverCardTrigger>
                            <HoverCardContent
                              align="start"
                              className="w-[260px] text-sm"
                              side="left"
                            >
                              {t("form.bottomClothesTooltip") || "Upload a photo of the bottom clothing item"}
                            </HoverCardContent>
                          </HoverCard>
                          <Upload
                            maxFiles={50}
                            maxSize={20 * 1024 * 1024}
                            placeholder={t("form.bottomClothesPlaceholder")}
                            value={uploadBottomClothes}
                            onChange={setUploadBottomClothes}
                            previewClassName="h-[120px]"
                            accept={{
                              "image/*": [],
                            }}
                          />
                        </div>
                        <div className="pt-2 border-t">
                          <p className="text-xs text-gray-500">
                            {t("form.clothingTryonHint") || "Upload at least one clothing item (top or bottom) along with your full-body photo to generate the try-on result."}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col space-y-2">
                  <Label htmlFor="Result">{t("form.result")}</Label>
                  <div className="min-h-20 rounded-md border-0 md:min-h-[400px] md:border lg:min-h-[450px]">
                    {loading || (generateLoading && fluxId) ? (
                      <div className="flex size-full flex-col items-center justify-center">
                        <Loading />
                        <div className="text-content-light mt-3 px-4 text-center text-sm">
                          <ComfortingMessages language={locale as Locale} />
                        </div>
                      </div>
                    ) : fluxData?.id &&
                      fluxData.taskStatus === FluxTaskStatus.Succeeded ? (
                      <div
                        className={cn("size-full relative", {
                          "bg-muted": !fluxData?.imageUrl || !fluxId,
                        })}
                      >
                        {isClothingTryon ? (
                          // Clothing Try-On 专用布局
                          batchTaskData.length > 1 ? (
                            // 多图列表展示（样式与上传控件一致）
                            <div className="grid grid-cols-2 gap-4 p-4">
                              {batchTaskData.map((task, index) => (
                                <div
                                  key={task.id}
                                  className="dark:!bg-navy-700 relative flex h-[225px] w-full items-center justify-center rounded-xl border-gray-200 bg-gray-100 transition duration-300 dark:!border-none"
                                >
                                  {task.taskStatus === FluxTaskStatus.Succeeded && task.imageUrl ? (
                                    <>
                                      <img
                                        src={task.imageUrl}
                                        alt={`Generated Image ${index + 1}`}
                                        className="aspect-auto h-full object-cover rounded-xl"
                                      />
                                      {/* 按钮容器 - 绝对定位在图片上方 */}
                                      <div className="absolute inset-0 flex items-start justify-end p-2">
                                        {/* 右上角：下载按钮 */}
                                        <div className="flex items-center">
                                          <DownloadAction id={task.id} skipAuthCheck={true} />
                                        </div>
                                      </div>
                                    </>
                                  ) : task.taskStatus === FluxTaskStatus.Processing ? (
                                    <div className="flex size-full flex-col items-center justify-center">
                                      <Loading />
                                      <div className="text-content-light mt-3 px-4 text-center text-sm">
                                        <ComfortingMessages language={locale as Locale} />
                                      </div>
                                    </div>
                                  ) : task.taskStatus === FluxTaskStatus.Failed ? (
                                    <div className="flex min-h-96 items-center justify-center">
                                      <EmptyPlaceholder>
                                        <EmptyPlaceholder.Icon name="Eraser" />
                                        <EmptyPlaceholder.Title>
                                          {t("empty.title")}
                                        </EmptyPlaceholder.Title>
                                        <EmptyPlaceholder.Description>
                                          {t("empty.description", {
                                            error: task.errorMsg ?? t("empty.errorPlaceholder"),
                                          })}
                                        </EmptyPlaceholder.Description>
                                      </EmptyPlaceholder>
                                    </div>
                                  ) : (
                                    <div className="text-sm text-gray-400">Waiting...</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            // 单图展示（保持原有样式）
                            <>
                              {fluxData?.imageUrl && fluxId && (
                                <BlurFade key={fluxData?.imageUrl} inView>
                                  <img
                                    src={fluxData?.imageUrl}
                                    alt="Generated Image"
                                    className="pointer-events-none size-full rounded-md object-cover"
                                  />
                                </BlurFade>
                              )}
                              {/* 按钮容器 - 绝对定位在图片上方 */}
                              <div className="absolute inset-0 flex items-start justify-end p-4">
                                {/* 右上角：下载按钮 */}
                                <div className="flex items-center">
                                  <DownloadAction id={fluxData.id} skipAuthCheck={true} />
                                </div>
                              </div>
                            </>
                          )
                        ) : (
                          // 其他模型的原有布局
                          <>
                            <div
                              className={`w-full rounded-md ${createRatio(fluxData?.aspectRatio as Ratio)}`}
                            >
                              {fluxData?.imageUrl && fluxId && (
                                <BlurFade key={fluxData?.imageUrl} inView>
                                  <img
                                    src={fluxData?.imageUrl}
                                    alt="Generated Image"
                                    className={`pointer-events-none w-full rounded-md ${createRatio(fluxData?.aspectRatio as Ratio)}`}
                                  />
                                </BlurFade>
                              )}
                            </div>
                            <div className="text-content-light inline-block px-4 py-2 text-sm">
                              <p className="line-clamp-4 italic md:line-clamp-6 lg:line-clamp-[8]">
                                {fluxData?.inputPrompt}
                              </p>
                            </div>
                            <div className="flex flex-row flex-wrap space-x-1 px-4">
                              <div className="bg-surface-alpha-strong text-content-base inline-flex items-center rounded-md border border-transparent px-1.5 py-0.5 font-mono text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                                {ModelName[fluxData?.model]}
                              </div>
                            </div>
                            <div className="flex flex-row justify-between space-x-2 p-4">
                              <button
                                className="focus-ring text-content-strong border-stroke-strong hover:border-stroke-stronger data-[state=open]:bg-surface-alpha-light inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg border bg-transparent px-2.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
                                onClick={() => copyPrompt(fluxData.inputPrompt!)}
                              >
                                <Copy className="icon-xs me-1" />
                                {t("action.copy")}
                              </button>
                              <DownloadAction id={fluxData.id} skipAuthCheck={true} />
                            </div>
                          </>
                        )}
                      </div>
                    ) : fluxData?.taskStatus === FluxTaskStatus.Failed ? (
                      <div className="flex min-h-96 items-center justify-center">
                        <EmptyPlaceholder>
                          <EmptyPlaceholder.Icon name="Eraser" />
                          <EmptyPlaceholder.Title>
                            {t("empty.title")}
                          </EmptyPlaceholder.Title>
                          <EmptyPlaceholder.Description>
                            {t("empty.description", {
                              error:
                                fluxData?.errorMsg ??
                                t("empty.errorPlaceholder"),
                            })}
                          </EmptyPlaceholder.Description>
                        </EmptyPlaceholder>
                      </div>
                    ) : (
                      <div />
                    )}
                  </div>
                  {/* 全部下载按钮（仅 clothing try-on 且有多图时显示） */}
                  {isClothingTryon && batchTaskData.length > 1 && batchTaskData.some(task => task.taskStatus === FluxTaskStatus.Succeeded && task.imageUrl) && (
                    <div className="flex justify-center mt-4">
                      <Button
                        variant="outline"
                        onClick={async () => {
                          let loadingToastId: string | number | undefined;
                          try {
                            const zip = new JSZip();
                            const succeededTasks = batchTaskData.filter(
                              task => task.taskStatus === FluxTaskStatus.Succeeded && task.imageUrl
                            );
                            
                            loadingToastId = toast.loading(t("action.downloadAllLoading", { count: succeededTasks.length }));
                            
                            // 下载所有图片并添加到压缩包
                            await Promise.all(
                              succeededTasks.map(async (task, index) => {
                                try {
                                  const response = await fetch(`/api/download?fluxId=${task.id}`, {
                                    credentials: 'include',
                                  });
                                  if (!response.ok) {
                                    throw new Error(`Failed to download image ${index + 1}`);
                                  }
                                  const blob = await response.blob();
                                  const fileName = `${task.id}_${index + 1}.${blob.type.split("/")[1] || "jpg"}`;
                                  zip.file(fileName, blob);
                                } catch (error) {
                                  console.error(`Failed to download image ${index + 1}:`, error);
                                }
                              })
                            );
                            
                            // 生成压缩包并下载
                            const zipBlob = await zip.generateAsync({ type: "blob" });
                            const url = window.URL.createObjectURL(zipBlob);
                            const link = document.createElement("a");
                            link.href = url;
                            link.download = `clothing-tryon-results-${Date.now()}.zip`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(url);
                            
                            // 先关闭 loading toast，再显示成功消息
                            if (loadingToastId) {
                              toast.dismiss(loadingToastId);
                            }
                            toast.success(t("action.downloadAllSuccess", { count: succeededTasks.length }));
                          } catch (error) {
                            console.error("Failed to download all images:", error);
                            // 先关闭 loading toast，再显示错误消息
                            if (loadingToastId) {
                              toast.dismiss(loadingToastId);
                            }
                            toast.error(t("action.downloadAllError") || "Failed to download all images");
                          }
                        }}
                        className="w-full sm:w-auto"
                      >
                        <ArrowDownToLine className="mr-2 size-4" />
                        {t("action.downloadAll") || "Download All"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-5">
                <Button
                  className="w-40"
                  disabled={
                    (isClothingTryon 
                      ? (!uploadUserPhoto || uploadUserPhoto.length === 0) || 
                        ((!uploadTopClothes || uploadTopClothes.length === 0) && 
                         (!uploadBottomClothes || uploadBottomClothes.length === 0))
                      : !inputPrompt.length) ||
                    loading ||
                    (generateLoading && !!fluxId)
                  }
                  onClick={debounceHandleSubmit}
                >
                  {loading ? (
                    <>
                      <Icons.spinner className="mr-2 size-4 animate-spin" />{" "}
                      Loading...
                    </>
                  ) : (
                    <>
                      {t("form.submit")}
                      <Icons.PointIcon className="size-[14px]" />
                      <span>{Credits[selectedModel.id]}</span>
                    </>
                  )}
                </Button>
                <PrivateSwitch isPublic={isPublic} onChange={setIsPublic} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <PricingCardDialog
        onClose={setPricingCardOpen}
        isOpen={pricingCardOpen}
        chargeProduct={chargeProduct}
      />
    </div>
  );
}
