import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center gap-8">
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-accent-primary" />
          <span className="font-syne text-5xl font-bold text-text-primary tracking-widest">
            RRQ
          </span>
        </div>
        <p className="font-dm-mono text-sm text-text-secondary tracking-widest uppercase">
          Join Content Factory
        </p>
      </div>
      <SignUp />
    </div>
  );
}
