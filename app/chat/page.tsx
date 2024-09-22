'use client';

import { useEffect, useState } from 'react';
import '@/styles/chat.scss';
import styles from './ChatList.module.scss'; // モジュールCSSをインポート
import { useChatLogic } from '_hooks/useChatLogic'; // カスタムフックをインポート
import InputSection from '_components/InputSection';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ChatItem {
    id: string;
    title: string;
    lastMessage: string;
    timestamp: number;
}

export default function ChatListPage() {
    const {
        models,
        selectedModels,
        setSelectedModels,
        chatInput,
        setChatInput,
        isGenerating,
        setMessages, // 追加
    } = useChatLogic();

    const [chats, setChats] = useState<ChatItem[]>([]);
    const router = useRouter();

    // ローカルストレージからチャットリストを取得
    useEffect(() => {
        const chatItems: ChatItem[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('chatMessages_')) {
                const chatId = key.replace('chatMessages_', '');
                const chatData = JSON.parse(localStorage.getItem(key) || '[]');
                if (chatData.length > 0) {
                    const lastMessage = chatData[chatData.length - 1];
                    chatItems.push({
                        id: chatId,
                        title: `Chat ${chatId}`,
                        lastMessage: lastMessage.user[0]?.text || 'No messages',
                        timestamp: lastMessage.timestamp || Date.now(),
                    });
                }
            }
        }
        setChats(chatItems.sort((a, b) => b.timestamp - a.timestamp));
    }, []);

    // メッセージ送信時にチャットIDを作成し、ローカルストレージに保存してから遷移
    const handleSend = (
        event: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>,
        isPrimaryOnly = false
    ) => {
        event.preventDefault();
        if (isGenerating) return;

        // 新しいチャットIDを作成
        const newChatId = Date.now().toString();

        // 初期メッセージを作成してローカルストレージに保存
        const initialMessage = {
            user: chatInput,
            llm: selectedModels.map((model) => ({
                role: 'assistant',
                model,
                text: '',
                selected: false,
                isGenerating: true, // ここで isGenerating を true に設定
            })),
            timestamp: Date.now(),
        };

        const messages = [initialMessage];

        // ローカルストレージに保存
        localStorage.setItem(`chatMessages_${newChatId}`, JSON.stringify(messages));

        // チャットページに遷移
        router.push(`/chat/${newChatId}`);
    };

    return (
        <>
            <div className={styles.chatList}>
                <h1>Your Chats</h1>
                <ul>
                    {chats.map((chat) => (
                        <li key={chat.id}>
                            <Link href={`/chat/${chat.id}`}>
                                <div className={styles.chatItem}>
                                    <h3>{chat.title}</h3>
                                    <p>{chat.lastMessage}</p>
                                    <small>{new Date(chat.timestamp).toLocaleString()}</small>
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>

            <InputSection
                mainInput={true}
                models={models}
                chatInput={chatInput}
                setChatInput={setChatInput}
                handleSend={handleSend}
                selectedModels={selectedModels}
                setSelectedModels={setSelectedModels}
                isEditMode={false}
                messageIndex={0}
                handleResetAndRegenerate={() => { }}
                handleSaveOnly={() => { }}
                isInitialScreen={true}
                handleStopAllGeneration={() => { }}
                isGenerating={isGenerating}
            />
        </>
    );
}