"use client";
import "@/_styles/top.scss";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import useAccessToken from "_hooks/useAccessToken";

const isProduction = process.env.NODE_ENV === "production";
const redirectUri = isProduction
  ? "https://your-production-url.com"
  : "http://localhost:3000";

export default function HomePage() {
  const router = useRouter();
  const [accessToken] = useAccessToken();

  useEffect(() => {
    if (accessToken) {
      router.replace("/chat");
    }
  }, [accessToken, router]);

  const handleLogin = () => {
    const openRouterAuthUrl = `https://openrouter.ai/auth?callback_url=${redirectUri}`;
    window.location.href = openRouterAuthUrl;
  };

  return (
    <div className="page">
      {/* Header */}
      <header className="header">
        <div className="container">
          <nav className="nav">
            <Link href="/" className="logo">
              <Image
                src="/logo.png"
                width={50}
                height={50}
                alt="Multi AI Chat Logo"
              />
              <span>Multi AI Chat</span>
            </Link>
            <div className="navLinks">
              <button onClick={handleLogin} className="loginButton">
                Login with OpenRouter
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {/* Hero Section */}
        <section className="hero">
          <div className="container">
            <div className="heroContent">
              <h1>Collaborate with Multiple AI Models</h1>
              <p>
                Unlock the power of AI collaboration. Compare responses,
                customize your experience, and enhance your productivity.
              </p>
              <div className="ctaButtons">
                <button onClick={handleLogin} className="btn primary">
                  Start Chatting
                </button>
                <Link href="/demo" className="btn secondary">
                  Try Demo
                </Link>
              </div>
            </div>
            <div className="heroImage">
              <Image
                src="/hero-screenshot.png"
                alt="Multi AI Chat Interface"
                width={800}
                height={450}
              />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="features">
          <div className="container">
            <div className="featureList">
              <div className="feature">
                <Image
                  src="/feature-models.png"
                  alt="Multiple AI Models"
                  width={500}
                  height={300}
                />
                <h2>Choose from Multiple AI Models</h2>
                <p>
                  Access a wide range of AI models from OpenRouter without any
                  monthly subscription.
                </p>
              </div>
              <div className="feature">
                <Image
                  src="/feature-collaborate.png"
                  alt="AI Collaboration"
                  width={500}
                  height={300}
                />
                <h2>Collaborate with AI</h2>
                <p>
                  Compare responses from different models and let AI summarize
                  or continue conversations.
                </p>
              </div>
              <div className="feature">
                <Image
                  src="/feature-customize.png"
                  alt="Customization"
                  width={500}
                  height={300}
                />
                <h2>Customize Your Experience</h2>
                <p>
                  Add your own function calls and tools to enhance AI
                  capabilities with your APIs.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="howItWorks">
          <div className="container">
            <h2>Start Chatting in 4 Easy Steps</h2>
            <div className="steps">
              <div className="step">
                <div className="stepNumber">1</div>
                <h3>Login with OpenRouter</h3>
                <p>Use your OpenRouter account for seamless access.</p>
              </div>
              <div className="step">
                <div className="stepNumber">2</div>
                <h3>Select AI Models</h3>
                <p>Choose from a variety of AI models for your conversation.</p>
              </div>
              <div className="step">
                <div className="stepNumber">3</div>
                <h3>Start Your Conversation</h3>
                <p>Begin chatting and see responses from multiple AIs.</p>
              </div>
              <div className="step">
                <div className="stepNumber">4</div>
                <h3>Collaborate and Customize</h3>
                <p>
                  Compare responses, add custom tools, and enhance your AI
                  experience.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <p>
            &copy; {new Date().getFullYear()} Multi AI Chat. All rights
            reserved.
          </p>
          <div className="socialLinks">
            <a href="#" aria-label="Twitter">
              <Image
                src="/icon-twitter.svg"
                width={24}
                height={24}
                alt="Twitter"
              />
            </a>
            <a href="#" aria-label="GitHub">
              <Image
                src="/icon-github.svg"
                width={24}
                height={24}
                alt="GitHub"
              />
            </a>
            <a href="#" aria-label="LinkedIn">
              <Image
                src="/icon-linkedin.svg"
                width={24}
                height={24}
                alt="LinkedIn"
              />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
