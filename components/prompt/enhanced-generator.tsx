"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import copy from "copy-to-clipboard";
import { debounce } from "lodash-es";
import { Copy, Eraser, Sparkles, BookOpen, Lightbulb, Zap, Target, Palette, Camera, Users, Building, Rocket, Brain } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Icons } from "../shared/icons";
import SignBox from "../sign-box";
import { CopyButton } from "./copy-button";

const useCreatePromptMutation = (config?: {
  onSuccess: (result: any) => void;
}) => {
  return useMutation({
    mutationFn: async (values: any) => {
      const res = await fetch("/api/prompt", {
        body: JSON.stringify(values),
        method: "POST",
        credentials: 'include',
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

const promptCategories = [
  {
    title: "📸 Photorealistic Portraits",
    icon: Palette,
    prompts: [
      "Professional headshot of a confident business woman, natural lighting, shallow depth of field, 85mm lens, realistic skin texture",
      "Close-up portrait of an elderly man with weathered hands, soft window light, authentic wrinkles, genuine smile",
      "Candid photo of a young artist in their studio, natural expression, golden hour lighting, authentic environment",
      "Street photography style portrait, natural lighting, authentic emotions, real-world setting",
      "Environmental portrait of a chef in professional kitchen, natural lighting, realistic textures"
    ]
  },
  {
    title: "🌅 Natural Photography",
    icon: Camera,
    prompts: [
      "Breathtaking sunrise over mountain range, natural lighting, photorealistic landscape photography, crisp details",
      "Misty forest path with dappled sunlight, authentic nature photography, rich earth tones, realistic textures",
      "Calm lake reflection at golden hour, natural colors, professional landscape photography, no oversaturation",
      "Desert canyon with natural rock formations, warm natural lighting, realistic geological details",
      "Coastal scene with natural wave motion, authentic ocean colors, realistic water textures"
    ]
  },
  {
    title: "🏘️ Lifestyle & Documentary",
    icon: Users,
    prompts: [
      "Authentic street scene in a busy marketplace, natural lighting, documentary photography style, real human interactions",
      "Cozy coffee shop interior with natural window light, realistic atmosphere, authentic daily life moment",
      "Family gathering around dinner table, warm natural lighting, genuine emotions, photojournalistic style",
      "Artisan at work in traditional workshop, natural lighting, realistic textures, authentic craftsmanship details",
      "Urban life scene with natural city lighting, realistic architecture, authentic human behavior"
    ]
  },
  {
    title: "🏗️ Architectural Photography",
    icon: Building,
    prompts: [
      "Modern minimalist building with clean lines, natural daylight, architectural photography, realistic materials",
      "Historic brick building with authentic weathering, natural lighting, realistic texture details",
      "Contemporary glass office building, professional architectural photography, natural reflections",
      "Traditional wooden house with natural aging, authentic materials, realistic environmental wear",
      "Urban street with mixed architecture, natural lighting, realistic city atmosphere"
    ]
  },
  {
    title: "🎬 Cinematic Realism",
    icon: Rocket,
    prompts: [
      "Cinematic close-up of hands working with clay, natural lighting, shallow depth of field, realistic textures",
      "Film noir style street scene, dramatic natural shadows, authentic urban atmosphere, realistic lighting",
      "Documentary style workshop interior, natural lighting, authentic tools and materials, realistic environment",
      "Cinematic wide shot of person walking through forest, natural lighting, realistic nature details",
      "Movie-style kitchen scene with natural morning light, authentic daily life, realistic props"
    ]
  },
  {
    title: "🎨 Professional Photography",
    icon: Brain,
    prompts: [
      "Product photography of handmade ceramic mug, natural lighting, realistic textures, no artificial enhancement",
      "Food photography with natural ingredients, authentic presentation, realistic colors, natural lighting",
      "Fashion photography with natural poses, realistic fabric textures, authentic styling, natural lighting",
      "Still life photography with natural objects, realistic shadows, authentic materials, natural composition",
      "Interior design photography with natural lighting, realistic textures, authentic lived-in atmosphere"
    ]
  }
];

const quickPrompts = [
  "Professional portrait with natural lighting, realistic skin texture",
  "Cozy coffee shop interior, natural window light, authentic atmosphere",
  "Street photography scene, documentary style, natural interactions",
  "Landscape photography at golden hour, natural colors, no oversaturation",
  "Architectural photography, clean lines, natural lighting",
  "Food photography with natural ingredients, authentic presentation",
  "Candid family moment, natural expressions, warm lighting",
  "Product photography with realistic textures, natural shadows"
];

export default function EnhancedGenerator() {
  const [userInput, setUserInput] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [activeTab, setActiveTab] = useState("generator");
  const t = useTranslations("PromptGenerator");
  const usePrompt = useCreatePromptMutation();
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setGeneratedPrompt("");
      const res = await usePrompt.mutateAsync({
        prompt: userInput,
      });
      if (!res.error) {
        setGeneratedPrompt(res.prompt);
      } else {
        if (res.error.includes("Authentication") || res.error.includes("sign in")) {
          toast.error("Please sign in to use the prompt generator");
        } else {
          toast.error(res.error);
        }
      }
    } catch (error) {
      console.log("error", error);
      if (error.message?.includes("401") || error.message?.includes("Authentication")) {
        toast.error("Please sign in to use the prompt generator");
      } else {
        toast.error("An error occurred while generating the prompt");
      }
    } finally {
      setLoading(false);
    }
  };

  const debounceHandleGenerate = debounce(handleGenerate, 800);

  const copyPrompt = (prompt: string) => {
    copy(prompt);
    toast.success("Prompt copied to clipboard!");
  };

  const handleNavigate = () => {
    copy(generatedPrompt);
    window.sessionStorage.setItem('GENERATOR_PROMPT', generatedPrompt);
  };

  const handleQuickPrompt = (prompt: string) => {
    setUserInput(prompt);
    setActiveTab("generator");
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="generator" className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            {t("tabs.generator")}
          </TabsTrigger>
          <TabsTrigger value="guide" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            {t("tabs.guide")}
          </TabsTrigger>
          <TabsTrigger value="examples" className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            {t("tabs.examples")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generator" className="space-y-6">
          {/* Quick Prompts Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                {t("quickPrompts.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((prompt, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => handleQuickPrompt(prompt)}
                  >
                    {prompt}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Generator Section */}
          <Card>
            <CardHeader>
              <CardTitle>{t("form.input.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Textarea
                  id="userInput"
                  placeholder={t("form.input.placeholder")}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            </CardContent>
            <CardFooter>
              <SignBox>
                <Button
                  onClick={debounceHandleGenerate}
                  disabled={loading || !userInput.length}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Icons.spinner className="mr-2 size-4 animate-spin" />
                      {t("form.action.generating")}
                    </>
                  ) : (
                    <>{t("form.action.generate")}</>
                  )}
                </Button>
              </SignBox>
            </CardFooter>
          </Card>

          {generatedPrompt && (
            <Card>
              <CardHeader>
                <CardTitle>{t("form.output.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="min-h-[100px] rounded-md bg-muted p-4">
                  {generatedPrompt}
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2 md:flex-row justify-between">
                <CopyButton text={generatedPrompt} className="mt-2" />
                <Link
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "group relative w-full max-w-52 items-center justify-center gap-2 overflow-hidden whitespace-pre rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-all duration-300 ease-out hover:bg-primary/90 hover:ring-2 hover:ring-primary hover:ring-offset-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 md:flex",
                  )}
                  onClick={handleNavigate}
                  href="/app/generate"
                >
                  <span className="absolute right-0 -mt-12 h-32 w-8 translate-x-12 rotate-12 bg-white opacity-10 transition-all duration-1000 ease-out group-hover:-translate-x-40" />
                  <div className="flex items-center">
                    <Eraser className="mr-2 size-4" />
                    <span className="whitespace-pre-wrap text-center text-sm font-medium leading-none tracking-tight text-white dark:from-white dark:to-slate-900/10 dark:text-slate-900">
                      {t("form.action.to_generate")}
                    </span>
                  </div>
                </Link>
              </CardFooter>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="guide" className="space-y-6">
          {/* How to Use Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{t("guide.howToUse.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                {t("guide.howToUse.description")}
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-lg mb-2">{t("guide.howToUse.proTips.title")}</h3>
                  <ul className="text-muted-foreground space-y-1">
                    <li>• {t("guide.howToUse.proTips.tips.0")}</li>
                    <li>• {t("guide.howToUse.proTips.tips.1")}</li>
                    <li>• {t("guide.howToUse.proTips.tips.2")}</li>
                    <li>• {t("guide.howToUse.proTips.tips.3")}</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">{t("guide.howToUse.modelSelection.title")}</h3>
                  <ul className="text-muted-foreground space-y-1">
                    <li>• {t("guide.howToUse.modelSelection.models.0")}</li>
                    <li>• {t("guide.howToUse.modelSelection.models.1")}</li>
                    <li>• {t("guide.howToUse.modelSelection.models.2")}</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Advanced Techniques */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{t("guide.advancedTechniques.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-lg mb-2">{t("guide.advancedTechniques.structure.title")}</h3>
                  <p className="text-muted-foreground">
                    {t("guide.advancedTechniques.structure.description")}
                    <br />
                    <code className="text-sm bg-gray-100 p-2 rounded block mt-2">
                      {t("guide.advancedTechniques.structure.template")}
                    </code>
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">{t("guide.advancedTechniques.styleKeywords.title")}</h3>
                  <ul className="text-muted-foreground space-y-1">
                    <li>• {t("guide.advancedTechniques.styleKeywords.keywords.0")}</li>
                    <li>• {t("guide.advancedTechniques.styleKeywords.keywords.1")}</li>
                    <li>• {t("guide.advancedTechniques.styleKeywords.keywords.2")}</li>
                    <li>• {t("guide.advancedTechniques.styleKeywords.keywords.3")}</li>
                    <li>• {t("guide.advancedTechniques.styleKeywords.keywords.4")}</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="examples" className="space-y-6">
          {promptCategories.map((category, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <category.icon className="w-5 h-5" />
                  {category.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {category.prompts.map((prompt, promptIndex) => (
                    <div key={promptIndex} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                      <p className="text-sm font-mono bg-gray-100 p-3 rounded border-l-4 border-blue-500">
                        {prompt}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <CopyButton 
                          text={prompt}
                          className="mt-2"
                        />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-2"
                          onClick={() => handleQuickPrompt(prompt)}
                        >
                          {t("examples.useInGenerator")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Call to Action */}
      <div className="text-center bg-gradient-to-r from-purple-50 to-blue-50 p-8 rounded-lg mt-8">
        <h2 className="text-2xl font-bold mb-4">{t("cta.title")}</h2>
        <p className="text-lg mb-6">
          {t("cta.description")}
        </p>
        <Button asChild size="lg">
          <Link href="/app/generate">{t("cta.button")}</Link>
        </Button>
        <p className="text-sm text-muted-foreground mt-4">
          {t("cta.subtext")}
        </p>
      </div>
    </div>
  );
} 