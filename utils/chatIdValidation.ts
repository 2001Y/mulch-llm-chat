export const validateAndNormalizeChatId = (id: string) => {
  const decodedId = decodeURIComponent(id);
  // チャットIDのフォーマット検証
  const isValidFormat = /^[a-zA-Z0-9-_$#]+$/.test(decodedId);
  if (!isValidFormat) {
    console.error("Invalid chat ID format:", decodedId);
    return false;
  }

  // 部分的なIDマッチングの防止
  const allChatKeys = Object.keys(localStorage).filter((key) =>
    key.startsWith("chatMessages_")
  );

  const exactMatch = allChatKeys.find(
    (key) => key === `chatMessages_${decodedId}`
  );

  const partialMatches = allChatKeys.filter(
    (key) => key.includes(decodedId) && key !== `chatMessages_${decodedId}`
  );

  if (partialMatches.length > 0) {
    console.warn("Partial ID matches found:", {
      requestedId: decodedId,
      partialMatches,
    });
  }

  return !!exactMatch;
};
