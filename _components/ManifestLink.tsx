'use client'

import { usePathname, useSearchParams } from 'next/navigation';

export function ManifestLink() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const fullUrl = `${window.location.origin}${pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    const manifestUrl = `${window.location.origin}/api/manifest.json?url=${encodeURIComponent(fullUrl)}`;

    return <link rel="manifest" href={manifestUrl} />
}