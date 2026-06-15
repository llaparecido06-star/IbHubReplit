import React from "react";

const URL_RE = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)]/g;

const LINK_STYLE: React.CSSProperties = {
  color: "#c9a84c",
  textDecoration: "underline",
  wordBreak: "break-all",
  cursor: "pointer",
};

export function linkifyText(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  URL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const url = match[0];
    nodes.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={LINK_STYLE}
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>,
    );
    last = match.index + url.length;
  }
  if (last < text.length) {
    nodes.push(text.slice(last));
  }
  return nodes;
}
