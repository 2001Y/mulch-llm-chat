"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

interface LogoProps {
  onClick?: (e: React.MouseEvent) => void;
  variant?: "sidebar" | "header";
}

export default function Logo({ onClick, variant = "sidebar" }: LogoProps) {
  return (
    <div
      className={`logo ${
        variant === "header" ? "logo--header" : "logo--sidebar"
      }`}
    >
      <Link href="/" onClick={onClick}>
        <Image
          src="/logo.png"
          width={variant === "header" ? 32 : 40}
          height={variant === "header" ? 32 : 40}
          alt="Logo"
          className="logo-img"
        />
        <h1>
          Multi AI Chat
          <small>OpenRouter Chat Client</small>
        </h1>
      </Link>
    </div>
  );
}
