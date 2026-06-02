import Link from "next/link";

export const metadata = {
  title: "How Axion works",
};

function Block({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel p-7">
      <div className="label mb-2">{eyebrow}</div>
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-[var(--muted)]">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="label mb-2">How it works</div>
        <h1 className="font-display text-4xl font-extrabold">
          A wallet that <span className="gradient-text">proves how it thinks</span>
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-[var(--muted)]">
          Axion is a self-evolving agentic wallet on Mantle. It commits its decision paths before
          acting, executes through approved skills, verifies outcomes, and turns every result into
          on-chain memory and strategy evolution.
        </p>
      </div>

      <Block eyebrow="Pre-commitment" title="Why committing first matters">
        <p>
          A post-action explanation is unfalsifiable: an agent can always describe its choice in
          whatever light flatters the result. Axion removes that freedom. Before it touches any
          funds it builds a full decision tree, hashes each branch and the tree as a whole, and
          commits those hashes — locally or on Mantle.
        </p>
        <p>
          Once committed, the prediction is frozen. When the outcome arrives, Axion is judged
          against the forecast it could not edit. That is the difference between a wallet that
          explains itself and a wallet that can prove itself.
        </p>
      </Block>

      <Block eyebrow="Judging" title="Why post-action explanations are not enough">
        <p>
          Most AI wallets act first and narrate later. Users cannot verify what the agent predicted,
          what options it weighed, what risks it dismissed, or whether it actually learned. Axion
          compares the realised yield and slippage against the committed prediction and assigns a
          verdict: Correct, Partially correct, Wrong, Rejected safely, or Unsafe blocked.
        </p>
        <p>
          A safe rejection is a first-class success. When no branch clears the policy, refusing to
          act is the correct move and is scored as such.
        </p>
      </Block>

      <Block eyebrow="EchoForge" title="What “forging” means">
        <p>
          Forging is how a verified outcome rewrites the agent. After each epoch, EchoForge nudges
          the strategy weights — slippage tolerance, risk weight, source confidence, approval
          safety — based on what actually happened, and increments the strategy version.
        </p>
        <p>
          The trust score moves with the verdict and, in turn, sets the wallet&apos;s permission
          level: read-only, suggest-only, execute low-value, or higher autonomy. Memory is not
          cosmetic; it changes what the wallet is allowed to do next.
        </p>
      </Block>

      <Block eyebrow="ERC-8004" title="How identity and memory are used">
        <p>
          Axion models its identity in the spirit of ERC-8004: a registered agent with an owner,
          metadata URI, strategy version, trust score and a memory root. Each judged epoch chains
          the previous memory root with the epoch hash, producing an append-only history. Rewriting
          a past epoch would break the chain, so the timeline is tamper-evident by construction.
        </p>
      </Block>

      <Block eyebrow="Mantle" title="Where commitments and epochs live">
        <p>
          Axion targets Mantle&apos;s low-cost EVM environment. Three contracts carry the lifecycle:
          AxionAgentRegistry (identity, trust, memory root, strategy version),
          DecisionCommitmentLog (pre-execution tree commitments), and EpochMemoryLog (judged epochs
          with verdict and score). An optional AxionPolicyVault enforces spend, slippage and
          approval rules on-chain.
        </p>
        <p>
          The app runs fully in local demo mode with no wallet or contracts. Configure the contract
          addresses and connect a wallet and the exact same lifecycle writes to Mantle instead.
        </p>
      </Block>

      <section className="panel p-7">
        <div className="label mb-2">Honesty</div>
        <h2 className="font-display text-2xl font-bold">What is real and what is simulated</h2>
        <ul className="mt-3 space-y-2 text-[var(--muted)]">
          <li>
            <strong className="text-[var(--text)]">Real:</strong> the lifecycle, deterministic
            hashing, judging logic, strategy forging, trust/permission updates, memory-root chaining
            and local persistence.
          </li>
          <li>
            <strong className="text-[var(--text)]">Simulated and labelled:</strong> the DeFi yield
            routes and their outcomes, so the demo is reliable without live protocol risk.
          </li>
          <li>
            <strong className="text-[var(--text)]">Swappable:</strong> skill execution runs through a
            ByrealSkillAdapter; the local adapter can be replaced with a real Byreal Skills backend
            without changing the lifecycle.
          </li>
        </ul>
        <Link href="/console" className="btn btn-primary mt-6 inline-flex px-6 py-3">
          Try the lifecycle →
        </Link>
      </section>
    </div>
  );
}
