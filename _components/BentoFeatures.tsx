import "@/_styles/bento.scss";
import { useEffect, useRef, useState, useCallback, memo } from "react";

const initialFeatures1 = [
  {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    title: "Multiple LLMs in One Chat",
    description:
      "Chat simultaneously with GPT, Claude, Gemini, CommandR+, Llama, Qwen, and more. Get diverse perspectives and leverage each model's unique strengths in a single conversation.",
  },
  {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    title: "Choose the Best Response",
    description:
      "Compare responses from multiple AI models and select the most suitable answer to continue your conversation. Enhance your chat experience by picking the best insights.",
  },
  {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <path d="M12 6v8" />
        <path d="M8 10h8" />
      </svg>
    ),
    title: "Custom Function Calls",
    description:
      "Automate tasks and integrate with external APIs through natural conversation. Execute complex operations like data processing and service integrations seamlessly.",
  },
  {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
    title: "Edit AI Responses",
    description:
      "Fine-tune AI responses to match your needs. Edit and adjust the content for accuracy and context, creating the perfect conversation flow.",
  },
  {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
      </svg>
    ),
    title: "Share & Sync with GitHub",
    description:
      "Share and synchronize your chat history using GitHub Gist. Enable seamless access across devices and secure backups of your conversations (Coming Soon).",
  },
];

const initialFeatures2 = [
  {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    title: "No Subscription Required",
    description:
      "Pay only for what you use with OpenRouter's usage-based pricing. No subscription commitments, complete flexibility in how you use the service.",
  },
  {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
        <path d="M1.42 9a16 16 0 0 1 21.16 0" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <circle cx="12" cy="20" r="1" />
      </svg>
    ),
    title: "No Installation Needed",
    description:
      "Start using instantly as a PWA (Progressive Web App) on both PC and mobile devices. Access the full feature set without any installation process.",
  },
  {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    title: "No Cloud Storage",
    description:
      "All conversation data is stored locally in your browser. Maintain your privacy and keep your data safe, even after service discontinuation.",
  },
];

function BentoGrid({
  features: initialFeatures,
  index,
  onVisible,
}: {
  features: typeof initialFeatures1;
  index: number;
  onVisible: () => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const initialScrollSetRef = useRef(false);

  // 初期スクロール位置を中央に設定
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || initialScrollSetRef.current) return;

    // グリッドアイテムの幅を取得
    const gridItem = grid.querySelector(".bento-item");
    if (!gridItem) return;
    const itemWidth = gridItem.clientWidth;

    // 中央のセットにスクロー�� + アイテム幅の半分をオフセット
    let middleSetPosition = grid.scrollWidth / 3 - itemWidth / 2;

    // 奇数番目のグリッドの場合、さらにアイテム幅の半分を追加
    if (index % 2 === 1) {
      middleSetPosition += itemWidth / 2;
    }

    grid.scrollLeft = middleSetPosition;
    initialScrollSetRef.current = true;

    // スクロール位置設定後に表示する
    setIsVisible(true);
    onVisible(); // 親コンポーネントにも通知
  }, [index, onVisible]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    // スクロールアニメーション
    const scrollInterval = setInterval(() => {
      if (!isPaused) {
        grid.scrollLeft += 1;

        // スクロール位置が最後のセットに近づいたら中央セットに戻す
        if (grid.scrollLeft >= (grid.scrollWidth * 2) / 3) {
          grid.scrollLeft = grid.scrollWidth / 3;
        }
        // スクロール位置が最初のセットに近づいたら中央セットに戻す
        else if (grid.scrollLeft <= grid.scrollWidth / 6) {
          grid.scrollLeft = grid.scrollWidth / 3;
        }
      }
    }, 30);

    // マウスイベントの処理
    const handleMouseEnter = () => setIsPaused(true);
    const handleMouseLeave = () => setIsPaused(false);

    grid.addEventListener("mouseenter", handleMouseEnter);
    grid.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      clearInterval(scrollInterval);
      grid.removeEventListener("mouseenter", handleMouseEnter);
      grid.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [isPaused]);

  return (
    <div className={`grid ${isVisible ? "visible" : ""}`} ref={gridRef}>
      {[...initialFeatures, ...initialFeatures, ...initialFeatures].map(
        (feature, index) => (
          <div key={index} className="bento-item">
            <div className="icon">{feature.icon}</div>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        )
      )}
    </div>
  );
}

const BentoFeatures = memo(function BentoFeatures() {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <section className={`bento-grid ${isVisible ? "visible" : ""}`}>
      <div className="bento-features-wrapper">
        <h2>Explore Features</h2>
        <BentoGrid
          features={initialFeatures1}
          index={0}
          onVisible={() => setIsVisible(true)}
        />
        <BentoGrid
          features={initialFeatures2}
          index={1}
          onVisible={() => setIsVisible(true)}
        />
      </div>
    </section>
  );
});

export default BentoFeatures;
