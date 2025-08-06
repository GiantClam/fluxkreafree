import { useTranslations } from "next-intl";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/lib/navigation";
import { cn } from "@/lib/utils";

import { Icons } from "../shared/icons";

type Props = {
  locale: string;
};

export default function PricingCard(props: Props) {
  const t = useTranslations("IndexPage");

  return (
    <section className="py-8 md:py-12">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold sm:text-4xl mb-4">
            {t("action.pricing")}
          </h2>
          <p className="text-lg text-muted-foreground">
            Flux Krea Free - No Cost, No Limits, Just Pure AI Creativity
          </p>
        </div>
        
        <Card className="mx-auto max-w-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Flux Krea Free</CardTitle>
            <CardDescription className="text-lg">
              Experience Krea's FLUX.1 model completely free
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="mb-6">
              <span className="text-4xl font-bold">$0</span>
              <span className="text-muted-foreground">/forever</span>
            </div>
            
            <ul className="space-y-3 mb-8 text-left">
              <li className="flex items-center">
                <Icons.check className="mr-2 h-4 w-4 text-green-500" />
                Unlimited image generation
              </li>
              <li className="flex items-center">
                <Icons.check className="mr-2 h-4 w-4 text-green-500" />
                Access to FLUX.1 Pro, Dev, and Schnell models
              </li>
              <li className="flex items-center">
                <Icons.check className="mr-2 h-4 w-4 text-green-500" />
                Lightning-fast generation speed
              </li>
              <li className="flex items-center">
                <Icons.check className="mr-2 h-4 w-4 text-green-500" />
                State-of-the-art image quality
              </li>
              <li className="flex items-center">
                <Icons.check className="mr-2 h-4 w-4 text-green-500" />
                No watermarks or restrictions
              </li>
              <li className="flex items-center">
                <Icons.check className="mr-2 h-4 w-4 text-green-500" />
                Powered by Krea's open-source FLUX.1
              </li>
            </ul>
            
            <Link
              href="/app/generate"
              className={cn(
                buttonVariants({ size: "lg" }),
                "w-full"
              )}
            >
              <Icons.arrowRight className="mr-2 h-4 w-4" />
              Start Generating Free
            </Link>
            
            <p className="text-sm text-muted-foreground mt-4">
              Learn more about Krea's FLUX.1 open-source release
            </p>
            <Link
              href="https://www.krea.ai/blog/flux-krea-open-source-release"
              className="text-sm text-primary hover:underline"
              target="_blank"
            >
              Read the announcement →
            </Link>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
