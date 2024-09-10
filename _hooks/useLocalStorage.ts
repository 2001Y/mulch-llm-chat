'use client';
import { useState, useEffect, useRef } from "react";

export default function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void, boolean] {
    const [storedValue, setStoredValue] = useState<T>(initialValue);
    const [isLoaded, setIsLoaded] = useState(false);
    const isInitialized = useRef(false);

    useEffect(() => {
        if (!isInitialized.current) {
            if (typeof window !== 'undefined') {
                try {
                    const item = localStorage.getItem(key);
                    if (item) {
                        setStoredValue(JSON.parse(item));
                        console.log(`ローカルストレージからキー「${key}」の値を読み込みました:`, JSON.parse(item));
                    } else {
                        // ローカルストレージにデータがない場合、initialValueを保存
                        localStorage.setItem(key, JSON.stringify(initialValue));
                        console.log(`ローカルストレージにキー「${key}」の初期値を保存しました:`, initialValue);
                    }
                } catch (error) {
                    console.error('ローカルストレージの操作エラー:', error);
                } finally {
                    setIsLoaded(true);
                }
            }
            isInitialized.current = true;
        }
    }, [key, initialValue]);

    const setValue = (value: T | ((val: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            if (typeof window !== 'undefined') {
                localStorage.setItem(key, JSON.stringify(valueToStore));
                console.log(`ローカルストレージにキー「${key}」の値を保存しました:`, valueToStore);
            }
        } catch (error) {
            console.error('ローカルストレージへの書き込みエラー:', error);
        }
    };

    return [storedValue, setValue, isLoaded];
}