import { model, ModelName } from "@/config/constants";

export const types = ["Flux AI", "Workflow"] as const;

export type ModelType = (typeof types)[number];

export interface Model<Type = string> {
  id: string;
  name: string;
  description: string;
  strengths?: string;
  type: Type;
}

export const models: Model<ModelType>[] = [
  {
    id: model.pro,
    name: ModelName[model.pro],
    description:
      "A distilled version of FLUX.1 that operates up to 10 times faster. text-to-image",
    type: "Flux AI",
    // strengths:
    //   "Complex intent, cause and effect, creative generation, search, summarization for audience",
  },
  {
    id: model.schnell,
    name: ModelName[model.schnell],
    description:
      "The pro version of FLUX.1, served in partnership with BFL text-to-image",
    type: "Flux AI",
    // strengths:
    //   "Language translation, complex classification, sentiment, summarization",
  },
  {
    id: model.dev,
    name: ModelName[model.dev],
    description:
      "FLUX.1, a 12B parameters text-to-image model with outstanding aesthetics. text-to-imageinference",
    type: "Flux AI",
  },
  {
    id: model.general,
    name: ModelName[model.general],
    description: "For LoRA use. Choose to see LoRAs.",
    type: "Flux AI",
  },
  {
    id: model.kreaDev,
    name: ModelName[model.kreaDev],
    description:
      "FLUX Krea Dev - 经济实惠的开发版本，成本优化，适合大量生成和测试",
    type: "Flux AI",
  },
  {
    id: model.clothingTryon,
    name: ModelName[model.clothingTryon],
    description:
      "Clothing Try-On - AI 虚拟试衣，上传全身自拍照和衣服图片，生成试穿效果",
    type: "Workflow",
  },
];
