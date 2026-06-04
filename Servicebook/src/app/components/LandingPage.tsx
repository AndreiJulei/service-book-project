import { useNavigate } from "react-router";
import { ImageWithFallback } from "./figma/ImageWithFallback";

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#013220]">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1653213096326-4e3854c6fcc2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBhcHBvaW50bWVudCUyMHNjaGVkdWxpbmclMjBwbGFubmVyJTIwZGVza3xlbnwxfHx8fDE3NzQ1NTc2MTB8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
          alt="ServiceBook Environment"
          className="w-full h-full object-cover"
        />
        {/* Dark Overlay for Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#013220]/80 via-[#013220]/70 to-[#013220]/90" />
      </div>

      {/* Content Container */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-12">
        {/* Logo */}
        <div className="mb-8">
          <svg
            width="120"
            height="120"
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-2xl"
          >
            {/* Outer Circle */}
            <circle
              cx="60"
              cy="60"
              r="58"
              stroke="#D4AF37"
              strokeWidth="2"
              fill="none"
              opacity="0.6"
            />
            
            {/* Book Cover - Front */}
            <rect
              x="40"
              y="30"
              width="45"
              height="60"
              rx="3"
              fill="#F5F5DC"
            />
            
            {/* Book Spine/Edge */}
            <path
              d="M 40 30 L 35 33 L 35 87 L 40 90 Z"
              fill="#D4AF37"
            />
            
            {/* Simple "S" on Book Cover */}
            <text
              x="62.5"
              y="70"
              fontFamily="serif"
              fontSize="40"
              fontWeight="700"
              fill="#013220"
              textAnchor="middle"
            >
              S
            </text>
            
            {/* Decorative Lines on Book */}
            <line
              x1="45"
              y1="40"
              x2="80"
              y2="40"
              stroke="#D4AF37"
              strokeWidth="1.5"
              opacity="0.5"
            />
            <line
              x1="45"
              y1="80"
              x2="80"
              y2="80"
              stroke="#D4AF37"
              strokeWidth="1.5"
              opacity="0.5"
            />
          </svg>
        </div>

        {/* App Name */}
        <h1 className="text-7xl mb-4 text-[#F5F5DC] text-center tracking-wide font-serif">
          ServiceBook
        </h1>

        {/* Tagline */}
        <p className="text-2xl text-[#D4AF37] italic mb-8 text-center font-serif opacity-90">
          Master Your Time. Scale Your Success.
        </p>

        {/* Description */}
        <p className="text-lg text-[#F5F5DC]/90 max-w-2xl text-center leading-relaxed mb-16 px-8">
          The premier digital ecosystem for high-end service management. 
          Experience a new standard of booking where predictive reliability 
          meets intelligent logistics.
        </p>

        {/* CTA Button */}
        <button
          onClick={() => navigate("/auth")}
          className="
            px-12 py-5
            bg-[#013220] 
            text-[#F5F5DC] 
            rounded-[32px]
            text-xl
            font-medium
            shadow-2xl
            hover:shadow-[0_20px_60px_rgba(212,175,55,0.3)]
            hover:scale-105
            transition-all 
            duration-300
            border-2
            border-[#D4AF37]
            hover:border-[#F5F5DC]
            hover:bg-[#013220]/90
            backdrop-blur-sm
          "
        >
          Begin Your Booking Journey
        </button>

        {/* Decorative Bottom Accent */}
        <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 flex gap-2">
          <div className="w-2 h-2 rounded-full bg-[#D4AF37] opacity-60" />
          <div className="w-2 h-2 rounded-full bg-[#D4AF37] opacity-40" />
          <div className="w-2 h-2 rounded-full bg-[#D4AF37] opacity-20" />
        </div>
      </div>
    </div>
  );
}