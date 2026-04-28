/**
 * MentionTextArea — textarea with @mention autocomplete for web.
 *
 * When the user types "@" followed by characters, a floating suggestion panel
 * appears above or below the textarea. Selecting a suggestion replaces the
 * partial @query with "@username ".
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { searchUsersForMention, type MentionSuggestion } from "@/services/api";

const GOLD  = "#c9a84c";
const NAVY  = "#0d1b2a";
const MUTED = "#7a8494";
const WHITE = "#ffffff";
const BG    = "#f5f5f0";
const BORDER = "#e8e8e3";

interface MentionTextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
}

function Avatar({ src, name, size = 32 }: { src?: string | null; name: string; size?: number }) {
  const initials = (name || "?").split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: NAVY, color: WHITE,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.34, fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

export function MentionTextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
  autoFocus,
  disabled,
  style,
}: MentionTextAreaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const extractQuery = useCallback((text: string, pos: number): string | null => {
    const before = text.slice(0, pos);
    const match = before.match(/@([\w.]*)$/);
    return match ? match[1] : null;
  }, []);

  const triggerSearch = useCallback((query: string | null) => {
    setMentionQuery(query);
    setActiveIndex(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query === null) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const results = await searchUsersForMention(query);
      setSuggestions(results);
      setLoading(false);
    }, 200);
  }, []);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    const pos = e.target.selectionStart ?? 0;
    triggerSearch(extractQuery(e.target.value, pos));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!suggestions.length || mentionQuery === null) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" || e.key === "Tab") {
      if (suggestions[activeIndex]) { e.preventDefault(); applySuggestion(suggestions[activeIndex]); }
    } else if (e.key === "Escape") {
      setSuggestions([]); setMentionQuery(null);
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const pos = ref.current?.selectionStart ?? 0;
      triggerSearch(extractQuery(value, pos));
    }
  };

  const applySuggestion = (s: MentionSuggestion) => {
    const pos = ref.current?.selectionStart ?? value.length;
    const before = value.slice(0, pos).replace(/@([\w.]*)$/, `@${s.username} `);
    const after = value.slice(pos);
    onChange(before + after);
    setSuggestions([]);
    setMentionQuery(null);
    setTimeout(() => {
      ref.current?.focus();
      const newPos = before.length;
      ref.current?.setSelectionRange(newPos, newPos);
    }, 10);
  };

  const showSuggestions = mentionQuery !== null && (loading || suggestions.length > 0);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Suggestion panel — shown above the textarea */}
      {showSuggestions && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 4px)", left: 0, right: 0, zIndex: 1000,
          background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", overflow: "hidden", maxHeight: 240,
        }}>
          {loading && suggestions.length === 0 ? (
            <div style={{ padding: "12px 16px", color: MUTED, fontSize: 13, textAlign: "center" }}>Buscando…</div>
          ) : suggestions.map((s, i) => (
            <div
              key={s.id}
              onMouseDown={e => { e.preventDefault(); applySuggestion(s); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 14px", cursor: "pointer",
                background: i === activeIndex ? `${GOLD}12` : WHITE,
                borderBottom: i < suggestions.length - 1 ? `1px solid ${BORDER}` : "none",
              }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <Avatar src={s.avatar_url} name={s.display_name} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, display: "flex", alignItems: "center", gap: 5 }}>
                  {s.display_name}
                  {s.type === "company" && (
                    <span style={{ fontSize: 10, background: `${GOLD}20`, color: GOLD, borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>Empresa</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: MUTED }}>@{s.username}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <textarea
        ref={ref}
        className="mention-textarea"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onClick={() => {
          const pos = ref.current?.selectionStart ?? 0;
          triggerSearch(extractQuery(value, pos));
        }}
        placeholder={placeholder}
        rows={rows}
        autoFocus={autoFocus}
        disabled={disabled}
        style={{
          width: "100%",
          boxSizing: "border-box",
          border: `1px solid ${BORDER}`,
          borderRadius: 10,
          padding: "12px 14px",
          fontSize: 14,
          color: NAVY,
          lineHeight: 1.65,
          resize: "none",
          outline: "none",
          fontFamily: "inherit",
          background: disabled ? BG : WHITE,
          ...style,
        }}
      />
    </div>
  );
}
