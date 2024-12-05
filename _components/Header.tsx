import Image from "next/image";
import { useRouter } from "next/navigation";
import useAccessToken from "_hooks/useAccessToken";
import Link from "next/link";

interface HeaderProps {
  setIsModalOpen: (isOpen: boolean) => void;
  isLoggedIn: boolean;
}

export default function Header({ setIsModalOpen, isLoggedIn }: HeaderProps) {
  const router = useRouter();
  const [accessToken, setAccessToken] = useAccessToken();

  const handleLogout = () => {
    setAccessToken("");
  };

  return (
    <header>
      <div className="logo">
        <Link href="/">
          <Image
            src="/logo.png"
            width={40}
            height={40}
            alt="Logo"
            className="logo-img"
          />
          <h1>
            Multi AI Chat
            <br />
            <small>OpenRouter Chat Client</small>
          </h1>
        </Link>
      </div>
      <div className="header-side">
        {isLoggedIn ? (
          <button onClick={handleLogout}>Logout</button>
        ) : (
          <button onClick={() => router.push("/login")} className="login">
            Login
          </button>
        )}
        <div onClick={() => setIsModalOpen(true)} className="setting">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0 .33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </div>
      </div>
      {!isLoggedIn && <div className="free-version">Free Version</div>}
    </header>
  );
}
