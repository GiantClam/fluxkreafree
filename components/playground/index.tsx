"use client";

import React, { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import copy from "copy-to-clipboard";
import { debounce } from "lodash-es";
import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const useCreateTask = useCreateTaskMutation();
  const [uploadInputImage, setUploadInputImage] = useState<any[]>([]);
  // clothing-tryon 模型专用的上传状态
  const [uploadUserPhoto, setUploadUserPhoto] = useState<any[]>([]);
  const [uploadTopClothes, setUploadTopClothes] = useState<any[]>([]);
  const [uploadBottomClothes, setUploadBottomClothes] = useState<any[]>([]);
  const t = useTranslations("Playground");
  const queryClient = useQueryClient();
  const [pricingCardOpen, setPricingCardOpen] = useState(false);
  const [lora, setLora] = React.useState<string>(loras.wukong);
  
  // 判断是否为 clothing-tryon 模型
  const isClothingTryon = selectedModel.id === model.clothingTryon;
  
  // 当切换模型时，清空 clothing-tryon 专用的上传状态
  useEffect(() => {
    if (!isClothingTryon) {
      setUploadUserPhoto([]);
      setUploadTopClothes([]);
      setUploadBottomClothes([]);
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
    if (queryData?.credit <= 0) {
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
        const topClothesUrl = uploadTopClothes?.[0]?.completedUrl;
        const bottomClothesUrl = uploadBottomClothes?.[0]?.completedUrl;
        
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
          if (res.code === 1000402) {
            setPricingCardOpen(true);
            error = t("error.insufficientCredits") ?? res.error;
          }
          toast.error(error);
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
          if (res.code === 1000402) {
            setPricingCardOpen(true);
            error = t("error.insufficientCredits") ?? res.error;
          }
          toast.error(error);
        }
      }
    } catch (error) {
      console.log("error", error);
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
            {isClothingTryon && (
              <div className="flex flex-col gap-4">
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
                    maxSize={5 * 1024 * 1024}
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
                    maxFiles={1}
                    maxSize={5 * 1024 * 1024}
                    placeholder={t("form.topClothesPlaceholder") || "Upload top clothing photo"}
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
                    maxFiles={1}
                    maxSize={5 * 1024 * 1024}
                    placeholder={t("form.bottomClothesPlaceholder") || "Upload bottom clothing photo"}
                    value={uploadBottomClothes}
                    onChange={setUploadBottomClothes}
                    previewClassName="h-[120px]"
                    accept={{
                      "image/*": [],
                    }}
                  />
                </div>
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
                      <div className="flex-1 rounded-md border p-4 lg:min-h-[320px]">
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm font-medium mb-2">
                              {t("form.userPhoto") || "Full-Body Photo"} <span className="text-red-500">*</span>
                            </p>
                            {uploadUserPhoto && uploadUserPhoto.length > 0 ? (
                              <div className="text-sm text-gray-500">
                                ✓ {uploadUserPhoto[0].filename || "Photo uploaded"}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400">
                                Please upload a full-body photo in the right panel
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium mb-2">
                              {t("form.topClothes") || "Top Clothes"} <span className="text-gray-500">(Optional)</span>
                            </p>
                            {uploadTopClothes && uploadTopClothes.length > 0 ? (
                              <div className="text-sm text-gray-500">
                                ✓ {uploadTopClothes[0].filename || "Photo uploaded"}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400">
                                Optional: Upload top clothing photo
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium mb-2">
                              {t("form.bottomClothes") || "Bottom Clothes"} <span className="text-gray-500">(Optional)</span>
                            </p>
                            {uploadBottomClothes && uploadBottomClothes.length > 0 ? (
                              <div className="text-sm text-gray-500">
                                ✓ {uploadBottomClothes[0].filename || "Photo uploaded"}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400">
                                Optional: Upload bottom clothing photo
                              </div>
                            )}
                          </div>
                          <div className="pt-2 border-t">
                            <p className="text-xs text-gray-500">
                              {t("form.clothingTryonHint") || "Upload at least one clothing item (top or bottom) along with your full-body photo to generate the try-on result."}
                            </p>
                          </div>
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
                          // Clothing Try-On 专用布局：图片铺满，标签和按钮在图片上
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
                            {/* 标签和按钮容器 - 绝对定位在图片上方 */}
                            <div className="absolute inset-0 flex items-start justify-between p-4">
                              {/* 左上角：标签 */}
                              <div className="bg-surface-alpha-strong text-content-base inline-flex items-center rounded-md border border-transparent px-1.5 py-0.5 font-mono text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                                {ModelName[fluxData?.model]}
                              </div>
                              {/* 右上角：下载按钮 */}
                              <div className="flex items-center">
                                <DownloadAction id={fluxData.id} skipAuthCheck={true} />
                              </div>
                            </div>
                          </>
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
