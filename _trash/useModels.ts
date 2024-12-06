import { useState, useEffect } from "react";

export type Model = {
  fullId: string;
  shortId: string;
};

export function useModels() {
  const [allModels, setAllModels] = useState<Model[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/models");
        const data = await response.json();
        const modelIds = data.data.map((model: any) => ({
          fullId: model.id,
          shortId: model.id.split("/").pop(),
        }));
        setAllModels(modelIds);
      } catch (error) {
        console.error("モデルリストの取得に失敗しました:", error);
      }
    };
    fetchModels();
  }, []);

  const extractModelsFromInput = (inputContent: any): string[] => {
    const textContent = inputContent
      .filter((item: any) => item.type === "text" && item.text)
      .map((item: any) => item.text)
      .join(" ");

    const modelMatches = textContent.match(/@(\S+)/g) || [];
    return modelMatches
      .map((match: string) => match.slice(1))
      .map((shortId: string) => {
        const matchedModel = allModels.find(
          (model) => model.shortId === shortId
        );
        return matchedModel ? matchedModel.fullId : null;
      })
      .filter((model: string | null): model is string => model !== null);
  };

  const cleanInputContent = (inputContent: any): any => {
    return inputContent
      .map((item: any) => {
        if (item.type === "text" && item.text) {
          return {
            ...item,
            text: item.text.replace(/@\S+/g, "").trim(),
          };
        }
        return item;
      })
      .filter((item: any) => item.text !== "");
  };

  return {
    allModels,
    selectedModels,
    setSelectedModels,
    extractModelsFromInput,
    cleanInputContent,
  };
}
