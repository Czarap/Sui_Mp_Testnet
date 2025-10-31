type NFTCardProps = {
    imageUrl: string;
    name?: string;
    description?: string;
    ctaLabel?: string;
    onCtaClick?: () => void;
};

function NFTCard({ imageUrl, name, description, ctaLabel, onCtaClick }: NFTCardProps) {
    return (
        <div className="nft-card">
            <div className="nft-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt={name} />
            </div>
            <div className="nft-info">
                {name && <h3 className="nft-title">{name}</h3>}
                {description && <p className="nft-desc">{description}</p>}
                {ctaLabel && (
                    <button className="button primary" onClick={onCtaClick}>
                        {ctaLabel}
                    </button>
                )}
            </div>
        </div>
    );
}

export default NFTCard;


