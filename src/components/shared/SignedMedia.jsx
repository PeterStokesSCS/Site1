import { useState, useEffect } from "react";
import { signedUrl } from "../../lib/storage";

// Renders an image from a stored value (storage path OR legacy public URL) by resolving a
// short-lived signed URL first. Use everywhere a raw <img src={record.url}> used to be, now
// that attachments are private/org-scoped. Forwards onClick + style; shows a neutral
// placeholder (preserving layout) until the signed URL resolves.
export function SignedImage({ value, alt = "", onClick, style }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let live = true;
    setSrc(null);
    signedUrl(value).then((u) => { if (live) setSrc(u); });
    return () => { live = false; };
  }, [value]);
  if (!src) return <div onClick={onClick} aria-label={alt} style={{ background: "#111", ...style }} />;
  return <img src={src} alt={alt} onClick={onClick} style={style} />;
}

// Anchor whose href is a signed URL (for PDFs / downloads). Disabled until resolved.
export function SignedLink({ value, children, style, className }) {
  const [href, setHref] = useState(null);
  useEffect(() => {
    let live = true;
    setHref(null);
    signedUrl(value).then((u) => { if (live) setHref(u); });
    return () => { live = false; };
  }, [value]);
  return (
    <a href={href || undefined} target="_blank" rel="noreferrer" className={className}
       style={{ ...style, opacity: href ? 1 : 0.5, pointerEvents: href ? "auto" : "none" }}>
      {children}
    </a>
  );
}
