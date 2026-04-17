import { motion } from "framer-motion";
import { StarFour, CircleHalf, SquaresFour, CirclesThree, Wind, Cube } from "@phosphor-icons/react";

const LOREM_LOGOS = [
  { name: "Lorem", Icon: StarFour },
  { name: "Ipsum", Icon: CircleHalf },
  { name: "Dolor", Icon: SquaresFour },
  { name: "Sit", Icon: CirclesThree },
  { name: "Amet", Icon: Wind },
  { name: "Consectetur", Icon: Cube },
];

const GlowingOrb = () => (
  <div className="relative w-full max-w-[600px] aspect-square select-none pointer-events-none">
    {/* Inner glowing core */}
    <div className="absolute inset-4 rounded-full border-[12px] border-cyan-400/80 shadow-[0_0_120px_rgba(34,211,238,0.4),inset_0_0_80px_rgba(34,211,238,0.5)] backdrop-blur-sm" />
    {/* Refractive outer edge */}
    <div className="absolute inset-0 rounded-full border-4 border-white/30 shadow-[inset_0_0_20px_rgba(255,255,255,0.5)]" />
    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-500/10 to-cyan-300/30 blur-xl" />
  </div>
);

export function Hero() {
  return (
    <section className="relative min-h-[100dvh] w-full overflow-hidden bg-[#0a5cff] bg-gradient-to-br from-[#0a3fff] to-[#018deb]">
      {/* Noise Overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-20 mix-blend-overlay"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}
      />

      {/* Main Grid */}
      <div className="relative z-10 mx-auto grid min-h-[100dvh] max-w-[1400px] grid-cols-1 items-center gap-12 px-6 pt-32 pb-32 md:grid-cols-12 md:px-12 md:pt-24 lg:pt-0">

        {/* Left Column (Typography) */}
        <div className="col-span-1 pt-12 md:col-span-7 md:pt-0">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="font-satoshi text-[3.5rem] font-bold leading-[1.1] tracking-tight text-white md:text-6xl lg:text-[5rem] xl:text-[5.5rem]"
          >
            Smart Stake Router.<br className="hidden md:block" />
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 max-w-xl font-sans text-[20px] font-normal leading-relaxed text-white/95 md:text-[21px]"
          >
            BlueSense is an intelligent yield router on Cardano that automatically finds and allocates your ADA to the most profitable strategy.       </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="mt-12"
          >
          </motion.div>
        </div>

        {/* Right Column (Visual) */}
        <div className="relative col-span-1 flex items-center justify-center pt-10 md:col-span-5 md:pt-0 md:-ml-12 lg:-ml-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="relative w-full max-w-[500px]"
          >
            <GlowingOrb />
          </motion.div>
        </div>
      </div>

      {/* Trust Logos (Marquee) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="absolute bottom-0 left-0 right-0 z-20 w-full bg-white border-y border-gray-200"
      >
        <div className="flex overflow-hidden w-full">
          <motion.div
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
            className="flex whitespace-nowrap min-w-max items-center"
          >
            {[...LOREM_LOGOS, ...LOREM_LOGOS, ...LOREM_LOGOS, ...LOREM_LOGOS].map((item, index) => (
              <div
                key={index}
                className="flex w-[240px] items-center justify-center gap-3 border-r border-gray-200 py-6 font-satoshi text-[19px] font-bold tracking-tight text-[#555]"
              >
                <item.Icon weight="fill" className="text-[26px] text-[#888]" />
                {item.name}
              </div>
            ))}
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
