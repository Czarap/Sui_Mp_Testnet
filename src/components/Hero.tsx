import { MintNFTDialog } from './MintNFTDialog';

export function Hero({ onBrowse, onAfterMint }: { onBrowse: () => void; onAfterMint: () => void }) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 pointer-events-none" />
      <div className="container relative py-12 md:py-16">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 text-blue-800 px-3 py-1 text-xs w-fit">
              <span>Built on Sui</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Discover, mint, and trade NFTs on Sui
            </h1>
            <p className="text-muted-foreground max-w-prose">
              A sleek marketplace starter with wallet integration, minting, and listing flows. Configure your
              contracts and start showcasing digital collectibles in minutes.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <MintNFTDialog onSuccess={onAfterMint} />
              <button
                className="inline-flex items-center rounded-md border border-blue-600 text-blue-600 hover:bg-blue-50 px-4 py-2 text-sm"
                onClick={onBrowse}
              >
                Browse NFTs
              </button>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="relative rounded-xl border bg-white shadow-md p-6">
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-md bg-gradient-to-br from-blue-200 to-purple-200" />
                ))}
              </div>
              <div className="mt-4 h-3 rounded bg-gray-200" />
              <div className="mt-2 h-3 w-2/3 rounded bg-gray-100" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


