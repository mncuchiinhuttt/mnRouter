import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "motion/react";

interface OnboardingStampProps {
	className?: string;
	onImpact?: () => void;
}

export function OnboardingStamp({ className = "", onImpact }: OnboardingStampProps) {
	const { t } = useTranslation();
	const shouldReduceMotion = useReducedMotion();

	return (
		<div className={`relative select-none pointer-events-none ${className}`}>
			{/* Expanding ink shockwave on impact */}
			{!shouldReduceMotion && (
				<motion.div
					initial={{ scale: 0.6, opacity: 0.9 }}
					animate={{ scale: 1.6, opacity: 0 }}
					transition={{ delay: 0.15, duration: 0.65, ease: "easeOut" }}
					className="absolute inset-0 rounded-full border-2 border-red-600/60"
				/>
			)}

			{/* Main Rubber Stamp Graphic */}
			<motion.div
				initial={shouldReduceMotion ? { opacity: 1, rotate: -13 } : { scale: 2.6, opacity: 0, rotate: -32 }}
				animate={{ scale: 1, opacity: 0.92, rotate: -13 }}
				transition={{
					type: "spring",
					stiffness: 420,
					damping: 20,
					mass: 0.8,
					delay: 0.1,
				}}
				onAnimationComplete={onImpact}
				className="relative flex h-36 w-36 items-center justify-center rounded-full border-[3px] border-red-600 bg-red-600/[0.04] p-2 text-red-600 shadow-[0_0_20px_rgba(220,38,38,0.18)] backdrop-blur-[0.5px]"
				style={{
					maskImage: "radial-gradient(circle, black 85%, transparent 100%)",
					filter: "drop-shadow(0 2px 6px rgba(185, 28, 28, 0.35))",
				}}
			>
				{/* Inner Dotted Ring */}
				<div className="flex h-full w-full flex-col items-center justify-between rounded-full border border-dashed border-red-600/90 py-1.5 text-center font-mono">
					{/* Header Arc Label */}
					<div className="text-[8.5px] font-bold tracking-[0.22em] uppercase">
						★ MNCUCHIINHUTTT DEV ★
					</div>

					{/* Center Seal Box */}
					<div className="w-full border-y-2 border-red-600 py-1 bg-red-600/10">
						<div className="text-[13px] font-black tracking-[0.18em] uppercase leading-none">
							{t("onboarding.stampApproved", "ĐÃ PHÊ DUYỆT")}
						</div>
						<div className="text-[7.5px] font-bold tracking-[0.24em] text-red-700 uppercase mt-0.5">
							{t("onboarding.stampVerified", "VERIFIED & ISSUED")}
						</div>
					</div>

					{/* Footer Code */}
					<div className="text-[7px] font-semibold tracking-[0.16em] uppercase opacity-90">
						{t("onboarding.stampAuthority", "MNROUTER SECURITY SEAL")}
					</div>
				</div>

				{/* Distressed Stamp Noise Lines */}
				<div className="absolute inset-0 rounded-full border border-red-600/20 mix-blend-overlay pointer-events-none" />
			</motion.div>
		</div>
	);
}
