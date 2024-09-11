import { Toaster } from 'sonner';

function MyApp({ Component, pageProps }) {
    return (
        <>
            <Component {...pageProps} />
            <Toaster />
        </>
    );
}

export default MyApp;