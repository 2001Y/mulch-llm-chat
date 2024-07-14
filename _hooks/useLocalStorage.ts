import { useState, useEffect, useRef } from "react";

export default function useLocalStorage(key, initialValue) {
    const [storedValue, setStoredValue] = useState(initialValue);
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

    const setValue = (value) => {
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
};