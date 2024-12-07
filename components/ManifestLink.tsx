'use client'

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export function ManifestLink() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [manifestUrl, setManifestUrl] = useState('');

    useEffect(() => {
        const fullUrl = `${window.location.origin}${pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
        setManifestUrl(`${window.location.origin}/api/manifest.json?url=${encodeURIComponent(fullUrl)}`);
    }, [pathname, searchParams]);

    if (!manifestUrl) return null;

    return <link rel="manifest" href={manifestUrl} />
}