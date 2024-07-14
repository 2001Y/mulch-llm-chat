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
                    }
                } catch (error) {
                    console.error('ローカルストレージからの読み込みエラー:', error);
                } finally {
                    setIsLoaded(true);
                }
            }
            isInitialized.current = true;
        }
    }, [key]);

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