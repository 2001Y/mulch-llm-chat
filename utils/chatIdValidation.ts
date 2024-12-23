export const validateAndNormalizeChatId = (id: string) => {
  // チャットIDのフォーマット検証
  const isValidFormat = /^[a-zA-Z0-9-_]+$/.test(id);
  if (!isValidFormat) {
    console.error("Invalid chat ID format:", id);
    return false;
  }

  // 部分的なIDマッチングの防止
  const allChatKeys = Object.keys(localStorage).filter((key) =>
    key.startsWith("chatMessages_")
  );

  const exactMatch = allChatKeys.find((key) => key === `chatMessages_${id}`);

  const partialMatches = allChatKeys.filter(
    (key) => key.includes(id) && key !== `chatMessages_${id}`
  );

  if (partialMatches.length > 0) {
    console.warn("Partial ID matches found:", {
      requestedId: id,
      partialMatches,
    });
  }

  return !!exactMatch;
};
