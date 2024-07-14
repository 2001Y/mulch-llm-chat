import { useState, useEffect, useRef } from "react";

export default function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
    const [storedValue, setStoredValue] = useState<T>(initialValue);
    const isInitialized = useRef(false);

    useEffect(() => {
        if (!isInitialized.current) {
            if (typeof window !== 'undefined') {
                try {
                    const item = localStorage.getItem(key);
                    if (item) {
                        setStoredValue(JSON.parse(item));
                    }
                } catch (error) {
                    console.error('Error reading from localStorage:', error);
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
            }
        } catch (error) {
            console.error('Error writing to localStorage:', error);
        }
    };

    return [storedValue, setValue];
}