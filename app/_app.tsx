import { AppProps } from 'next/app';
import { Toaster } from 'sonner';

function MyApp({ Component, pageProps }: AppProps) {
    return (
        <>
            <Component {...pageProps} />
            <Toaster />
        </>
    );
}

export default MyApp;