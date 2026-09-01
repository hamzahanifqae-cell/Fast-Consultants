import './pastel-blobs.css';

type BlobSpec = {
  size: number;
  top: string;
  left?: string;
  right?: string;
  color: string;
  delay: string;
  driftY: number;
  driftX: number;
  duration: string;
  opacity: number;
};

const BLOBS: BlobSpec[] = [
  { size: 220, top: '-60px', left: '-70px', color: '#f24e68', delay: '0s', driftY: 16, driftX: 10, duration: '12s', opacity: 0.28 },
  { size: 180, top: '8%', right: '-50px', color: '#ff6b84', delay: '0.5s', driftY: 14, driftX: -8, duration: '14s', opacity: 0.22 },
  { size: 120, top: '36%', left: '22%', color: '#ffffff', delay: '1.2s', driftY: 12, driftX: 6, duration: '11s', opacity: 0.14 },
  { size: 90, top: '58%', right: '16%', color: '#ffb3c1', delay: '0.8s', driftY: 10, driftX: -5, duration: '13s', opacity: 0.18 },
  { size: 70, top: '18%', left: '48%', color: '#e02a48', delay: '1.6s', driftY: 9, driftX: 4, duration: '10s', opacity: 0.2 },
];

export function PastelBlobs() {
  return (
    <div className="pastel-blobs" aria-hidden="true">
      {BLOBS.map((blob, index) => (
        <span
          key={index}
          className="pastel-blob"
          style={{
            width: blob.size,
            height: blob.size,
            top: blob.top,
            left: blob.left,
            right: blob.right,
            backgroundColor: blob.color,
            opacity: blob.opacity,
            animationDelay: blob.delay,
            animationDuration: blob.duration,
            ['--blob-drift-y' as string]: `${blob.driftY}px`,
            ['--blob-drift-x' as string]: `${blob.driftX}px`,
          }}
        />
      ))}
    </div>
  );
}
