"use client";

import React, { useEffect } from "react"; // useState, useCallback は不要に

export interface MentionListProps {
  items: Array<{ id: string; label: string; [key: string]: any }>; // サジェスチョンアイテムの配列
  command: (item: { id: string; label: string; [key: string]: any }) => void; // アイテム選択時に実行するコマンド
  selectedIndex: number; // ★ 親から選択インデックスを受け取る
  // selectItem?: (index: number) => void; // ← props.command を使うので不要
  // handleKeyDown?: (event: KeyboardEvent) => boolean; // 親がキーイベントを処理する場合
}

export const MentionList: React.FC<MentionListProps> = ({
  items,
  command,
  selectedIndex,
}) => {
  // const [selectedIndex, setSelectedIndex] = useState(0); // 親から受け取るので不要

  // useEffect(() => setSelectedIndex(0), [items]); // 親で制御

  // const selectItem = useCallback((index: number) => { // command を直接使う
  //   const item = items[index];
  //   if (item) {
  //     command(item);
  //   }
  // }, [command, items]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mention-list">
      {items.map((item, index) => (
        <button
          key={item.id}
          className={`mention-item ${
            index === selectedIndex ? "is-selected" : ""
          }`}
          onClick={() => command(item)} // ★ 直接command(item)を呼び出す
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};

export default MentionList;
