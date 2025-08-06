"use client";

import { useEffect } from "react";

export default function PricingRedirect() {
  useEffect(() => {
    window.location.href = "https://www.krea.ai/blog/flux-krea-open-source-release";
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Redirecting to Krea FLUX.1...</h1>
        <p className="text-muted-foreground">
          You will be redirected to the Krea FLUX.1 open source announcement page.
        </p>
        <p className="mt-4">
          <a 
            href="https://www.krea.ai/blog/flux-krea-open-source-release"
            className="text-primary hover:underline"
          >
            Click here if you are not redirected automatically
          </a>
        </p>
      </div>
    </div>
  );
} 