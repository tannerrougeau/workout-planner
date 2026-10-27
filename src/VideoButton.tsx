import { useEffect, useRef, useState } from "react";
import { VIDEOS, videoEmbedUrl, videoSearchUrl, videoWatchUrl } from "./videos";

/** A small ▶ button: plays a hand-picked demo in a sheet, or opens a YouTube form search. */
export function VideoButton({ exercise }: { exercise: string }) {
  const id = VIDEOS[exercise];
  const [open, setOpen] = useState(false);
  const label = `Watch how to do ${exercise}`;

  if (!id) {
    return (
      <a className="icon-btn" href={videoSearchUrl(exercise)} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>
        <PlayIcon />
      </a>
    );
  }
  return (
    <>
      <button type="button" className="icon-btn" aria-label={label} title={label} onClick={() => setOpen(true)}>
        <PlayIcon />
      </button>
      {open && <VideoSheet exercise={exercise} id={id} onClose={() => setOpen(false)} />}
    </>
  );
}

function VideoSheet({ exercise, id, onClose }: { exercise: string; id: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={`${exercise} demo`}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="sheet-head">
        <h2>{exercise}</h2>
        <button type="button" className="ghost small" onClick={onClose}>Close</button>
      </div>
      <div className="video-frame">
        <iframe
          src={videoEmbedUrl(id)}
          title={`${exercise} demo video`}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
      <a className="link" href={videoWatchUrl(id)} target="_blank" rel="noopener noreferrer">Open on YouTube</a>
    </dialog>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
    </svg>
  );
}
