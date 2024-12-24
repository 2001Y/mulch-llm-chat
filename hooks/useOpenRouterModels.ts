import { useState, useEffect } from "react";

export interface OpenRouterModel {
  fullId: string;
  shortId: string;
  icon?: string;
  name: string;
}

export function useOpenRouterModels() {
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch(
          "https://openrouter.ai/api/frontend/models"
        );
        const data = await response.json();
        const modelList = data.data.map((model: any) => ({
          fullId: model.slug,
          shortId: model.slug.split("/").pop()?.split(":")[0] || "",
          icon: model.endpoint?.provider_info?.icon?.url,
          name: model.name,
        }));
        setModels(modelList);
      } catch (error) {
        setError(error as Error);
        console.error("Failed to fetch models:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchModels();
  }, []);

  return { models, isLoading, error };
}
